import { describe, it, expect } from 'vitest';
import { detectFormat } from '@/lib/import/detectFormat';
import { normalizeDate, splitCols } from '@/lib/import/parseUtils';
import { applyIgnoreRules } from '@/lib/import/applyIgnoreRules';
import { hashTransaction } from '@/lib/import/hashTransaction';
import { parseCibcChequing } from '@/lib/import/parseCibcChequing';
import { parseCibcCc } from '@/lib/import/parseCibcCc';
import { parseScotiabankCc } from '@/lib/import/parseScotiabankCc';
import type { Account } from '@/lib/types';

const chequingAccount: Account = { id: 'acc-1', label: 'Main chequing', kind: 'chequing', isPassThrough: false };
const ccAccount: Account      = { id: 'acc-2', label: 'My CC',          kind: 'credit-card', isPassThrough: false };
const passThroughAccount: Account = { id: 'acc-3', label: 'Scotia chequing', kind: 'chequing', isPassThrough: true };

// ─── detectFormat ────────────────────────────────────────────────────────────

describe('detectFormat', () => {
  it('detects CIBC chequing', () => {
    expect(detectFormat('"Date","Transaction Type","Name / Description","$ Amount"')).toBe('cibc-chequing');
  });
  it('detects CIBC CC', () => {
    expect(detectFormat('"Date","Description","Debit","Credit"')).toBe('cibc-cc');
  });
  it('detects Scotiabank chequing', () => {
    expect(detectFormat('"Date","Transaction","Name","Memo","Amount"')).toBe('scotiabank-chequing');
  });
  it('detects Scotiabank CC', () => {
    expect(detectFormat('"Transaction Date","Posting Date","Description 1","Description 2","CAD$","USD$"')).toBe('scotiabank-cc');
  });
  it('falls back to generic', () => {
    expect(detectFormat('"Date","Description","Amount"')).toBe('generic');
  });
});

// ─── normalizeDate ────────────────────────────────────────────────────────────

describe('normalizeDate', () => {
  it('converts YYYY/MM/DD to YYYY-MM-DD', () => {
    expect(normalizeDate('2026/05/01')).toBe('2026-05-01');
  });
  it('converts MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(normalizeDate('05/01/2026')).toBe('2026-05-01');
  });
  it('preserves YYYY-MM-DD', () => {
    expect(normalizeDate('2026-05-01')).toBe('2026-05-01');
  });
});

// ─── splitCols ────────────────────────────────────────────────────────────────

describe('splitCols', () => {
  it('handles commas inside quoted fields', () => {
    expect(splitCols('"Tim Hortons, Toronto",12.50')).toEqual(['Tim Hortons, Toronto', '12.50']);
  });
});

// ─── hashTransaction ─────────────────────────────────────────────────────────

describe('hashTransaction', () => {
  it('returns 16-char hex string', () => {
    const h = hashTransaction('2026-05-01', 'Grocery Store', 45.99, 'acc-1');
    expect(h).toHaveLength(16);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });
  it('is stable for same inputs', () => {
    const a = hashTransaction('2026-05-01', 'Grocery Store', 45.99, 'acc-1');
    const b = hashTransaction('2026-05-01', 'Grocery Store', 45.99, 'acc-1');
    expect(a).toBe(b);
  });
  it('differs for different accounts', () => {
    const a = hashTransaction('2026-05-01', 'Grocery Store', 45.99, 'acc-1');
    const b = hashTransaction('2026-05-01', 'Grocery Store', 45.99, 'acc-2');
    expect(a).not.toBe(b);
  });
  it('is case-insensitive on description', () => {
    const a = hashTransaction('2026-05-01', 'GROCERY STORE', 45.99, 'acc-1');
    const b = hashTransaction('2026-05-01', 'grocery store', 45.99, 'acc-1');
    expect(a).toBe(b);
  });
});

// ─── applyIgnoreRules ────────────────────────────────────────────────────────

