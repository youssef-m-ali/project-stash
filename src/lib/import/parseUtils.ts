import { v4 as uuid } from 'uuid';
import type { Account, ParsedTransaction } from '@/lib/types';
import { applyIgnoreRules } from './applyIgnoreRules';

/** Strip BOM and split CSV text into rows, skipping blank lines. */
export function splitRows(csv: string): string[] {
  return csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
}

/** Very simple CSV column splitter — handles quoted fields with commas. */
export function splitCols(line: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

/** YYYY/MM/DD or MM/DD/YYYY → YYYY-MM-DD */
export function normalizeDate(raw: string): string {
  const clean = raw.trim();
  if (/^\d{4}[\/\-]/.test(clean)) {
    return clean.replace(/\//g, '-');
  }
  const [m, d, y] = clean.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function buildParsedTx(
  date: string,
  description: string,
  rawAmount: number,
  account: Account,
): ParsedTransaction {
  const { status } = applyIgnoreRules(description, rawAmount, account);
  const amount = account.kind === 'credit-card' ? rawAmount : Math.abs(rawAmount);

  return {
    tempId: uuid(),
    accountId: account.id,
    date,
    description,
    amount,
    rawAmount,
    bucketId: null,
    periodId: null,
    suggestedBucketId: null,
    status,
    duplicate: false,
  };
}
