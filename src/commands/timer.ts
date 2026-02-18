import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { TimerParseError } from '../lib/timer-store.js';
import type { ITimerStore, TimerInstance, TimerCompleteReason } from '../lib/store-interface.js';
import type { RateLimiter } from '../lib/ratelimit.js';
import {
  buildTimerTriggerEmbed,
  buildTimerCompleteEmbed,
  buildTimerStartedEmbed,
  buildTimerStoppedEmbed,
  buildTimerListEmbed,
} from '../lib/timer-embeds.js';
import { buildErrorEmbed } from '../lib/embeds.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Mention suppression for timer names (same pattern as roll.ts)
// ---------------------------------------------------------------------------

/** Strip @everyone, @here, and <@...> mention patterns from user input. */
function sanitizeName(raw: string): string {
  return raw
    .replace(/@everyone/gi, '@\u200Beveryone')
    .replace(/@here/gi, '@\u200Bhere')
    .replace(/<@[!&]?\d+>/g, '[mention]')
    .replace(/<#\d+>/g, '[channel]')
    .replace(/<@&\d+>/g, '[role]');
}

// ---------------------------------------------------------------------------
// Button customId helpers
// ---------------------------------------------------------------------------

/** Max name length in a restart button customId (100-char limit). */
const MAX_RESTART_NAME_LENGTH = 40;

/** Build a stop button for a timer message. */
export function buildStopButton(timerId: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`tstop:${timerId}`)
      .setLabel('Stop')
      .setStyle(ButtonStyle.Secondary)
  );
}

/** Build a restart button for a completed timer message. */
export function buildRestartButton(timer: TimerInstance): ActionRowBuilder<ButtonBuilder> {
  const repeatPart = timer.maxRepeat ?? 0;
  const namePart = timer.name.slice(0, MAX_RESTART_NAME_LENGTH);
  const customId = `trestart:${timer.id}:${timer.intervalMinutes}:${repeatPart}:${namePart}`;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel('Restart')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄')
  );
}

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

/** /timer command with start, stop, list subcommands. */
export const timerCommandData = new SlashCommandBuilder()
  .setName('timer')
  .setDescription('Manage event timers for your session')
  .addSubcommand((sub) =>
    sub
      .setName('start')
      .setDescription('Start a recurring event timer')
      .addIntegerOption((opt) =>
        opt
          .setName('interval')
          .setDescription('Interval in minutes between triggers')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(480)
      )
      .addStringOption((opt) =>
        opt
          .setName('name')
          .setDescription('Name for this timer event (max 50 characters)')
          .setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('repeat')
          .setDescription(
            'Number of times to trigger (omit for indefinite, capped by max duration)'
          )
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(100)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('stop')
      .setDescription('Stop a running timer')
      .addIntegerOption((opt) =>
        opt
          .setName('timer_id')
          .setDescription('ID of the timer to stop')
          .setRequired(false)
          .setMinValue(1)
      )
      .addBooleanOption((opt) =>
        opt.setName('all').setDescription('Stop all timers in this channel').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all active timers in this channel')
  );

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/** Handle /timer interactions. */
export async function handleTimerCommand(
  interaction: ChatInputCommandInteraction,
  timerStore: ITimerStore,
  limiter: RateLimiter
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'start':
      await handleTimerStart(interaction, timerStore, limiter);
      break;
    case 'stop':
      await handleTimerStop(interaction, timerStore);
      break;
    case 'list':
      await handleTimerList(interaction, timerStore);
      break;
  }
}

// ---------------------------------------------------------------------------
// /timer start
// ---------------------------------------------------------------------------

async function handleTimerStart(
  interaction: ChatInputCommandInteraction,
  timerStore: ITimerStore,
  limiter: RateLimiter
): Promise<void> {
  const userId = interaction.user.id;

  // Rate limit check
  if (!limiter.consume(userId)) {
    const retryAfter = limiter.retryAfterSeconds(userId);
    await interaction.editReply({
      embeds: [
        buildErrorEmbed(
          `You're acting too fast! Please wait **${retryAfter}** second(s) before trying again.`
        ),
      ],
    });
    return;
  }

  const intervalMinutes = interaction.options.getInteger('interval', true);
  const rawName = interaction.options.getString('name', true);
  const repeat = interaction.options.getInteger('repeat') ?? null;

  const name = sanitizeName(rawName.trim());

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('Timers can only be used in a server (guild).')],
    });
    return;
  }

  const channel = interaction.channel;
  if (!channel || !('send' in channel)) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('Unable to send timer messages in this channel.')],
    });
    return;
  }

  // Validate and create
  let timer: TimerInstance;
  try {
    timer = await timerStore.create(
      {
        guildId,
        channelId: interaction.channelId,
        name,
        intervalMinutes,
        maxRepeat: repeat,
        startedBy: userId,
      },
      // onTrigger — channel is verified to have send() above
      (t) => sendTriggerMessage(channel as TextChannel, t),
      // onComplete
      (t, reason) => sendCompleteMessage(channel as TextChannel, t, reason)
    );
  } catch (err) {
    const message = err instanceof TimerParseError ? err.message : 'Failed to create timer.';
    await interaction.editReply({
      embeds: [buildErrorEmbed(message)],
    });
    return;
  }

  logger.info('timer-created', {
    timerId: timer.id,
    channelId: interaction.channelId,
    guildId,
    userId,
    name,
    intervalMinutes,
    maxRepeat: repeat,
  });

  // Reply ephemeral with confirmation
  const embed = buildTimerStartedEmbed({
    timerId: timer.id,
    name,
    intervalMinutes,
    maxRepeat: repeat,
    maxDurationMs: timerStore.maxDurationMs,
  });

  await interaction.editReply({ embeds: [embed] });
}

