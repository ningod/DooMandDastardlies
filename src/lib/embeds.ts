import { EmbedBuilder, Colors } from "discord.js";
import { RollResult, DieGroupResult } from "./dice.js";

const TITLE = "DooM & Dastardlies — Dice Roll";

/** Maximum comment length allowed in embeds. */
export const MAX_COMMENT_LENGTH = 120;

/**
 * Format a single die group result for display.
 * Shows label (if present), dice notation, individual values, and subtotal.
 */
function formatGroupResult(gr: DieGroupResult): string {
  const dice = `${gr.group.count}d${gr.group.sides}`;
  const values = gr.rolls.map((r) => `**${r}**`).join(", ");
  const subtotal = gr.rolls.reduce((a, b) => a + b, 0);
  const prefix = gr.group.label ? `**${gr.group.label}** — ` : "";
  return `${prefix}${dice}: [${values}] = ${subtotal}`;
}

/**
 * Build a rich embed displaying roll results.
 *
 * @param opts.result - The roll result with dice values and total
 * @param opts.comment - Optional comment for the roll
 * @param opts.rollerTag - Discord tag of the user who rolled
 * @param opts.rollerId - Discord ID of the user who rolled
 * @param opts.isRevealed - Whether this is a revealed roll (affects color and footer)
 */
export function buildRollEmbed(opts: {
  result: RollResult;
  comment: string | null;
  rollerTag: string;
  rollerId: string;
  isRevealed?: boolean;
}): EmbedBuilder {
  const { result, comment, rollerId, isRevealed } = opts;

  const embed = new EmbedBuilder()
    .setTitle(TITLE)
    .setColor(isRevealed ? Colors.Green : Colors.DarkGold)
    .setTimestamp();

  // Dice expression
  embed.addFields({ name: "Dice", value: `\`${result.expression}\``, inline: true });
  embed.addFields({ name: "Roller", value: `<@${rollerId}>`, inline: true });

  // Comment (optional)
  if (comment) {
    embed.addFields({ name: "Comment", value: comment });
  }

  // Individual results per group (with labels and subtotals)
  const resultsLines = result.groups.map(formatGroupResult);
  embed.addFields({ name: "Results", value: resultsLines.join("\n") });

  // Total
  embed.addFields({ name: "Total", value: `**${result.total}**`, inline: true });

  if (isRevealed) {
    embed.setFooter({ text: `Revealed` });
  } else {
    embed.setFooter({ text: "Secret roll — only you can see this" });
  }

  return embed;
}

/**
 * Build a public announcement embed for a secret roll (no results shown).
 * This is the message everyone sees before the roll is revealed.
 *
 * @param opts.expression - The dice expression (e.g., "2d6")
 * @param opts.comment - Optional comment for the roll
 * @param opts.rollerId - Discord ID of the user who rolled
 */
export function buildSecretRollAnnouncementEmbed(opts: {
  expression: string;
  comment: string | null;
  rollerId: string;
}): EmbedBuilder {
  const { expression, comment, rollerId } = opts;

  const embed = new EmbedBuilder()
    .setTitle("Secret Roll")
    .setColor(Colors.DarkGold)
    .setTimestamp();

  embed.addFields({ name: "Dice", value: `\`${expression}\``, inline: true });
  embed.addFields({ name: "Roller", value: `<@${rollerId}>`, inline: true });

  if (comment) {
    embed.addFields({ name: "Comment", value: comment });
  }

  embed.setDescription("🎲 Result is hidden until revealed.");

  return embed;
}

/**
 * Build a reveal embed showing the roll results and who revealed them.
 * This replaces the secret announcement when the roller clicks "Reveal Result".
 *
 * @param opts.result - The roll result with dice values and total
 * @param opts.comment - Optional comment for the roll
 * @param opts.rollerTag - Discord tag of the original roller
 * @param opts.rollerId - Discord ID of the original roller
 * @param opts.revealerTag - Discord tag of who clicked reveal
 * @param opts.revealerId - Discord ID of who clicked reveal
 */
export function buildRevealEmbed(opts: {
  result: RollResult;
  comment: string | null;
  rollerTag: string;
  rollerId: string;
  revealerTag: string;
  revealerId: string;
}): EmbedBuilder {
  const { result, comment, rollerId, revealerTag } = opts;

  const embed = new EmbedBuilder()
    .setTitle(TITLE)
    .setColor(Colors.Green)
    .setTimestamp();

  // Dice expression
  embed.addFields({ name: "Dice", value: `\`${result.expression}\``, inline: true });
  embed.addFields({ name: "Roller", value: `<@${rollerId}>`, inline: true });

  // Comment (optional)
  if (comment) {
    embed.addFields({ name: "Comment", value: comment });
  }

  // Individual results per group (with labels and subtotals)
  const resultsLines = result.groups.map(formatGroupResult);
  embed.addFields({ name: "Results", value: resultsLines.join("\n") });

  // Total
  embed.addFields({ name: "Total", value: `**${result.total}**`, inline: true });

  // Revealer
  embed.setFooter({ text: `Revealed by ${revealerTag}` });

  return embed;
}

/**
 * Build an error embed for displaying user-friendly error messages.
 *
 * @param message - The error message to display
 */
export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("DooM & Dastardlies — Error")
    .setColor(Colors.Red)
    .setDescription(message)
    .setTimestamp();
}
