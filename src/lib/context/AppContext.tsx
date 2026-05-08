import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getConfig } from '@/lib/db/queries/config';
import type { BudgetState } from '@/lib/types';

interface AppContextValue {
  config: BudgetState | null;
  isSetup: boolean;
  isLoading: boolean;
  reloadConfig: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<BudgetState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  async function loadConfig() {
    try {
      const data = await getConfig();
      setConfig(data);
    } catch {
      setConfig(null);
    }
  }

  useEffect(() => {
    loadConfig().finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reloadConfig() {
    await loadConfig();
  }

  const isSetup = config !== null;

  useEffect(() => {
    if (!isLoading && !isSetup) {
      navigate('/setup');
    }
  }, [isLoading, isSetup, navigate]);

  return (
    <AppContext.Provider value={{ config, isSetup, isLoading, reloadConfig }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}
