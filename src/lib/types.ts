// ── Core domain types ────────────────────────────────────────────────────────

export type AccountKind = 'chequing' | 'credit-card';

export type Account = {
  id: string;
  label: string;
  kind: AccountKind;
  isPassThrough: boolean; // credit card paid from chequing — skip double-count
};

export type Bucket = {
  id: string;
  name: string;
  amountPerPaycheck: number; // planned spend per 2-week period
  color: string;             // hex, used for progress bar
  sortOrder: number;
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

export type BankFormat =
  | 'cibc-chequing'
  | 'cibc-cc'
  | 'scotiabank-chequing'
  | 'scotiabank-cc'
  | 'generic';

// ── Master state (persisted to SQLite) ───────────────────────────────────────

export type BudgetState = {
  schemaVersion: 4;
  currency: string;
  income: {
    netPerPaycheck: number;
    firstPaycheckDate: string; // ISO date; used to compute all period boundaries
    frequency: 'biweekly';
  };
  accounts: Account[];
  buckets: Bucket[];
};

// ── API response shapes ───────────────────────────────────────────────────────

export type BucketFill = {
  id: string;
  name: string;
  color: string;
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
};

export type ReviewTransaction = Transaction & {
  suggestedBucketId: string | null;
};
