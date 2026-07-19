// ─── Precious Metals Vault AI — Holdings List Data Hook ─────────

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { Holding, StorageLocation, SpotPrice } from '@pmvault/shared';

export interface HoldingsData {
  holdings: Holding[];
  locations: Map<string, string>; // id -> name
  spotPrices: Record<string, number>; // metal -> price per oz
}

interface HoldingsState {
  data: HoldingsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useHoldingsData(): HoldingsState {
  const [data, setData] = useState<HoldingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const [holdings, locations, spotPricesArr] = await Promise.all([
        api.get<Holding[]>('/api/holdings'),
        api.get<StorageLocation[]>('/api/storage-locations'),
        api.get<SpotPrice[]>('/api/spot'),
      ]);

      // Build location ID -> name map
      const locationMap = new Map<string, string>();
      for (const loc of locations) {
        locationMap.set(loc.id, loc.name);
      }

      // Build metal -> price map
      const spotMap: Record<string, number> = {};
      for (const sp of spotPricesArr) {
        spotMap[sp.metal] = sp.price;
      }

      setData({
        holdings,
        locations: locationMap,
        spotPrices: spotMap,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load holdings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
