import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import { config } from '../lib/config.js';

/** /privacy command definition. */
export const privacyCommandData = new SlashCommandBuilder()
  .setName('privacy')
  .setDescription('Show what data this bot collects and your privacy rights');

/**
 * Handle the /privacy interaction.
 * Replies with an ephemeral embed summarising data collection and GDPR rights.
 */
export async function handlePrivacyCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('DooM & Dastardlies — Privacy & Data')
    .setColor(Colors.Blurple)
    .setDescription(
      'This bot processes the minimum data required to roll dice and support the ' +
        'secret-roll reveal flow. **No data is stored permanently.**'
    );

  embed.addFields({
    name: 'What We Temporarily Store',
    value: [
      '• **Discord User ID** — identifies who rolled, enforces reveal authorization',
      '• **Discord Channel ID** — scopes reveals to the originating channel',
      '• **Discord Server (Guild) ID** — scopes timer events',
      '• **Dice expression** — logged in operational metadata only (never roll results)',
      '• **Roll results** — stored only for unrevealed secret rolls (see below)',
    ].join('\n'),
  });

  embed.addFields({
    name: 'How Long We Keep It',
    value: [
      '• **Secret roll data** — deleted automatically after **10 minutes** or immediately on reveal',
      '• **Rate-limit counters** — held in memory only, pruned within a **10-second** window',
      '• **Timer metadata** — held in memory; cleared when the timer stops or the bot restarts',
      '',
      'All storage is transient. There is no permanent database.',
    ].join('\n'),
  });

  embed.addFields({
    name: 'Requesting Data Deletion',
    value: [
      'Because all data expires within **10 minutes**, there is typically nothing to delete by the time you ask.',
      '',
      'If you have an unrevealed roll you want deleted immediately, simply wait — it expires automatically.',
      'Server administrators can also remove the bot to stop all future data processing.',
    ].join('\n'),
  });

  embed.addFields({
    name: 'Your GDPR Rights (EU/EEA Users)',
    value: [
      'You have the right to:',
      '• **Access** — ask what data is held about you',
      '• **Erasure** — request deletion (in practice, data auto-deletes within 10 min)',
      '• **Portability** — request a copy of your data',
      '• **Object** — object to processing',
      '',
      config.developerContactEmail
        ? `Contact: **${config.developerContactEmail}**`
        : 'To exercise these rights, open an issue at: https://github.com/ningod/DooMandDastardlies/issues',
    ].join('\n'),
  });

  embed.addFields({
    name: 'Third-Party Services',
    value: [
      "• **Discord Inc.** — all interactions pass through Discord's platform ([Discord Privacy Policy](https://discord.com/privacy))",
      '• **Upstash Redis** — only used when the operator enables `STORAGE_BACKEND=redis`. If enabled, temporary roll data is stored on Upstash servers with the same 10-minute TTL.',
      '• No analytics, advertising, or tracking services are used.',
    ].join('\n'),
  });

  const links: string[] = [
    `[Privacy Policy](${config.privacyUrl})`,
    `[Terms of Service](${config.termsUrl})`,
  ];
  if (config.supportServerLink) {
    links.push(`[Support Server](${config.supportServerLink})`);
  }

  embed.addFields({
    name: 'Full Policy & Links',
    value: links.join(' · '),
  });

  embed.setFooter({
    text: 'DooM & Dastardlies — Roll behind the screen',
  });

  await interaction.reply({ embeds: [embed] });
}
