import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRollStore } from '../src/lib/store.js';
import type { StoredRoll } from '../src/lib/store-interface.js';

function makeRoll(overrides?: Partial<StoredRoll>): StoredRoll {
  return {
    rollId: 'test-roll-1',
    userId: 'user-123',
    channelId: 'channel-456',
    result: {
      expression: '2d6',
      groups: [
        {
          group: { count: 2, sides: 6 },
          rolls: [3, 5],
        },
      ],
      total: 8,
    },
    comment: null,
    rolledAt: new Date(),
    publicMessageId: 'msg-789',
    rollerTag: 'TestUser#1234',
    ...overrides,
  };
}

describe('MemoryRollStore', () => {
  let store: MemoryRollStore;

  beforeEach(() => {
    store = new MemoryRollStore(1000); // 1 second TTL for tests
  });

  afterEach(() => {
    store.stop();
  });

  it('stores and retrieves a roll', async () => {
    const roll = makeRoll();
    await store.set(roll);
    const retrieved = await store.get('test-roll-1');
    expect(retrieved).toEqual(roll);
  });

  it('returns null for non-existent roll', async () => {
    expect(await store.get('nonexistent')).toBeNull();
  });

  it('deletes a roll', async () => {
    const roll = makeRoll();
    await store.set(roll);
    expect(await store.delete('test-roll-1')).toBe(true);
    expect(await store.get('test-roll-1')).toBeNull();
  });

  it('returns null for expired roll', async () => {
    const roll = makeRoll({
      rolledAt: new Date(Date.now() - 2000), // 2 seconds ago, TTL is 1s
    });
    await store.set(roll);
    expect(await store.get('test-roll-1')).toBeNull();
  });

  it('tracks size', async () => {
    expect(store.size).toBe(0);
    await store.set(makeRoll({ rollId: 'a' }));
    expect(store.size).toBe(1);
    await store.set(makeRoll({ rollId: 'b' }));
    expect(store.size).toBe(2);
    await store.delete('a');
    expect(store.size).toBe(1);
  });

  it('claims a roll (atomic get+delete)', async () => {
    const roll = makeRoll();
    await store.set(roll);
    const claimed = await store.claim('test-roll-1');
    expect(claimed).toEqual(roll);
    expect(await store.get('test-roll-1')).toBeNull();
    expect(store.size).toBe(0);
  });

  it('claim returns null for non-existent roll', async () => {
    expect(await store.claim('nonexistent')).toBeNull();
  });

  it('claim returns null for expired roll', async () => {
    const roll = makeRoll({
      rolledAt: new Date(Date.now() - 2000),
    });
    await store.set(roll);
    expect(await store.claim('test-roll-1')).toBeNull();
  });
});
