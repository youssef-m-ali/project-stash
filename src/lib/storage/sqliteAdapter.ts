import type { BudgetState } from '../types';
import type { StorageAdapter, Actuals } from './adapter';
import { runMigrations } from './migrations';

export const storageAdapter: StorageAdapter = {
  async loadState(): Promise<BudgetState | null> {
    try {
      const res = await fetch('/api/budget');
      if (!res.ok) return null;
      const data = await res.json();
      if (!data) return null;
      return runMigrations(data as BudgetState);
    } catch {
      return null;
    }
  },

  async saveState(state: BudgetState): Promise<void> {
    await fetch('/api/budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  },

  async loadActuals(): Promise<Actuals> {
    try {
      const res = await fetch('/api/actuals');
      if (!res.ok) return {};
      return (await res.json()) as Actuals;
    } catch {
      return {};
    }
  },

  async saveActuals(actuals: Actuals): Promise<void> {
    await fetch('/api/actuals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actuals),
    });
  },

  async clear(): Promise<void> {
    await fetch('/api/budget', { method: 'DELETE' });
  },
};
