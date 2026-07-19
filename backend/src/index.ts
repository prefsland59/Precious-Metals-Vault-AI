import express from 'express';
import cors from 'cors';
import { initializeSchema } from './db/schema.js';
import { seedDemoData } from './db/seed.js';
import { getDb } from './db/connection.js';
import holdingsRouter from './routes/holdings.js';
import storageLocationsRouter from './routes/storageLocations.js';
import portfolioRouter from './routes/portfolio.js';

const app = express();
const PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);

// Middleware
app.use(cors());
app.use(express.json());

// ─── Initialize Database ─────────────────────────────────────
initializeSchema();
seedDemoData();

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
    const db = getDb();
    const rows = db.prepare(`
      SELECT metal, price_per_oz_cents, currency, timestamp
      FROM spot_prices
      WHERE (metal, timestamp) IN (
        SELECT metal, MAX(timestamp) FROM spot_prices GROUP BY metal
      )
    `).all() as Record<string, unknown>[];

    const data = rows.map((r) => ({
      metal: r.metal,
      price: (r.price_per_oz_cents as number) / 100,
      currency: r.currency,
      timestamp: r.timestamp,
    }));

    res.json({ success: true, data });
  } catch {
    // Fallback to static prices if DB fails
    res.json({
      success: true,
      data: [
        { metal: 'gold', price: 2420.50, currency: 'USD', timestamp: new Date().toISOString() },
        { metal: 'silver', price: 29.87, currency: 'USD', timestamp: new Date().toISOString() },
        { metal: 'platinum', price: 985.30, currency: 'USD', timestamp: new Date().toISOString() },
        { metal: 'palladium', price: 925.00, currency: 'USD', timestamp: new Date().toISOString() },
      ],
    });
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
