// ── Core domain types ────────────────────────────────────────────────────────

export type AccountKind = 'chequing' | 'credit-card';

export type Account = {
  id: string;
  label: string;
  kind: AccountKind;
};

export type FixedExpense = {
  id: string;
  name: string;
  amount: number;
  dueDayOfMonth: number;  // 1–31
  emoji: string | null;
  sortOrder: number;
};

export type Bucket = {
  id: string;
  name: string;
  amountPerPaycheck: number; // planned spend per 2-week period
  color: string;             // hex, used for progress bar
  emoji: string | null;      // optional emoji shown in place of color dot
  sortOrder: number;
  isSpecial?: boolean;       // true for the system Fixed Expenses bucket
};

export type PaycheckPeriod = {
  id: string;         // = startDate (YYYY-MM-DD), PK
  startDate: string;
  endDate: string;    // startDate + 13 days
  paycheckAmount: number;
};

export type TransactionStatus = 'pending' | 'approved' | 'ignored';

export type Transaction = {
  id: string;         // sha256(date|description|rawAmount|accountId) — dedup key
  accountId: string;
  date: string;       // YYYY-MM-DD
  description: string;
  amount: number;     // positive = outflow (spending); negative = credit/refund
  rawAmount: number;  // original CSV value before normalization
  bucketId: string | null;
  periodId: string | null;
  status: TransactionStatus;
  importedAt: string;
};

export type Subtransaction = {
  id: string;
  txId: string;
  description: string;
  amount: number;  // negative = credit back (reimbursement/split); positive = rare extra charge
  date: string;    // YYYY-MM-DD
  createdAt: string;
};

// Transaction as returned by the API — always includes its subtransactions.
// netAmount = amount + SUM(subtransactions[].amount)
export type TransactionWithSubs = Transaction & {
  subtransactions: Subtransaction[];
  netAmount: number;
};

export type MerchantMemory = {
  merchantKey: string; // normalized description
  bucketId: string;
  lastSeen: string;    // ISO date
  count: number;       // times approved to this bucket
};

// ── Ephemeral types (used during import preview, not persisted) ───────────────

export type ParsedTransaction = Omit<Transaction, 'id' | 'importedAt'> & {
  tempId: string;
  duplicate: boolean;
  suggestedBucketId: string | null; // from merchant_memory at preview time
};

// ── Master state (persisted to SQLite) ───────────────────────────────────────

export type BudgetState = {
  schemaVersion: 4;
  currency: string;
  income: {
    netPerPaycheck: number;
    firstPaycheckDate: string; // ISO date; used to compute all period boundaries
    frequency: 'biweekly';
  };
  fixedExpenses: FixedExpense[];
  accounts: Account[];
  buckets: Bucket[];
};

export type CsvMapping = {
  dateCol: number | null;
  descCol: number | null;
  amountCol: number | null;
  flipSign: boolean;
};

// ── API response shapes ───────────────────────────────────────────────────────

export type BucketFill = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  sortOrder: number;
  planned: number;  // amountPerPaycheck
  spent: number;    // SUM of approved transactions in the current period
  pct: number;      // spent / planned, may exceed 1.0 for over-budget display
};

export type DashboardData = {
  period: PaycheckPeriod;
  buckets: BucketFill[];
  pendingCount: number;
  totalSpent: number;
  totalPlanned: number;
  prevPeriodStart: string;
  nextPeriodStart: string;
  currentPeriodStart: string;
};

export type ReviewTransaction = Transaction & {
  suggestedBucketId: string | null;
};
