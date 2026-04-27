import type { BudgetState } from '../types';

export type Actuals = Record<string, Record<string, number>>;

export interface StorageAdapter {
  loadState(): BudgetState | null;
  saveState(state: BudgetState): void;
  loadActuals(): Actuals;
  saveActuals(actuals: Actuals): void;
  clear(): void;
}
