import {
  ButtonInteraction,
  MessageFlags,
} from 'discord.js';
import { IRollStore } from '../lib/store-interface.js';
import { buildRollEmbed, buildErrorEmbed, buildRevealEmbed } from '../lib/embeds.js';
import { logger } from '../lib/logger.js';

/**
 * Handle all button interactions.
 *
 * Custom IDs follow the pattern: "reveal:<rollId>"
 */
export async function handleButton(interaction: ButtonInteraction, store: IRollStore): Promise<void> {
  const customId = interaction.customId;

  if (!customId.startsWith('reveal:')) {
    // Unknown button — ignore silently
    return;
  }

  // Defer is already done in index.ts - we can safely process
  const rollId = customId.slice('reveal:'.length);
  const userId = interaction.user.id;

  logger.info('reveal-attempt', {
    rollId,
    userId,
    userTag: interaction.user.tag,
    channelId: interaction.channelId,
    storeSize: await store.size,
  });

  // Look up the stored roll
  const stored = await store.get(rollId);

  if (!stored) {
    // Expired or already revealed
    logger.info('reveal-failed', {
      userId,
      rollId,
      reason: 'not-found-or-expired',
      channelId: interaction.channelId,
    });
    await interaction.followUp({
      embeds: [
        buildErrorEmbed(
          'This roll has expired or was already revealed. Please roll again with `/roll`.'
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Authorization: only the original roller can reveal
  if (stored.userId !== userId) {
    logger.info('reveal-denied-wrong-user', {
      rollId,
      storedUserId: stored.userId,
      attemptUserId: userId,
      channelId: interaction.channelId,
    });
    await interaction.followUp({
      embeds: [buildErrorEmbed('Only the person who rolled can reveal this result.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Channel check: prevent cross-channel replay
  if (stored.channelId !== interaction.channelId) {
    logger.info('reveal-denied-wrong-channel', {
      rollId,
      userId,
      storedChannelId: stored.channelId,
      attemptChannelId: interaction.channelId,
    });
    await interaction.followUp({
      embeds: [
        buildErrorEmbed('This roll belongs to a different channel and cannot be revealed here.'),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  logger.info('reveal-authorized', {
    rollId,
    userId,
    channelId: interaction.channelId,
  });

  const channel = interaction.channel;
  if (!channel || !('send' in channel)) {
    await interaction.followUp({
      embeds: [buildErrorEmbed("Unable to send messages in this channel.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Build the reveal embed with revealer info
  const revealEmbed = buildRevealEmbed({
    result: stored.result,
    comment: stored.comment,
    rollerTag: stored.rollerTag,
    rollerId: stored.userId,
    revealerTag: interaction.user.tag,
    revealerId: userId,
  });

  // Edit the original public message to show the results
  try {
    logger.info('reveal-editing-public-message', {
      rollId,
      userId,
      revealerId: userId,
      publicMessageId: stored.publicMessageId,
      channelId: interaction.channelId,
    });

    const publicMessage = await channel.messages.fetch(stored.publicMessageId);
    await publicMessage.edit({
      embeds: [revealEmbed],
      components: [], // Remove the button
    });

    logger.info('reveal-edited-public-message', {
      rollId,
      userId,
      channelId: interaction.channelId,
    });
  } catch (err) {
    // Handle permission errors gracefully
    if (err instanceof Error && err.message.includes('Missing Permissions')) {
      logger.info('reveal-failed-permissions', {
        rollId,
        userId,
        channelId: interaction.channelId,
      });
      await interaction.followUp({
        embeds: [
          buildErrorEmbed(
            "I don't have permission to edit messages in this channel. Please ask a server admin to grant me the appropriate permissions."
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    // If we can't fetch/edit the original message, log the error
    logger.info('reveal-failed-edit-public-message', {
      rollId,
      userId,
      publicMessageId: stored.publicMessageId,
      error: err instanceof Error ? err.message : String(err),
    });
    await interaction.followUp({
      embeds: [
        buildErrorEmbed(
          'Failed to reveal the roll. The original message may have been deleted.'
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Update the ephemeral message with confirmation
  const ephemeralEmbed = buildRollEmbed({
    result: stored.result,
    comment: stored.comment,
    rollerTag: stored.rollerTag,
    rollerId: stored.userId,
    isRevealed: true,
  });

  await interaction.editReply({
    embeds: [ephemeralEmbed],
  });

  // Remove from store to prevent duplicate reveals
  await store.delete(rollId);

  logger.info('reveal', {
    userId,
    rollId,
    revealerId: userId,
    channelId: interaction.channelId,
  });
}
