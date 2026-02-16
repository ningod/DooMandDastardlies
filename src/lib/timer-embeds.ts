import { EmbedBuilder, Colors } from "discord.js";
import { TimerInstance } from "./timer-store.js";

const TITLE = "DooM & Dastardlies — Event Timer";

/**
 * Build the embed shown on each timer trigger tick.
 */
export function buildTimerTriggerEmbed(opts: {
  timerId: number;
  name: string;
  triggerCount: number;
  maxRepeat: number | null;
  intervalMinutes: number;
}): EmbedBuilder {
  const { timerId, name, triggerCount, maxRepeat, intervalMinutes } = opts;
  const countDisplay =
    maxRepeat !== null ? `#${triggerCount}/${maxRepeat}` : `#${triggerCount}`;

  const embed = new EmbedBuilder()
    .setTitle(TITLE)
    .setColor(Colors.DarkGold)
    .setTimestamp();

  embed.addFields(
    { name: "Event", value: name, inline: true },
    { name: "Trigger", value: `⏳ ${countDisplay}`, inline: true },
    {
      name: "Interval",
      value: `Every ${intervalMinutes} minute${intervalMinutes !== 1 ? "s" : ""}`,
      inline: true,
    },
  );

  embed.setFooter({ text: `Timer #${timerId}` });

  return embed;
}

/**
 * Build the embed shown when a timer completes naturally.
 */
export function buildTimerCompleteEmbed(opts: {
  timerId: number;
  name: string;
  triggerCount: number;
  reason: "repeat-exhausted" | "max-duration";
}): EmbedBuilder {
  const { timerId, name, triggerCount, reason } = opts;

  const description =
    reason === "repeat-exhausted"
      ? `✅ **${name}** — Completed (${triggerCount} trigger${triggerCount !== 1 ? "s" : ""})`
      : `⏹ **${name}** — Maximum duration reached (${triggerCount} trigger${triggerCount !== 1 ? "s" : ""})`;

  const color = reason === "repeat-exhausted" ? Colors.Green : Colors.Greyple;

  return new EmbedBuilder()
    .setTitle(TITLE)
    .setColor(color)
    .setDescription(description)
    .setFooter({ text: `Timer #${timerId}` })
    .setTimestamp();
}

/**
 * Build the confirmation embed shown when a timer starts.
 */
export function buildTimerStartedEmbed(opts: {
  timerId: number;
  name: string;
  intervalMinutes: number;
  maxRepeat: number | null;
  maxDurationMs: number;
}): EmbedBuilder {
  const { timerId, name, intervalMinutes, maxRepeat, maxDurationMs } = opts;
  const maxDurationHours = Math.round(maxDurationMs / (60 * 60 * 1000) * 10) / 10;
  const repeatDisplay = maxRepeat !== null ? `${maxRepeat}` : "∞";

  const embed = new EmbedBuilder()
    .setTitle(TITLE)
    .setColor(Colors.Green)
    .setDescription(`Timer **${name}** started.`)
    .setTimestamp();

  embed.addFields(
    { name: "Timer ID", value: `#${timerId}`, inline: true },
    {
      name: "Interval",
      value: `${intervalMinutes} minute${intervalMinutes !== 1 ? "s" : ""}`,
      inline: true,
    },
    { name: "Repeats", value: repeatDisplay, inline: true },
    { name: "Max Duration", value: `${maxDurationHours}h`, inline: true },
  );

  return embed;
}

/**
 * Build the confirmation embed shown when a timer is stopped.
 */
export function buildTimerStoppedEmbed(opts: {
  timerId: number;
  name: string;
}): EmbedBuilder {
  const { timerId, name } = opts;

  return new EmbedBuilder()
    .setTitle(TITLE)
    .setColor(Colors.Red)
    .setDescription(`⏹ Timer **${name}** (#${timerId}) has been stopped.`)
    .setTimestamp();
}

/**
 * Build the ephemeral embed listing active timers in a channel.
 */
export function buildTimerListEmbed(timers: TimerInstance[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(TITLE)
    .setColor(Colors.Blurple)
    .setTimestamp();

  if (timers.length === 0) {
    embed.setDescription("No active timers in this channel.");
    return embed;
  }

  embed.setDescription(`${timers.length} active timer${timers.length !== 1 ? "s" : ""}:`);

  for (const timer of timers) {
    const intervalMs = timer.intervalMinutes * 60 * 1000;
    const elapsed = Date.now() - timer.startedAt;
    const nextTriggerIn = intervalMs - (elapsed % intervalMs);
    const nextTriggerMinutes = Math.ceil(nextTriggerIn / 60_000);

    const remainingReps =
      timer.maxRepeat !== null
        ? `${timer.maxRepeat - timer.triggerCount}`
        : "∞";

    const remainingRuntimeMs = timer.maxDurationMs - elapsed;
    const remainingMinutes = Math.max(0, Math.ceil(remainingRuntimeMs / 60_000));

    const lines = [
      `**Interval:** ${timer.intervalMinutes}min`,
      `**Next trigger:** ~${nextTriggerMinutes}min`,
      `**Remaining triggers:** ${remainingReps}`,
      `**Runtime left:** ~${remainingMinutes}min`,
    ];

    embed.addFields({
      name: `#${timer.id} — ${timer.name}`,
      value: lines.join("\n"),
    });
  }

  return embed;
}
