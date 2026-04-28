export type BankFormat =
  | 'cibc-chequing'
  | 'cibc-cc'
  | 'scotiabank-chequing'
  | 'scotiabank-cc'
  | 'generic';

export function detectFormat(headerLine: string): BankFormat {
  const h = headerLine.toLowerCase();

  if (h.includes('transaction type') || h.includes('$ amount')) return 'cibc-chequing';
  if (h.includes('transaction date') && h.includes('cad$')) return 'scotiabank-cc';
  if (h.includes('transaction') && h.includes('memo')) return 'scotiabank-chequing';
  if (h.includes('debit') && h.includes('credit')) return 'cibc-cc';

  return 'generic';
}
