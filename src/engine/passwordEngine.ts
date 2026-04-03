import dictionary from '../data/dictionary.json';

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS   = '0123456789';
const SPECIAL   = '!@#$%^&*()-_=+[]{};:,.<>?|';
const AMBIGUOUS = new Set(['0', 'O', '1', 'l', 'I', '|']);

const MAX_RETRIES = 50;

export interface GeneratorConfig {
  mode:             'password' | 'passphrase';
  // Password mode
  length:           number;   // 8–128
  useSpecialChars:  boolean;
  useNumbers:       boolean;
  useUppercase:     boolean;
  excludeAmbiguous: boolean;
  // Passphrase mode
  wordCount:        number;   // 3–8
  separator:        string;   // '-' | ' ' | '.'
}

export interface PasswordEntry {
  value:   string;
  entropy: number;
}

export class PasswordEngine {

  // ─── Char Pool ─────────────────────────────────────────────────────────────

  static buildCharPool(config: GeneratorConfig): string {
    let pool = LOWERCASE;
    if (config.useUppercase)   pool += UPPERCASE;
    if (config.useNumbers)     pool += NUMBERS;
    if (config.useSpecialChars) pool += SPECIAL;
    if (config.excludeAmbiguous) {
      pool = pool.split('').filter(c => !AMBIGUOUS.has(c)).join('');
    }
    return pool;
  }

  // ─── Password Generation ───────────────────────────────────────────────────

  private static generatePasswordValue(config: GeneratorConfig): string {
    const pool   = this.buildCharPool(config);
    const length = Math.max(8, Math.min(128, config.length));
    if (pool.length === 0) return '';
    return Array.from({ length }, () => pool[Math.floor(Math.random() * pool.length)]).join('');
  }

  // ─── Passphrase Generation ─────────────────────────────────────────────────

  private static getAllWords(): string[] {
    return [
      ...(dictionary.adjectives as string[]),
      ...(dictionary.nouns      as string[]),
      ...(dictionary.verbs      as string[]),
    ];
  }

  private static pickWord(allWords: string[], depth = 0): string {
    if (depth >= MAX_RETRIES) {
      throw new Error('PasswordEngine: blocklist exhausted all candidates');
    }
    const word = allWords[Math.floor(Math.random() * allWords.length)];
    if (dictionary.blocklist.includes(word.toLowerCase())) {
      return this.pickWord(allWords, depth + 1);
    }
    return word;
  }

  private static generatePassphraseValue(config: GeneratorConfig): string {
    const allWords = this.getAllWords();
    if (allWords.length === 0) throw new Error('PasswordEngine: word dictionary is empty');

    const count = Math.max(3, Math.min(8, config.wordCount));
    const words = Array.from({ length: count }, () => {
      const w = this.pickWord(allWords);
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
    return words.join(config.separator);
  }

  // ─── Entropy ───────────────────────────────────────────────────────────────

  static calculateEntropy(config: GeneratorConfig): number {
    let bits: number;
    if (config.mode === 'passphrase') {
      const total = this.getAllWords().length;
      bits = Math.max(3, Math.min(8, config.wordCount)) * Math.log2(Math.max(1, total));
    } else {
      const pool = this.buildCharPool(config);
      bits = Math.max(8, Math.min(128, config.length)) * Math.log2(Math.max(1, pool.length));
    }
    return Math.round(bits * 10) / 10;
  }

  // ─── Strength ──────────────────────────────────────────────────────────────

  static getStrengthLabel(entropy: number): { label: string; color: string; barColor: string } {
    if (entropy >= 70) return { label: 'Strong', color: 'text-success', barColor: 'bg-success shadow-[0_0_8px_rgba(52,211,153,0.3)]' };
    if (entropy >= 40) return { label: 'Good',   color: 'text-warning', barColor: 'bg-warning shadow-[0_0_8px_rgba(251,191,36,0.2)]' };
    return               { label: 'Weak',   color: 'text-error',   barColor: 'bg-error   shadow-[0_0_8px_rgba(248,113,113,0.2)]' };
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  static generate(config: GeneratorConfig): PasswordEntry {
    const value = config.mode === 'passphrase'
      ? this.generatePassphraseValue(config)
      : this.generatePasswordValue(config);
    return { value, entropy: this.calculateEntropy(config) };
  }

  static generateBatch(config: GeneratorConfig, quantity: number): PasswordEntry[] {
    return Array.from({ length: Math.max(1, quantity) }, () => this.generate(config));
  }
}
