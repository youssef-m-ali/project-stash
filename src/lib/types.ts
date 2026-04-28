export type Frequency = 'biweekly';

export type Income = {
  netPerPaycheck: number;
  frequency: Frequency;
  firstPaycheckDate: string;
  payDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

export type FixedExpense = {
  id: string;
  name: string;
  amount: number;
  dueDayOfMonth: number;
  category: 'housing' | 'utilities' | 'transport' | 'insurance' | 'subscription' | 'other';
};

export type VariableExpense = {
  id: string;
  name: string;
  monthlyBudget: number;
  isCap: boolean;
};

export type Subscription = {
  id: string;
  name: string;
  monthlyAmount: number;
  usedRecently: boolean;
  markedForCancel: boolean;
};

export type SavingsBucket = {
  id: string;
  name: string;
  percentageOfSavings: number;
  notes?: string;
};

export type SavingsGoal = {
  targetRate: number;
  buckets: SavingsBucket[];
};

export type AccountKind = 'chequing' | 'credit-card';

export type Account = {
  id: string;
  label: string;
  kind: AccountKind;
  isPassThrough: boolean;
};

export type BudgetState = {
  schemaVersion: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  income: Income;
  fixedExpenses: FixedExpense[];
  variableExpenses: VariableExpense[];
  subscriptions: Subscription[];
  savingsGoal: SavingsGoal;
  accounts: Account[];
};

export type Transaction = {
  id: string;               // sha256(date|description|rawAmount|accountId).slice(0,16)
  accountId: string;        // FK → Account.id
  date: string;             // YYYY-MM-DD
  monthKey: string;         // YYYY-MM
  description: string;
  amount: number;           // normalized: spending = positive, refund/credit = negative
  rawAmount: number;        // original signed value from CSV
  categoryId: string | null;
  status: 'active' | 'ignored';
  ignoreReason: string | null;
  importedAt: string;
};

export type CategoryRule = {
  id: string;
  pattern: string;          // case-insensitive substring match on description
  categoryId: string;
  priority: number;         // lower = higher priority; first match wins
  createdAt: string;
};

// Ephemeral — import preview only, never persisted
export type ParsedTransaction = Omit<Transaction, 'id' | 'importedAt'> & {
  tempId: string;
  duplicate: boolean;
  userOverrideCategory: string | null;
};

export type Paycheck = {
  index: number;
  date: string;
  monthKey: string;
  amount: number;
};

export type PaycheckAllocation = {
  paycheck: Paycheck;
  job: string;
  billsPaid: { name: string; amount: number; dueDate: string }[];
  totalBills: number;
  variableAllowance: number;
  savings: number;
  notes: string;
};

export type MonthlySummary = {
  monthKey: string;
  paycheckCount: number;
  netIncome: number;
  fixedSpending: number;
  variableSpending: number;
  totalSpending: number;
  budgetedSavings: number;
  savingsRate: number;
  hitsGoal: boolean;
};

export type ValidationResult = {
  valid: boolean;
  errors: { field: string; message: string }[];
};
