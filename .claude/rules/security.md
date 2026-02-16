# Security Rules

These rules are auto-loaded by Claude Code at the start of every session.

## Absolute Prohibitions

- NEVER log, print, or return actual dice roll results in log output
- NEVER hardcode tokens, secrets, or credentials in source files
- NEVER use `Math.random()` for dice rolls — always use `crypto.randomInt()`
- NEVER allow a user other than the original roller to reveal a secret roll
- NEVER skip `userId` or `channelId` verification in button handlers

## Input Validation

- Reject dice expressions longer than 200 characters
- Cap total dice count at 50
- Only allow polyhedral dice: d4, d6, d8, d10, d12, d20
- Reject malformed tokens with user-friendly error messages including examples

## Rate Limiting

- Enforce per-user rate limit (currently 5 rolls per 10 seconds)
- Any new user-facing interaction must be rate-limited or justified as exempt
