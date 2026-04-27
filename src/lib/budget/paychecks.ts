import { addDays, format } from 'date-fns';
import type { Paycheck } from '../types';

function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function generatePaychecks(
  firstPaycheckDate: string,
  netPerPaycheck: number,
  windowMonths: number = 6,
): Paycheck[] {
  const paychecks: Paycheck[] = [];
  const start = parseLocalDate(firstPaycheckDate);
  const end = new Date(start.getFullYear(), start.getMonth() + windowMonths, start.getDate());

  let current = new Date(start);
  let index = 0;

  while (current < end) {
    paychecks.push({
      index,
      date: format(current, 'yyyy-MM-dd'),
      monthKey: format(current, 'yyyy-MM'),
      amount: netPerPaycheck,
    });
    current = addDays(current, 14);
    index++;
  }

  return paychecks;
}
