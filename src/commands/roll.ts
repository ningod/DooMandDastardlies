import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import { parseDice, rollDice, DiceParseError } from '../lib/dice.js';
import { RollStore } from '../lib/store.js';
import { RateLimiter } from '../lib/ratelimit.js';
import {
  buildRollEmbed,
  buildErrorEmbed,
  buildSecretRollAnnouncementEmbed,
  MAX_COMMENT_LENGTH,
} from '../lib/embeds.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Shared option builders
// ---------------------------------------------------------------------------

function addDiceOption(builder: SlashCommandBuilder): SlashCommandBuilder {
  return builder.addStringOption((opt) =>
    opt
      .setName('dice')
      .setDescription('Dice expression, e.g. "2d6", "(Verve) 2d20 + (Damage) 1d8"')
      .setRequired(true)
  ) as SlashCommandBuilder;
}

function addCommentOption(builder: SlashCommandBuilder): SlashCommandBuilder {
  return builder.addStringOption((opt) =>
    opt
      .setName('comment')
      .setDescription('Optional comment, e.g. "Greatsword swing"')
      .setRequired(false)
  ) as SlashCommandBuilder;
}

function addSecretOption(builder: SlashCommandBuilder, description: string): SlashCommandBuilder {
  return builder.addBooleanOption((opt) =>
    opt.setName('secret').setDescription(description).setRequired(false)
  ) as SlashCommandBuilder;
}

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------

/** /roll — public by default */
export const rollCommandData = addSecretOption(
  addCommentOption(
    addDiceOption(
      new SlashCommandBuilder().setName('roll').setDescription('Roll dice (public by default)')
    )
  ),
  'Roll secretly? Default: false'
);

/** /r — alias for /roll */
export const rCommandData = addSecretOption(
  addCommentOption(
    addDiceOption(
      new SlashCommandBuilder().setName('r').setDescription('Roll dice (shortcut for /roll)')
    )
  ),
  'Roll secretly? Default: false'
);

/** /secret — secret by default */
export const secretCommandData = addSecretOption(
  addCommentOption(
    addDiceOption(
      new SlashCommandBuilder()
        .setName('secret')
        .setDescription('Roll dice secretly (only you see the result)')
    )
  ),
  'Roll publicly instead? Default: true (secret)'
);

/** /s — alias for /secret */
export const sCommandData = addSecretOption(
  addCommentOption(
    addDiceOption(
      new SlashCommandBuilder()
        .setName('s')
        .setDescription('Roll dice secretly (shortcut for /secret)')
    )
  ),
  'Roll publicly instead? Default: true (secret)'
);

/** All roll-type command names. */
export const ROLL_COMMAND_NAMES = new Set(['roll', 'r', 'secret', 's']);

/** Commands where secret defaults to true. */
const SECRET_DEFAULT_COMMANDS = new Set(['secret', 's']);

// ---------------------------------------------------------------------------
// Mention suppression for comments
// ---------------------------------------------------------------------------

/** Strip @everyone, @here, and <@...> mention patterns from user input. */
function sanitizeComment(raw: string): string {
  return raw
    .replace(/@everyone/gi, '@\u200Beveryone')
    .replace(/@here/gi, '@\u200Bhere')
    .replace(/<@[!&]?\d+>/g, '[mention]')
    .replace(/<#\d+>/g, '[channel]')
    .replace(/<@&\d+>/g, '[role]');
}

// ---------------------------------------------------------------------------
// Shared handler
// ---------------------------------------------------------------------------

/**
 * Handle /roll, /r, /secret, /s interactions.
 */
export async function handleRollCommand(
  interaction: ChatInputCommandInteraction,
  store: RollStore,
  limiter: RateLimiter
): Promise<void> {
  const userId = interaction.user.id;
  const commandName = interaction.commandName;
  const secretDefault = SECRET_DEFAULT_COMMANDS.has(commandName);
  const secret = interaction.options.getBoolean('secret') ?? secretDefault;

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

  const diceInput = interaction.options.getString('dice', true);
  const rawComment = interaction.options.getString('comment') ?? null;

  // Validate and sanitize comment
  let comment: string | null = null;
  if (rawComment) {
    if (rawComment.length > MAX_COMMENT_LENGTH) {
      await interaction.editReply({
        embeds: [
          buildErrorEmbed(
            `Comment is too long (max ${MAX_COMMENT_LENGTH} characters). You used ${rawComment.length}.`
          ),
        ],
      });
      return;
    }
    comment = sanitizeComment(rawComment);
  }

  logger.info('roll-parsing', {
    userId,
    diceInput,
    secret,
    channelId: interaction.channelId,
  });

  // Parse the dice expression
  let groups;
  try {
    groups = parseDice(diceInput);
  } catch (err) {
    const message =
      err instanceof DiceParseError ? err.message : 'Failed to parse dice expression.';
    await interaction.editReply({
      embeds: [buildErrorEmbed(message)],
    });
    return;
  }

  // Roll the dice
  const result = rollDice(groups);

  logger.info('roll-complete', {
    userId,
    expression: result.expression,
    secret,
    channelId: interaction.channelId,
  });

  if (!secret) {
    // Public roll — reply publicly
    const embed = buildRollEmbed({
      result,
      comment,
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
      .setLabel('Reveal Result')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎲')
  );

  // Step 1: Send PUBLIC announcement to channel (no results shown)
  const announcementEmbed = buildSecretRollAnnouncementEmbed({
    expression: result.expression,
    comment,
    rollerId: userId,
  });

  const channel = interaction.channel;
  if (!channel || !('send' in channel)) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('Unable to send messages in this channel.')],
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
    comment,
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
    comment,
    rolledAt: new Date(),
    publicMessageId: publicMessage.id,
    rollerTag: interaction.user.tag,
  });

  logger.info('roll-stored', {
    rollId,
    userId,
    channelId: interaction.channelId,
    publicMessageId: publicMessage.id,
    storeSize: store.size,
  });
}
