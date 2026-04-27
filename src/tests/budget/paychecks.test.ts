import { describe, it, expect } from 'vitest';
import { generatePaychecks } from '@/lib/budget/paychecks';

describe('generatePaychecks', () => {
  it('generates correct count for a 6-month window starting on a Friday', () => {
    // 2026-05-01 is a Friday
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    expect(paychecks.length).toBeGreaterThanOrEqual(13);
    expect(paychecks.length).toBeLessThanOrEqual(14);
  });

  it('generates correct count starting on a Monday', () => {
    const paychecks = generatePaychecks('2026-05-04', 2000, 6);
    expect(paychecks.length).toBeGreaterThanOrEqual(13);
  });

  it('each paycheck is 14 days apart', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    for (let i = 1; i < paychecks.length; i++) {
      const prev = new Date(paychecks[i - 1].date + 'T00:00:00').getTime();
      const curr = new Date(paychecks[i].date + 'T00:00:00').getTime();
      expect((curr - prev) / (1000 * 60 * 60 * 24)).toBe(14);
    }
  });

  it('assigns correct monthKey', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    expect(paychecks[0].monthKey).toBe('2026-05');
  });

  it('amount equals netPerPaycheck', () => {
    const paychecks = generatePaychecks('2026-05-01', 2500, 6);
    for (const p of paychecks) {
      expect(p.amount).toBe(2500);
    }
  });

  it('index is 0-based and sequential', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    paychecks.forEach((p, i) => expect(p.index).toBe(i));
  });

  it('detects months with 3 paychecks — May 2026 has paychecks on May 1, 15, 29', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const mayPaychecks = paychecks.filter((p) => p.monthKey === '2026-05');
    expect(mayPaychecks.length).toBe(3);
  });

  it('does not include a paycheck on the 6-month end boundary', () => {
    const paychecks = generatePaychecks('2026-05-01', 2000, 6);
    const last = paychecks[paychecks.length - 1];
    expect(last.date < '2026-11-01').toBe(true);
  });
});
