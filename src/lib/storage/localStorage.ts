import type { BudgetState } from '../types';
import type { StorageAdapter, Actuals } from './adapter';
import { runMigrations } from './migrations';

const STATE_KEY = 'project-stash:v1';
const ACTUALS_KEY = 'project-stash:v1:actuals';

// Kept only for the one-time migration from localStorage → SQLite.
export const localStorageAdapter: StorageAdapter = {
  async loadState(): Promise<BudgetState | null> {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return null;
      return runMigrations(JSON.parse(raw) as BudgetState);
    } catch {
      return null;
    }
  },

  async saveState(state: BudgetState): Promise<void> {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  },

  async loadActuals(): Promise<Actuals> {
    try {
      const raw = localStorage.getItem(ACTUALS_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Actuals;
    } catch {
      return {};
    }
  },

  async saveActuals(actuals: Actuals): Promise<void> {
    localStorage.setItem(ACTUALS_KEY, JSON.stringify(actuals));
  },

  async clear(): Promise<void> {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(ACTUALS_KEY);
  },
};

export const LS_STATE_KEY = STATE_KEY;
export const LS_ACTUALS_KEY = ACTUALS_KEY;
