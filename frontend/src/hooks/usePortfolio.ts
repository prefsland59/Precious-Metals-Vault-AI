// ─── Precious Metals Vault AI — Portfolio Data Hook ─────────────

import { useState, useEffect, useCallback } from 'react';
import { api, type PortfolioSummary } from '../lib/api';

interface PortfolioState {
  data: PortfolioSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePortfolio(refreshIntervalMs = 60_000): PortfolioState {
  const [data, setData] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await api.get<PortfolioSummary>('/api/portfolio/summary');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchData, refreshIntervalMs]);

  return { data, loading, error, refetch: fetchData };
}
