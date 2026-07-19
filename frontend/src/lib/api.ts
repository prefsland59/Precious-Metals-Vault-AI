// ─── Precious Metals Vault AI — API Client ──────────────────────

const BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error ?? 'Unknown API error');
  }

  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ─── Types ───────────────────────────────────────────────────────

export interface MetalBreakdown {
  valueUsd: number;
  ounces: number;
  holdings: number;
  pctOfPortfolio: number;
}

export interface CategoryBreakdown {
  valueUsd: number;
  count: number;
}

export interface LocationBreakdown {
  valueUsd: number;
  count: number;
}

// ─── Storage Location Detail (from GET /api/storage-locations/:id) ─
export interface HoldingSummaryItem {
  id: string;
  name: string;
  metal: string;
  weightOunces: number;
  valueUsd: number;
}

export interface StorageLocationDetail {
  id: string;
  name: string;
  description?: string;
  type: 'home' | 'bank_vault' | 'private_vault' | 'safe' | 'other';
  insuranceCoverage?: number;
  notes?: string;
  createdAt: string;
  holdings: HoldingSummaryItem[];
  totalValueUsd: number;
  totalOunces: number;
  itemCount: number;
}

export interface PortfolioSummary {
  totalValueUsd: number;
  costBasisUsd: number;
  profitLossUsd: number;
  profitLossPercent: number;
  totalHoldings: number;
  totalOunces: number;
  breakdown: {
    byMetal: Record<string, MetalBreakdown>;
    byCategory: Record<string, CategoryBreakdown>;
    byLocation: Record<string, LocationBreakdown>;
  };
  spotPrices: Record<string, number>;
}
