# DooM & Dastardlies — Dice Roller Bot

[![CI](https://github.com/yourusername/DooMandDastardlies/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/DooMandDastardlies/actions/workflows/ci.yml)
[![CodeQL](https://github.com/yourusername/DooMandDastardlies/actions/workflows/codeql.yml/badge.svg)](https://github.com/yourusername/DooMandDastardlies/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

A Discord bot for the **DooM & Dastardlies** TTRPG. Its signature feature is **secret rolls**: dice results are initially visible only to the roller, who can reveal them to the channel with a button click.

> **🎲 Roll behind the screen.** Perfect for game masters and players who want to keep their dice results hidden until the right moment.

## About the Original Game

**[DooM & Dastardlies](https://stefanovetrini.itch.io/doom-and-dastardlies)** is a fantasy tabletop RPG about power, trust, and bold deception where players roll the dice behind the screen. Created by **[Stefano Vetrini](https://stefanovetrini.itch.io)**, this game puts a unique twist on traditional TTRPGs: players secretly roll their own dice, and the Game Master must decide whether to believe them.

**Game Details:**
- 🎲 **Players:** 3–6
- ⏱️ **Play Time:** 3–4 hours per session
- 📖 **Status:** Currently in playtest
- 🔗 **Get the Game:** [stefanovetrini.itch.io/doom-and-dastardlies](https://stefanovetrini.itch.io/doom-and-dastardlies)

This Discord bot brings the "roll behind the screen" mechanic to online play, making it easy for players to roll secretly and reveal their results when dramatically appropriate.

## Table of Contents

- [About the Original Game](#about-the-original-game)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Security](#security)
- [Support](#support)
- [License](#license)
- [Author](#author)

## Features

- **Secret rolls by default** — results are ephemeral (only the roller sees them)
- **Reveal button** — post the result publicly when you're ready
- **Composite dice pools** — `2d4+1d8`, `2d4, 1d8`, `2d4 1d8` all work
- **Polyhedral dice** — d4, d6, d8, d10, d12, d20
- **Public roll option** — use `secret:false` to roll openly
- **Rate limiting** — 5 rolls per 10 seconds per user
- **Crypto-grade RNG** — uses Node.js `crypto.randomInt`
- **10-minute TTL** — unrevealed rolls expire automatically

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- A **Discord application** with a bot user ([Discord Developer Portal](https://discord.com/developers/applications))

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd DooMandDastardlies
npm install
```

### 2. Open in VS Code

This repo includes a `.vscode/` folder with recommended settings. When you open the project, VS Code will prompt you to install recommended extensions:

- **Claude Code** (`anthropic.claude-code`) — AI-assisted development
- **ESLint** (`dbaeumer.vscode-eslint`) — linting
- **Prettier** (`esbenp.prettier-vscode`) — formatting
- **TypeScript Next** (`ms-vscode.vscode-typescript-next`) — latest TS language features

To install them manually: open the Command Palette (`Ctrl+Shift+P`) → "Extensions: Show Recommended Extensions".

### 3. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DISCORD_BOT_TOKEN=your-bot-token-here
DISCORD_CLIENT_ID=your-client-id-here
DISCORD_GUILD_ID=your-test-guild-id    # optional, for dev
```

**Where to find these values:**
- **Bot Token**: Discord Developer Portal → Your App → Bot → Reset Token
- **Client ID**: Discord Developer Portal → Your App → General Information → Application ID
- **Guild ID**: Right-click your Discord server → Copy Server ID (enable Developer Mode in Discord settings)

### 4. Register slash commands

```bash
npm run deploy-commands
```

- With `DISCORD_GUILD_ID` set: commands register instantly for that server (good for development).
- Without `DISCORD_GUILD_ID`: commands register globally (can take up to 1 hour to propagate).

### 5. Invite the bot to your server

Use this URL pattern (replace `YOUR_CLIENT_ID`):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2048&scope=bot%20applications.commands
```

Required permissions:
- `Send Messages` (2048)
- `applications.commands` scope

### 6. Run the bot

**Development** (with ts-node):
```bash
npm run dev
```

**Production** (compiled):
```bash
npm run build
npm start
```

**From VS Code tasks** (`Ctrl+Shift+P` → "Tasks: Run Task"):
- **Install** — `npm install`
- **Build** — `npm run build` (default build task, also `Ctrl+Shift+B`)
- **Dev** — `npm run dev` (runs in a dedicated terminal)
- **Test** — `npm test` (default test task)
- **Test (Watch)** — `npm run test:watch`
- **Deploy Commands** — `npm run deploy-commands`

**Debugging** (`F5` in VS Code):
- **Debug Bot** — runs `src/index.ts` with ts-node and the VS Code debugger attached
- **Debug Deploy Commands** — runs `src/deploy-commands.ts` with debugger
- **Debug Current Test File** — runs the currently open test file with Vitest

## Usage

### Basic rolls

```
/roll dice:d20
/roll dice:2d6
/roll dice:2d4+1d8
/roll dice:2d4, 1d8
```

### With a reason

```
/roll dice:2d6 reason:attack
```

### Public roll (not secret)

```
/roll dice:d20 secret:false
```

### Revealing a secret roll

When you make a secret roll:

1. **Everyone sees:** A public message announcing "User rolled dice in secret" with a "Reveal Result" button
2. **Only you see:** An ephemeral message (visible only to you) showing your actual roll results
3. **To reveal:** Click the "Reveal Result" button on the public message
4. **Result:** The public message is edited to show your roll results to everyone

Rolls expire after 10 minutes. If you don't reveal in time, you'll need to roll again.

## Project Structure

```
src/
  index.ts                 # Bot entry point
  deploy-commands.ts       # Slash command registration script
  commands/
    roll.ts                # /roll command handler
  interactions/
    buttons.ts             # Reveal button handler
  lib/
    dice.ts                # Dice expression parser & roller
    store.ts               # In-memory TTL store for secret rolls
    ratelimit.ts           # Per-user rate limiter
    embeds.ts              # Discord embed builders
    logger.ts              # Structured JSON logger
tests/
  dice.test.ts             # Dice parser & roller tests
  store.test.ts            # TTL store tests
  ratelimit.test.ts        # Rate limiter tests
.claude/
  settings.json            # Shared Claude Code project settings
  rules/
    security.md            # Security rules (auto-loaded by Claude Code)
    code-style.md          # Code style rules (auto-loaded by Claude Code)
.vscode/
  extensions.json          # Recommended VS Code extensions
  settings.json            # Shared editor settings
  tasks.json               # Build/test/dev tasks
  launch.json              # Debug configurations
```

## Testing

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Check code formatting
npm run format:check

# Format code
npm run format

# Type check
npm run typecheck
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines on:

- Setting up your development environment
- Coding standards and style guide
- How to submit pull requests
- Security requirements
- Testing expectations

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run the full test suite: `npm test && npm run lint && npm run typecheck`
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/): `git commit -m "feat: add new feature"`
6. Push and create a pull request

## Security

Security is a top priority for this project. Please see [SECURITY.md](./SECURITY.md) for:

- Supported versions
- How to report security vulnerabilities (privately)
- Security best practices for deployment
- Our security policies and guarantees

**Never include bot tokens or secrets in issues or pull requests!**

## Support

Need help? Check out [SUPPORT.md](./SUPPORT.md) for resources:

- Documentation links
- How to ask questions
- Common issues and solutions
- Where to get help

## Topics

When publishing this repository, consider adding these GitHub topics:

`discord-bot` `dice-roller` `ttrpg` `discord-js` `typescript` `secret-rolls` `rpg` `tabletop-gaming` `dungeons-and-dragons` `bot`

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Author

**Stefano Vetrini**

- 🎲 Creator of [DooM & Dastardlies TTRPG](https://stefanovetrini.itch.io/doom-and-dastardlies)
- 🌐 itch.io: [stefanovetrini.itch.io](https://stefanovetrini.itch.io)
- 💬 This bot was created to support the DooM & Dastardlies tabletop RPG community

## Acknowledgments

- **Original Game:** [DooM & Dastardlies](https://stefanovetrini.itch.io/doom-and-dastardlies) by Stefano Vetrini
- Built with [discord.js](https://discord.js.org/) v14
- Uses cryptographically secure RNG from Node.js `crypto` module
- Follows [Conventional Commits](https://www.conventionalcommits.org/) specification
- Community health files based on GitHub best practices

## Claude Code Integration

This repo is configured for [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) out of the box.

### What is committed (shared with the team)

| File | Purpose |
|---|---|
| `CLAUDE.md` | Project context, coding standards, agentic rules — loaded every session |
| `AGENTS.md` | Protocols for AI-assisted development (change, security, interaction) |
| `.claude/settings.json` | Project-wide Claude Code settings (permission deny rules for `.env`, `dist/`, `node_modules/`) |
| `.claude/rules/security.md` | Security rules auto-loaded at session start |
| `.claude/rules/code-style.md` | Code style rules auto-loaded at session start |

### What is NOT committed (local-only)

| File | Purpose |
|---|---|
| `CLAUDE.local.md` | Personal project-specific instructions (auto-gitignored by Claude Code) |
| `.claude/settings.local.json` | Personal project overrides (auto-gitignored) |
| `~/.claude/CLAUDE.md` | Your global personal Claude Code memory (home directory) |
| `~/.claude/settings.json` | Your global personal settings (home directory) |

### Usage tips

- Claude Code reads `CLAUDE.md` at session start for project context.
- Modular rules in `.claude/rules/` are auto-loaded — add new `.md` files there for domain-specific guidance.
- If you need personal overrides, create `CLAUDE.local.md` in the project root (it won't be committed).
- The `.claude/settings.json` prevents Claude Code from reading `.env`, `dist/`, and `node_modules/`.

## Deployment

### Systemd (Linux)

Create `/etc/systemd/system/doom-dice-bot.service`:

```ini
[Unit]
Description=DooM & Dastardlies Dice Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/DooMandDastardlies
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
EnvironmentFile=/path/to/DooMandDastardlies/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable doom-dice-bot
sudo systemctl start doom-dice-bot
```

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
CMD ["node", "dist/index.js"]
```

```bash
npm run build
docker build -t doom-dice-bot .
docker run -d --env-file .env doom-dice-bot
```

### Cloud (Railway, Render, Fly.io)

Set the environment variables in the platform's dashboard and deploy. Use `npm run build && npm start` as the start command.

## Required Discord Intents

- `Guilds` — needed for slash command and channel access

No privileged intents (Message Content, Presence, Guild Members) are required.

## Documentation

### For Users and Contributors

| Document | Description |
|---|---|
| [README.md](./README.md) | You are here! Setup, usage, and overview |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute (required reading for contributors) |
| [SECURITY.md](./SECURITY.md) | Security policies and vulnerability reporting |
| [SUPPORT.md](./SUPPORT.md) | How to get help |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Community standards and expectations |
| [CHANGELOG.md](./CHANGELOG.md) | Version history and release notes |
| [LICENSE](./LICENSE) | MIT License text |

### For Developers and Maintainers

| Document | Description |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Component diagram, data flows, storage model |
| [AGENTS.md](./AGENTS.md) | Agentic development protocols for AI-assisted changes |
| [CLAUDE.md](./CLAUDE.md) | Project context and rules for Claude Code sessions |
