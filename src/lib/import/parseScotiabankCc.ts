import type { Account, CategoryRule, ParsedTransaction } from '@/lib/types';
import { splitRows, splitCols, normalizeDate, buildParsedTx } from './parseUtils';

export function parseScotiabankCc(
  csvText: string,
  account: Account,
  rules: CategoryRule[],
): ParsedTransaction[] {
  const rows = splitRows(csvText);
  if (rows.length < 2) return [];

  const header = splitCols(rows[0]).map((h) => h.toLowerCase());
  const dateIdx  = header.findIndex((h) => h.includes('transaction date'));
  const desc1Idx = header.findIndex((h) => h === 'description 1');
  const desc2Idx = header.findIndex((h) => h === 'description 2');
  const cadIdx   = header.findIndex((h) => h === 'cad$' || h === 'cad');

  const results: ParsedTransaction[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = splitCols(rows[i]);
    if (cols.length < 3) continue;

    const rawAmount = parseFloat(cols[cadIdx] ?? '0') || 0;
    if (rawAmount === 0) continue;

    const d1 = cols[desc1Idx] ?? '';
    const d2 = desc2Idx >= 0 ? (cols[desc2Idx] ?? '') : '';
    const description = d2 ? `${d1} ${d2}`.trim() : d1;

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
