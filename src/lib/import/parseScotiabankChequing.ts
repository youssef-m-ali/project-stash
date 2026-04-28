import type { Account, CategoryRule, ParsedTransaction } from '@/lib/types';
import { splitRows, splitCols, normalizeDate, buildParsedTx } from './parseUtils';

// All rows from a pass-through account are auto-ignored by applyIgnoreRules.
// This parser still runs so the user can see what was ignored in the preview.
export function parseScotiabankChequing(
  csvText: string,
  account: Account,
  rules: CategoryRule[],
): ParsedTransaction[] {
  const rows = splitRows(csvText);
  if (rows.length < 2) return [];

  const header = splitCols(rows[0]).map((h) => h.toLowerCase());
  const dateIdx   = header.findIndex((h) => h === 'date');
  const nameIdx   = header.findIndex((h) => h === 'name');
  const memoIdx   = header.findIndex((h) => h === 'memo');
  const amountIdx = header.findIndex((h) => h === 'amount');

  const results: ParsedTransaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = splitCols(rows[i]);
    if (cols.length < 3) continue;

    const rawAmount = parseFloat(cols[amountIdx] ?? '0') || 0;
    if (rawAmount === 0) continue;

    const name = cols[nameIdx] ?? '';
    const memo = memoIdx >= 0 ? (cols[memoIdx] ?? '') : '';
    const description = memo ? `${name} ${memo}`.trim() : name;

    results.push(buildParsedTx(
      normalizeDate(cols[dateIdx] ?? ''),
      description,
      rawAmount,
      account,
      rules,
    ));
  }
  return results;
}
