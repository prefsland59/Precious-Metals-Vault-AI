import express from 'express';
import cors from 'cors';
import { initializeSchema } from './db/schema.js';
import { seedDemoData } from './db/seed.js';
import { getDb } from './db/connection.js';
import holdingsRouter from './routes/holdings.js';
import storageLocationsRouter from './routes/storageLocations.js';
import portfolioRouter from './routes/portfolio.js';
import {
  getLatestSpotPrices,
  getSpotPriceMeta,
  refreshSpotPrices,
  seedSpotPrices,
  startAutoRefresh,
} from './services/spotPriceService.js';

const app = express();
const PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);

// Middleware
app.use(cors());
app.use(express.json());

// ─── Initialize Database ─────────────────────────────────────
initializeSchema();
seedDemoData();

// ─── Initialize Spot Prices ──────────────────────────────────
// Seed fallback prices if DB is empty, then start live refresh
seedSpotPrices().then(() => {
  startAutoRefresh();
});

// ─── Health Check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: '0.2.0',
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── Spot Prices ───────────────────────────────────────────────
app.get('/api/spot', (_req, res) => {
  try {
    const prices = getLatestSpotPrices();
    const meta = getSpotPriceMeta();

    res.json({
      success: true,
      data: prices,
      meta: {
        lastFetchTimestamp: meta.lastFetchTimestamp,
        lastFetchSuccess: meta.lastFetchSuccess,
        apiConfigured: meta.apiConfigured,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: msg });
  }
});

// POST /api/spot/refresh — manually trigger a price refresh
app.post('/api/spot/refresh', async (_req, res) => {
  try {
    const prices = await refreshSpotPrices();
    const meta = getSpotPriceMeta();

    res.json({
      success: true,
      data: prices,
      meta: {
        lastFetchTimestamp: meta.lastFetchTimestamp,
        lastFetchSuccess: meta.lastFetchSuccess,
        apiConfigured: meta.apiConfigured,
      },
      message: prices.length > 0
        ? `Refreshed ${prices.length} metal prices`
        : 'No prices fetched — check METALS_API_KEY or API availability',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: msg });
  }
});

// ─── CRUD Routes ───────────────────────────────────────────────
app.use('/api/holdings', holdingsRouter);
app.use('/api/storage-locations', storageLocationsRouter);
app.use('/api/portfolio', portfolioRouter);

// ─── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[pmvault-backend] running on http://localhost:${PORT}`);
});

export default app;
