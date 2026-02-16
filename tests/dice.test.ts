import { describe, it, expect } from 'vitest';
import { parseDice, rollDice, canonicalize, DiceParseError, DieGroup } from '../src/lib/dice.js';

// ---------------------------------------------------------------------------
// parseDice — unlabeled (backward-compatible)
// ---------------------------------------------------------------------------

describe('parseDice', () => {
  it('parses a single die with no count (d6 -> 1d6)', () => {
    const result = parseDice('d6');
    expect(result).toEqual([{ count: 1, sides: 6 }]);
  });

  it('parses a single die with count (2d8)', () => {
    const result = parseDice('2d8');
    expect(result).toEqual([{ count: 2, sides: 8 }]);
  });

  it('parses plus-separated expression (2d4+1d8)', () => {
    const result = parseDice('2d4+1d8');
    expect(result).toEqual([
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
    ]);
  });

  it('parses comma-separated expression (2d4, 1d8)', () => {
    const result = parseDice('2d4, 1d8');
    expect(result).toEqual([
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
    ]);
  });

  it('parses space-separated expression (2d4 1d8)', () => {
    const result = parseDice('2d4 1d8');
    expect(result).toEqual([
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
    ]);
  });

  it('parses mixed separators (2d4 + 1d8, 3d6)', () => {
    const result = parseDice('2d4 + 1d8, 3d6');
    expect(result).toEqual([
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
      { count: 3, sides: 6 },
    ]);
  });

  it('handles uppercase input', () => {
    const result = parseDice('2D6');
    expect(result).toEqual([{ count: 2, sides: 6 }]);
  });

  it('handles extra whitespace', () => {
    const result = parseDice('  2d4  +  1d8  ');
    expect(result).toEqual([
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
    ]);
  });

  it('accepts all valid die types', () => {
    const valid = [4, 6, 8, 10, 12, 20];
    for (const sides of valid) {
      const result = parseDice(`d${sides}`);
      expect(result).toEqual([{ count: 1, sides }]);
    }
  });

  it('rejects unsupported die type (d100)', () => {
    expect(() => parseDice('d100')).toThrow(DiceParseError);
    expect(() => parseDice('d100')).toThrow(/Unsupported die type: d100/);
  });

  it('rejects unsupported die type (d2)', () => {
    expect(() => parseDice('d2')).toThrow(DiceParseError);
  });

  it('rejects invalid token (abc)', () => {
    expect(() => parseDice('abc')).toThrow(DiceParseError);
    expect(() => parseDice('abc')).toThrow(/Could not parse any dice/);
  });

  it('rejects mixed valid and invalid tokens (abc + d6)', () => {
    expect(() => parseDice('abc + d6')).toThrow(DiceParseError);
    expect(() => parseDice('abc + d6')).toThrow(/Invalid token/);
  });

  it('rejects empty input', () => {
    expect(() => parseDice('')).toThrow(DiceParseError);
    expect(() => parseDice('')).toThrow(/Empty dice expression/);
  });

  it('rejects expression exceeding max length', () => {
    const long = 'd4+'.repeat(80) + 'd4';
    expect(() => parseDice(long)).toThrow(DiceParseError);
    expect(() => parseDice(long)).toThrow(/too long/);
  });

  it('rejects more than 50 dice total', () => {
    expect(() => parseDice('51d4')).toThrow(DiceParseError);
    expect(() => parseDice('51d4')).toThrow(/Too many dice/);
  });

  it('allows exactly 50 dice', () => {
    const result = parseDice('50d4');
    expect(result).toEqual([{ count: 50, sides: 4 }]);
  });

  it('rejects 0-count dice (0d6)', () => {
    expect(() => parseDice('0d6')).toThrow(DiceParseError);
    expect(() => parseDice('0d6')).toThrow(/at least 1/);
  });
});

// ---------------------------------------------------------------------------
// parseDice — labeled rolls
// ---------------------------------------------------------------------------

