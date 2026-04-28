import type { Account, CategoryRule, ParsedTransaction } from '@/lib/types';
import { detectFormat } from './detectFormat';
import { splitRows } from './parseUtils';
import { parseCibcChequing } from './parseCibcChequing';
import { parseCibcCc } from './parseCibcCc';
import { parseScotiabankChequing } from './parseScotiabankChequing';
import { parseScotiabankCc } from './parseScotiabankCc';
import { parseGeneric } from './parseGeneric';

export function parseCsv(
  csvText: string,
  account: Account,
  rules: CategoryRule[],
): { transactions: ParsedTransaction[]; format: string } {
  const rows = splitRows(csvText);
  if (rows.length === 0) return { transactions: [], format: 'empty' };

  const format = detectFormat(rows[0]);

  let transactions: ParsedTransaction[];
  switch (format) {
    case 'cibc-chequing':
      transactions = parseCibcChequing(csvText, account, rules);
      break;
    case 'cibc-cc':
      transactions = parseCibcCc(csvText, account, rules);
      break;
    case 'scotiabank-chequing':
      transactions = parseScotiabankChequing(csvText, account, rules);
      break;
    case 'scotiabank-cc':
      transactions = parseScotiabankCc(csvText, account, rules);
      break;
    default:
      // generic: assume Date=0, Description=1, Amount=2
      transactions = parseGeneric(csvText, account, rules, { dateCol: 0, descCol: 1, amountCol: 2 });
  }

  return { transactions, format };
}
