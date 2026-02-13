import { EmbedBuilder, Colors } from "discord.js";
import { RollResult } from "./dice.js";

const TITLE = "DooM & Dastardlies — Dice Roll";

/**
 * Build a rich embed displaying roll results.
 *
 * @param opts - Configuration for the embed
 * @param opts.result - The roll result with dice values and total
 * @param opts.reason - Optional reason for the roll
 * @param opts.rollerTag - Discord tag of the user who rolled
 * @param opts.rollerId - Discord ID of the user who rolled
 * @param opts.isRevealed - Whether this is a revealed roll (affects color and footer)
 * @returns Discord embed with roll information
 */
export function buildRollEmbed(opts: {
  result: RollResult;
  reason: string | null;
  rollerTag: string;
  rollerId: string;
  isRevealed?: boolean;
}): EmbedBuilder {
  const { result, reason, rollerTag, rollerId, isRevealed } = opts;

  const embed = new EmbedBuilder()
    .setTitle(TITLE)
    .setColor(isRevealed ? Colors.Green : Colors.DarkGold)
    .setTimestamp();

  // Dice expression
  embed.addFields({ name: "Dice", value: `\`${result.expression}\``, inline: true });

  // Individual results per group
  const resultsLines = result.groups.map((gr) => {
    const label = `${gr.group.count}d${gr.group.sides}`;
    const values = gr.rolls.map((r) => `**${r}**`).join(", ");
    return `${label}: [${values}]`;
  });
  embed.addFields({ name: "Results", value: resultsLines.join("\n") });

  // Total
  embed.addFields({ name: "Total", value: `**${result.total}**`, inline: true });

  // Reason (optional)
  if (reason) {
    embed.addFields({ name: "Reason", value: reason, inline: true });
  }

  // Roller
  embed.addFields({ name: "Roller", value: `<@${rollerId}>`, inline: true });

  if (isRevealed) {
    embed.setFooter({ text: `Revealed by ${rollerTag}` });
  } else {
    embed.setFooter({ text: "Secret roll — only you can see this" });
  }

  return embed;
}

/**
 * Build a public announcement embed for a secret roll (no results shown).
 * This is the message everyone sees before the roll is revealed.
 *
 * @param opts - Configuration for the announcement
 * @param opts.expression - The dice expression (e.g., "2d6")
 * @param opts.reason - Optional reason for the roll
 * @param opts.rollerId - Discord ID of the user who rolled
 * @returns Discord embed announcing a secret roll
 */
export function buildSecretRollAnnouncementEmbed(opts: {
  expression: string;
  reason: string | null;
  rollerId: string;
}): EmbedBuilder {
  const { expression, reason, rollerId } = opts;

  const embed = new EmbedBuilder()
    .setTitle("Secret Roll")
    .setColor(Colors.DarkGold)
    .setTimestamp();

  embed.addFields({ name: "Dice", value: `\`${expression}\``, inline: true });
  embed.addFields({ name: "Roller", value: `<@${rollerId}>`, inline: true });

  if (reason) {
    embed.addFields({ name: "Reason", value: reason, inline: true });
  }

  embed.setDescription("🎲 Result is hidden until revealed.");

  return embed;
}

/**
 * Build a reveal embed showing the roll results and who revealed them.
 * This replaces the secret announcement when the roller clicks "Reveal Result".
 *
 * @param opts - Configuration for the reveal
 * @param opts.result - The roll result with dice values and total
 * @param opts.reason - Optional reason for the roll
 * @param opts.rollerTag - Discord tag of the original roller
 * @param opts.rollerId - Discord ID of the original roller
 * @param opts.revealerTag - Discord tag of who clicked reveal (usually same as roller)
 * @param opts.revealerId - Discord ID of who clicked reveal
 * @returns Discord embed with revealed roll results and attribution
 */
export function buildRevealEmbed(opts: {
  result: RollResult;
  reason: string | null;
  rollerTag: string;
  rollerId: string;
  revealerTag: string;
  revealerId: string;
}): EmbedBuilder {
  const { result, reason, rollerTag, rollerId, revealerTag, revealerId } = opts;

  const embed = new EmbedBuilder()
    .setTitle(TITLE)
    .setColor(Colors.Green)
    .setTimestamp();

  // Dice expression
  embed.addFields({ name: "Dice", value: `\`${result.expression}\``, inline: true });

  // Individual results per group
  const resultsLines = result.groups.map((gr) => {
    const label = `${gr.group.count}d${gr.group.sides}`;
    const values = gr.rolls.map((r) => `**${r}**`).join(", ");
    return `${label}: [${values}]`;
  });
  embed.addFields({ name: "Results", value: resultsLines.join("\n") });

  // Total
  embed.addFields({ name: "Total", value: `**${result.total}**`, inline: true });

  // Reason (optional)
  if (reason) {
    embed.addFields({ name: "Reason", value: reason, inline: true });
  }

  // Roller
  embed.addFields({ name: "Roller", value: `<@${rollerId}>`, inline: true });

  // Revealer
  embed.setFooter({ text: `Revealed by ${revealerTag}` });

  return embed;
}

/**
 * Build an error embed for displaying user-friendly error messages.
 *
 * @param message - The error message to display
 * @returns Discord embed with error styling
 */
export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("DooM & Dastardlies — Error")
    .setColor(Colors.Red)
    .setDescription(message)
    .setTimestamp();
}
