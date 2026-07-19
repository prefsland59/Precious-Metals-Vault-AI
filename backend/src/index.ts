import express from 'express';
import cors from 'cors';

const app = express();
const PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);

// Middleware
app.use(cors());
app.use(express.json());

// ─── Health Check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── Placeholder Routes ────────────────────────────────────────
app.get('/api/holdings', (_req, res) => {
  res.json({ success: true, data: [] });
});

app.get('/api/spot', (_req, res) => {
  res.json({
    success: true,
    data: [
      { metal: 'gold', price: 2420.50, currency: 'USD', timestamp: new Date().toISOString() },
      { metal: 'silver', price: 29.87, currency: 'USD', timestamp: new Date().toISOString() },
      { metal: 'platinum', price: 985.30, currency: 'USD', timestamp: new Date().toISOString() },
      { metal: 'palladium', price: 925.00, currency: 'USD', timestamp: new Date().toISOString() },
    ],
  });
});

// ─── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[pmvault-backend] running on http://localhost:${PORT}`);
});

export default app;
