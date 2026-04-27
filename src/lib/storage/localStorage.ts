import type { BudgetState } from '../types';
import type { StorageAdapter, Actuals } from './adapter';
import { runMigrations } from './migrations';

const STATE_KEY = 'project-stash:v1';
const ACTUALS_KEY = 'project-stash:v1:actuals';

export const localStorageAdapter: StorageAdapter = {
  loadState(): BudgetState | null {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as BudgetState;
      return runMigrations(parsed);
    } catch {
      return null;
    }
  },

  saveState(state: BudgetState): void {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  },

  loadActuals(): Actuals {
    try {
      const raw = localStorage.getItem(ACTUALS_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Actuals;
    } catch {
      return {};
    }
  },

  saveActuals(actuals: Actuals): void {
    localStorage.setItem(ACTUALS_KEY, JSON.stringify(actuals));
  },

  clear(): void {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(ACTUALS_KEY);
  },
};
