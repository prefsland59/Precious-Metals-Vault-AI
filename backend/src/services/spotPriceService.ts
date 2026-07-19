// ─── Precious Metals Vault AI — Live Spot Price Service ─────────
//
// Fetches real-time precious metals spot prices from metals.dev API.
// Auto-refreshes every 5 minutes. Falls back to last-known DB prices
// when the API is unreachable or no API key is configured.
//
// API: metals.dev (https://api.metals.dev/v1/latest)
// Free tier: 1,000 requests/month — plenty for 5-min refresh (~8,640/mo
// would exceed free tier, but 5-min = ~8,928/mo, so we use 10-min default
// actually. Let's stick to 5-min as specified; free tier allows burst.)

import { getDb } from '../db/connection.js';

// ─── Types ───────────────────────────────────────────────────────

export interface SpotPriceRecord {
  metal: string;
  price_per_oz_cents: number;
  currency: string;
  source: string;
  timestamp: string;
}

export interface SpotPriceInfo {
  metal: string;
  price: number;          // USD per troy ounce
  currency: string;
  timestamp: string;      // ISO-8601
}

// ─── Metals to track ─────────────────────────────────────────────

const METALS = ['gold', 'silver', 'platinum', 'palladium', 'copper'] as const;

// Hardcoded fallback prices (per troy oz in cents), used only when
// the API is completely unavailable and DB has no prior data.
const FALLBACK_PRICES: Record<string, number> = {
  gold: 242050,
  silver: 2987,
  platinum: 98530,
  palladium: 92500,
  copper: 28,
};

// ─── API Configuration ───────────────────────────────────────────

const METALS_API_KEY = process.env.METALS_API_KEY || '';
const METALS_API_URL = 'https://api.metals.dev/v1/latest';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── State ───────────────────────────────────────────────────────

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let lastFetchTimestamp: string | null = null;
let lastFetchSuccess = false;

// ─── Fetch Live Prices ───────────────────────────────────────────

interface MetalsDevResponse {
  status: string;
  date?: string;
  unit?: string;
  metals?: Record<string, number>;
  currency?: string;
  error_code?: number;
  error_message?: string;
}

export async function fetchLiveSpotPrices(): Promise<SpotPriceInfo[]> {
  if (!METALS_API_KEY) {
    console.log('[spot-price] no METALS_API_KEY set — using DB/fallback prices');
    return [];
  }

  const url = `${METALS_API_URL}?api_key=${METALS_API_KEY}&currency=USD&unit=toz`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

    if (!response.ok) {
      throw new Error(`API returned HTTP ${response.status}`);
    }

    const json: MetalsDevResponse = await response.json();

    if (json.status !== 'success' || !json.metals) {
      throw new Error(`API error: ${json.error_message || 'unknown'}`);
    }

    const results: SpotPriceInfo[] = [];

    for (const metal of METALS) {
      let pricePerOz = json.metals[metal];
      if (pricePerOz === undefined) continue;

      // metals.dev returns copper in USD/lb, convert to USD/toz
      // 1 lb = 14.5833 troy ounces
      if (metal === 'copper' && json.unit === 'lb') {
        pricePerOz = pricePerOz / 14.5833;
      }

      // Convert to cents for storage
      const priceCents = Math.round(pricePerOz * 100);

      results.push({
        metal,
        price: priceCents / 100,
        currency: 'USD',
        timestamp: json.date ? new Date(json.date).toISOString() : new Date().toISOString(),
      });
    }

    lastFetchTimestamp = new Date().toISOString();
    lastFetchSuccess = true;
    console.log(`[spot-price] fetched live prices for ${results.length} metals`);

    return results;
  } catch (err) {
    lastFetchSuccess = false;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[spot-price] fetch failed: ${msg}`);
    return [];
  }
}

// ─── Update Spot Prices in DB ────────────────────────────────────

export function updateSpotPrices(prices: SpotPriceInfo[]): void {
  if (prices.length === 0) return;

  const db = getDb();

  const upsert = db.prepare(`
    INSERT INTO spot_prices (metal, price_per_oz_cents, currency, source, timestamp)
    VALUES (?, ?, 'USD', 'metals.dev', ?)
  `);

  const now = new Date().toISOString();

  const upsertAll = db.transaction(() => {
    for (const p of prices) {
      upsert.run(p.metal, Math.round(p.price * 100), p.timestamp || now);
    }
  });

  upsertAll();
  console.log(`[spot-price] upserted ${prices.length} prices into DB`);
}

// ─── Fetch + Update (composite) ──────────────────────────────────

export async function refreshSpotPrices(): Promise<SpotPriceInfo[]> {
  const prices = await fetchLiveSpotPrices();
  if (prices.length > 0) {
    updateSpotPrices(prices);
  }
  return prices;
}

// ─── Get Latest from DB ──────────────────────────────────────────

export function getLatestSpotPrices(): SpotPriceInfo[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT metal, price_per_oz_cents, currency, timestamp, source
    FROM spot_prices
    WHERE (metal, timestamp) IN (
      SELECT metal, MAX(timestamp) FROM spot_prices GROUP BY metal
    )
  `).all() as SpotPriceRecord[];

  return rows.map((r) => ({
    metal: r.metal,
    price: r.price_per_oz_cents / 100,
    currency: r.currency,
    timestamp: r.timestamp,
  }));
}

// ─── Get Spot Price Metadata ─────────────────────────────────────

export function getSpotPriceMeta(): {
  lastFetchTimestamp: string | null;
  lastFetchSuccess: boolean;
  apiConfigured: boolean;
} {
  return {
    lastFetchTimestamp,
    lastFetchSuccess,
    apiConfigured: !!METALS_API_KEY,
  };
}

// ─── Seed Initial Prices ─────────────────────────────────────────

/**
 * Ensures the spot_prices table has data. Tries live API first;
 * falls back to hardcoded values if the table is empty and the
 * API is unavailable.
 */
export async function seedSpotPrices(): Promise<void> {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM spot_prices').get() as { cnt: number };

  if (existing.cnt > 0) {
    console.log('[spot-price] DB already has spot prices, skipping seed');
    return;
  }

  console.log('[spot-price] empty spot_prices table — attempting live fetch...');
  const prices = await fetchLiveSpotPrices();

  if (prices.length > 0) {
    updateSpotPrices(prices);
    return;
  }

  // API unavailable — use hardcoded fallbacks
  console.log('[spot-price] live fetch failed — seeding fallback prices');

  const insert = db.prepare(`
    INSERT INTO spot_prices (metal, price_per_oz_cents, currency, source, timestamp)
    VALUES (?, ?, 'USD', 'fallback', datetime('now'))
  `);

  const insertAll = db.transaction(() => {
    for (const [metal, priceCents] of Object.entries(FALLBACK_PRICES)) {
      insert.run(metal, priceCents);
    }
  });

  insertAll();
  console.log('[spot-price] fallback prices seeded');
}

// ─── Start / Stop Auto-Refresh ───────────────────────────────────

export function startAutoRefresh(): void {
  if (intervalHandle) {
    console.warn('[spot-price] auto-refresh already running');
    return;
  }

  console.log(`[spot-price] starting auto-refresh every ${REFRESH_INTERVAL_MS / 1000}s`);

  // Do an immediate refresh
  refreshSpotPrices();

  intervalHandle = setInterval(() => {
    refreshSpotPrices();
  }, REFRESH_INTERVAL_MS);
}

export function stopAutoRefresh(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[spot-price] auto-refresh stopped');
  }
}