// ---------------------------------------------------------------------------
// Timer message senders (used as callbacks)
// ---------------------------------------------------------------------------

async function sendTriggerMessage(channel: TextChannel, timer: TimerInstance): Promise<void> {
  try {
    const embed = buildTimerTriggerEmbed({
      timerId: timer.id,
      name: timer.name,
      triggerCount: timer.triggerCount,
      maxRepeat: timer.maxRepeat,
      intervalMinutes: timer.intervalMinutes,
    });

    const row = buildStopButton(timer.id);

    await channel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    logger.error('timer-trigger-send-failed', {
      timerId: timer.id,
      channelId: timer.channelId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function sendCompleteMessage(
  channel: TextChannel,
  timer: TimerInstance,
  reason: TimerCompleteReason
): Promise<void> {
  try {
    const embed = buildTimerCompleteEmbed({
      timerId: timer.id,
      name: timer.name,
      triggerCount: timer.triggerCount,
      reason,
    });

    const row = buildRestartButton(timer);

    await channel.send({ embeds: [embed], components: [row] });

    logger.info('timer-completed', {
      timerId: timer.id,
      channelId: timer.channelId,
      reason,
      triggerCount: timer.triggerCount,
    });
  } catch (err) {
    logger.error('timer-complete-send-failed', {
      timerId: timer.id,
      channelId: timer.channelId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// /timer stop
// ---------------------------------------------------------------------------

async function handleTimerStop(
  interaction: ChatInputCommandInteraction,
  timerStore: ITimerStore
): Promise<void> {
  const timerId = interaction.options.getInteger('timer_id') ?? null;
  const all = interaction.options.getBoolean('all') ?? false;

  if (timerId === null && !all) {
    await interaction.editReply({
      embeds: [
        buildErrorEmbed(
          'Please specify `timer_id` to stop a specific timer, or `all:true` to stop all timers in this channel.\n\n' +
            'Use `/timer list` to see active timers and their IDs.'
        ),
      ],
    });
    return;
  }

  if (all) {
    const count = await timerStore.stopAllInChannel(interaction.channelId);

    logger.info('timer-stop-all', {
      channelId: interaction.channelId,
      userId: interaction.user.id,
      count,
    });

    if (count === 0) {
      await interaction.editReply({
        embeds: [buildErrorEmbed('No active timers in this channel.')],
      });
    } else {
      await interaction.editReply({
        embeds: [
          buildTimerStoppedEmbed({
            timerId: 0,
            name: `${count} timer${count !== 1 ? 's' : ''}`,
          }),
        ],
      });
    }
    return;
  }

  // Stop specific timer — timerId is non-null here: the null+!all case returned early
  if (timerId === null) return;

  const timer = await timerStore.get(timerId);
  if (!timer) {
    await interaction.editReply({
      embeds: [
        buildErrorEmbed(
          `Timer #${timerId} was not found. It may have already completed or been stopped.`
        ),
      ],
    });
    return;
  }

  // Verify channel match
  if (timer.channelId !== interaction.channelId) {
    await interaction.editReply({
      embeds: [
        buildErrorEmbed(
          'That timer belongs to a different channel and cannot be stopped from here.'
        ),
      ],
    });
    return;
  }

  await timerStore.stop(timerId);

  logger.info('timer-stopped', {
    timerId,
    channelId: interaction.channelId,
    userId: interaction.user.id,
    name: timer.name,
  });

  await interaction.editReply({
    embeds: [buildTimerStoppedEmbed({ timerId: timer.id, name: timer.name })],
  });
}

// ---------------------------------------------------------------------------
// /timer list
// ---------------------------------------------------------------------------

async function handleTimerList(
  interaction: ChatInputCommandInteraction,
  timerStore: ITimerStore
): Promise<void> {
  const timers = await timerStore.getByChannel(interaction.channelId);
  const embed = buildTimerListEmbed(timers);

  await interaction.editReply({ embeds: [embed] });
}
