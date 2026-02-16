# DooM & Dastardlies — Dice Roller Bot

[![CI](https://github.com/ningod/DooMandDastardlies/actions/workflows/ci.yml/badge.svg)](https://github.com/ningod/DooMandDastardlies/actions/workflows/ci.yml)
[![CodeQL](https://github.com/ningod/DooMandDastardlies/actions/workflows/codeql.yml/badge.svg)](https://github.com/ningod/DooMandDastardlies/actions/workflows/codeql.yml)
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

- **Multiple commands** — `/roll` (public default), `/secret` (secret default), plus `/r` and `/s` shortcuts
- **Secret rolls** — results are ephemeral (only the roller sees them) with a "Reveal Result" button
- **Labeled rolls** — `(VIG) 2d20 + (Damage) 1d8` groups results by label with subtotals
- **Roll with comment** — add an optional comment to any roll (max 120 characters)
- **Composite dice pools** — `2d4+1d8`, `2d4, 1d8`, `2d4 1d8` all work
- **Polyhedral dice** — d4, d6, d8, d10, d12, d20
- **Rate limiting** — 5 rolls per 10 seconds per user
- **Crypto-grade RNG** — uses Node.js `crypto.randomInt`
- **10-minute TTL** — unrevealed rolls expire automatically
- **Built-in help** — `/help` shows full syntax reference

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
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=18432&scope=bot%20applications.commands
```

Required permissions:

- `Send Messages`
- `Embed Links`
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

### Labeled rolls

```
/roll dice:(Finesse) 2d20
/secret dice:(Arcane Magic) 1d20
```

### With a comment

```
/roll dice:3d20 comment:Soul check
```

### Secret roll (two ways)

```
/secret dice:d20            # secret by default
/roll dice:d20 secret:true  # explicit override
```

### Shortcuts

```
/r dice:2d6      # alias for /roll (public default)
/s dice:d20      # alias for /secret (secret default)
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
    roll.ts                # /roll, /r, /secret, /s — shared handler
    help.ts                # /help command
  interactions/
    buttons.ts             # Reveal button handler
  lib/
    dice.ts                # Dice expression parser (with labels) & roller
    store.ts               # In-memory TTL store for secret rolls
    ratelimit.ts           # Per-user rate limiter
    embeds.ts              # Discord embed builders
    logger.ts              # Structured JSON logger
tests/
  dice.test.ts             # Dice parser & roller tests (including labels)
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

| File                          | Purpose                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                   | Project context, coding standards, agentic rules — loaded every session                        |
| `AGENTS.md`                   | Protocols for AI-assisted development (change, security, interaction)                          |
| `.claude/settings.json`       | Project-wide Claude Code settings (permission deny rules for `.env`, `dist/`, `node_modules/`) |
| `.claude/rules/security.md`   | Security rules auto-loaded at session start                                                    |
| `.claude/rules/code-style.md` | Code style rules auto-loaded at session start                                                  |

### What is NOT committed (local-only)

| File                          | Purpose                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `CLAUDE.local.md`             | Personal project-specific instructions (auto-gitignored by Claude Code) |
| `.claude/settings.local.json` | Personal project overrides (auto-gitignored)                            |
| `~/.claude/CLAUDE.md`         | Your global personal Claude Code memory (home directory)                |
| `~/.claude/settings.json`     | Your global personal settings (home directory)                          |

### Usage tips

- Claude Code reads `CLAUDE.md` at session start for project context.
- Modular rules in `.claude/rules/` are auto-loaded — add new `.md` files there for domain-specific guidance.
- If you need personal overrides, create `CLAUDE.local.md` in the project root (it won't be committed).
- The `.claude/settings.json` prevents Claude Code from reading `.env`, `dist/`, and `node_modules/`.

## Deployment

This bot is deployed on [Fly.io](https://fly.io). The repository includes a production-ready `Dockerfile` and `fly.toml`.

### Prerequisites

- A [Fly.io account](https://fly.io/docs/getting-started/sign-up/)
- The `flyctl` CLI installed — see [Install flyctl](https://fly.io/docs/flyctl/install/)
- Authenticated via `fly auth login`
- Your Discord bot token and client ID (see [Setup](#setup))

### Configuration overview

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build: installs deps, compiles TypeScript, prunes dev deps, runs `node dist/index.js` |
| `.dockerignore` | Excludes `node_modules/`, `dist/`, `.env`, test/coverage files from the Docker context |
| `fly.toml` | Fly.io app configuration — app name, region, VM size, process settings |

The `Dockerfile` uses a Node.js 22 slim base image with a two-stage build to keep the final image small. Only production dependencies and the compiled `dist/` output are included in the deployed image.

### 1. Create the Fly.io app (first time only)

If you are setting up the app for the first time:

```bash
fly launch --no-deploy
```

This generates a `fly.toml` if one doesn't exist. Since this repo already includes a `fly.toml`, you can skip this step and go straight to setting secrets.

If you need to adopt the existing config under your Fly.io account:

```bash
fly apps create doomanddastardlies --org personal
```

### 2. Set secrets

Secrets are encrypted and injected as environment variables at runtime. **Never** commit them to the repository.

```bash
fly secrets set DISCORD_BOT_TOKEN=your-bot-token-here
fly secrets set DISCORD_CLIENT_ID=your-client-id-here
```

To verify which secrets are set (values are not shown):

```bash
fly secrets list
```

To update a secret, run `fly secrets set` again with the new value. The machine restarts automatically when secrets change.

### 3. Deploy

```bash
fly deploy
```

This builds the Docker image remotely on Fly.io's builders, pushes it to the internal registry, and creates/updates the machine. On first deploy, Fly provisions the machine in the configured region.

To watch the build output and verify success:

```bash
fly deploy --verbose
```

### 4. Register slash commands

After the first deploy (or whenever commands change), register the slash commands with Discord. Run this **locally** — it only needs to happen once per command schema change:

```bash
npm run deploy-commands
```

Without `DISCORD_GUILD_ID`, commands register globally (can take up to 1 hour to propagate). With `DISCORD_GUILD_ID` set in your local `.env`, they register instantly for that server.

### 5. Verify the deployment

Check that the machine is running:

```bash
fly status
```

View recent logs to confirm the bot connected to Discord:

```bash
fly logs
```

You should see a `ready` log entry with the bot's tag and guild count.

### fly.toml reference

```toml
app = 'doomanddastardlies'
primary_region = 'iad'

[build]
# Uses the Dockerfile in the repo root

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 1
  processes = ['app']

[[vm]]
  memory = '1gb'
  cpu_kind = 'shared'
  cpus = 1
  memory_mb = 1024
```

| Setting | Purpose |
|---|---|
| `primary_region` | `iad` (Ashburn, Virginia). Choose a region close to your users — see `fly platform regions` |
| `min_machines_running = 1` | Keeps the bot online at all times. A Discord bot must maintain a persistent WebSocket connection |
| `auto_stop_machines = 'stop'` | Fly stops idle machines, but `min_machines_running = 1` ensures at least one stays active |
| `memory_mb = 1024` | 1 GB RAM — sufficient for the bot and its in-memory TTL store |
| `cpu_kind = 'shared'` | Shared CPU is adequate for a low-traffic Discord bot |

### Monitoring and logs

View live logs:

```bash
fly logs --app doomanddastardlies
```

The bot uses structured JSON logging (see [src/lib/logger.ts](src/lib/logger.ts)). Log entries include metadata like user ID, channel ID, command name, and success/failure — but **never** actual roll results.

Check machine status and resource usage:

```bash
fly status
fly machine list
```

### Redeploying

After pushing code changes, redeploy with:

```bash
fly deploy
```

Fly.io performs a rolling update — the new machine starts before the old one is stopped, minimizing downtime.

### Scaling

The bot runs on a single machine by default. To change the VM size or region:

```bash
# Change VM size
fly scale vm shared-cpu-1x --memory 512

# Add a machine in a different region
fly scale count 1 --region lhr
```

For most Discord bots serving a small-to-medium number of servers, a single `shared-cpu-1x` machine with 256–1024 MB of RAM is sufficient.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Bot not responding to commands | Secrets not set or wrong | `fly secrets list`, re-set if needed |
| "Unknown interaction" errors | Slash commands not registered | Run `npm run deploy-commands` locally |
| Machine keeps restarting | Crash in bot startup (bad token, etc.) | `fly logs` to see the error |
| Bot goes offline periodically | `min_machines_running` set to 0 | Ensure `min_machines_running = 1` in `fly.toml` |

## Required Discord Intents

- `Guilds` — needed for slash command and channel access

No privileged intents (Message Content, Presence, Guild Members) are required.

## Documentation

### For Users and Contributors

| Document                                   | Description                                           |
| ------------------------------------------ | ----------------------------------------------------- |
| [README.md](./README.md)                   | You are here! Setup, usage, and overview              |
| [CONTRIBUTING.md](./CONTRIBUTING.md)       | How to contribute (required reading for contributors) |
| [SECURITY.md](./SECURITY.md)               | Security policies and vulnerability reporting         |
| [SUPPORT.md](./SUPPORT.md)                 | How to get help                                       |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Community standards and expectations                  |
| [CHANGELOG.md](./CHANGELOG.md)             | Version history and release notes                     |
| [LICENSE](./LICENSE)                       | MIT License text                                      |

### For Developers and Maintainers

| Document                             | Description                                           |
| ------------------------------------ | ----------------------------------------------------- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Component diagram, data flows, storage model          |
| [AGENTS.md](./AGENTS.md)             | Agentic development protocols for AI-assisted changes |
| [CLAUDE.md](./CLAUDE.md)             | Project context and rules for Claude Code sessions    |
