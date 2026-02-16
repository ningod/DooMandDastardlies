# DooM & Dastardlies — Dice Roller Bot

## Project Purpose

Discord dice roller bot for the **DooM & Dastardlies** TTRPG. The signature mechanic is **"rolling behind the screen"**: dice results can be rolled secretly (ephemeral to the roller) and revealed publicly via a button click.

## Critical UX Constraints

- **Two roll modes.** `/roll` (and `/r`) default to public. `/secret` (and `/s`) default to secret. Both accept a `secret` option to override.
- **Secret roll two-message flow:** A public announcement message (no results) with a "Reveal Result" button, plus an ephemeral message showing results only to the roller.
- **Reveal edits the public message.** Clicking "Reveal Result" edits the original announcement to show results — no third message is created.
- **No re-rolling on reveal.** The exact rolled values are preserved in the TTL store and posted as-is.
- **Only the roller can reveal.** Button handler must verify `userId` and `channelId` match.
- **10-minute TTL.** Unrevealed rolls expire; clicking reveal after expiry shows a friendly error.
- **Labeled rolls.** Optional `(Label) NdS` syntax groups results by label with subtotals.
- **Comments replace reasons.** An optional `comment` string (max 120 chars) is shown in embeds. The old `reason` parameter no longer exists.

## Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled bot (production)
npm run dev          # Run with ts-node (development)
npm test             # Run all tests (vitest)
npm run test:watch   # Run tests in watch mode
npm run deploy-commands  # Register slash commands with Discord
```

## File Structure

```
src/
  index.ts                 — Bot entry point, client setup, graceful shutdown
  deploy-commands.ts       — One-shot script to register all commands with Discord API
  commands/
    roll.ts                — /roll, /r, /secret, /s command definitions + shared handler
    help.ts                — /help command definition + handler
  interactions/buttons.ts  — "Reveal Result" button handler
  lib/
    dice.ts                — Dice expression parser (with labels) + crypto-secure roller
    store.ts               — In-memory TTL store for pending secret rolls
    ratelimit.ts           — Per-user sliding-window rate limiter
    embeds.ts              — Discord embed builders (roll result, errors)
    logger.ts              — Structured JSON logger (metadata only, never secrets)
tests/
  dice.test.ts             — Parser + roller unit tests (including labels)
  store.test.ts            — TTL store tests
  ratelimit.test.ts        — Rate limiter tests
```

## Coding Standards

- **Language:** TypeScript (strict mode) with Node.js 18+
- **Module system:** CommonJS (`"type": "commonjs"` in package.json)
- **Formatting:** 2-space indentation, Prettier defaults, trailing newlines
- **Imports:** Use `.js` extensions in import paths (required for TypeScript ESM-compatible output)
- **Error handling:** Custom error classes (e.g., `DiceParseError`) with user-friendly messages
- **Logging:** Use `src/lib/logger.ts`. NEVER log roll results or ephemeral content — metadata only (userId, expression, channelId, success/failure)
- **RNG:** Always use `crypto.randomInt()` — never `Math.random()`
- **Discord interactions:** Must acknowledge within 3 seconds. Use ephemeral replies for secret rolls. Use `MessageFlags.Ephemeral` (not the deprecated `ephemeral: true`)
- **Testing:** Vitest. Every new feature or parser change requires corresponding tests

## Agentic Rules

IMPORTANT: When making changes to this codebase, follow these rules strictly.

- **Plan before editing.** Always describe the change and rationale before writing code.
- **Small, atomic changes.** One logical change per commit. Do not bundle unrelated changes.
- **No new dependencies without justification.** Explain why an existing module or stdlib cannot be used.
- **Update tests when behavior changes.** If you modify parsing, rolling, store logic, or interaction handling, update or add tests.
- **Update docs when interfaces change.** If a command option changes, or a new feature is added, update README.md and this file.
- **Preserve security invariants.** See SECURITY.md. Do not weaken:
  - Reveal authorization checks (userId + channelId)
  - TTL expiration on the store
  - Rate limiting
  - Input validation (dice count cap, expression length, allowed die types)
  - Crypto-secure RNG usage
  - No-secrets-in-logs policy

## Safe Operations

- NEVER print, log, or expose ephemeral roll results in plaintext
- NEVER hardcode tokens, secrets, or credentials — use environment variables
- NEVER write to `.env`, `node_modules/`, or `dist/` during normal development
- NEVER disable TypeScript strict mode
- ALWAYS use `crypto.randomInt()` for dice rolls
- ALWAYS validate Discord interaction authorization before acting on button clicks
