# Architecture

## High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Discord API                         │
│              (Slash Commands / Interactions)             │
└────────────┬──────────────────────────┬─────────────────┘
             │                          │
             ▼                          ▼
┌────────────────────┐     ┌─────────────────────────┐
│   index.ts         │     │   index.ts               │
│   (Command Router) │     │   (Button Router)        │
└────────┬───────────┘     └────────┬────────────────┘
         │                          │
         ▼                          ▼
┌────────────────────┐     ┌─────────────────────────┐
│  commands/roll.ts  │     │  interactions/buttons.ts │
│                    │     │                          │
│  • Parse input     │     │  • Verify authorization  │
│  • Rate limit      │     │  • Retrieve stored roll  │
│  • Roll dice       │     │  • Edit public message   │
│  • Send public msg │     │  • Show revealed results │
│  • Send ephemeral  │     │  • Delete from store     │
│  • Store result    │     │                          │
└──┬──┬──┬──┬────────┘     └──┬──┬───────────────────┘
   │  │  │  │                 │  │
   │  │  │  │                 │  │
   ▼  │  │  │                 ▼  │
┌──────────┐ │  │          ┌──────────┐
│ dice.ts  │ │  │          │ store.ts │
│          │ │  │          │          │
│ • Parse  │ │  │          │ • Get    │
│ • Validate│ │  │         │ • Delete │
│ • Roll   │ │  │          └──────────┘
└──────────┘ │  │               │
             ▼  │               │
       ┌────────────┐          │
       │ ratelimit.ts│          │
       │             │          │
       │ • consume() │          │
       └─────────────┘          │
             │  │               │
             ▼  ▼               ▼
       ┌──────────┐      ┌──────────┐
       │ embeds.ts │      │ logger.ts│
       │           │      │          │
       │ • Build   │      │ • info() │
       │   roll    │      │ • warn() │
       │   embed   │      │ • error()│
       │ • Build   │      └──────────┘
       │   error   │
       │   embed   │
       └──────────┘
```

## Data Flow: Secret Roll → Reveal

### Phase 1: Secret Roll

```
User types: /secret dice:(Verve) 2d20 + (Damage) 1d8 comment:Fire Bolt

1. Discord API → index.ts (InteractionCreate event)
2. index.ts → commands/roll.ts (route by command name — handles /roll, /r, /secret, /s)
3. roll.ts → ratelimit.ts: consume(userId)
   └─ If rejected → reply with ephemeral rate-limit error
4. roll.ts → dice.ts: parseDice("(Verve) 2d20 + (Damage) 1d8")
   └─ Returns: [{ count: 2, sides: 20, label: "Verve" }, { count: 1, sides: 8, label: "Damage" }]
   └─ If parse error → reply with ephemeral parse error
5. roll.ts → dice.ts: rollDice(groups)
   └─ Uses crypto.randomInt() for each die
   └─ Returns: { expression: "(Verve) 2d20 + (Damage) 1d8", groups: [...], total: 25 }
6. roll.ts → uuid: generate rollId
7. roll.ts → embeds.ts: buildSecretRollAnnouncementEmbed()
   └─ Creates announcement embed (no results shown)
8. roll.ts → Discord API: channel.send() - PUBLIC message with "Reveal Result" button
9. roll.ts → embeds.ts: buildRollEmbed({ isRevealed: false })
   └─ Creates results embed for roller only (with labels and subtotals)
10. roll.ts → Discord API: interaction.editReply() - EPHEMERAL message with results
11. roll.ts → store.ts: set({ rollId, userId, channelId, result, comment, rolledAt, publicMessageId, rollerTag })
12. roll.ts → logger.ts: log metadata (userId, expression, channelId)
```

### Phase 2: Reveal

```
User clicks: "Reveal Result" button on the public message

1. Discord API → index.ts (InteractionCreate event, button type)
2. index.ts → interactions/buttons.ts (route by customId prefix "reveal:")
3. buttons.ts: extract rollId from customId
4. buttons.ts → store.ts: get(rollId)
   └─ If null (expired/missing) → reply with ephemeral expiry error
5. buttons.ts: verify interaction.user.id === storedRoll.userId
   └─ If mismatch → reply with ephemeral auth error
6. buttons.ts: verify interaction.channelId === storedRoll.channelId
   └─ If mismatch → reply with ephemeral channel error
7. buttons.ts → embeds.ts: buildRevealEmbed({ revealerTag })
   └─ Creates reveal embed with results + "Revealed by" footer
8. buttons.ts → Discord API: channel.messages.fetch(publicMessageId)
9. buttons.ts → Discord API: publicMessage.edit() - UPDATE existing message with results
10. buttons.ts → Discord API: interaction.editReply() - update ephemeral confirmation
11. buttons.ts → store.ts: delete(rollId)
12. buttons.ts → logger.ts: log reveal metadata
```

## Storage Model

### In-Memory TTL Map (`RollStore`)

```
Map<string, StoredRoll>

