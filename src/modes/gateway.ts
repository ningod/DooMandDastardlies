/**
 * Gateway mode — discord.js WebSocket-based interaction handling.
 *
 * This is the original (default) mode extracted from index.ts.
 * The Client connects via WebSocket and receives interactions as events.
 */

import { Client, GatewayIntentBits, Events, InteractionType, MessageFlags } from 'discord.js';
import { handleRollCommand, ROLL_COMMAND_NAMES } from '../commands/roll.js';
import { handleHelpCommand } from '../commands/help.js';
import { handleTimerCommand } from '../commands/timer.js';
import { handleButton } from '../interactions/buttons.js';
import { handleTimerButton } from '../interactions/timer-buttons.js';
import type { IRollStore, ITimerStore } from '../lib/store-interface.js';
import type { RateLimiter } from '../lib/ratelimit.js';
import { logger } from '../lib/logger.js';

/**
 * Start the gateway (WebSocket) mode.
 *
 * Creates a discord.js Client, registers interaction handlers,
 * and logs in. Returns the client for graceful shutdown.
 */
export function startGateway(
  rollStore: IRollStore,
  timerStore: ITimerStore,
  limiter: RateLimiter
): Client {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    logger.error('missing-token', {
      message: 'DISCORD_BOT_TOKEN environment variable is not set.',
    });
    process.exit(1);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  // Bot ready
  client.once(Events.ClientReady, (readyClient) => {
    logger.info('ready', {
      user: readyClient.user.tag,
      guilds: readyClient.guilds.cache.size,
    });
    rollStore.start();
  });

  // Interaction handler
  client.on(Events.InteractionCreate, (interaction) => {
    void (async () => {
      try {
        // CRITICAL: Defer commands IMMEDIATELY before any processing.
        // /help does NOT need deferring (it replies directly).
        if (interaction.isChatInputCommand() && ROLL_COMMAND_NAMES.has(interaction.commandName)) {
          const secretDefault = ['secret', 's'].includes(interaction.commandName);
          const secret = interaction.options.getBoolean('secret') ?? secretDefault;
          await interaction.deferReply({
            flags: secret ? MessageFlags.Ephemeral : undefined,
          });
        }

        // Timer commands are always ephemeral
        if (interaction.isChatInputCommand() && interaction.commandName === 'timer') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        // Button interactions need immediate defer too
        if (interaction.isButton() && interaction.customId.startsWith('reveal:')) {
          await interaction.deferUpdate();
        }

        // Timer buttons get ephemeral deferred replies
        if (
          interaction.isButton() &&
          (interaction.customId.startsWith('tstop:') ||
            interaction.customId.startsWith('trestart:'))
        ) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
      } catch (err) {
        const isTimeout =
          err instanceof Error &&
          (err.message.includes('Unknown interaction') ||
            err.message.includes('Interaction has already been acknowledged'));

        if (isTimeout) {
          logger.warn('defer-timeout', {
            interactionId: interaction.id,
            message: 'Discord may have auto-acknowledged',
          });
        } else {
          logger.error('defer-failed', {
            interactionId: interaction.id,
            error: err instanceof Error ? err.message : String(err),
          });
          return;
        }
      }

      try {
        // Dispatch slash commands
        if (interaction.isChatInputCommand()) {
          logger.info('interaction-received', {
            type: 'slash-command',
            command: interaction.commandName,
            interactionId: interaction.id,
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            channelId: interaction.channelId,
          });

          if (ROLL_COMMAND_NAMES.has(interaction.commandName)) {
            await handleRollCommand(interaction, rollStore, limiter);
          } else if (interaction.commandName === 'help') {
            await handleHelpCommand(interaction);
          } else if (interaction.commandName === 'timer') {
            await handleTimerCommand(interaction, timerStore, limiter);
          }
          return;
        }

        // Button interactions
        if (interaction.isButton()) {
          logger.info('interaction-received', {
            type: 'button',
            customId: interaction.customId,
            interactionId: interaction.id,
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            channelId: interaction.channelId,
          });

          const customId = interaction.customId;
          if (customId.startsWith('reveal:')) {
            await handleButton(interaction, rollStore);
          } else if (customId.startsWith('tstop:') || customId.startsWith('trestart:')) {
            await handleTimerButton(interaction, timerStore, limiter);
          }
          return;
        }
      } catch (err) {
        // Ignore stale interaction errors
        const isStaleInteraction =
          err instanceof Error &&
          (err.message.includes('Unknown interaction') ||
            err.message.includes('Interaction has already been acknowledged'));

        if (isStaleInteraction) {
          logger.info('stale-interaction-ignored', {
            type: InteractionType[interaction.type],
            interactionId: interaction.id,
            userId: interaction.user.id,
          });
          return;
        }

        logger.error('interaction-error', {
          type: InteractionType[interaction.type],
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          interactionId: interaction.id,
          userId: interaction.user.id,
          channelId: interaction.channelId,
        });

        // Try to respond with an error if we haven't already
        try {
          if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: 'An unexpected error occurred. Please try again.',
              flags: MessageFlags.Ephemeral,
            });
          }
        } catch {
          // If we can't respond, just log — don't crash
        }
      }
    })();
  });

  // Login
  void client.login(token);

  return client;
}
