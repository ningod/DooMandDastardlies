import { randomInt } from 'node:crypto';

/** Allowed polyhedral die sizes. */
const VALID_SIDES = new Set([4, 6, 8, 10, 12, 20]);

/** Hard cap on total number of dice in a single expression. */
const MAX_TOTAL_DICE = 50;

/** Maximum input string length. */
const MAX_EXPRESSION_LENGTH = 200;

/** Maximum label length. */
const MAX_LABEL_LENGTH = 32;

/** Allowed characters in labels: letters, digits, spaces, underscores, hyphens. */
const LABEL_PATTERN = /^[\w\s-]+$/u;

/**
 * A single parsed die group, e.g. "2d8" -> { count: 2, sides: 8 }.
 * Optionally labeled, e.g. "(Verve) 2d20" -> { count: 2, sides: 20, label: "Verve" }.
 */
export interface DieGroup {
  count: number;
  sides: number;
  label?: string;
}

/** Result for one die group after rolling. */
export interface DieGroupResult {
  group: DieGroup;
  rolls: number[];
}

/** Full roll result. */
export interface RollResult {
  expression: string; // canonical form, e.g. "(Verve) 2d20 + (Damage) 1d8"
  groups: DieGroupResult[];
  total: number;
}

/**
 * Parse a dice expression string into an array of DieGroup.
 *
 * Accepted formats (with optional labels):
 *   "d4"                        -> [{ count: 1, sides: 4 }]
 *   "2d4+1d8"                   -> [{ count: 2, sides: 4 }, { count: 1, sides: 8 }]
 *   "(Verve) 2d20"             -> [{ count: 2, sides: 20, label: "Verve" }]
 *   "(Verve) 2d20 + (Dmg) 1d8" -> two labeled groups
 *   "(Roll1) d6, (Roll2) d4"   -> comma-separated labeled groups
 *
 * @throws DiceParseError with a user-friendly message on invalid input.
 */
export function parseDice(input: string): DieGroup[] {
  if (input.length > MAX_EXPRESSION_LENGTH) {
    throw new DiceParseError(`Expression is too long (max ${MAX_EXPRESSION_LENGTH} characters).`);
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new DiceParseError(
      'Empty dice expression. Example: `2d6` or `(Verve) 2d20 + (Damage) 1d8`.'
    );
  }

  // Tokenize: extract sequential (label)? dice pairs.
  // Strategy: split on separators (+, comma) while preserving label-dice grouping.
  // We use a regex that captures optional (label) followed by dice notation.
  const groupPattern = /(?:\(([^)]*)\)\s*)?(\d*d\d+)/gi;
  const matches = [...trimmed.matchAll(groupPattern)];

  if (matches.length === 0) {
    throw new DiceParseError(
      'Could not parse any dice from the expression. Example: `2d6` or `(Verve) 2d20 + (Damage) 1d8`.'
    );
  }

  // Verify the entire input is covered by valid tokens and separators.
  // Build what we expect the input to look like from matches, then compare.
  const validStructure =
    /^[\s,+]*(?:\([^)]*\)\s*)?(?:\d*d\d+)(?:[\s,+]+(?:\([^)]*\)\s*)?(?:\d*d\d+))*[\s,+]*$/i;
  if (!validStructure.test(trimmed)) {
    // Find the first problematic token for a helpful error message
    const cleaned = trimmed.replace(/\([^)]*\)/g, ''); // remove labels
    const tokens = cleaned.split(/[+,\s]+/).filter((t) => t.length > 0);
    const badToken = tokens.find((t) => !/^\d*d\d+$/i.test(t));
    if (badToken) {
      throw new DiceParseError(
        `Invalid token "${badToken}". Expected format like \`d6\` or \`2d8\`. ` +
          `Supported dice: d4, d6, d8, d10, d12, d20.`
      );
    }
    throw new DiceParseError(
      'Could not parse the dice expression. Example: `2d6` or `(Verve) 2d20 + (Damage) 1d8`.'
    );
  }

  const groups: DieGroup[] = [];
  let totalDice = 0;

  for (const match of matches) {
    // match[1] can be undefined at runtime (optional capture group) despite TS typing it as string
    const rawLabel = match[1] as string | undefined;
    const diceStr = match[2].toLowerCase();

    // Validate label if present
    let label: string | undefined;
    if (rawLabel != null) {
      const labelTrimmed = rawLabel.trim();
      if (labelTrimmed.length > 0) {
        if (labelTrimmed.length > MAX_LABEL_LENGTH) {
          throw new DiceParseError(
            `Label "${labelTrimmed}" is too long (max ${MAX_LABEL_LENGTH} characters).`
          );
        }
        if (!LABEL_PATTERN.test(labelTrimmed)) {
          throw new DiceParseError(
            `Label "${labelTrimmed}" contains invalid characters. Use letters, numbers, spaces, underscores, or hyphens.`
          );
        }
        label = labelTrimmed;
      }
    }

    // Parse dice notation
    const diceMatch = /^(\d*)d(\d+)$/.exec(diceStr);
    if (!diceMatch) {
      throw new DiceParseError(
        `Invalid dice "${diceStr}". Expected format like \`d6\` or \`2d8\`.`
      );
    }

    const count = diceMatch[1] === '' ? 1 : parseInt(diceMatch[1], 10);
    const sides = parseInt(diceMatch[2], 10);

    if (count < 1) {
      throw new DiceParseError(`Dice count must be at least 1 (got "${diceStr}").`);
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

    const group: DieGroup = { count, sides };
    if (label) {
      group.label = label;
    }
    groups.push(group);
  }

  return groups;
}

/**
 * Build a canonical string representation of parsed groups.
 *
 * @param groups - Array of parsed die groups
 * @returns Canonical string like "(Verve) 2d20 + (Damage) 1d8"
 */
export function canonicalize(groups: DieGroup[]): string {
  return groups
    .map((g) => {
      const dice = `${g.count}d${g.sides}`;
      return g.label ? `(${g.label}) ${dice}` : dice;
    })
    .join(' + ');
}

/**
 * Roll dice for the given groups using cryptographically secure RNG.
 *
 * @param groups - Array of die groups to roll
 * @returns Complete roll result with expression, individual rolls, and total
 */
export function rollDice(groups: DieGroup[]): RollResult {
  const results: DieGroupResult[] = [];
  let total = 0;

  for (const group of groups) {
    const rolls: number[] = [];
    for (let i = 0; i < group.count; i++) {
      // randomInt(min, max) -> [min, max)  so we use (1, sides+1)
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
    this.name = 'DiceParseError';
  }
}
