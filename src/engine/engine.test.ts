import { describe, it, expect } from 'vitest'
import { PasswordEngine, GeneratorConfig } from './passwordEngine'
import {
  ADJECTIVES, NOUNS, BLOCKED_PAIRS, SYMBOLS,
  generateSmartPass, generateSmartPassBatch, calculateSmartPassEntropy,
  SmartPassOptions,
} from '../lib/smartpass'

// ─── PasswordEngine — password mode ───────────────────────────────────────────

const basePasswordConfig: GeneratorConfig = {
  mode: 'password', length: 24,
  useSpecialChars: true, useNumbers: true, useUppercase: true, excludeAmbiguous: false,
  wordCount: 4, separator: '-',
}

describe('PasswordEngine — password mode', () => {
  it('generates a value of the correct length', () => {
    expect(PasswordEngine.generate(basePasswordConfig).value.length).toBe(24)
  })

  it('excludes ambiguous characters when option is set', () => {
    const cfg = { ...basePasswordConfig, excludeAmbiguous: true }
    for (let i = 0; i < 50; i++) {
      expect(PasswordEngine.generate(cfg).value).not.toMatch(/[0O1lI|]/)
    }
  })

  it('calculates correct entropy for lowercase-only pool', () => {
    const cfg = { ...basePasswordConfig, useSpecialChars: false, useNumbers: false, useUppercase: false, excludeAmbiguous: false }
    expect(PasswordEngine.generate(cfg).entropy).toBeCloseTo(113.1, 0)
  })

  it('entropy increases with more character classes', () => {
    const less = PasswordEngine.generate({ ...basePasswordConfig, useSpecialChars: false, useNumbers: false })
    const more = PasswordEngine.generate(basePasswordConfig)
    expect(more.entropy).toBeGreaterThan(less.entropy)
  })

  it('clamps length to 8 minimum', () => {
    expect(PasswordEngine.generate({ ...basePasswordConfig, length: 1 }).value.length).toBe(8)
  })

  it('clamps length to 128 maximum', () => {
    expect(PasswordEngine.generate({ ...basePasswordConfig, length: 999 }).value.length).toBe(128)
  })
})

// ─── PasswordEngine — passphrase mode ─────────────────────────────────────────

const basePassphraseConfig: GeneratorConfig = {
  mode: 'passphrase', length: 24,
  useSpecialChars: false, useNumbers: false, useUppercase: false, excludeAmbiguous: false,
  wordCount: 4, separator: '-',
}

describe('PasswordEngine — passphrase mode', () => {
  it('generates the correct number of words', () => {
    expect(PasswordEngine.generate(basePassphraseConfig).value.split('-').length).toBe(4)
  })

  it('uses the configured separator', () => {
    const { value } = PasswordEngine.generate({ ...basePassphraseConfig, separator: '.' })
    expect(value.split('.').length).toBe(4)
  })

  it('title-cases each word', () => {
    for (let i = 0; i < 10; i++) {
      PasswordEngine.generate(basePassphraseConfig).value.split('-').forEach(w => {
        expect(w[0]).toBe(w[0].toUpperCase())
      })
    }
  })

  it('entropy scales with word count', () => {
    const three = PasswordEngine.calculateEntropy({ ...basePassphraseConfig, wordCount: 3 })
    const six   = PasswordEngine.calculateEntropy({ ...basePassphraseConfig, wordCount: 6 })
    expect(six).toBeGreaterThan(three)
  })
})

// ─── PasswordEngine — batch & strength ────────────────────────────────────────

describe('PasswordEngine — batch', () => {
  it('generates the correct quantity', () => {
    expect(PasswordEngine.generateBatch(basePasswordConfig, 5).length).toBe(5)
  })
})

describe('PasswordEngine — strength labels', () => {
  it('returns Strong for ≥70 bits',  () => expect(PasswordEngine.getStrengthLabel(70).label).toBe('Strong'))
  it('returns Good for 40–69 bits',  () => expect(PasswordEngine.getStrengthLabel(55).label).toBe('Good'))
  it('returns Weak for <40 bits',    () => expect(PasswordEngine.getStrengthLabel(30).label).toBe('Weak'))
})

// ─── SmartPass — word list integrity ──────────────────────────────────────────

describe('SmartPass — word list integrity', () => {
  it('ADJECTIVES has 180 entries', () => {
    expect(ADJECTIVES.length).toBe(180)
  })

  it('NOUNS has 180 entries', () => {
    expect(NOUNS.length).toBe(180)
  })

  it('no adjective exceeds 8 characters', () => {
    const bad = ADJECTIVES.filter(w => w.length > 8)
    expect(bad).toEqual([])
  })

  it('no noun exceeds 9 characters', () => {
    const bad = NOUNS.filter(w => w.length > 9)
    expect(bad).toEqual([])
  })

  it('no word appears in both ADJECTIVES and NOUNS', () => {
    const nounSet = new Set(NOUNS)
    const overlap = ADJECTIVES.filter(a => nounSet.has(a))
    expect(overlap).toEqual([])
  })

  it('no duplicate entries in ADJECTIVES', () => {
    expect(new Set(ADJECTIVES).size).toBe(ADJECTIVES.length)
  })

  it('no duplicate entries in NOUNS', () => {
    expect(new Set(NOUNS).size).toBe(NOUNS.length)
  })

  it('blocked pairs are valid CamelCase strings with an interior uppercase letter', () => {
    // BLOCKED_PAIRS are intentionally future-proof — words may not be in the current
    // lists but will block those combos if added later. We just verify correct format.
    for (const pair of BLOCKED_PAIRS) {
      expect(pair.length).toBeGreaterThan(2)
      expect(pair[0]).toMatch(/[A-Z]/)              // starts with uppercase
      expect(pair.slice(1)).toMatch(/[A-Z]/)         // has at least one interior uppercase
    }
  })
})

