# Security Policy

This document defines the security requirements and policies for the DooM & Dastardlies dice roller bot.

## Secret Management

- **Bot token** (`DISCORD_BOT_TOKEN`) and **client ID** (`DISCORD_CLIENT_ID`) are loaded exclusively from environment variables via `dotenv`.
- **No secrets are hardcoded** in source files, configuration, or documentation.
- `.env` and `.env.*` files (except `.env.example`) are excluded from version control via `.gitignore`.
- `.env.example` contains only placeholder values and variable names.

## HTTP Mode — Signature Verification

When running in HTTP interactions mode (`INTERACTIONS_MODE=http`), the bot verifies every incoming request using Ed25519 signatures per the [Discord HTTP interactions spec](https://discord.com/developers/docs/interactions/overview#setting-up-an-endpoint).

- **`DISCORD_PUBLIC_KEY`** is required for HTTP mode. It is the application's public verification key from the Discord Developer Portal.
- **`DISCORD_PUBLIC_KEY` is NOT a secret** — it is a public key used only for verification. It is safe to commit in `fly.toml` env or similar non-secret configuration.
- Requests with missing or invalid signatures receive a `401 Unauthorized` response.
- Signature verification uses Node.js native `crypto.subtle` (Ed25519) — no external cryptographic dependencies.

## Redis Credentials (Optional)

When the optional Redis storage backend is enabled (`STORAGE_BACKEND=redis`), two additional secrets are required:

- **`UPSTASH_REDIS_REST_URL`** — the Upstash Redis REST endpoint
- **`UPSTASH_REDIS_REST_TOKEN`** — the authentication token

**Security requirements:**

- These values **must** be set via environment variables or `fly secrets set`. They must **never** appear in `fly.toml`, source code, or committed files.
- The only Redis-related value safe to commit is `STORAGE_BACKEND` (which is `"memory"` by default).
- Redis data is protected by Upstash's TLS-encrypted REST API — all traffic is HTTPS.
- Atomic operations (Lua scripts) are used for the `claim()` operation to prevent race conditions during secret roll reveals.

## Logging Policy

The bot uses a structured JSON logger (`src/lib/logger.ts`).

**What IS logged** (metadata only):
- User ID
- Dice expression (e.g., `"2d6"`)
- Channel ID
- Whether the roll was secret or public
- Timestamps
- Error messages (without stack traces in production)

**What is NEVER logged:**
- Actual dice roll results (individual values or totals)
- Ephemeral message content
- Bot token or any credentials
- Full interaction payloads

## Input Validation Policy

All user input passes through strict validation before processing:

| Constraint | Limit | Enforced In |
|---|---|---|
| Expression length | Max 200 characters | `dice.ts` → `parseDice()` |
| Total dice count | Max 50 | `dice.ts` → `parseDice()` |
| Allowed die types | d4, d6, d8, d10, d12, d20 | `dice.ts` → `VALID_SIDES` |
| Dice count per group | Min 1 | `dice.ts` → `parseDice()` |
| Token format | Must match `/^\d*d\d+$/` | `dice.ts` → `parseDice()` |
| Label length | Max 32 characters | `dice.ts` → `parseDice()` |
| Label characters | Letters, digits, spaces, underscores, hyphens | `dice.ts` → `LABEL_PATTERN` |
| Comment length | Max 120 characters | `embeds.ts` → `MAX_COMMENT_LENGTH` |
| Comment sanitization | @mentions replaced with safe text | `roll.ts` → `sanitizeComment()` |

Invalid input produces a user-friendly error embed with usage examples. No stack traces or internal details are exposed.

## Interaction Authorization

### Reveal Button Authorization

When a user clicks "Reveal Result", the button handler (`src/interactions/buttons.ts`) performs three checks:

1. **Existence check:** The roll ID must exist in the TTL store (not expired, not already revealed).
2. **User check:** `interaction.user.id` must match `storedRoll.userId`.
3. **Channel check:** `interaction.channelId` must match `storedRoll.channelId`.

If any check fails, the user receives an ephemeral error. No roll data is exposed.

### Anti-Replay

- Each roll is stored with a UUID (`v4`). UUIDs are opaque and non-sequential.
- After a successful reveal, the roll is **deleted from the store**, preventing duplicate reveals.
- The public announcement message is edited to show results and the button is removed.
- The ephemeral message is updated to confirm the reveal.
- Rolls expire after 10 minutes (configurable TTL), preventing stale reveals.

## Rate Limiting Policy

The bot enforces a sliding-window rate limiter (`src/lib/ratelimit.ts`):

| Parameter | Value |
|---|---|
| Max actions per window | 5 |
| Window duration | 10 seconds |
| Scope | Per user ID |

When rate-limited, the user receives an ephemeral error with a retry-after countdown. This prevents:
- Command spam
- Store exhaustion from rapid roll creation
- API abuse

## Random Number Generation

All dice rolls use `crypto.randomInt()` from Node.js's `node:crypto` module. This provides cryptographically secure pseudo-random numbers suitable for fair dice rolling. `Math.random()` is never used.

## Dependency Policy

- Dependencies are minimal: `discord.js`, `dotenv`, `uuid`, `@upstash/redis` (optional, for Redis persistence).
- New dependencies require explicit justification.
- `npm audit` should be run periodically to check for known vulnerabilities.
- Dev dependencies (`typescript`, `vitest`, `ts-node`, type packages) are not included in production builds.

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting Vulnerabilities

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please report it privately:

1. **Email:** Send details to the repository maintainers (add your contact email here when publishing)
2. **GitHub Security Advisories:** Use the "Security" tab → "Report a vulnerability" on GitHub
3. **Expected Response Time:** We aim to respond within 48 hours

### What to Include

Please include the following in your report:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### What to Expect

- We will acknowledge receipt of your vulnerability report
- We will confirm the vulnerability and determine its impact
- We will release a fix as soon as possible
- We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices for Users

When deploying this bot:

- **Never commit `.env` files** to version control
- **Use environment variables** for all secrets (bot token, client ID)
- **Keep dependencies updated** - run `npm audit` regularly
- **Review logs carefully** - this bot does not log roll results, but verify this in your deployment
- **Use read-only file system** where possible in production
- **Run with minimal permissions** - bot only needs "Send Messages" and "Use Slash Commands"

## Attribution & Credits

This Discord bot was created by **[Stefano Vetrini](https://stefanovetrini.itch.io)** to support **[DooM & Dastardlies](https://stefanovetrini.itch.io/doom-and-dastardlies)**, a tabletop RPG about power, trust, and deception. The bot implements the game's signature "roll behind the screen" mechanic for online play.

For more information about the original game, visit: [stefanovetrini.itch.io/doom-and-dastardlies](https://stefanovetrini.itch.io/doom-and-dastardlies)
