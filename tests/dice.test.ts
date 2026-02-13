import { describe, it, expect } from "vitest";
import {
  parseDice,
  rollDice,
  canonicalize,
  DiceParseError,
  DieGroup,
} from "../src/lib/dice.js";

describe("parseDice", () => {
  it("parses a single die with no count (d6 → 1d6)", () => {
    const result = parseDice("d6");
    expect(result).toEqual([{ count: 1, sides: 6 }]);
  });

  it("parses a single die with count (2d8)", () => {
    const result = parseDice("2d8");
    expect(result).toEqual([{ count: 2, sides: 8 }]);
  });

  it("parses plus-separated expression (2d4+1d8)", () => {
    const result = parseDice("2d4+1d8");
    expect(result).toEqual([
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
    ]);
  });

  it("parses comma-separated expression (2d4, 1d8)", () => {
    const result = parseDice("2d4, 1d8");
    expect(result).toEqual([
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
    ]);
  });

  it("parses space-separated expression (2d4 1d8)", () => {
    const result = parseDice("2d4 1d8");
    expect(result).toEqual([
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
    ]);
  });

  it("parses mixed separators (2d4 + 1d8, 3d6)", () => {
    const result = parseDice("2d4 + 1d8, 3d6");
    expect(result).toEqual([
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
      { count: 3, sides: 6 },
    ]);
  });

  it("handles uppercase input", () => {
    const result = parseDice("2D6");
    expect(result).toEqual([{ count: 2, sides: 6 }]);
  });

  it("handles extra whitespace", () => {
    const result = parseDice("  2d4  +  1d8  ");
    expect(result).toEqual([
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
    ]);
  });

  it("accepts all valid die types", () => {
    const valid = [4, 6, 8, 10, 12, 20];
    for (const sides of valid) {
      const result = parseDice(`d${sides}`);
      expect(result).toEqual([{ count: 1, sides }]);
    }
  });

  it("rejects unsupported die type (d100)", () => {
    expect(() => parseDice("d100")).toThrow(DiceParseError);
    expect(() => parseDice("d100")).toThrow(/Unsupported die type: d100/);
  });

  it("rejects unsupported die type (d2)", () => {
    expect(() => parseDice("d2")).toThrow(DiceParseError);
  });

  it("rejects invalid token (abc)", () => {
    expect(() => parseDice("abc")).toThrow(DiceParseError);
    expect(() => parseDice("abc")).toThrow(/Invalid token/);
  });

  it("rejects empty input", () => {
    expect(() => parseDice("")).toThrow(DiceParseError);
    expect(() => parseDice("")).toThrow(/Empty dice expression/);
  });

  it("rejects expression exceeding max length", () => {
    const long = "d4+" .repeat(50) + "d4";
    expect(() => parseDice(long)).toThrow(DiceParseError);
    expect(() => parseDice(long)).toThrow(/too long/);
  });

  it("rejects more than 50 dice total", () => {
    // 51d4 = 51 dice → over cap
    expect(() => parseDice("51d4")).toThrow(DiceParseError);
    expect(() => parseDice("51d4")).toThrow(/Too many dice/);
  });

  it("allows exactly 50 dice", () => {
    const result = parseDice("50d4");
    expect(result).toEqual([{ count: 50, sides: 4 }]);
  });

  it("rejects 0-count dice (0d6)", () => {
    expect(() => parseDice("0d6")).toThrow(DiceParseError);
    expect(() => parseDice("0d6")).toThrow(/at least 1/);
  });
});

describe("canonicalize", () => {
  it("produces canonical string", () => {
    const groups: DieGroup[] = [
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
    ];
    expect(canonicalize(groups)).toBe("2d4 + 1d8");
  });

  it("handles a single group", () => {
    expect(canonicalize([{ count: 3, sides: 20 }])).toBe("3d20");
  });
});

describe("rollDice", () => {
  it("returns correct structure for a single group", () => {
    const groups: DieGroup[] = [{ count: 3, sides: 6 }];
    const result = rollDice(groups);

    expect(result.expression).toBe("3d6");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].rolls).toHaveLength(3);
    expect(result.groups[0].group).toEqual(groups[0]);

    // Each roll should be in [1, 6]
    for (const r of result.groups[0].rolls) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(6);
    }

    // Total should equal sum of rolls
    const expectedTotal = result.groups[0].rolls.reduce((a, b) => a + b, 0);
    expect(result.total).toBe(expectedTotal);
  });

  it("returns correct structure for multiple groups", () => {
    const groups: DieGroup[] = [
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
    ];
    const result = rollDice(groups);

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].rolls).toHaveLength(2);
    expect(result.groups[1].rolls).toHaveLength(1);

    // Validate bounds
    for (const r of result.groups[0].rolls) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(4);
    }
    for (const r of result.groups[1].rolls) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(8);
    }

    // Total should be sum of all rolls
    const allRolls = result.groups.flatMap((g) => g.rolls);
    const expectedTotal = allRolls.reduce((a, b) => a + b, 0);
    expect(result.total).toBe(expectedTotal);
  });

  it("rolls produce values within valid range over many iterations", () => {
    // Statistical sanity check: roll 1d20 many times
    const groups: DieGroup[] = [{ count: 1, sides: 20 }];
    const values = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const r = rollDice(groups);
      const val = r.groups[0].rolls[0];
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(20);
      values.add(val);
    }
    // With 200 rolls of d20, we should see a decent spread
    expect(values.size).toBeGreaterThan(10);
  });
});
