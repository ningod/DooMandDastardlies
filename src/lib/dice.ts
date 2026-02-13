import { randomInt } from "node:crypto";

/** Allowed polyhedral die sizes. */
const VALID_SIDES = new Set([4, 6, 8, 10, 12, 20]);

/** Hard cap on total number of dice in a single expression. */
const MAX_TOTAL_DICE = 50;

/** Maximum input string length. */
const MAX_EXPRESSION_LENGTH = 100;

/** A single parsed die group, e.g. "2d8" → { count: 2, sides: 8 }. */
export interface DieGroup {
  count: number;
  sides: number;
}

/** Result for one die group after rolling. */
export interface DieGroupResult {
  group: DieGroup;
  rolls: number[];
}

/** Full roll result. */
export interface RollResult {
  expression: string; // canonical form, e.g. "2d4 + 1d8"
  groups: DieGroupResult[];
  total: number;
}

/**
 * Parse a dice expression string into an array of DieGroup.
 *
 * Accepted formats:
 *   "d4"        → [{ count: 1, sides: 4 }]
 *   "2d4+1d8"   → [{ count: 2, sides: 4 }, { count: 1, sides: 8 }]
 *   "2d4, 1d8"  → same
 *   "2d4 1d8"   → same
 *
 * @throws Error with a user-friendly message on invalid input.
 */
export function parseDice(input: string): DieGroup[] {
  if (input.length > MAX_EXPRESSION_LENGTH) {
    throw new DiceParseError(
      `Expression is too long (max ${MAX_EXPRESSION_LENGTH} characters).`
    );
  }

  // Normalize: trim, lowercase
  const normalized = input.trim().toLowerCase();

  if (normalized.length === 0) {
    throw new DiceParseError(
      "Empty dice expression. Example: `2d6` or `1d4+1d8`."
    );
  }

  // Split on separators: +, comma, or whitespace (one or more)
  const tokens = normalized
    .split(/[+,\s]+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    throw new DiceParseError(
      "Could not parse any dice from the expression. Example: `2d6` or `1d4+1d8`."
    );
  }

  const groups: DieGroup[] = [];
  let totalDice = 0;

  for (const token of tokens) {
    const match = token.match(/^(\d*)d(\d+)$/);
    if (!match) {
      throw new DiceParseError(
        `Invalid token "${token}". Expected format like \`d6\` or \`2d8\`. ` +
          `Supported dice: d4, d6, d8, d10, d12, d20.`
      );
    }

    const count = match[1] === "" ? 1 : parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);

    if (count < 1) {
      throw new DiceParseError(
        `Dice count must be at least 1 (got "${token}").`
      );
    }

    if (!VALID_SIDES.has(sides)) {
      throw new DiceParseError(
        `Unsupported die type: d${sides}. Supported dice: d4, d6, d8, d10, d12, d20.`
      );
    }

    totalDice += count;
    if (totalDice > MAX_TOTAL_DICE) {
      throw new DiceParseError(
        `Too many dice! Maximum total is ${MAX_TOTAL_DICE}. You requested ${totalDice}.`
      );
    }

    groups.push({ count, sides });
  }

  return groups;
}

/**
 * Build a canonical string representation of parsed groups.
 *
 * @param groups - Array of parsed die groups
 * @returns Canonical string like "2d4 + 1d8"
 * @example
 * canonicalize([{count:2, sides:4}, {count:1, sides:8}]) // → "2d4 + 1d8"
 */
export function canonicalize(groups: DieGroup[]): string {
  return groups.map((g) => `${g.count}d${g.sides}`).join(" + ");
}

/**
 * Roll dice for the given groups using cryptographically secure RNG.
 *
 * @param groups - Array of die groups to roll
 * @returns Complete roll result with expression, individual rolls, and total
 * @example
 * rollDice([{count: 2, sides: 6}]) // Rolls 2d6, returns results + total
 */
export function rollDice(groups: DieGroup[]): RollResult {
  const results: DieGroupResult[] = [];
  let total = 0;

  for (const group of groups) {
    const rolls: number[] = [];
    for (let i = 0; i < group.count; i++) {
      // randomInt(min, max) → [min, max)  so we use (1, sides+1)
      const value = randomInt(1, group.sides + 1);
      rolls.push(value);
      total += value;
    }
    results.push({ group, rolls });
  }

  return {
    expression: canonicalize(groups),
    groups: results,
    total,
  };
}

/** Custom error class for dice parsing failures. */
export class DiceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiceParseError";
  }
}
