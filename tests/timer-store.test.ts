import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TimerStore,
  TimerParseError,
  TimerConfig,
  TimerInstance,
  TimerCompleteReason,
} from "../src/lib/timer-store.js";

function makeConfig(overrides?: Partial<TimerConfig>): TimerConfig {
  return {
    guildId: "guild-1",
    channelId: "channel-1",
    name: "Test Timer",
    intervalMinutes: 5,
    maxRepeat: null,
    startedBy: "user-1",
    ...overrides,
  };
}

describe("TimerStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------- validate() ----------

  describe("validate()", () => {
    it("accepts valid config", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      expect(() => store.validate(makeConfig())).not.toThrow();
    });

    it("rejects empty name", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      expect(() => store.validate(makeConfig({ name: "" }))).toThrow(
        TimerParseError
      );
      expect(() => store.validate(makeConfig({ name: "   " }))).toThrow(
        TimerParseError
      );
    });

    it("rejects name longer than 50 characters", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const longName = "A".repeat(51);
      expect(() => store.validate(makeConfig({ name: longName }))).toThrow(
        /too long/
      );
    });

    it("rejects name with unsafe characters", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      expect(() => store.validate(makeConfig({ name: "Test@Timer!" }))).toThrow(
        /invalid characters/
      );
    });

    it("accepts name with letters, numbers, spaces, underscores, hyphens", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      expect(() =>
        store.validate(makeConfig({ name: "Combat Round 2_test-run" }))
      ).not.toThrow();
    });

    it("rejects interval below minimum", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      expect(() =>
        store.validate(makeConfig({ intervalMinutes: 0 }))
      ).toThrow(/between/);
    });

    it("rejects interval above maximum", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      expect(() =>
        store.validate(makeConfig({ intervalMinutes: 481 }))
      ).toThrow(/between/);
    });

    it("rejects repeat below 1", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      expect(() =>
        store.validate(makeConfig({ maxRepeat: 0 }))
      ).toThrow(/between/);
    });

    it("rejects repeat above 100", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      expect(() =>
        store.validate(makeConfig({ maxRepeat: 101 }))
      ).toThrow(/between/);
    });

    it("rejects when channel has 5 timers already", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const noop = vi.fn();

      for (let i = 0; i < 5; i++) {
        store.create(makeConfig({ name: `Timer ${i}` }), noop, noop);
      }

      expect(() =>
        store.validate(makeConfig({ name: "One Too Many" }))
      ).toThrow(/already has 5/);
    });
  });

  // ---------- create() ----------

  describe("create()", () => {
    it("creates a timer and assigns incrementing ID", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const noop = vi.fn();

      const t1 = store.create(makeConfig({ name: "First" }), noop, noop);
      const t2 = store.create(makeConfig({ name: "Second" }), noop, noop);

      expect(t2.id).toBe(t1.id + 1);
      expect(store.size).toBe(2);

      store.stopAll();
    });

    it("calls onTrigger after one interval", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const onTrigger = vi.fn();
      const onComplete = vi.fn();

      store.create(
        makeConfig({ intervalMinutes: 1 }),
        onTrigger,
        onComplete
      );

      vi.advanceTimersByTime(60_000); // 1 minute

      expect(onTrigger).toHaveBeenCalledTimes(1);
      expect(onComplete).not.toHaveBeenCalled();

      store.stopAll();
    });

    it("increments triggerCount on each trigger", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const triggers: number[] = [];
      const onTrigger = vi.fn((timer: TimerInstance) => {
        triggers.push(timer.triggerCount);
      });

      store.create(
        makeConfig({ intervalMinutes: 1 }),
        onTrigger,
        vi.fn()
      );

      vi.advanceTimersByTime(180_000); // 3 minutes

      expect(triggers).toEqual([1, 2, 3]);

      store.stopAll();
    });

    it("calls onComplete with 'repeat-exhausted' after N triggers", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const onTrigger = vi.fn();
      const onComplete = vi.fn();

      store.create(
        makeConfig({ intervalMinutes: 1, maxRepeat: 3 }),
        onTrigger,
        onComplete
      );

      vi.advanceTimersByTime(180_000); // 3 minutes

      expect(onTrigger).toHaveBeenCalledTimes(3);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ triggerCount: 3 }),
        "repeat-exhausted"
      );
      expect(store.size).toBe(0);
    });

    it("calls onComplete with 'max-duration' when time exceeds limit", () => {
      // Max duration of 5 minutes, interval of 2 minutes
      // Tick 1 at 2min: elapsed=2min, next tick at 4min (4min < 5min) → continue
      // Tick 2 at 4min: elapsed=4min, next tick at 6min (6min > 5min) → complete
      const store = new TimerStore(5 * 60 * 1000); // 5 minutes
      const onTrigger = vi.fn();
      const onComplete = vi.fn();

      store.create(
        makeConfig({ intervalMinutes: 2 }),
        onTrigger,
        onComplete
      );

      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes

      expect(onTrigger).toHaveBeenCalledTimes(2);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ triggerCount: 2 }),
        "max-duration"
      );
      expect(store.size).toBe(0);
    });

    it("removes timer from store after completion", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const onComplete = vi.fn();

      const timer = store.create(
        makeConfig({ intervalMinutes: 1, maxRepeat: 1 }),
        vi.fn(),
        onComplete
      );

      vi.advanceTimersByTime(60_000);

      expect(store.get(timer.id)).toBeNull();
      expect(store.size).toBe(0);
    });

    it("does not call onTrigger after stop", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const onTrigger = vi.fn();

      const timer = store.create(
        makeConfig({ intervalMinutes: 1 }),
        onTrigger,
        vi.fn()
      );

      vi.advanceTimersByTime(60_000); // 1 trigger
      expect(onTrigger).toHaveBeenCalledTimes(1);

      store.stop(timer.id);

      vi.advanceTimersByTime(120_000); // 2 more minutes
      expect(onTrigger).toHaveBeenCalledTimes(1); // still 1
    });
  });

  // ---------- stop() ----------

  describe("stop()", () => {
    it("stops and removes a timer by ID", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const timer = store.create(makeConfig(), vi.fn(), vi.fn());

      const stopped = store.stop(timer.id);

      expect(stopped).not.toBeNull();
      expect(stopped!.id).toBe(timer.id);
      expect(store.size).toBe(0);
    });

    it("returns null for non-existent timer ID", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      expect(store.stop(999)).toBeNull();
    });
  });

  // ---------- stopAllInChannel() ----------

  describe("stopAllInChannel()", () => {
    it("stops all timers in specified channel", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const noop = vi.fn();

      store.create(makeConfig({ channelId: "ch-1", name: "Timer A" }), noop, noop);
      store.create(makeConfig({ channelId: "ch-1", name: "Timer B" }), noop, noop);
      store.create(makeConfig({ channelId: "ch-2", name: "Timer C" }), noop, noop);

      const count = store.stopAllInChannel("ch-1");

      expect(count).toBe(2);
      expect(store.channelCount("ch-1")).toBe(0);
    });

    it("does not affect timers in other channels", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const noop = vi.fn();

      store.create(makeConfig({ channelId: "ch-1", name: "Timer A" }), noop, noop);
      store.create(makeConfig({ channelId: "ch-2", name: "Timer B" }), noop, noop);

      store.stopAllInChannel("ch-1");

      expect(store.channelCount("ch-2")).toBe(1);

      store.stopAll();
    });
  });

  // ---------- stopAll() ----------

  describe("stopAll()", () => {
    it("stops all timers across all channels", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const noop = vi.fn();

      store.create(makeConfig({ channelId: "ch-1", name: "Timer A" }), noop, noop);
      store.create(makeConfig({ channelId: "ch-2", name: "Timer B" }), noop, noop);

      store.stopAll();

      expect(store.size).toBe(0);
    });
  });

  // ---------- getByChannel() ----------

  describe("getByChannel()", () => {
    it("returns only timers for the specified channel", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const noop = vi.fn();

      store.create(makeConfig({ channelId: "ch-1", name: "Timer A" }), noop, noop);
      store.create(makeConfig({ channelId: "ch-1", name: "Timer B" }), noop, noop);
      store.create(makeConfig({ channelId: "ch-2", name: "Timer C" }), noop, noop);

      const ch1Timers = store.getByChannel("ch-1");
      expect(ch1Timers).toHaveLength(2);
      expect(ch1Timers.every((t) => t.channelId === "ch-1")).toBe(true);

      store.stopAll();
    });

    it("returns empty array when no timers in channel", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      expect(store.getByChannel("nonexistent")).toEqual([]);
    });
  });

  // ---------- channelCount() ----------

  describe("channelCount()", () => {
    it("returns correct count for channel", () => {
      const store = new TimerStore(2 * 60 * 60 * 1000);
      const noop = vi.fn();

      expect(store.channelCount("ch-1")).toBe(0);

      store.create(makeConfig({ channelId: "ch-1", name: "Timer A" }), noop, noop);
      expect(store.channelCount("ch-1")).toBe(1);

      store.create(makeConfig({ channelId: "ch-1", name: "Timer B" }), noop, noop);
      expect(store.channelCount("ch-1")).toBe(2);

      store.stopAll();
    });
  });
});
