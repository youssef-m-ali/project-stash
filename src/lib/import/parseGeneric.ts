import type { Account, ParsedTransaction } from '@/lib/types';
import { splitRows, splitCols, normalizeDate, buildParsedTx } from './parseUtils';

// Fallback parser: expects at minimum Date, Description, Amount columns.
// Column indices are provided by the caller (from a manual mapping UI).
export interface GenericMapping {
  dateCol: number;
  descCol: number;
  amountCol: number;
}

export function parseGeneric(
  csvText: string,
  account: Account,
  mapping: GenericMapping,
  skipHeaderRows = 1,
): ParsedTransaction[] {
  const rows = splitRows(csvText);
  const results: ParsedTransaction[] = [];

  for (let i = skipHeaderRows; i < rows.length; i++) {
    const cols = splitCols(rows[i]);
    const rawAmount = parseFloat(cols[mapping.amountCol] ?? '0') || 0;
    if (rawAmount === 0) continue;

    results.push(buildParsedTx(
      normalizeDate(cols[mapping.dateCol] ?? ''),
      cols[mapping.descCol] ?? '',
      rawAmount,
      account,
    ));
  }
  return results;
}
