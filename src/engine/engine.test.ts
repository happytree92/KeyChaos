import { describe, it, expect } from 'vitest';
import { PasswordEngine, GeneratorConfig } from './passwordEngine';

const basePasswordConfig: GeneratorConfig = {
  mode: 'password',
  length: 24,
  useSpecialChars: true,
  useNumbers: true,
  useUppercase: true,
  excludeAmbiguous: false,
  wordCount: 4,
  separator: '-',
};

const basePassphraseConfig: GeneratorConfig = {
  mode: 'passphrase',
  length: 24,
  useSpecialChars: false,
  useNumbers: false,
  useUppercase: false,
  excludeAmbiguous: false,
  wordCount: 4,
  separator: '-',
};

describe('PasswordEngine — password mode', () => {
  it('generates a value of the correct length', () => {
    const { value } = PasswordEngine.generate(basePasswordConfig);
    expect(value.length).toBe(24);
  });

  it('excludes ambiguous characters when option is set', () => {
    const config = { ...basePasswordConfig, excludeAmbiguous: true };
    for (let i = 0; i < 50; i++) {
      const { value } = PasswordEngine.generate(config);
      expect(value).not.toMatch(/[0O1lI|]/);
    }
  });

  it('calculates correct entropy for lowercase-only pool', () => {
    const config = {
      ...basePasswordConfig,
      useSpecialChars: false,
      useNumbers: false,
      useUppercase: false,
      excludeAmbiguous: false,
    };
    // 26 lowercase * 24 chars → 24 * log2(26) ≈ 113.1
    const { entropy } = PasswordEngine.generate(config);
    expect(entropy).toBeCloseTo(113.1, 0);
  });

  it('calculates higher entropy with more character classes', () => {
    const less = PasswordEngine.generate({ ...basePasswordConfig, useSpecialChars: false, useNumbers: false });
    const more = PasswordEngine.generate(basePasswordConfig);
    expect(more.entropy).toBeGreaterThan(less.entropy);
  });

  it('clamps length to 8 minimum', () => {
    const { value } = PasswordEngine.generate({ ...basePasswordConfig, length: 1 });
    expect(value.length).toBe(8);
  });

  it('clamps length to 128 maximum', () => {
    const { value } = PasswordEngine.generate({ ...basePasswordConfig, length: 999 });
    expect(value.length).toBe(128);
  });
});

describe('PasswordEngine — passphrase mode', () => {
  it('generates the correct number of words', () => {
    const { value } = PasswordEngine.generate(basePassphraseConfig);
    expect(value.split('-').length).toBe(4);
  });

  it('uses the configured separator', () => {
    const { value } = PasswordEngine.generate({ ...basePassphraseConfig, separator: '.' });
    expect(value).toContain('.');
    expect(value.split('.').length).toBe(4);
  });

  it('title-cases each word', () => {
    for (let i = 0; i < 10; i++) {
      const { value } = PasswordEngine.generate(basePassphraseConfig);
      value.split('-').forEach(word => {
        expect(word[0]).toBe(word[0].toUpperCase());
      });
    }
  });

  it('returns positive entropy', () => {
    const { entropy } = PasswordEngine.generate(basePassphraseConfig);
    expect(entropy).toBeGreaterThan(0);
  });

  it('entropy scales with word count', () => {
    const three = PasswordEngine.calculateEntropy({ ...basePassphraseConfig, wordCount: 3 });
    const six   = PasswordEngine.calculateEntropy({ ...basePassphraseConfig, wordCount: 6 });
    expect(six).toBeGreaterThan(three);
  });
});

describe('PasswordEngine — batch', () => {
  it('generates the correct quantity', () => {
    const batch = PasswordEngine.generateBatch(basePasswordConfig, 5);
    expect(batch.length).toBe(5);
  });

  it('each entry has value and entropy', () => {
    PasswordEngine.generateBatch(basePasswordConfig, 3).forEach(entry => {
      expect(typeof entry.value).toBe('string');
      expect(entry.value.length).toBeGreaterThan(0);
      expect(typeof entry.entropy).toBe('number');
      expect(entry.entropy).toBeGreaterThan(0);
    });
  });
});

describe('PasswordEngine — strength labels', () => {
  it('returns Strong for ≥70 bits', () => {
    expect(PasswordEngine.getStrengthLabel(70).label).toBe('Strong');
    expect(PasswordEngine.getStrengthLabel(120).label).toBe('Strong');
  });

  it('returns Good for 40–69 bits', () => {
    expect(PasswordEngine.getStrengthLabel(40).label).toBe('Good');
    expect(PasswordEngine.getStrengthLabel(69).label).toBe('Good');
  });

  it('returns Weak for <40 bits', () => {
    expect(PasswordEngine.getStrengthLabel(0).label).toBe('Weak');
    expect(PasswordEngine.getStrengthLabel(39).label).toBe('Weak');
  });
});
