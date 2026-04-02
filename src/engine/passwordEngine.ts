import dictionary from '../data/dictionary.json';

export type SegmentType = 'word' | 'number' | 'symbol' | 'literal';
export type WordCategory = 'adjective' | 'noun' | 'verb';
export type Capitalization = 'title' | 'upper' | 'lower' | 'preserve';

export interface FormulaSegment {
  type: SegmentType;
  wordCategory?: WordCategory;
  capitalization?: Capitalization;
  separator?: string;
  numberRange?: [number, number];
  symbolPool?: string;
  literalValue?: string;
}

export interface FormulaConfig {
  name: string;
  segments: FormulaSegment[];
  minLength?: number;
  maxLength?: number;
}

export class PasswordEngine {
  private static defaultSymbols = "!@#$%^&*";

  static generate(config: FormulaConfig): string {
    let result = "";

    for (const segment of config.segments) {
      let segmentValue = "";

      switch (segment.type) {
        case 'word':
          segmentValue = this.getRandomWord(segment.wordCategory || 'noun');
          break;
        case 'number':
          const [min, max] = segment.numberRange || [10, 99];
          segmentValue = Math.floor(Math.random() * (max - min + 1) + min).toString();
          break;
        case 'symbol':
          const pool = segment.symbolPool || this.defaultSymbols;
          segmentValue = pool[Math.floor(Math.random() * pool.length)];
          break;
        case 'literal':
          segmentValue = segment.literalValue || "";
          break;
      }

      segmentValue = this.applyCapitalization(segmentValue, segment.capitalization || 'preserve');
      result += segmentValue + (segment.separator || "");
    }

    // Basic length guard (v1)
    if (config.minLength && result.length < config.minLength) {
      return this.generate(config);
    }
    if (config.maxLength && result.length > config.maxLength) {
      return this.generate(config);
    }

    return result;
  }

  private static getRandomWord(category: WordCategory): string {
    const list = dictionary[`${category}s` as keyof typeof dictionary] as string[];
    const word = list[Math.floor(Math.random() * list.length)];
    
    // Check blocklist
    if (dictionary.blocklist.includes(word.toLowerCase())) {
      return this.getRandomWord(category);
    }
    
    return word;
  }

  private static applyCapitalization(text: string, cap: Capitalization): string {
    switch (cap) {
      case 'title':
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
      case 'upper':
        return text.toUpperCase();
      case 'lower':
        return text.toLowerCase();
      default:
        return text;
    }
  }

  static getPoolSize(segment: FormulaSegment): number {
    switch (segment.type) {
      case 'word':
        const list = dictionary[`${segment.wordCategory || 'noun'}s` as keyof typeof dictionary] as string[];
        return list.length;
      case 'number':
        const [min, max] = segment.numberRange || [10, 99];
        return max - min + 1;
      case 'symbol':
        return (segment.symbolPool || this.defaultSymbols).length;
      case 'literal':
        return 1;
      default:
        return 1;
    }
  }
}
