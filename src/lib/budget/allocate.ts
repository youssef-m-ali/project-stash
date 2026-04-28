import { getDaysInMonth, format } from 'date-fns';
import type { Paycheck, PaycheckAllocation, FixedExpense, VariableExpense, Subscription } from '../types';

function subscriptionTotal(subscriptions: Subscription[]): number {
  return subscriptions
    .filter((s) => !s.markedForCancel)
    .reduce((sum, s) => sum + s.monthlyAmount, 0);
}

function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function dueDateForBill(bill: FixedExpense, year: number, month: number): Date {
  const daysInMonth = getDaysInMonth(new Date(year, month));
  const day = Math.min(bill.dueDayOfMonth, daysInMonth);
  return new Date(year, month, day);
}

export function allocatePaychecks(
  paychecks: Paycheck[],
  fixedExpenses: FixedExpense[],
  variableExpenses: VariableExpense[],
  subscriptions: Subscription[],
): PaycheckAllocation[] {
  if (paychecks.length === 0) return [];

  // Group paychecks by monthKey to detect 3-paycheck months
  const byMonth = new Map<string, Paycheck[]>();
  for (const p of paychecks) {
    const arr = byMonth.get(p.monthKey) ?? [];
    arr.push(p);
    byMonth.set(p.monthKey, arr);
  }

  const variableAllowancePerPaycheck =
    variableExpenses.reduce((s, e) => s + e.monthlyBudget, 0) / 2;

  // Build the synthetic subscriptions fixed expense if there are active subs
  const subTotal = subscriptionTotal(subscriptions);
  const allFixed: FixedExpense[] = subTotal > 0
    ? [
        ...fixedExpenses,
        {
          id: '__subscriptions__',
          name: 'Subscriptions',
          amount: subTotal,
          dueDayOfMonth: 1,
          category: 'subscription',
        },
      ]
    : [...fixedExpenses];

  // For each bill, figure out which paycheck it belongs to
  // We'll build a map: paycheckIndex -> bills[]
  const billMap = new Map<number, { name: string; amount: number; dueDate: string }[]>();

  for (const bill of allFixed) {
    // We need to assign this bill for each month it appears in the window
    // Collect all unique months in the window
    const months = Array.from(byMonth.keys()).sort();

    for (const monthKey of months) {
      const [yearStr, monthStr] = monthKey.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr) - 1; // 0-based

      const monthPaychecks = byMonth.get(monthKey)!;
      const isThreePaycheckMonth = monthPaychecks.length === 3;

      // Special housing rule: in a 3-paycheck month, the 3rd paycheck funds *next* month's housing
      if (bill.category === 'housing' && isThreePaycheckMonth) {
        // Assign to the 3rd paycheck of this month (it pre-funds next month)
        const thirdPaycheck = monthPaychecks[2];
        const idx = thirdPaycheck.index;
        const arr = billMap.get(idx) ?? [];
        const nextMonthDt = new Date(year, month + 1, 1);
        const nextDueDate = dueDateForBill(bill, nextMonthDt.getFullYear(), nextMonthDt.getMonth());
        arr.push({ name: bill.name + ' (next month)', amount: bill.amount, dueDate: format(nextDueDate, 'yyyy-MM-dd') });
        billMap.set(idx, arr);

        // The regular housing bill for this month goes to the most recent paycheck before due date.
        // Search all paychecks except the 3rd one (already used for next month) so that a bill
        // due on day 1 can be covered by the last paycheck of the prior month.
        const dueDate = dueDateForBill(bill, year, month);
        const nonThirdPaychecks = paychecks.filter((p) => p.index !== thirdPaycheck.index);
        const candidate = findAssignedPaycheck(nonThirdPaychecks, dueDate, paychecks);
        if (candidate !== null) {
          const arr2 = billMap.get(candidate) ?? [];
          arr2.push({ name: bill.name, amount: bill.amount, dueDate: format(dueDate, 'yyyy-MM-dd') });
          billMap.set(candidate, arr2);
        }
      } else if (bill.category === 'housing') {
        // If the previous month was a 3-paycheck month its 3rd paycheck already
        // funded this month's housing as an advance — don't double-assign.
        const prev = prevMonthKey(monthKey);
        if ((byMonth.get(prev)?.length ?? 0) === 3) continue;

        // Normal month: search all paychecks so a bill due on day 1 can be covered
        // by the last paycheck of the previous month (within the 14-day window).
        const dueDate = dueDateForBill(bill, year, month);
        const candidate = findAssignedPaycheck(paychecks, dueDate, paychecks);
        if (candidate !== null) {
          const arr = billMap.get(candidate) ?? [];
          arr.push({ name: bill.name, amount: bill.amount, dueDate: format(dueDate, 'yyyy-MM-dd') });
          billMap.set(candidate, arr);
        }
      } else {
        // Search all paychecks — bills due early in the month (before the first
        // in-month paycheck) are covered by the last paycheck of the prior month.
        const dueDate = dueDateForBill(bill, year, month);
        const candidate = findAssignedPaycheck(paychecks, dueDate, paychecks);
        if (candidate !== null) {
          const arr = billMap.get(candidate) ?? [];
          arr.push({ name: bill.name, amount: bill.amount, dueDate: format(dueDate, 'yyyy-MM-dd') });
          billMap.set(candidate, arr);
        }
      }
    }
  }

  // Build allocations
  return paychecks.map((p) => {
    const bills = billMap.get(p.index) ?? [];
    const totalBills = bills.reduce((s, b) => s + b.amount, 0);
    const savings = p.amount - totalBills - variableAllowancePerPaycheck;

    const monthPaychecks = byMonth.get(p.monthKey)!;
    const isThird = monthPaychecks.length === 3 && monthPaychecks[2].index === p.index;

    const advanceHousing = bills.some((b) => b.name.endsWith('(next month)'));

    let job: string;
    let notes = '';

    if (isThird && advanceHousing) {
      job = 'Advance rent + extra savings';
      notes = 'Funds next month\'s housing (3rd paycheck of month)';
    } else if (isThird) {
      job = 'EXTRA SAVINGS';
      notes = '3rd paycheck of month — no new bills';
    } else if (bills.length > 0) {
      const monthName = format(parseLocalDate(p.date), 'MMM');
      job = `${monthName} bills`;
    } else {
      job = 'Variable + savings';
    }

    return {
      paycheck: p,
      job,
      billsPaid: bills,
      totalBills,
      variableAllowance: variableAllowancePerPaycheck,
      savings,
      notes,
    };
  });
}

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Returns the index of the paycheck that should fund the given bill due date.
// Rule: most recent paycheck whose date <= dueDate AND within 14 days of dueDate.
// Fallback: last paycheck before the due date.
function findAssignedPaycheck(
  candidates: Paycheck[],
  dueDate: Date,
  _allPaychecks: Paycheck[],
): number | null {
  const sorted = [...candidates].sort((a, b) => a.date.localeCompare(b.date));

  let best: Paycheck | null = null;

  for (const p of sorted) {
    const pDate = parseLocalDate(p.date);
    const diffDays = (dueDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays >= 0 && diffDays < 14) {
      best = p;
    }
  }

  if (best === null) {
    for (const p of sorted) {
      const pDate = parseLocalDate(p.date);
      if (pDate <= dueDate) {
        best = p;
      }
    }
  }

  return best ? best.index : null;
}
