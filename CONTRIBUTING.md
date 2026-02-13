# Contributing to DooM & Dastardlies Dice Bot

Thank you for considering contributing to this project! This document provides guidelines and instructions for contributing.

## About This Project

This Discord bot was created by **[Stefano Vetrini](https://stefanovetrini.itch.io)** to support the **[DooM & Dastardlies](https://stefanovetrini.itch.io/doom-and-dastardlies)** tabletop RPG. The game is a fantasy TTRPG about power, trust, and bold deception where players roll dice behind the screen—and this bot brings that mechanic to online play.

By contributing to this project, you're helping the DooM & Dastardlies community enjoy secret rolls in their Discord-based games!

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, use the bug report template and include:

- A clear and descriptive title
- Steps to reproduce the behavior
- Expected behavior vs actual behavior
- Environment details (Node.js version, OS, Discord.js version)
- Relevant logs (remember: never include bot tokens or secrets)

### Suggesting Features

Feature requests are welcome! Use the feature request template and include:

- A clear description of the feature
- Why this feature would be useful
- Example use cases
- Any potential implementation ideas

### Pull Requests

1. **Fork the repository** and create your branch from `main`:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Make your changes** following our coding standards (see below)

4. **Add tests** for any new functionality or bug fixes

5. **Run the test suite**:
   ```bash
   npm test
   npm run lint
   npm run format:check
   npm run typecheck
   ```

6. **Commit your changes** using [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add support for d100 dice"
   git commit -m "fix: resolve rate limit bypass issue"
   git commit -m "docs: update deployment instructions"
   ```

   Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

7. **Push to your fork** and submit a pull request

8. **Wait for review** - maintainers will review your PR and may request changes

## Development Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- A Discord bot token for testing

### Local Setup

1. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/DooMandDastardlies.git
   cd DooMandDastardlies
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` from the example:
   ```bash
   cp .env.example .env
   ```

4. Fill in your Discord credentials in `.env`

5. Register commands:
   ```bash
   npm run deploy-commands
   ```

6. Run the bot in development mode:
   ```bash
   npm run dev
   ```

## Coding Standards

### TypeScript

- **Strict mode enabled** - do not disable TypeScript strict checks
- Use `.js` extensions in import paths (required for proper module resolution)
- Prefer `const` over `let`; never use `var`
- Use explicit return types on exported functions
- Use `interface` for object shapes; `type` for unions and aliases

### Code Style

- **2-space indentation**
- **Max line length: 100 characters** (guideline, not enforced)
- Run `npm run format` before committing
- ESLint and Prettier configs are provided - your editor should auto-format

### Testing

- Test framework: **Vitest**
- Every new feature requires corresponding tests
- Tests go in `tests/` directory with `*.test.ts` naming
- Run tests with `npm test` or `npm run test:watch`

### Security Requirements

**CRITICAL:** Before submitting, ensure your changes maintain security invariants:

- ✅ **No secrets in code** - use environment variables only
- ✅ **No logging of roll results** - logs metadata only
- ✅ **Use `crypto.randomInt()`** - never `Math.random()`
- ✅ **Validate user input** - maintain caps on dice count, expression length
- ✅ **Check authorization** - verify userId and channelId on button interactions
- ✅ **Rate limiting** - don't bypass or weaken rate limits without justification

See [SECURITY.md](./SECURITY.md) for full security policy.

## Project Structure

```
src/
  index.ts                 # Bot entry point, client setup
  deploy-commands.ts       # Command registration script
  commands/
    roll.ts                # /roll command handler
  interactions/
    buttons.ts             # Reveal button handler
  lib/
    dice.ts                # Dice parser & roller (crypto RNG)
    store.ts               # TTL store for secret rolls
    ratelimit.ts           # Per-user rate limiter
    embeds.ts              # Discord embed builders
    logger.ts              # Structured JSON logger
tests/
  *.test.ts                # Unit tests (Vitest)
```

## Adding New Commands

When adding a new slash command:

1. Create handler in `src/commands/`
2. Register in `src/deploy-commands.ts`
3. Wire up in `src/index.ts` command handler
4. Add rate limiting if user-facing
5. Add tests
6. Update documentation

## Documentation

Keep documentation up to date:

- Update `README.md` for user-facing features
- Update `ARCHITECTURE.md` for architectural changes
- Update `SECURITY.md` for security-relevant changes
- Update `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Examples:**

```
feat(dice): add support for d100 dice
fix(reveal): prevent reveal button click after expiry
docs(readme): add deployment instructions for Railway
test(store): add TTL expiration edge case tests
chore(deps): update discord.js to v14.15.0
```

## Release Process

Maintainers handle releases:

1. Update `CHANGELOG.md` with version and date
2. Update version in `package.json`
3. Create git tag: `git tag v1.2.0`
4. Push tag: `git push origin v1.2.0`
5. GitHub Actions will create the release automatically

## Questions?

- Open an issue with the "question" template
- Check existing issues and discussions first
- See [SUPPORT.md](./SUPPORT.md) for help resources

## Attribution & Credits

This Discord bot exists to support **[DooM & Dastardlies](https://stefanovetrini.itch.io/doom-and-dastardlies)**, a tabletop RPG by **[Stefano Vetrini](https://stefanovetrini.itch.io)**. The game's unique "roll behind the screen" mechanic inspired this bot's secret roll functionality.

If you enjoy using this bot, consider checking out the original game at [stefanovetrini.itch.io/doom-and-dastardlies](https://stefanovetrini.itch.io/doom-and-dastardlies)!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