// ─── SmartPass — generation ───────────────────────────────────────────────────

const defaultOpts: SmartPassOptions = { digitCount: 2, symbolSet: 'safe' }

describe('SmartPass — generateSmartPass', () => {
  it('returns a non-empty string', () => {
    expect(generateSmartPass(defaultOpts).length).toBeGreaterThan(0)
  })

  it('ends with the correct number of digits (2)', () => {
    for (let i = 0; i < 20; i++) {
      const pw = generateSmartPass({ digitCount: 2, symbolSet: 'none' })
      expect(pw.slice(-2)).toMatch(/^\d{2}$/)
    }
  })

  it('ends with the correct number of digits (3)', () => {
    for (let i = 0; i < 20; i++) {
      const pw = generateSmartPass({ digitCount: 3, symbolSet: 'none' })
      expect(pw.slice(-3)).toMatch(/^\d{3}$/)
    }
  })

  it('ends with the correct number of digits (4)', () => {
    for (let i = 0; i < 20; i++) {
      const pw = generateSmartPass({ digitCount: 4, symbolSet: 'none' })
      expect(pw.slice(-4)).toMatch(/^\d{4}$/)
    }
  })

  it('includes a symbol when symbolSet is safe', () => {
    const symbolChars = new Set(SYMBOLS as unknown as string[])
    for (let i = 0; i < 20; i++) {
      const pw = generateSmartPass({ digitCount: 2, symbolSet: 'safe' })
      const chars = pw.split('')
      expect(chars.some(c => symbolChars.has(c))).toBe(true)
    }
  })

  it('produces no symbol when symbolSet is none', () => {
    const symbolChars = new Set(SYMBOLS as unknown as string[])
    for (let i = 0; i < 20; i++) {
      const pw = generateSmartPass({ digitCount: 2, symbolSet: 'none' })
      expect(pw.split('').some(c => symbolChars.has(c))).toBe(false)
    }
  })

  it('never emits a blocked number string', () => {
    const blocked = new Set(['69', '420', '1337', '000', '13', '666'])
    for (let i = 0; i < 100; i++) {
      const pw = generateSmartPass({ digitCount: 2, symbolSet: 'none' })
      const digits = pw.slice(-2)
      expect(blocked.has(digits)).toBe(false)
      // Not all-same digits
      expect(new Set(digits).size).toBeGreaterThan(1)
    }
  })

  it('never emits a blocked pair', () => {
    for (let i = 0; i < 100; i++) {
      const pw = generateSmartPass(defaultOpts)
      for (const pair of BLOCKED_PAIRS) {
        expect(pw.startsWith(pair)).toBe(false)
      }
    }
  })

  it('starts with a known adjective', () => {
    for (let i = 0; i < 20; i++) {
      const pw = generateSmartPass({ digitCount: 2, symbolSet: 'none' })
      const adj = ADJECTIVES.find(a => pw.startsWith(a))
      expect(adj).toBeDefined()
    }
  })
})

describe('SmartPass — generateSmartPassBatch', () => {
  it('returns the correct count', () => {
    expect(generateSmartPassBatch(5, defaultOpts).length).toBe(5)
  })

  it('all entries are non-empty strings', () => {
    generateSmartPassBatch(3, defaultOpts).forEach(pw => {
      expect(typeof pw).toBe('string')
      expect(pw.length).toBeGreaterThan(0)
    })
  })
})

describe('SmartPass — entropy', () => {
  it('is positive for all configurations', () => {
    expect(calculateSmartPassEntropy({ digitCount: 2, symbolSet: 'safe' })).toBeGreaterThan(0)
    expect(calculateSmartPassEntropy({ digitCount: 4, symbolSet: 'none' })).toBeGreaterThan(0)
  })

  it('is higher with more digits', () => {
    const two  = calculateSmartPassEntropy({ digitCount: 2, symbolSet: 'none' })
    const four = calculateSmartPassEntropy({ digitCount: 4, symbolSet: 'none' })
    expect(four).toBeGreaterThan(two)
  })

  it('is higher with symbol than without', () => {
    const withSym    = calculateSmartPassEntropy({ digitCount: 2, symbolSet: 'safe' })
    const withoutSym = calculateSmartPassEntropy({ digitCount: 2, symbolSet: 'none' })
    expect(withSym).toBeGreaterThan(withoutSym)
  })
})
