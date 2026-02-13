# Support

## Getting Help

If you need help with the DooM & Dastardlies Dice Bot, here are your options:

### Documentation

First, check the documentation:

- **[README.md](./README.md)** - Setup, usage, and deployment instructions
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - How the bot works internally
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Development setup and coding standards
- **[SECURITY.md](./SECURITY.md)** - Security policies and best practices

### GitHub Issues

If the documentation doesn't answer your question:

1. **Search existing issues** - your question may have been answered already
2. **Open a new issue** using the "question" template
3. **Be specific** - include relevant details (Node.js version, OS, error messages)

**Remember:** Never include bot tokens or secrets in issues!

### GitHub Discussions

For general discussion, ideas, or showing off your setup, use [GitHub Discussions](../../discussions) (if enabled for this repo).

### Discord

If you're part of a DooM & Dastardlies community server, ask there! Many users may have encountered similar issues.

## Common Issues

### Bot not responding to commands

- Verify the bot is online (check Discord server member list)
- Ensure commands were deployed: `npm run deploy-commands`
- Check bot permissions: needs "Send Messages" and "Use Slash Commands"
- Review logs for errors

### "Interaction failed" error

- Bot must respond within 3 seconds of command invocation
- Check if bot is rate-limited or overloaded
- Review logs for timeout or network errors

### Reveal button doesn't work

- Rolls expire after 10 minutes
- Only the original roller can reveal their rolls
- Button must be clicked in the same channel as the original roll

### TypeScript or build errors

- Delete `node_modules/` and `dist/` folders
- Run `npm install` to reinstall dependencies
- Run `npm run build` to rebuild

## Contributing

Want to fix a bug or add a feature? See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Security Issues

**Do not report security vulnerabilities as public issues.** See [SECURITY.md](./SECURITY.md) for how to report security issues privately.

## Project Status

This is an actively maintained open-source project. Response times may vary based on maintainer availability.

## About the Game

This bot was created to support **[DooM & Dastardlies](https://stefanovetrini.itch.io/doom-and-dastardlies)**, a fantasy tabletop RPG by **[Stefano Vetrini](https://stefanovetrini.itch.io)** where players roll dice behind the screen. The game is currently in playtest and available at:

🎲 **[stefanovetrini.itch.io/doom-and-dastardlies](https://stefanovetrini.itch.io/doom-and-dastardlies)**

If you're enjoying the bot, check out the original game!
