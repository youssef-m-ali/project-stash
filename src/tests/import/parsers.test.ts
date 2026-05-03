import { describe, it, expect } from 'vitest';
import { normalizeDate, splitCols } from '@/lib/import/parseUtils';
import { hashTransaction } from '@/lib/import/hashTransaction';

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

// ─── Deduplication ───────────────────────────────────────────────────────────

describe('deduplication', () => {
  it('same transaction on different accounts produces different hashes', () => {
    const h1 = hashTransaction('2026-05-01', 'amazon', 45.99, 'acc-1');
    const h2 = hashTransaction('2026-05-01', 'amazon', 45.99, 'acc-2');
    expect(h1).not.toBe(h2);
  });
});
