import { getDb } from './connection.js';

const DEMO_USER_ID = 'user-demo-001';
const LOCATION_HOME_ID = 'loc-home-safe-001';
const LOCATION_BANK_ID = 'loc-bank-box-001';

export function seedDemoData(): void {
  const db = getDb();

  // Check if demo user already exists
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(DEMO_USER_ID);
  if (existing) {
    console.log('[pmvault-db] demo data already seeded, skipping');
    return;
  }

  // Reusable prepared statement with ALL columns
  const insertHolding = db.prepare(`
    INSERT INTO holdings (
      id, user_id, storage_location_id, name, metal, category,
      weight_grams, purity, actual_metal_weight_grams, quantity,
      purchase_price_cents, purchase_date, purchase_currency, dealer,
      taxes_cents, shipping_cents, total_cost_cents,
      condition, estimated_grade, certification_number, slab_company,
      serial_number, notes, images, documents
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6,
      ?7, ?8, ?9, ?10,
      ?11, ?12, ?13, ?14,
      ?15, ?16, ?17,
      ?18, ?19, ?20, ?21,
      ?22, ?23, ?24, ?25
    )
  `);

  db.transaction(() => {
    // ─── Demo User ──
    db.prepare(`
      INSERT INTO users (id, email, name, subscription_tier, settings)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      DEMO_USER_ID,
      'demo@pmvault.ai',
      'Alex Stackwell',
      'free',
      JSON.stringify({ theme: 'dark', currency: 'USD', weightUnit: 'oz' }),
    );

    // ─── Storage Locations ──
    db.prepare(`
      INSERT INTO storage_locations (id, user_id, name, description, type, insurance_coverage, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      LOCATION_HOME_ID,
      DEMO_USER_ID,
      'Home Safe',
      'Master bedroom walk-in closet safe',
      'safe',
      500000,
      'Combination safe, fireproof rated 1hr',
    );

    db.prepare(`
      INSERT INTO storage_locations (id, user_id, name, description, type, insurance_coverage, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      LOCATION_BANK_ID,
      DEMO_USER_ID,
      'Bank Box',
      'First National Bank safety deposit box #342',
      'bank_vault',
      1000000,
      'Requires two keys to access',
    );

    // ─── Holdings ──
    // 1. Gold American Eagle 1oz coin
    insertHolding.run(
      'holding-001', DEMO_USER_ID, LOCATION_HOME_ID,
      '2024 American Gold Eagle 1oz', 'gold', 'coin',
      31.1035, 0.9167, 28.523, 2,         // weight, purity, metalWeight, qty
      210000, '2024-03-15', 'USD', 'APMEX', // price, date, currency, dealer
      0, 0, 420000,                         // taxes, shipping, total
      'BU', 'MS-69', '', '',               // condition, grade, cert, slab
      '', 'Purchased during dip, great condition', // serial, notes
      JSON.stringify(['https://example.com/images/eagle-obv.jpg', 'https://example.com/images/eagle-rev.jpg']),
      '[]',
    );

    // 2. Silver bars (10oz each)
    insertHolding.run(
      'holding-002', DEMO_USER_ID, LOCATION_HOME_ID,
      'SilverTowne 10oz Stacker Bar', 'silver', 'bar',
      311.035, 0.999, 310.725, 5,
      29000, '2024-06-01', 'USD', 'SD Bullion',
      0, 1500, 146500,
      'New', '', '', '',
      '', 'Stacker design, fits perfectly in safe',
      JSON.stringify(['https://example.com/images/silver-bar.jpg']),
      '[]',
    );

    // 3. Platinum Eagle
    insertHolding.run(
      'holding-003', DEMO_USER_ID, LOCATION_BANK_ID,
      '2023 Platinum American Eagle 1oz', 'platinum', 'coin',
      31.1035, 0.9995, 31.088, 1,
      105000, '2024-01-20', 'USD', 'JM Bullion',
      0, 0, 105000,
      'BU', 'MS-70', '', '',
      '', 'Bank storage for high-value items',
      JSON.stringify(['https://example.com/images/plat-eagle.jpg']),
      '[]',
    );

    // 4. Palladium Maple Leaf
    insertHolding.run(
      'holding-004', DEMO_USER_ID, LOCATION_BANK_ID,
      '2023 Palladium Maple Leaf 1oz', 'palladium', 'coin',
      31.1035, 0.9995, 31.088, 1,
      95000, '2024-04-10', 'USD', 'Kitco',
      0, 0, 95000,
      'BU', '', '', '',
      '', 'Rare pickup, palladium market is thin',
      JSON.stringify(['https://example.com/images/pd-maple.jpg']),
      '[]',
    );

    // 5. Copper round
    insertHolding.run(
      'holding-005', DEMO_USER_ID, LOCATION_HOME_ID,
      '1oz Copper Round - Walking Liberty', 'copper', 'round',
      28.3495, 0.999, 28.321, 10,
      250, '2024-07-01', 'USD', 'Golden State Mint',
      0, 0, 2500,
      'New', '', '', '',
      '', 'Fun additions to the stack, great for gifts',
      JSON.stringify(['https://example.com/images/cu-round.jpg']),
      '[]',
    );

    // ─── Transactions ──
    const holdings = [
      { id: 'holding-001', qty: 2, ppu: 210000, total: 420000, date: '2024-03-15', notes: 'Initial gold purchase' },
      { id: 'holding-002', qty: 5, ppu: 29000, total: 146500, date: '2024-06-01', notes: 'Stacking silver bars' },
      { id: 'holding-003', qty: 1, ppu: 105000, total: 105000, date: '2024-01-20', notes: 'Diversifying into platinum' },
      { id: 'holding-004', qty: 1, ppu: 95000, total: 95000, date: '2024-04-10', notes: 'Palladium addition' },
      { id: 'holding-005', qty: 10, ppu: 250, total: 2500, date: '2024-07-01', notes: 'Copper for fun' },
    ];

    const insertTx = db.prepare(`
      INSERT INTO transactions (id, user_id, holding_id, type, quantity, price_per_unit_cents, total_cents, date, notes)
      VALUES (?, ?, ?, 'buy', ?, ?, ?, ?, ?)
    `);

    for (const h of holdings) {
      insertTx.run(`tx-${h.id}`, DEMO_USER_ID, h.id, h.qty, h.ppu, h.total, h.date, h.notes);
    }
  })();

  console.log('[pmvault-db] demo data seeded successfully');
}
