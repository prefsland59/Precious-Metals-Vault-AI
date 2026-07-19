-- 001_initial.sql — Precious Metals Vault AI Initial Schema
-- Creates core tables: users, storage_locations, holdings, spot_prices, transactions

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK(subscription_tier IN ('free', 'pro', 'vault')),
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS storage_locations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'home' CHECK(type IN ('home', 'bank_vault', 'private_vault', 'safe', 'other')),
  insurance_coverage INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_location_id TEXT REFERENCES storage_locations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  metal TEXT NOT NULL CHECK(metal IN ('gold', 'silver', 'platinum', 'palladium', 'copper', 'rhodium', 'custom')),
  category TEXT NOT NULL CHECK(category IN ('coin', 'bar', 'round', 'constitutional', 'junk', 'proof', 'commemorative', 'slabbed', 'vintage_bar', 'fractional', 'collectible', 'custom')),
  weight_grams REAL NOT NULL DEFAULT 0,
  purity REAL NOT NULL DEFAULT 1.0 CHECK(purity > 0 AND purity <= 1),
  actual_metal_weight_grams REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchase_price_cents INTEGER DEFAULT 0,
  purchase_date TEXT,
  purchase_currency TEXT DEFAULT 'USD',
  dealer TEXT DEFAULT '',
  taxes_cents INTEGER DEFAULT 0,
  shipping_cents INTEGER DEFAULT 0,
  total_cost_cents INTEGER DEFAULT 0,
  condition TEXT DEFAULT '',
  estimated_grade TEXT DEFAULT '',
  certification_number TEXT DEFAULT '',
  slab_company TEXT DEFAULT '',
  serial_number TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',
  documents TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS spot_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metal TEXT NOT NULL CHECK(metal IN ('gold', 'silver', 'platinum', 'palladium', 'copper', 'rhodium')),
  price_per_oz_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  source TEXT DEFAULT '',
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  holding_id TEXT REFERENCES holdings(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK(type IN ('buy', 'sell', 'transfer')),
  quantity INTEGER NOT NULL DEFAULT 1,
  price_per_unit_cents INTEGER DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_storage_locations_user ON storage_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_location ON holdings(storage_location_id);
CREATE INDEX IF NOT EXISTS idx_holdings_metal ON holdings(metal);
CREATE INDEX IF NOT EXISTS idx_spot_prices_metal_time ON spot_prices(metal, timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_holding ON transactions(holding_id);