describe('parseDice (labeled)', () => {
  it('parses a single labeled group', () => {
    const result = parseDice('(Verve) 2d20');
    expect(result).toEqual([{ count: 2, sides: 20, label: 'Verve' }]);
  });

  it('parses multiple labeled groups with plus separator', () => {
    const result = parseDice('(Verve) 2d20 + (Damage) 1d8');
    expect(result).toEqual([
      { count: 2, sides: 20, label: 'Verve' },
      { count: 1, sides: 8, label: 'Damage' },
    ]);
  });

  it('parses multiple labeled groups with comma separator', () => {
    const result = parseDice('(NomeLancio1) d6, (NomeLancio2) d4, (NomeLancio3) 2d20');
    expect(result).toEqual([
      { count: 1, sides: 6, label: 'NomeLancio1' },
      { count: 1, sides: 4, label: 'NomeLancio2' },
      { count: 2, sides: 20, label: 'NomeLancio3' },
    ]);
  });

  it('parses mixed labeled and unlabeled groups', () => {
    const result = parseDice('(Verve) 2d20 + 1d6');
    expect(result).toEqual([
      { count: 2, sides: 20, label: 'Verve' },
      { count: 1, sides: 6 },
    ]);
  });

  it('parses labels with spaces, hyphens, underscores', () => {
    const result = parseDice('(Fire Bolt) d10');
    expect(result).toEqual([{ count: 1, sides: 10, label: 'Fire Bolt' }]);
  });

  it('parses space-separated labeled groups', () => {
    const result = parseDice('(Soul) d4 (Bonus) d6');
    expect(result).toEqual([
      { count: 1, sides: 4, label: 'Soul' },
      { count: 1, sides: 6, label: 'Bonus' },
    ]);
  });

  it('ignores empty parentheses', () => {
    const result = parseDice('() d6');
    expect(result).toEqual([{ count: 1, sides: 6 }]);
  });

  it('rejects label exceeding 32 characters', () => {
    const longLabel = 'A'.repeat(33);
    expect(() => parseDice(`(${longLabel}) d6`)).toThrow(DiceParseError);
    expect(() => parseDice(`(${longLabel}) d6`)).toThrow(/too long/);
  });

  it('rejects labels with unsafe characters', () => {
    expect(() => parseDice('(Verve!) d6')).toThrow(DiceParseError);
    expect(() => parseDice('(Verve!) d6')).toThrow(/invalid characters/);
  });

  it('handles uppercase in labels', () => {
    const result = parseDice('(Verve) 2D20');
    expect(result).toEqual([{ count: 2, sides: 20, label: 'Verve' }]);
  });
});

// ---------------------------------------------------------------------------
// canonicalize
// ---------------------------------------------------------------------------

describe('canonicalize', () => {
  it('produces canonical string for unlabeled groups', () => {
    const groups: DieGroup[] = [
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
    ];
    expect(canonicalize(groups)).toBe('2d4 + 1d8');
  });

  it('handles a single group', () => {
    expect(canonicalize([{ count: 3, sides: 20 }])).toBe('3d20');
  });

  it('includes labels in canonical output', () => {
    const groups: DieGroup[] = [
      { count: 2, sides: 20, label: 'Verve' },
      { count: 1, sides: 8, label: 'Damage' },
    ];
    expect(canonicalize(groups)).toBe('(Verve) 2d20 + (Damage) 1d8');
  });

  it('mixes labeled and unlabeled groups', () => {
    const groups: DieGroup[] = [
      { count: 2, sides: 20, label: 'Verve' },
      { count: 1, sides: 6 },
    ];
    expect(canonicalize(groups)).toBe('(Verve) 2d20 + 1d6');
  });
});

// ---------------------------------------------------------------------------
// rollDice
// ---------------------------------------------------------------------------

describe('rollDice', () => {
  it('returns correct structure for a single group', () => {
    const groups: DieGroup[] = [{ count: 3, sides: 6 }];
    const result = rollDice(groups);

    expect(result.expression).toBe('3d6');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].rolls).toHaveLength(3);
    expect(result.groups[0].group).toEqual(groups[0]);

    for (const r of result.groups[0].rolls) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(6);
    }

    const expectedTotal = result.groups[0].rolls.reduce((a, b) => a + b, 0);
    expect(result.total).toBe(expectedTotal);
  });

  it('returns correct structure for multiple groups', () => {
    const groups: DieGroup[] = [
      { count: 2, sides: 4 },
      { count: 1, sides: 8 },
    ];
    const result = rollDice(groups);

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].rolls).toHaveLength(2);
    expect(result.groups[1].rolls).toHaveLength(1);

    for (const r of result.groups[0].rolls) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(4);
    }
    for (const r of result.groups[1].rolls) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(8);
    }

    const allRolls = result.groups.flatMap((g) => g.rolls);
    const expectedTotal = allRolls.reduce((a, b) => a + b, 0);
    expect(result.total).toBe(expectedTotal);
  });

  it('preserves labels in results', () => {
    const groups: DieGroup[] = [{ count: 1, sides: 6, label: 'Verve' }];
    const result = rollDice(groups);
    expect(result.groups[0].group.label).toBe('Verve');
    expect(result.expression).toBe('(Verve) 1d6');
  });

  it('rolls produce values within valid range over many iterations', () => {
    const groups: DieGroup[] = [{ count: 1, sides: 20 }];
    const values = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const r = rollDice(groups);
      const val = r.groups[0].rolls[0];
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(20);
      values.add(val);
    }
    expect(values.size).toBeGreaterThan(10);
  });
});
