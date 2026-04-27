import type { BudgetState } from '../types';

const CURRENT_SCHEMA_VERSION = 1;

export function runMigrations(state: BudgetState): BudgetState {
  if (state.schemaVersion === CURRENT_SCHEMA_VERSION) return state;
  // Future migrations: if (state.schemaVersion < 2) { ... }
  return { ...state, schemaVersion: CURRENT_SCHEMA_VERSION };
}
