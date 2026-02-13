# DooM & Dastardlies — Dice Roller Bot

## Project Purpose

Discord dice roller bot for the **DooM & Dastardlies** TTRPG. The signature mechanic is **"rolling behind the screen"**: dice results are secret by default (ephemeral to the roller) and can be revealed publicly via a button click.

## Critical UX Constraints

- **Secret rolls are the default.** The `secret` option defaults to `true`.
- **Ephemeral → Reveal flow:** The initial reply is ephemeral (only the roller sees it). A "Reveal to Channel" button sends a **new public message** to the channel. The ephemeral message is then updated with a disabled "Revealed" button.
- **No re-rolling on reveal.** The exact rolled values are preserved in the TTL store and posted as-is.
- **Only the roller can reveal.** Button handler must verify `userId` and `channelId` match.
- **10-minute TTL.** Unrevealed rolls expire; clicking reveal after expiry shows a friendly error.

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
  deploy-commands.ts       — One-shot script to register /roll with Discord API
  commands/roll.ts         — /roll slash command handler
  interactions/buttons.ts  — "Reveal to Channel" button handler
  lib/
    dice.ts                — Dice expression parser + crypto-secure roller
    store.ts               — In-memory TTL store for pending secret rolls
    ratelimit.ts           — Per-user sliding-window rate limiter
    embeds.ts              — Discord embed builders (roll result, errors)
    logger.ts              — Structured JSON logger (metadata only, never secrets)
tests/
  dice.test.ts             — Parser + roller unit tests
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
