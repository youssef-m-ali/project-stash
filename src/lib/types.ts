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
  billsPaid: { name: string; amount: number }[];
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
