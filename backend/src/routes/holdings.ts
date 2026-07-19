import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import type { ApiResponse, Holding } from '@pmvault/shared';

const router = Router();

const DEMO_USER_ID = 'user-demo-001';

function toCamelCase(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camel] = value;
  }
  return result;
}

function rowToHolding(row: Record<string, unknown>): Holding {
  const r = toCamelCase(row) as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    metal: r.metal as Holding['metal'],
    category: r.category as Holding['category'],
    weight: (r.weightGrams as number) / 31.1035, // grams to troy oz
    weightUnit: 'oz',
    purity: r.purity as number,
    quantity: r.quantity as number,
    purchasePrice: (r.purchasePriceCents as number) / 100,
    purchaseDate: (r.purchaseDate as string) || '',
    purchaseCurrency: (r.purchaseCurrency as string) || 'USD',
    storageLocation: r.storageLocationId as string || '',
    notes: (r.notes as string) || undefined,
    grade: (r.estimatedGrade as string) || undefined,
    images: typeof r.images === 'string' ? JSON.parse(r.images as string) : (r.images || []),
    createdAt: r.createdAt as string,
    updatedAt: r.updatedAt as string,
  };
}

// GET /api/holdings — list all holdings for a user
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEMO_USER_ID;
    const db = getDb();

    const rows = db.prepare(`
      SELECT * FROM holdings WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId) as Record<string, unknown>[];

    const holdings = rows.map(rowToHolding);

    const response: ApiResponse<Holding[]> = { success: true, data: holdings };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching holdings',
    };
    res.status(500).json(response);
  }
});

// GET /api/holdings/:id — single holding
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM holdings WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;

    if (!row) {
      const response: ApiResponse<null> = { success: false, error: 'Holding not found' };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Holding> = { success: true, data: rowToHolding(row) };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching holding',
    };
    res.status(500).json(response);
  }
});

// POST /api/holdings — create a holding
router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const body = req.body;

    const id = body.id || `holding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userId = body.userId || DEMO_USER_ID;
    const weightGrams = body.weightGrams || (body.weight && body.weightUnit === 'oz' ? body.weight * 31.1035 : body.weight || 0);
    const purity = body.purity ?? 1.0;
    const actualMetalWeightGrams = weightGrams * purity;

    db.prepare(`
      INSERT INTO holdings (
        id, user_id, storage_location_id, name, metal, category,
        weight_grams, purity, actual_metal_weight_grams, quantity,
        purchase_price_cents, purchase_date, purchase_currency, dealer,
        taxes_cents, shipping_cents, total_cost_cents,
        condition, estimated_grade, certification_number, slab_company,
        serial_number, notes, images, documents
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      body.storageLocationId || body.storageLocation || null,
      body.name || 'Untitled Holding',
      body.metal || 'silver',
      body.category || 'custom',
      weightGrams,
      purity,
      actualMetalWeightGrams,
      body.quantity || 1,
      Math.round((body.purchasePrice || 0) * 100),
      body.purchaseDate || new Date().toISOString().slice(0, 10),
      body.purchaseCurrency || 'USD',
      body.dealer || '',
      body.taxesCents || 0,
      body.shippingCents || 0,
      body.totalCostCents || Math.round((body.purchasePrice || 0) * 100 * (body.quantity || 1)),
      body.condition || '',
      body.estimatedGrade || body.grade || '',
      body.certificationNumber || '',
      body.slabCompany || '',
      body.serialNumber || '',
      body.notes || '',
      JSON.stringify(body.images || []),
      JSON.stringify(body.documents || []),
    );

    const row = db.prepare('SELECT * FROM holdings WHERE id = ?').get(id) as Record<string, unknown>;
    const response: ApiResponse<Holding> = { success: true, data: rowToHolding(row) };
    res.status(201).json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error creating holding',
    };
    res.status(500).json(response);
  }
});

export default router;
