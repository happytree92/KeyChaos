import { describe, it, expect } from 'vitest';
import { PasswordEngine, FormulaConfig } from './passwordEngine';
import { EntropyCalculator } from './entropyCalculator';

describe('PasswordEngine', () => {
  const testConfig: FormulaConfig = {
    name: 'Test Passphrase',
    segments: [
      { type: 'word', wordCategory: 'adjective', capitalization: 'title', separator: '-' },
      { type: 'word', wordCategory: 'noun', capitalization: 'upper', separator: '-' },
      { type: 'number', numberRange: [10, 99] }
    ]
  };

  it('generates a password with correct segments', () => {
    const password = PasswordEngine.generate(testConfig);
    const parts = password.split('-');
    
    expect(parts.length).toBe(3);
    expect(parts[0][0]).toBe(parts[0][0].toUpperCase()); // Title case check
    expect(parts[1]).toBe(parts[1].toUpperCase()); // Upper case check
    expect(parseInt(parts[2])).toBeGreaterThanOrEqual(10);
    expect(parseInt(parts[2])).toBeLessThanOrEqual(99);
  });
});

describe('EntropyCalculator', () => {
  it('calculates entropy correctly for a simple numeric segment', () => {
    const config: FormulaConfig = {
      name: 'numeric',
      segments: [{ type: 'number', numberRange: [0, 9] }] // 10 options = log2(10) ≈ 3.32
    };
    const entropy = EntropyCalculator.calculate(config);
    expect(entropy).toBeCloseTo(3.3, 1);
  });

  it('provides correct strength labels', () => {
    expect(EntropyCalculator.getStrengthLabel(70).label).toBe('Strong');
    expect(EntropyCalculator.getStrengthLabel(45).label).toBe('Fair');
    expect(EntropyCalculator.getStrengthLabel(20).label).toBe('Weak');
  });
});
