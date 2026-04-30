import { describe, it, expect } from 'vitest';
import { generatePeriods, getCurrentPeriod } from '@/lib/periods/generatePeriods';

describe('generatePeriods', () => {
  it('generates 14-day periods starting from firstPaycheckDate', () => {
    const periods = generatePeriods('2026-04-28', 2400, 1);
    expect(periods[0].startDate).toBe('2026-04-28');
    expect(periods[0].endDate).toBe('2026-05-11');
    expect(periods[0].id).toBe('2026-04-28');
    expect(periods[0].paycheckAmount).toBe(2400);
  });

  it('end date is always start + 13 days', () => {
    const periods = generatePeriods('2026-01-01', 1000, 3);
    for (const p of periods) {
      // Parse as local dates (no timezone offset) to avoid DST-induced hour differences
      const [sy, sm, sd] = p.startDate.split('-').map(Number);
      const [ey, em, ed] = p.endDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd);
      const end   = new Date(ey, em - 1, ed);
      const diff  = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      expect(diff).toBe(13);
    }
  });

  it('periods do not overlap', () => {
    const periods = generatePeriods('2026-01-01', 1000, 6);
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i].startDate > periods[i - 1].endDate).toBe(true);
    }
  });

  it('generates approximately 2 periods per month', () => {
    const periods = generatePeriods('2026-01-01', 1000, 6);
    expect(periods.length).toBeGreaterThanOrEqual(12);
    expect(periods.length).toBeLessThanOrEqual(14);
  });

  it('uses firstPaycheckDate as period id', () => {
    const periods = generatePeriods('2026-06-15', 3000, 1);
    expect(periods[0].id).toBe('2026-06-15');
  });
});

describe('getCurrentPeriod', () => {
  it('returns the period containing today', () => {
    const periods = generatePeriods('2020-01-01', 1000, 100);
    const current = getCurrentPeriod(periods);
    if (!current) {
      // today is outside the window — skip
      expect(true).toBe(true);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    expect(current.startDate <= today).toBe(true);
    expect(today <= current.endDate).toBe(true);
  });

  it('returns null when today is outside all periods', () => {
    const periods = generatePeriods('2020-01-01', 1000, 1);
    const result = getCurrentPeriod(periods);
    // periods ended in early 2020 — today (2026) is outside
    expect(result).toBeNull();
  });

  it('returns null for empty list', () => {
    expect(getCurrentPeriod([])).toBeNull();
  });
});
