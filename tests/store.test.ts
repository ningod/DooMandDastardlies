import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RollStore, StoredRoll } from "../src/lib/store.js";

function makeRoll(overrides?: Partial<StoredRoll>): StoredRoll {
  return {
    rollId: "test-roll-1",
    userId: "user-123",
    channelId: "channel-456",
    result: {
      expression: "2d6",
      groups: [
        {
          group: { count: 2, sides: 6 },
          rolls: [3, 5],
        },
      ],
      total: 8,
    },
    reason: null,
    rolledAt: new Date(),
    publicMessageId: "msg-789",
    rollerTag: "TestUser#1234",
    ...overrides,
  };
}

describe("RollStore", () => {
  let store: RollStore;

  beforeEach(() => {
    store = new RollStore(1000); // 1 second TTL for tests
  });

  afterEach(() => {
    store.stop();
  });

  it("stores and retrieves a roll", () => {
    const roll = makeRoll();
    store.set(roll);
    const retrieved = store.get("test-roll-1");
    expect(retrieved).toEqual(roll);
  });

  it("returns null for non-existent roll", () => {
    expect(store.get("nonexistent")).toBeNull();
  });

  it("deletes a roll", () => {
    const roll = makeRoll();
    store.set(roll);
    expect(store.delete("test-roll-1")).toBe(true);
    expect(store.get("test-roll-1")).toBeNull();
  });

  it("returns null for expired roll", () => {
    const roll = makeRoll({
      rolledAt: new Date(Date.now() - 2000), // 2 seconds ago, TTL is 1s
    });
    store.set(roll);
    expect(store.get("test-roll-1")).toBeNull();
  });

  it("tracks size", () => {
    expect(store.size).toBe(0);
    store.set(makeRoll({ rollId: "a" }));
    expect(store.size).toBe(1);
    store.set(makeRoll({ rollId: "b" }));
    expect(store.size).toBe(2);
    store.delete("a");
    expect(store.size).toBe(1);
  });
});
