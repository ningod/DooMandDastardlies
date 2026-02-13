import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { v4 as uuidv4 } from "uuid";
import { parseDice, rollDice, DiceParseError } from "../lib/dice.js";
import { RollStore } from "../lib/store.js";
import { RateLimiter } from "../lib/ratelimit.js";
import { buildRollEmbed, buildErrorEmbed, buildSecretRollAnnouncementEmbed } from "../lib/embeds.js";
import { logger } from "../lib/logger.js";

/** Build the /roll slash command definition. */
export const rollCommandData = new SlashCommandBuilder()
  .setName("roll")
  .setDescription("Roll dice behind the screen (DooM & Dastardlies)")
  .addStringOption((opt) =>
    opt
      .setName("dice")
      .setDescription('Dice expression, e.g. "2d6", "1d4+1d8", "d20"')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("reason")
      .setDescription('Optional reason for the roll, e.g. "attack"')
      .setRequired(false)
  )
  .addBooleanOption((opt) =>
    opt
      .setName("secret")
      .setDescription("Roll secretly? Default: true (only you see the result)")
      .setRequired(false)
  );

/**
 * Handle the /roll interaction.
 */
export async function handleRollCommand(
  interaction: ChatInputCommandInteraction,
  store: RollStore,
  limiter: RateLimiter
): Promise<void> {
  // Defer is already done in index.ts - we can safely process
  const userId = interaction.user.id;
  const secret = interaction.options.getBoolean("secret") ?? true;

  // Rate limit check
  if (!limiter.consume(userId)) {
    const retryAfter = limiter.retryAfterSeconds(userId);
    await interaction.editReply({
      embeds: [
        buildErrorEmbed(
          `You're rolling too fast! Please wait **${retryAfter}** second(s) before rolling again.`
        ),
      ],
    });
    return;
  }

  const diceInput = interaction.options.getString("dice", true);
  const reason = interaction.options.getString("reason") ?? null;

  logger.info("roll-parsing", {
    userId,
    diceInput,
    reason,
    secret,
    channelId: interaction.channelId,
  });

  // Parse the dice expression
  let groups;
  try {
    groups = parseDice(diceInput);
  } catch (err) {
    const message =
      err instanceof DiceParseError
        ? err.message
        : "Failed to parse dice expression.";
    await interaction.editReply({
      embeds: [buildErrorEmbed(message)],
    });
    return;
  }

  // Roll the dice
  const result = rollDice(groups);

  // Log metadata only (not the roll values for secret rolls)
  logger.info("roll-complete", {
    userId,
    expression: result.expression,
    total: result.total,
    secret,
    channelId: interaction.channelId,
  });

  if (!secret) {
    // Public roll — reply publicly
    const embed = buildRollEmbed({
      result,
      reason,
      rollerTag: interaction.user.tag,
      rollerId: userId,
      isRevealed: true,
    });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Secret roll — send public announcement + ephemeral result
  const rollId = uuidv4();

  // Build the reveal button
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`reveal:${rollId}`)
      .setLabel("Reveal Result")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🎲")
  );

  // Step 1: Send PUBLIC announcement to channel (no results shown)
  const announcementEmbed = buildSecretRollAnnouncementEmbed({
    expression: result.expression,
    reason,
    rollerId: userId,
  });

  const channel = interaction.channel;
  if (!channel || !('send' in channel)) {
    await interaction.editReply({
      embeds: [buildErrorEmbed("Unable to send messages in this channel.")],
    });
    return;
  }

  const publicMessage = await channel.send({
    embeds: [announcementEmbed],
    components: [row],
  });

  // Step 2: Send EPHEMERAL result to the roller
  const resultEmbed = buildRollEmbed({
    result,
    reason,
    rollerTag: interaction.user.tag,
    rollerId: userId,
    isRevealed: false,
  });

  await interaction.editReply({
    embeds: [resultEmbed],
  });

  // Step 3: Store the roll with public message ID
  store.set({
    rollId,
    userId,
    channelId: interaction.channelId,
    result,
    reason,
    rolledAt: new Date(),
    publicMessageId: publicMessage.id,
    rollerTag: interaction.user.tag,
  });

  // Debug: confirm storage
  logger.info("roll-stored", {
    rollId,
    userId,
    channelId: interaction.channelId,
    publicMessageId: publicMessage.id,
    storeSize: store.size,
  });
}
