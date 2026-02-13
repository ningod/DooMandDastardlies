# Agentic Development Guide

This document defines protocols for AI agents (including Claude Code) working on the DooM & Dastardlies dice bot. Follow these protocols to produce safe, consistent, and reviewable changes.

## Change Protocol

Every change follows this sequence:

### 1. Plan

- State **what** you intend to change and **why**.
- Identify which files will be affected.
- Call out any risks (e.g., breaking Discord interaction timing, weakening auth checks).
- If the change adds a dependency, justify it explicitly.

### 2. Implement

- Make the smallest change that satisfies the goal.
- Follow the coding standards in [CLAUDE.md](./CLAUDE.md).
- Use `.js` import extensions, `crypto.randomInt()`, `MessageFlags.Ephemeral`.
- Do not modify unrelated files in the same change.

### 3. Test

- Run the full test suite: `npm test`.
- If you changed parsing or rolling logic, add or update tests in `tests/dice.test.ts`.
- If you changed store behavior, update `tests/store.test.ts`.
- If you changed rate limiting, update `tests/ratelimit.test.ts`.
- Verify TypeScript compiles cleanly: `npx tsc --noEmit`.

### 4. Document

- If a command option changed, update `README.md` (Usage section).
- If architecture changed, update `ARCHITECTURE.md`.
- If a security invariant was added or modified, update `SECURITY.md`.
- Update `CLAUDE.md` if the file structure or commands changed.

## Security Protocol

Before implementing any new feature, run through this checklist:

### Threat Modeling Checklist

- [ ] **Secrets exposure:** Does this change risk logging, displaying, or transmitting secret roll data?
- [ ] **Authorization bypass:** Does this change affect who can reveal a roll? Are `userId` and `channelId` still verified?
- [ ] **Input validation:** Does this accept new user input? Is it validated (length, format, allowed values)?
- [ ] **Rate limiting:** Could this new feature be spammed? Is it covered by the rate limiter?
- [ ] **TTL integrity:** Does this change affect roll storage or expiration? Are expired rolls still rejected?
- [ ] **RNG quality:** If dice rolling is involved, is `crypto.randomInt()` used (never `Math.random()`)?
- [ ] **Dependency safety:** If a new package is added, is it well-maintained, small, and necessary?
- [ ] **Environment variables:** Are any new secrets needed? Are they documented in `.env.example`?

## Interaction Protocol

Discord has strict constraints on bot interactions. Follow these rules:

### Timing

- **Slash commands:** Must be acknowledged within **3 seconds** or Discord shows "interaction failed."
- For long operations, use `interaction.deferReply()` first, then `interaction.editReply()`.
- The current `/roll` handler is fast enough to reply directly (no defer needed).

### Ephemeral vs. Public

| Scenario | Message Type | Implementation |
|---|---|---|
| Secret roll result | Ephemeral | `interaction.reply({ flags: MessageFlags.Ephemeral })` |
| Revealed roll | Public (new message) | `channel.send({ embeds: [...] })` |
| Updated ephemeral after reveal | Ephemeral edit | `interaction.update({ components: [disabledRow] })` |
| Public roll (`secret:false`) | Public | `interaction.reply({ embeds: [...] })` |
| Error messages | Ephemeral | `interaction.reply({ flags: MessageFlags.Ephemeral })` |

### Button Interactions

- Custom IDs follow the pattern: `reveal:<uuid>`.
- The handler MUST verify:
  1. The roll exists in the store (not expired).
  2. `interaction.user.id === storedRoll.userId`.
  3. `interaction.channelId === storedRoll.channelId`.
- After reveal, the roll is deleted from the store to prevent duplicate reveals.
- The button is disabled on the ephemeral message.

## File Ownership

| Area | Primary File(s) | Owner Concern |
|---|---|---|
| Dice parsing | `src/lib/dice.ts` | Input validation, allowed dice, expression caps |
| RNG | `src/lib/dice.ts` | `crypto.randomInt` only |
| Storage | `src/lib/store.ts` | TTL enforcement, memory cleanup |
| Rate limiting | `src/lib/ratelimit.ts` | Sliding window, per-user tracking |
| Command handling | `src/commands/roll.ts` | Discord API contract, option parsing |
| Button handling | `src/interactions/buttons.ts` | Authorization, channel verification |
| Embeds | `src/lib/embeds.ts` | Consistent UX, no secret leakage |
| Logging | `src/lib/logger.ts` | Metadata only, never roll values |

## Common Pitfalls

1. **Editing ephemeral messages:** You can `.update()` the ephemeral, but you cannot make it public. To reveal, send a separate `channel.send()`.
2. **Button custom ID length:** Discord limits custom IDs to 100 characters. UUIDs are 36 chars + prefix, well within limits.
3. **PartialGroupDMChannel:** `interaction.channel` might be a partial type that lacks `.send()`. Always check `"send" in channel` before calling it.
4. **Import extensions:** TypeScript requires `.js` in import paths even though the source files are `.ts`. This is a CommonJS + TypeScript convention for this project.