StoredRoll {
  rollId: string         // UUID v4, used as key and in button customId
  userId: string         // Discord user ID of the roller
  channelId: string      // Discord channel where the roll was created
  result: RollResult     // Frozen roll data (expression, groups, total)
  comment: string|null   // Optional comment string (max 120 chars, sanitized)
  rolledAt: Date         // Timestamp for TTL calculation
  publicMessageId: string // ID of the public announcement message (for editing on reveal)
  rollerTag: string      // Discord tag of roller (for reveal attribution)
}
```

**Constraints:**

- **TTL:** 10 minutes (600,000 ms). Entries are lazily evicted on access and actively swept every 60 seconds.
- **Uniqueness:** Each roll has a UUID v4 key. Collisions are astronomically unlikely.
- **Single-use reveal:** After successful reveal, the entry is deleted. Clicking the button again returns an expiry error.
- **No persistence:** All data is lost on bot restart. This is by design — secret rolls should not persist beyond a session.

**Memory characteristics:**

- Each entry is small (~500 bytes).
- With the 10-minute TTL and rate limiter (5 rolls/10s per user), even a busy server with 100 concurrent users would store at most ~30,000 entries (~15 MB). In practice, most entries are revealed or expire within minutes.

## Data Flow: Event Timer

### Phase 1: Timer Start

```
User types: /timer start interval:5 name:"Combat Round" repeat:3

1. Discord API → index.ts (InteractionCreate event)
2. index.ts: defer reply as ephemeral
3. index.ts → commands/timer.ts (route by command name "timer", subcommand "start")
4. timer.ts → ratelimit.ts: consume(userId)
   └─ If rejected → reply with ephemeral rate-limit error
5. timer.ts: sanitize name (strip mentions)
6. timer.ts → timer-store.ts: validate(config)
   └─ Checks: name length/chars, interval range, repeat range, channel timer cap (5)
7. timer.ts → timer-store.ts: create(config, onTrigger, onComplete)
   └─ setInterval created with intervalMinutes × 60,000ms
   └─ Returns TimerInstance { id, name, intervalMinutes, ... }
8. timer.ts → timer-embeds.ts: buildTimerStartedEmbed()
9. timer.ts → Discord API: interaction.editReply() — ephemeral confirmation
```

### Phase 2: Timer Trigger (repeats on each interval)

```
setInterval fires after N minutes

1. timer-store.ts interval callback: increment triggerCount
2. Callback → timer-embeds.ts: buildTimerTriggerEmbed()
3. Callback → Discord API: channel.send() — public message with Stop button
4. timer-store.ts: check completion conditions
   └─ If triggerCount >= maxRepeat → complete with "repeat-exhausted"
   └─ If elapsed + interval > maxDurationMs → complete with "max-duration"
   └─ Otherwise → continue
```

### Phase 3: Timer Completion

```
Timer reaches repeat limit or max duration

1. timer-store.ts: clearInterval, remove from store
2. Callback → timer-embeds.ts: buildTimerCompleteEmbed()
3. Callback → Discord API: channel.send() — completion message with Restart button
```

### Phase 4: Stop (button or command)

```
User clicks Stop button or uses /timer stop

1. Discord API → index.ts (button "tstop:<id>" or command)
2. Verify channelId matches timer's channel (anti-replay)
3. timer-store.ts: stop(timerId) — clearInterval, remove from store
4. Reply with ephemeral confirmation
```

## Storage Model: TimerStore

```
Map<number, TimerInstance>

TimerInstance {
  id: number              // Session-scoped incrementing counter
  guildId: string         // Discord guild ID
  channelId: string       // Discord channel ID
  name: string            // User-provided timer name (max 50 chars)
  intervalMinutes: number // Minutes between triggers (1–480)
  maxRepeat: number|null  // Max triggers (null = indefinite, capped by duration)
  triggerCount: number    // How many times the timer has fired
  startedAt: number       // Date.now() timestamp
  maxDurationMs: number   // Max runtime from MAX_TIMER_HOURS env (default 2h)
  intervalHandle: NodeJS.Timer // setInterval handle for cleanup
  startedBy: string       // Discord user ID of creator
}
```

**Runtime cap:** Configurable via `MAX_TIMER_HOURS` environment variable (default: 2 hours, range: 1–24). Even "infinite" timers (no repeat) auto-stop when the cap is reached.

**Constraints:**
- Max 5 timers per channel
- Individual `setInterval` per timer (start/stop per-timer is trivial)
- No persistence (lost on restart, by design)
- Button customId encoding: `tstop:<id>`, `trestart:<id>:<interval>:<repeat>:<name>`

## Discord API Constraints

| Constraint                 | Limit                         | How We Handle It                                |
| -------------------------- | ----------------------------- | ----------------------------------------------- |
| Interaction acknowledgment | 3 seconds                     | Defer immediately in index.ts before processing |
| Message editability        | Bot can edit its own messages | Edit the public announcement message on reveal  |
| Button custom ID length    | 100 characters                | `reveal:` + UUID = ~43 characters               |
| Embed field limits         | 25 fields, 1024 chars each    | We use 4-6 fields, well within limits           |
| Rate limits (Discord API)  | Varies by endpoint            | discord.js handles rate limiting automatically  |