describe('applyIgnoreRules', () => {
  it('ignores all transactions from a pass-through account', () => {
    const r = applyIgnoreRules('Tim Hortons', 5.50, passThroughAccount);
    expect(r.status).toBe('ignored');
    expect(r.ignoreReason).toBe('pass-through');
  });
  it('ignores CC payment credit (negative rawAmount on CC)', () => {
    const r = applyIgnoreRules('Payment received - thank you', -500, ccAccount);
    expect(r.status).toBe('ignored');
    expect(r.ignoreReason).toBe('cc-payment');
  });
  it('does NOT ignore positive CC charge', () => {
    const r = applyIgnoreRules('Amazon.ca', 35.99, ccAccount);
    expect(r.status).toBe('pending');
  });
  it('ignores CC payment on chequing by description', () => {
    const r = applyIgnoreRules('VISA PAYMENT', -450, chequingAccount);
    expect(r.status).toBe('ignored');
    expect(r.ignoreReason).toBe('cc-payment');
  });
  it('ignores Interac e-transfer on chequing', () => {
    const r = applyIgnoreRules('INTERAC E-TRANSFER SENT Jane Smith', -200, chequingAccount);
    expect(r.status).toBe('ignored');
    expect(r.ignoreReason).toBe('interac-transfer');
  });
  it('ignores payroll deposit on chequing', () => {
    const r = applyIgnoreRules('PAYROLL DEPOSIT - ACME CORP', -2180, chequingAccount);
    expect(r.status).toBe('ignored');
    expect(r.ignoreReason).toBe('payroll');
  });
  it('keeps a normal chequing debit as pending', () => {
    const r = applyIgnoreRules('TIM HORTONS #1234', 4.75, chequingAccount);
    expect(r.status).toBe('pending');
  });
});

// ─── CIBC chequing parser ────────────────────────────────────────────────────

describe('parseCibcChequing', () => {
  const csv = [
    '"Date","Transaction Type","Name / Description","$ Amount"',
    '"2026/05/01","Debit","TIM HORTONS #1234","4.75"',
    '"2026/05/01","Credit","PAYROLL DEPOSIT","-2180.00"',
    '"2026/05/03","Debit","INTERAC E-TRANSFER SENT Jane","200.00"',
  ].join('\n');

  it('parses all rows', () => {
    const txs = parseCibcChequing(csv, chequingAccount);
    expect(txs.length).toBe(3);
  });
  it('normalizes date', () => {
    const txs = parseCibcChequing(csv, chequingAccount);
    expect(txs[0].date).toBe('2026-05-01');
  });
  it('marks payroll as ignored', () => {
    const txs = parseCibcChequing(csv, chequingAccount);
    const payroll = txs.find(t => t.description.includes('PAYROLL'));
    expect(payroll?.status).toBe('ignored');
  });
  it('marks interac as ignored', () => {
    const txs = parseCibcChequing(csv, chequingAccount);
    const interac = txs.find(t => t.description.includes('INTERAC'));
    expect(interac?.status).toBe('ignored');
  });
  it('keeps regular debit as pending', () => {
    const txs = parseCibcChequing(csv, chequingAccount);
    const spend = txs.find(t => t.description.includes('TIM HORTONS'));
    expect(spend?.status).toBe('pending');
  });
});

// ─── CIBC CC parser ──────────────────────────────────────────────────────────

describe('parseCibcCc', () => {
  const csv = [
    '"Date","Description","Debit","Credit"',
    '"2026/05/02","AMAZON.CA MARKETPLACE","45.99",""',
    '"2026/05/05","PAYMENT - THANK YOU","","500.00"',
  ].join('\n');

  it('parses charge as positive rawAmount', () => {
    const txs = parseCibcCc(csv, ccAccount);
    const amazon = txs.find(t => t.description.includes('AMAZON'));
    expect(amazon?.rawAmount).toBe(45.99);
    expect(amazon?.status).toBe('pending');
  });
  it('parses payment as negative and ignores it', () => {
    const txs = parseCibcCc(csv, ccAccount);
    const payment = txs.find(t => t.description.includes('PAYMENT'));
    expect(payment?.rawAmount).toBe(-500);
    expect(payment?.status).toBe('ignored');
  });
});

// ─── Scotiabank CC parser ─────────────────────────────────────────────────────

describe('parseScotiabankCc', () => {
  const csv = [
    '"Transaction Date","Posting Date","Description 1","Description 2","CAD$","USD$"',
    '"05/10/2026","05/11/2026","NETFLIX","STREAMING","17.99","0.00"',
    '"05/15/2026","05/16/2026","PAYMENT RECEIVED","","-500.00","0.00"',
  ].join('\n');

  it('concatenates description 1 and 2', () => {
    const txs = parseScotiabankCc(csv, ccAccount);
    expect(txs[0].description).toBe('NETFLIX STREAMING');
  });
  it('converts MM/DD/YYYY date', () => {
    const txs = parseScotiabankCc(csv, ccAccount);
    expect(txs[0].date).toBe('2026-05-10');
  });
  it('ignores payment credit', () => {
    const txs = parseScotiabankCc(csv, ccAccount);
    const pmt = txs.find(t => t.rawAmount < 0);
    expect(pmt?.status).toBe('ignored');
  });
});

// ─── Deduplication ───────────────────────────────────────────────────────────

describe('deduplication', () => {
  it('same transaction on different accounts produces different hashes', () => {
    const h1 = hashTransaction('2026-05-01', 'amazon', 45.99, 'acc-1');
    const h2 = hashTransaction('2026-05-01', 'amazon', 45.99, 'acc-2');
    expect(h1).not.toBe(h2);
  });
});
