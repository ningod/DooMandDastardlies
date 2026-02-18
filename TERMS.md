# Terms of Service — DooM & Dastardlies Dice Roller Bot

**Last updated: 2026-02-18**

These Terms of Service ("Terms") govern your use of the **DooM & Dastardlies Dice Roller Bot**
("the Bot"), a Discord application operated by Stefano Vetrini ("the Developer").

---

## 1. Acceptance of Terms

By adding the Bot to a Discord server or using any of its commands, you ("the User") agree to be
bound by these Terms. If you do not agree, you must remove the Bot from your server and stop using
it immediately.

Your continued use of the Bot following any update to these Terms constitutes acceptance of the
revised Terms. The Developer will update the **Last updated** date above when changes are made.

---

## 2. Description of the Bot

The Bot is a **random number generator (RNG) tool** designed for use with the _DooM & Dastardlies_
tabletop role-playing game and similar applications. Its features include:

- Rolling polyhedral dice (d4, d6, d8, d10, d12, d20) via Discord slash commands
- Secret rolls visible only to the rolling user, with an optional public reveal
- Labeled roll groups and optional roll comments
- Event timers for session management

---

## 3. Disclaimer of Liability — "As Is" Service

THE BOT IS PROVIDED **"AS IS"** AND **"AS AVAILABLE"** WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE, ACCURACY, OR UNINTERRUPTED AVAILABILITY.

**The Developer expressly disclaims all liability for:**

- Any technical failures, outages, or unexpected behavior of the Bot
- Any decisions made based on dice results produced by the Bot
- **Any losses — virtual, monetary, reputational, or otherwise — arising from the use of the Bot
  for gambling, wagering, contests, competitions, or any activity where outcomes carry real or
  perceived consequences**

The Bot's RNG uses Node.js `crypto.randomInt()` (a cryptographically secure source), but no
warranty is made as to statistical fairness, bias, or fitness for any specific game or contest.
**Use the Bot for high-stakes purposes entirely at your own risk.**

---

## 4. Acceptable Use

You agree **not** to:

- **Spam commands** or submit roll requests at a rate designed to degrade service for other users
- **Attempt to exploit, bypass, or circumvent** the Bot's built-in rate limits
- **Reverse-engineer, decompile, or attempt to predict** the Bot's RNG algorithm or internal state
- **Abuse the secret-roll reveal system** (e.g., impersonating another user to reveal their roll)
- Use the Bot in any way that violates applicable laws or third-party rights
- Use the Bot to harass, harm, or threaten other Discord users

The Developer reserves the right to determine, at sole discretion, what constitutes a violation of
these rules.

---

## 5. Data and Privacy

The Bot processes the **minimum data necessary** to operate its features:

| Data Collected | Purpose |
|---|---|
| Discord User ID | Identify the roller; enforce "only the roller can reveal" authorization |
| Discord Channel ID | Scope secret roll reveals to the originating channel |
| Discord Server (Guild) ID | Scope timer events to the correct channel |
| Dice expression and roll results | Temporary in-memory or Redis storage (max 10-minute TTL) to support the reveal flow |

**The Bot does not:**

- Store roll results permanently
- Share data with third parties
- Log actual dice results (only metadata such as command name and success/failure)
- Collect any personally identifiable information beyond Discord IDs

Data stored in the temporary session store (in-memory or Redis) is automatically deleted after
**10 minutes** or upon a restart when in-memory mode is used.

For questions about data handling, contact the Developer via the repository's
[issue tracker](https://github.com/ningod/DooMandDastardlies/issues).

---

## 6. Discord Compliance

All users must comply with:

- [Discord's Terms of Service](https://discord.com/terms)
- [Discord's Community Guidelines](https://discord.com/guidelines)

The Developer is not affiliated with Discord Inc. Server administrators are responsible for ensuring
the Bot is used within their server in a manner consistent with Discord's policies.

---

## 7. Age Restriction

Discord requires users to be **at least 13 years of age** (or the minimum age of digital consent
in their jurisdiction, if higher) to create an account. The Bot inherits this requirement. By using
the Bot, you confirm that you meet Discord's minimum age requirement.

---

## 8. Termination and Suspension

The Developer reserves the right, without prior notice or liability, to:

- **Block** individual users from interacting with the Bot
- **Remove** the Bot from any Discord server
- **Suspend or terminate** access for any user or server found to be in violation of these Terms

In the event of termination, any pending secret rolls or active timers will cease to function.

---

## 9. Changes to These Terms

The Developer may update these Terms at any time. The **Last updated** date at the top of this
document will reflect the most recent revision. Continued use of the Bot after an update constitutes
acceptance of the new Terms.

---

## 10. Contact

For questions, concerns, or abuse reports, please open an issue on the GitHub repository:

- **Repository:** <https://github.com/ningod/DooMandDastardlies>
- **Author:** Stefano Vetrini — <https://stefanovetrini.itch.io>

---

_This document does not constitute legal advice. Consult a qualified attorney for legal matters._
