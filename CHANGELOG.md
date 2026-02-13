# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

**About This Project:** This Discord bot was created by [Stefano Vetrini](https://stefanovetrini.itch.io) to support [DooM & Dastardlies](https://stefanovetrini.itch.io/doom-and-dastardlies), a tabletop RPG where players roll dice behind the screen.

---

## [Unreleased]

### Added
- Initial public release preparation
- GitHub Actions CI/CD pipeline
- Community health files (CODE_OF_CONDUCT, CONTRIBUTING, SECURITY)
- ESLint and Prettier configuration
- Issue and pull request templates

## [1.0.0] - 2026-02-12

### Added
- `/roll` slash command for dice rolling
- Secret rolls by default (ephemeral to roller)
- "Reveal to Channel" button for publishing secret rolls
- Support for polyhedral dice (d4, d6, d8, d10, d12, d20)
- Composite dice pool expressions (e.g., `2d4+1d8`)
- Public roll option via `secret:false` parameter
- Rate limiting (5 rolls per 10 seconds per user)
- Cryptographically secure RNG using `crypto.randomInt()`
- 10-minute TTL for unrevealed rolls
- User authorization checks for reveal actions
- Structured JSON logging (metadata only, no roll results)
- Comprehensive test suite with Vitest
- Full TypeScript strict mode support

### Security
- Input validation (max 100 char expressions, max 50 dice)
- No secrets in logs policy
- Rate limiting to prevent abuse
- Authorization checks on button interactions
- Crypto-secure random number generation

[unreleased]: https://github.com/yourusername/DooMandDastardlies/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/DooMandDastardlies/releases/tag/v1.0.0
