import type { BudgetState } from '../types';

const CURRENT_SCHEMA_VERSION = 2;

export function runMigrations(state: BudgetState): BudgetState {
  let s = { ...state };

  if (s.schemaVersion < 2) {
    // v1 → v2: add accounts array
    s = { ...s, accounts: (s as BudgetState & { accounts?: BudgetState['accounts'] }).accounts ?? [] };
  }

  return { ...s, schemaVersion: CURRENT_SCHEMA_VERSION };
}
