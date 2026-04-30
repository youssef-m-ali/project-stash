import type { Account, TransactionStatus } from '@/lib/types';

interface IgnoreResult {
  status: TransactionStatus;
  ignoreReason: string | null; // internal only — not stored on ParsedTransaction
}

const INTERAC_RE = /interac|e-transfer|etransfer/i;
const CC_PAYMENT_RE = /credit card payment|visa payment|mastercard payment|online payment/i;
const PAYROLL_RE = /payroll|direct dep|direct deposit|cra |employment insurance/i;

export function applyIgnoreRules(
  description: string,
  rawAmount: number,
  account: Account,
): IgnoreResult {
  // Rule 1: pass-through account — ignore everything
  if (account.isPassThrough) {
    return { status: 'ignored', ignoreReason: 'pass-through' };
  }

  // Rule 2: CC payment credit (negative rawAmount on a CC = payment/refund received)
  if (account.kind === 'credit-card' && rawAmount < 0) {
    return { status: 'ignored', ignoreReason: 'cc-payment' };
  }

  // Rule 3: CC payment description on chequing
  if (account.kind === 'chequing' && CC_PAYMENT_RE.test(description)) {
    return { status: 'ignored', ignoreReason: 'cc-payment' };
  }

  // Rule 4: Interac e-transfer (any account)
  if (INTERAC_RE.test(description)) {
    return { status: 'ignored', ignoreReason: 'interac-transfer' };
  }

  // Rule 5: Payroll / income on chequing (negative = credit to account = money in)
  if (account.kind === 'chequing' && rawAmount < 0 && PAYROLL_RE.test(description)) {
    return { status: 'ignored', ignoreReason: 'payroll' };
  }

  return { status: 'pending', ignoreReason: null };
}
