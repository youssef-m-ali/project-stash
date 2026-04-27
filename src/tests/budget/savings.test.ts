import { describe, it, expect } from 'vitest';
import { allocateSavings } from '@/lib/budget/savings';
import type { SavingsBucket } from '@/lib/types';

const buckets: SavingsBucket[] = [
  { id: 'tfsa', name: 'TFSA', percentageOfSavings: 0.6 },
  { id: 'rrsp', name: 'RRSP', percentageOfSavings: 0.4 },
];

describe('allocateSavings', () => {
  it('splits savings by percentage', () => {
    const result = allocateSavings(1000, buckets);
    expect(result.find((r) => r.bucketId === 'tfsa')!.amount).toBeCloseTo(600);
    expect(result.find((r) => r.bucketId === 'rrsp')!.amount).toBeCloseTo(400);
  });

  it('handles single 100% bucket', () => {
    const single: SavingsBucket[] = [{ id: 'gen', name: 'General', percentageOfSavings: 1 }];
    const result = allocateSavings(500, single);
    expect(result[0].amount).toBe(500);
  });

  it('throws when buckets do not sum to 1.0', () => {
    const bad: SavingsBucket[] = [
      { id: 'a', name: 'A', percentageOfSavings: 0.5 },
      { id: 'b', name: 'B', percentageOfSavings: 0.3 },
    ];
    expect(() => allocateSavings(1000, bad)).toThrow();
  });

  it('accepts buckets summing to 1.0 within floating-point tolerance', () => {
    const fuzzy: SavingsBucket[] = [
      { id: 'a', name: 'A', percentageOfSavings: 1 / 3 },
      { id: 'b', name: 'B', percentageOfSavings: 1 / 3 },
      { id: 'c', name: 'C', percentageOfSavings: 1 / 3 },
    ];
    expect(() => allocateSavings(900, fuzzy)).not.toThrow();
  });

  it('returns bucket names', () => {
    const result = allocateSavings(1000, buckets);
    expect(result.find((r) => r.bucketId === 'tfsa')!.name).toBe('TFSA');
  });
});
