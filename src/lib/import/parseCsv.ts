import type { Account, ParsedTransaction, CsvMapping } from '@/lib/types';
import { splitRows, splitCols } from './parseUtils';
import { parseGeneric, type GenericMapping } from './parseGeneric';

export function parseCsv(
  csvText: string,
  account: Account,
  savedMapping?: CsvMapping | null,
): ParsedTransaction[] {
  const rows = splitRows(csvText);
  if (rows.length < 2) return [];

  let mapping: GenericMapping;

  if (savedMapping?.dateCol != null && savedMapping.descCol != null && savedMapping.amountCol != null) {
    mapping = {
      dateCol:   savedMapping.dateCol,
      descCol:   savedMapping.descCol,
      amountCol: savedMapping.amountCol,
      flipSign:  savedMapping.flipSign,
    };
  } else {
    const header = splitCols(rows[0]).map((h) => h.toLowerCase().trim());
    const dateCol   = header.findIndex((h) => h.includes('date'));
    const descCol   = header.findIndex((h) => h.includes('description') || h.includes('name') || h.includes('memo'));
    const amountCol = header.findIndex((h) => h.includes('amount') || h.includes('cad'));
    mapping = {
      dateCol:   dateCol   >= 0 ? dateCol   : 0,
      descCol:   descCol   >= 0 ? descCol   : 1,
      amountCol: amountCol >= 0 ? amountCol : 2,
    };
  }

  return parseGeneric(csvText, account, mapping);
}
