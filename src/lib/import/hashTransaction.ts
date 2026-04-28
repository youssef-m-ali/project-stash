import { createHash } from 'crypto';

export function hashTransaction(
  date: string,
  description: string,
  rawAmount: number,
  accountId: string,
): string {
  const canonical = `${date}|${description.trim().toLowerCase()}|${rawAmount}|${accountId}`;
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
