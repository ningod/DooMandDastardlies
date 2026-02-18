import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder, EmbedBuilder, Colors } from 'discord.js';
import { config } from '../lib/config.js';

/** /help command definition. */
export const helpCommandData = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show all commands and dice syntax for DooM & Dastardlies');

/**
 * Handle the /help interaction.
 * Replies with an ephemeral embed listing commands and syntax.
 */
export async function handleHelpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('DooM & Dastardlies — Dice Roller Help')
    .setColor(Colors.Blurple)
    .setDescription(
      'Roll dice for your DooM & Dastardlies sessions. ' +
        'Secret rolls let you hide results until the perfect moment.'
    );

  embed.addFields({
    name: 'Commands',
    value: [
      '`/roll dice:2d6` — Public roll (everyone sees)',
      '`/secret dice:2d6` — Secret roll (only you see)',
      '`/r` — Shortcut for `/roll`',
      '`/s` — Shortcut for `/secret`',
      '`/help` — This help message',
    ].join('\n'),
  });

  embed.addFields({
    name: 'Dice Syntax',
    value: [
      '`d20` — Roll one d20',
      '`2d6` — Roll two d6',
      '`2d4 + 1d8` — Multiple groups (also: `2d4, 1d8` or `2d4 1d8`)',
      'Supported dice: **d4, d6, d8, d10, d12, d20**',
    ].join('\n'),
  });

  embed.addFields({
    name: 'Labeled Rolls',
    value: [
      'Add labels in parentheses before each die group:',
      '`(Verve) 2d20 + (Damage) 1d8`',
      '`(Soul) d4, (Bonus) d6`',
      'Labels show up in the results next to each group.',
    ].join('\n'),
  });

  embed.addFields({
    name: 'Comments',
    value: [
      'Add a comment to describe your roll:',
      '`/roll dice:2d6 comment:"Greatsword swing"`',
      'Max 120 characters.',
    ].join('\n'),
  });

  embed.addFields({
    name: 'Secret Roll Flow',
    value: [
      '1. A **public message** appears: "User rolled in secret" + Reveal button',
      '2. An **ephemeral message** shows you the result (only you see it)',
      '3. Click **Reveal Result** to show the result to everyone',
      'Rolls expire after **10 minutes**.',
    ].join('\n'),
  });

  embed.addFields({
    name: 'Options',
    value: [
      '`secret:true/false` — Override the default on any command',
      '`/roll dice:d20 secret:true` — Make a public command secret',
      '`/secret dice:d20 secret:false` — Make a secret command public',
    ].join('\n'),
  });

  embed.addFields({
    name: 'Timer Commands',
    value: [
      '`/timer start interval:5 name:"Combat Round"` — Start a timer',
      '`/timer start interval:10 name:"Rest" repeat:3` — Timer with 3 triggers',
      '`/timer stop timer_id:1` — Stop a specific timer',
      '`/timer stop all:true` — Stop all timers in this channel',
      '`/timer list` — Show active timers',
      'Timers auto-stop after max duration (default 2h).',
    ].join('\n'),
  });

  embed.addFields({
    name: 'Legal & Privacy',
    value: [
      `By using this bot you agree to our [Terms of Service](${config.termsUrl}).`,
      `For data and privacy details, use \`/privacy\` or read the [Privacy Policy](${config.privacyUrl}).`,
    ].join('\n'),
  });

  embed.setFooter({
    text: 'DooM & Dastardlies — Roll behind the screen',
  });

  await interaction.reply({ embeds: [embed] });
}
