import { FormulaConfig, PasswordEngine } from './passwordEngine';

export class EntropyCalculator {
  static calculate(config: FormulaConfig): number {
    let totalEntropy = 0;

    for (const segment of config.segments) {
      if (segment.type === 'literal') continue;

      const poolSize = PasswordEngine.getPoolSize(segment);
      if (poolSize > 0) {
        totalEntropy += Math.log2(poolSize);
      }
    }

    return Math.round(totalEntropy * 10) / 10;
  }

  static getStrengthLabel(bits: number): { label: string; color: string } {
    if (bits >= 60) return { label: 'Strong', color: 'text-success' };
    if (bits >= 40) return { label: 'Fair', color: 'text-warning' };
    return { label: 'Weak', color: 'text-error' };
  }
}
