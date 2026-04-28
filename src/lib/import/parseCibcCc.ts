import type { Account, CategoryRule, ParsedTransaction } from '@/lib/types';
import { splitRows, splitCols, normalizeDate, buildParsedTx } from './parseUtils';

export function parseCibcCc(
  csvText: string,
  account: Account,
  rules: CategoryRule[],
): ParsedTransaction[] {
  const rows = splitRows(csvText);
  if (rows.length < 2) return [];

  const header = splitCols(rows[0]).map((h) => h.toLowerCase());
  const dateIdx   = header.findIndex((h) => h === 'date');
  const descIdx   = header.findIndex((h) => h.includes('description'));
  const debitIdx  = header.findIndex((h) => h === 'debit');
  const creditIdx = header.findIndex((h) => h === 'credit');

  const results: ParsedTransaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = splitCols(rows[i]);
    if (cols.length < 3) continue;

    const debit  = parseFloat(cols[debitIdx]  || '0') || 0;
    const credit = parseFloat(cols[creditIdx] || '0') || 0;

    // Debit = charge to card (spending, positive rawAmount)
    // Credit = payment or refund (negative rawAmount)
    const rawAmount = debit > 0 ? debit : -credit;
    if (rawAmount === 0) continue;

    results.push(buildParsedTx(
      normalizeDate(cols[dateIdx] ?? ''),
      cols[descIdx] ?? '',
      rawAmount,
      account,
      rules,
    ));
  }
  return results;
}
