import type { SavingsBucket } from '../types';

export function allocateSavings(
  totalSavings: number,
  buckets: SavingsBucket[],
): { bucketId: string; name: string; amount: number }[] {
  const sum = buckets.reduce((s, b) => s + b.percentageOfSavings, 0);
  if (Math.abs(sum - 1) > 0.001) {
    throw new Error(`Bucket percentages must sum to 1.0, got ${sum}`);
  }
  return buckets.map((b) => ({
    bucketId: b.id,
    name: b.name,
    amount: totalSavings * b.percentageOfSavings,
  }));
}
