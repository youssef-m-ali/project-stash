import { addDays, format } from 'date-fns';
import type { PaycheckPeriod } from '@/lib/types';

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function generatePeriods(
  firstPaycheckDate: string,
  netPerPaycheck: number,
  windowMonths = 24,
): PaycheckPeriod[] {
  const periods: PaycheckPeriod[] = [];
  const start = parseLocalDate(firstPaycheckDate);
  const end = new Date(start.getFullYear(), start.getMonth() + windowMonths, start.getDate());

  let cur = new Date(start);
  while (cur < end) {
    const startDate = format(cur, 'yyyy-MM-dd');
    const endDate = format(addDays(cur, 13), 'yyyy-MM-dd');
    periods.push({ id: startDate, startDate, endDate, paycheckAmount: netPerPaycheck });
    cur = addDays(cur, 14);
  }
  return periods;
}

export function getCurrentPeriod(periods: PaycheckPeriod[]): PaycheckPeriod | null {
  const today = format(new Date(), 'yyyy-MM-dd');
  return periods.find(p => p.startDate <= today && today <= p.endDate) ?? null;
}
