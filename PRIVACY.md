# Privacy Policy — DooM & Dastardlies Dice Roller Bot

**Last updated: 2026-02-18**

This Privacy Policy explains how the **DooM & Dastardlies Dice Roller Bot** ("the Bot"), operated
by Stefano Vetrini ("the Developer", "we", "us"), processes personal data when you use the Bot on
Discord.

> **Quick summary:** The Bot stores only the minimum Discord IDs needed to operate the secret-roll
> reveal flow. All data is deleted automatically within 10 minutes (or immediately on reveal).
> There is no permanent database.

---

## 1. Data Controller

**Stefano Vetrini**
GitHub: <https://github.com/ningod/DooMandDastardlies>
Contact for privacy matters: open an issue at the repository above.

---

## 2. What Data We Collect and Why

The Bot processes only the data that Discord provides as part of a slash-command or button
interaction. We never ask for, collect, or store anything beyond what is described below.

### 2.1 Secret Roll Session Data (Temporary)

When you use a secret roll command (`/secret`, `/s`, or `/roll secret:true`), the following data
is temporarily stored to enable the reveal flow:

| Field | Value | Purpose |
|---|---|---|
| `userId` | Your Discord User ID (e.g. `123456789`) | Authorize that only you can reveal your own roll |
| `channelId` | The Discord Channel ID | Scope the reveal to the originating channel |
| `rollerTag` | Your Discord username (e.g. `Alice#0001`) | Display attribution on the reveal embed |
| `publicMessageId` | The ID of the public announcement message | Edit the message when you click Reveal |
| `rollId` | A randomly generated UUID | Key for looking up the roll |
| `result` | The dice results and total | Revealed to the channel when you click Reveal |
| `comment` | Your optional comment (max 120 chars) | Displayed alongside the roll result |
| `rolledAt` | Timestamp of the roll | Calculate TTL expiry |

**Retention:** This data is held for a maximum of **10 minutes**. It is deleted immediately when
you click "Reveal Result", or automatically when the TTL expires — whichever comes first.

**Storage location:** In-memory (default) or Upstash Redis (if `STORAGE_BACKEND=redis` is set by
the operator). Redis data is subject to the same 10-minute TTL enforced at the key level.

### 2.2 Timer Session Data (Temporary)

When you use `/timer start`, the following is stored for the duration of the timer:

| Field | Value | Purpose |
|---|---|---|
| `startedBy` | Your Discord User ID | Record who created the timer (metadata only) |
| `guildId` | The Discord Server (Guild) ID | Scope timers to the correct server |
| `channelId` | The Discord Channel ID | Send timer trigger messages to the correct channel |

**Retention:** Timer data is held in memory only. It is deleted when the timer completes, when
anyone clicks "Stop", or when the bot restarts. No timer data is persisted to Redis.

### 2.3 Rate-Limit Counters (Transient)

To prevent abuse, the Bot tracks how many commands each user sends within a 10-second sliding
window.

| Field | Value | Purpose |
|---|---|---|
| `userId` | Your Discord User ID | Identify the requester for rate limiting |
| Timestamps | Array of action timestamps | Sliding-window calculation |

**Retention:** Counters are held in memory only and are automatically pruned as timestamps fall
outside the 10-second window. They are never written to disk or Redis.

### 2.4 Operational Logs

The Bot emits structured JSON log lines to standard output for operational monitoring. Logs contain:

- Event name (e.g., `roll-complete`, `reveal-attempt`)
- Discord User ID
- Channel ID
- Command name
- Success/failure indicator

**What logs do NOT contain:**
- Actual dice roll results or values
- Roll comments or any user-supplied text
- Any personally identifiable information beyond Discord IDs

Log retention is controlled by your hosting provider's log policy. On Fly.io the default log
retention is approximately 7 days.

---

## 3. Legal Basis for Processing (GDPR — EU/EEA Users)

| Processing activity | Legal basis |
|---|---|
| Storing secret roll session data | **Legitimate interests** (Art. 6(1)(f)) — necessary to provide the core feature you requested |
| Rate-limit counters | **Legitimate interests** (Art. 6(1)(f)) — necessary to protect the service from abuse |
| Operational logs | **Legitimate interests** (Art. 6(1)(f)) — necessary for security monitoring and debugging |

We do not use personal data for marketing, profiling, or automated decision-making.

---

