import type { Account, CategoryRule, ParsedTransaction } from '@/lib/types';
import { splitRows, splitCols, normalizeDate, buildParsedTx } from './parseUtils';

export function parseCibcChequing(
  csvText: string,
  account: Account,
  rules: CategoryRule[],
): ParsedTransaction[] {
  const rows = splitRows(csvText);
  if (rows.length < 2) return [];

  const header = splitCols(rows[0]).map((h) => h.toLowerCase());
  const idx = {
    date: header.findIndex((h) => h === 'date'),
    desc: header.findIndex((h) => h.includes('description') || h.includes('name')),
    amount: header.findIndex((h) => h.includes('amount') || h === '$ amount' || h === 'cad$'),
  };

  const results: ParsedTransaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = splitCols(rows[i]);
    if (cols.length < 3) continue;

    const rawAmount = parseFloat(cols[idx.amount] ?? '0') || 0;
    if (rawAmount === 0) continue;

    results.push(buildParsedTx(
      normalizeDate(cols[idx.date] ?? ''),
      cols[idx.desc] ?? '',
      rawAmount,
      account,
      rules,
    ));
  }
  return results;
}
