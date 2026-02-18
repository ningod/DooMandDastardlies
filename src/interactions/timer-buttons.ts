import type { ButtonInteraction } from 'discord.js';
import { TimerParseError } from '../lib/timer-store.js';
import type { ITimerStore, TimerInstance } from '../lib/store-interface.js';

import type { RateLimiter } from '../lib/ratelimit.js';
import {
  buildTimerTriggerEmbed,
  buildTimerCompleteEmbed,
  buildTimerStartedEmbed,
  buildTimerStoppedEmbed,
} from '../lib/timer-embeds.js';
import { buildStopButton, buildRestartButton } from '../commands/timer.js';
import { buildErrorEmbed } from '../lib/embeds.js';
import { logger } from '../lib/logger.js';

/**
 * Handle timer-related button interactions (tstop: and trestart: prefixes).
 */
export async function handleTimerButton(
  interaction: ButtonInteraction,
  timerStore: ITimerStore,
  limiter: RateLimiter
): Promise<void> {
  const customId = interaction.customId;

  if (customId.startsWith('tstop:')) {
    await handleStopButton(interaction, timerStore);
  } else if (customId.startsWith('trestart:')) {
    await handleRestartButton(interaction, timerStore, limiter);
  }
}

// ---------------------------------------------------------------------------
// Stop button handler
// ---------------------------------------------------------------------------

async function handleStopButton(
  interaction: ButtonInteraction,
  timerStore: ITimerStore
): Promise<void> {
  const timerId = parseInt(interaction.customId.slice('tstop:'.length), 10);

  if (Number.isNaN(timerId)) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('Invalid timer button.')],
    });
    return;
  }

  const timer = await timerStore.get(timerId);

  if (!timer) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('This timer has already been stopped or completed.')],
    });
    return;
  }

  // Verify channel match (anti-replay)
  if (timer.channelId !== interaction.channelId) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('This timer belongs to a different channel.')],
    });
    return;
  }

  await timerStore.stop(timerId);

  logger.info('timer-stopped-button', {
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
// Restart button handler
// ---------------------------------------------------------------------------

async function handleRestartButton(
  interaction: ButtonInteraction,
  timerStore: ITimerStore,
  limiter: RateLimiter
): Promise<void> {
  const userId = interaction.user.id;

  // Parse customId: trestart:<timerId>:<interval>:<repeat|0>:<name>
  const parts = interaction.customId.slice('trestart:'.length).split(':');
  if (parts.length < 4) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('Invalid restart button.')],
    });
    return;
  }

  const intervalMinutes = parseInt(parts[1], 10);
  const repeatRaw = parseInt(parts[2], 10);
  const maxRepeat = repeatRaw > 0 ? repeatRaw : null;
  const name = parts.slice(3).join(':'); // name may contain colons

  if (Number.isNaN(intervalMinutes) || !name) {
    await interaction.editReply({
      embeds: [buildErrorEmbed('Invalid restart button parameters.')],
    });
    return;
  }

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

  let timer: TimerInstance;
  try {
    timer = await timerStore.create(
      {
        guildId,
        channelId: interaction.channelId,
        name,
        intervalMinutes,
        maxRepeat,
        startedBy: userId,
      },
      // onTrigger
      async (t) => {
        try {
          const embed = buildTimerTriggerEmbed({
            timerId: t.id,
            name: t.name,
            triggerCount: t.triggerCount,
            maxRepeat: t.maxRepeat,
            intervalMinutes: t.intervalMinutes,
          });
          const row = buildStopButton(t.id);
          await channel.send({ embeds: [embed], components: [row] });
        } catch (err) {
          logger.error('timer-trigger-send-failed', {
            timerId: t.id,
            channelId: t.channelId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
      // onComplete
      async (t, reason) => {
        try {
          const embed = buildTimerCompleteEmbed({
            timerId: t.id,
            name: t.name,
            triggerCount: t.triggerCount,
            reason,
          });
          const row = buildRestartButton(t);
          await channel.send({ embeds: [embed], components: [row] });

          logger.info('timer-completed', {
            timerId: t.id,
            channelId: t.channelId,
            reason,
            triggerCount: t.triggerCount,
          });
        } catch (err) {
          logger.error('timer-complete-send-failed', {
            timerId: t.id,
            channelId: t.channelId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    );
  } catch (err) {
    const message = err instanceof TimerParseError ? err.message : 'Failed to restart timer.';
    await interaction.editReply({
      embeds: [buildErrorEmbed(message)],
    });
    return;
  }

  logger.info('timer-restarted', {
    newTimerId: timer.id,
    channelId: interaction.channelId,
    userId,
    name,
    intervalMinutes,
    maxRepeat,
  });

  const embed = buildTimerStartedEmbed({
    timerId: timer.id,
    name,
    intervalMinutes,
    maxRepeat,
    maxDurationMs: timerStore.maxDurationMs,
  });

  await interaction.editReply({ embeds: [embed] });
}