## 4. Data Retention Summary

| Data type | Location | Retention |
|---|---|---|
| Secret roll session | Memory or Redis | ≤ 10 minutes (deleted on reveal or TTL) |
| Timer metadata | Memory only | Until timer stops or bot restarts |
| Rate-limit counters | Memory only | Pruned within 10 seconds |
| Operational logs | Host stdout | Controlled by hosting provider (typically ≤ 7 days) |

**There is no permanent database.** No user data survives a bot restart (memory mode) or a Redis
TTL expiry (Redis mode).

---

## 5. Data Deletion

Because all data expires within **10 minutes**, there is typically nothing to delete by the time you
request deletion.

**If you have an unrevealed roll:** It will be deleted automatically when the 10-minute TTL
expires. You do not need to do anything.

**If you want to stop all future processing:**
- Server administrators can remove the Bot from the server at any time. This immediately stops all
  future interactions and any associated data collection.

**To submit a formal deletion request:** Open an issue at
<https://github.com/ningod/DooMandDastardlies/issues> with the subject "Data Deletion Request".
We will respond within **30 days**.

---

## 6. Your Rights (GDPR — EU/EEA Users)

Under the General Data Protection Regulation, you have the following rights:

| Right | Description |
|---|---|
| **Access** (Art. 15) | Request a copy of the data we hold about you |
| **Rectification** (Art. 16) | Request correction of inaccurate data |
| **Erasure** (Art. 17) | Request deletion of your data ("right to be forgotten") |
| **Restriction** (Art. 18) | Request that we restrict processing of your data |
| **Portability** (Art. 20) | Request your data in a machine-readable format |
| **Object** (Art. 21) | Object to processing based on legitimate interests |
| **Lodge a complaint** | Complain to your local supervisory authority |

To exercise any of these rights, open an issue at:
<https://github.com/ningod/DooMandDastardlies/issues>

We will acknowledge your request within **72 hours** and respond fully within **30 days**.

---

## 7. Data Sharing and Third Parties

We do not sell, rent, or share your personal data with third parties for commercial purposes.

The following third-party services may process data as part of the Bot's normal operation:

### 7.1 Discord Inc.

All bot interactions travel through Discord's platform. Discord processes interaction payloads,
message content, and user identifiers according to their own privacy policy.

- Discord Privacy Policy: <https://discord.com/privacy>
- Discord Terms of Service: <https://discord.com/terms>

### 7.2 Upstash Redis (Conditional)

If the Bot operator enables `STORAGE_BACKEND=redis`, temporary roll session data (see §2.1) is
written to an Upstash Redis instance. This is an optional feature and is not enabled by default.

- Upstash Privacy Policy: <https://upstash.com/privacy>

### 7.3 Fly.io (Deployment)

The Bot may be hosted on Fly.io's infrastructure. Fly.io may retain logs and operational metrics
according to their data handling policies.

- Fly.io Privacy Policy: <https://fly.io/legal/privacy-policy>

---

## 8. Data Security

We implement the following measures to protect data:

- **No plaintext logging of roll results** — dice values are never written to logs
- **Ephemeral Discord replies** — secret roll results are delivered only to the rolling user via
  Discord's ephemeral message mechanism (Discord does not persist ephemeral messages)
- **TTL-enforced expiry** — data cannot be retained beyond 10 minutes by design
- **Authorization checks** — only the original roller can reveal a secret roll (enforced in code)
- **Cryptographically secure RNG** — dice are rolled with `crypto.randomInt()`, not `Math.random()`

---

## 9. Children's Privacy

The Bot is subject to Discord's minimum age requirement of **13 years** (or the minimum age of
digital consent in your jurisdiction, whichever is higher). We do not knowingly collect data from
minors below this threshold. If you believe a minor's data has been processed inappropriately,
please contact us via the repository.

---

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. The **Last updated** date at the top of this
document will reflect the most recent revision. Continued use of the Bot after an update
constitutes acceptance of the revised policy.

The full change history of this document is available on GitHub.

---

## 11. Contact

For privacy questions, data requests, or concerns:

- **GitHub Issues:** <https://github.com/ningod/DooMandDastardlies/issues>
- **Author:** Stefano Vetrini — <https://stefanovetrini.itch.io>

---

_This document is provided for informational purposes. It does not constitute legal advice.
Consult a qualified attorney for legal matters relating to data protection compliance._
