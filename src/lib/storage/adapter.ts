import type { BudgetState } from '../types';

export type Actuals = Record<string, Record<string, number>>;

export interface StorageAdapter {
  loadState(): Promise<BudgetState | null>;
  saveState(state: BudgetState): Promise<void>;
  loadActuals(): Promise<Actuals>;
  saveActuals(actuals: Actuals): Promise<void>;
  clear(): Promise<void>;
}
