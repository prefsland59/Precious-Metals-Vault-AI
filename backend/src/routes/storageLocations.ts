import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import type { ApiResponse, StorageLocation, StorageLocationDetail } from '@pmvault/shared';

const router = Router();
const DEMO_USER_ID = 'user-demo-001';

function rowToStorageLocation(row: Record<string, unknown>): StorageLocation {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || undefined,
    type: row.type as StorageLocation['type'],
    insuranceCoverage: (row.insurance_coverage as number) || undefined,
    notes: (row.notes as string) || undefined,
    createdAt: row.created_at as string,
  };
}

// GET /api/storage-locations — list all locations for a user
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || DEMO_USER_ID;
    const db = getDb();

    const rows = db.prepare(`
      SELECT * FROM storage_locations WHERE user_id = ? ORDER BY created_at ASC
    `).all(userId) as Record<string, unknown>[];

    const locations = rows.map(rowToStorageLocation);
    const response: ApiResponse<StorageLocation[]> = { success: true, data: locations };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching locations',
    };
    res.status(500).json(response);
  }
});

// GET /api/storage-locations/:id — get a single location with holdings & value/weight summary
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    // Fetch the location
    const locationRow = db.prepare(
      'SELECT * FROM storage_locations WHERE id = ?'
    ).get(id) as Record<string, unknown> | undefined;

    if (!locationRow) {
      res.status(404).json({ success: false, error: 'Location not found' } as ApiResponse<null>);
      return;
    }

    const location = rowToStorageLocation(locationRow);

    // Fetch holdings at this location
    const holdingRows = db.prepare(`
      SELECT
        h.id, h.name, h.metal, h.weight_grams, h.purity, h.quantity
      FROM holdings h
      WHERE h.storage_location_id = ?
    `).all(id) as Record<string, unknown>[];

    // Fetch spot prices for value calculation
    const spotRows = db.prepare(`
      SELECT metal, price_per_oz_cents
      FROM spot_prices
      WHERE (metal, timestamp) IN (
        SELECT metal, MAX(timestamp) FROM spot_prices GROUP BY metal
      )
    `).all() as Record<string, unknown>[];

    const spotPrices: Record<string, number> = {};
    for (const row of spotRows) {
      spotPrices[row.metal as string] = (row.price_per_oz_cents as number) / 100;
    }

    let totalValueUsd = 0;
    let totalOunces = 0;

    const holdings = holdingRows.map((h) => {
      const weightGrams = h.weight_grams as number;
      const purity = h.purity as number;
      const quantity = h.quantity as number;
      const ounces = (weightGrams / 31.1035) * quantity;
      const metalOunces = ounces * purity;
      const spotPrice = spotPrices[h.metal as string] || 0;
      const valueUsd = Math.round(metalOunces * spotPrice * 100) / 100;

      totalValueUsd += valueUsd;
      totalOunces += ounces;

      return {
        id: h.id as string,
        name: h.name as string,
        metal: h.metal as string,
        weightOunces: Math.round(ounces * 1000) / 1000,
        valueUsd,
      };
    });

    const detail: StorageLocationDetail = {
      ...location,
      holdings,
      totalValueUsd: Math.round(totalValueUsd * 100) / 100,
      totalOunces: Math.round(totalOunces * 100) / 100,
      itemCount: holdingRows.length,
    };

    res.json({ success: true, data: detail } as ApiResponse<StorageLocationDetail>);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching location',
    };
    res.status(500).json(response);
  }
});

// POST /api/storage-locations — create a location
router.post('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const body = req.body;

    const id = body.id || `loc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userId = body.userId || DEMO_USER_ID;

    db.prepare(`
      INSERT INTO storage_locations (id, user_id, name, description, type, insurance_coverage, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      body.name || 'New Location',
      body.description || '',
      body.type || 'other',
      body.insuranceCoverage || 0,
      body.notes || '',
    );

    const row = db.prepare('SELECT * FROM storage_locations WHERE id = ?').get(id) as Record<string, unknown>;
    const response: ApiResponse<StorageLocation> = { success: true, data: rowToStorageLocation(row) };
    res.status(201).json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error creating location',
    };
    res.status(500).json(response);
  }
});

// PUT /api/storage-locations/:id — update a location
router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const body = req.body;

    // Check location exists
    const existing = db.prepare('SELECT id FROM storage_locations WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Location not found' } as ApiResponse<null>);
      return;
    }

    db.prepare(`
      UPDATE storage_locations
      SET name = ?, description = ?, type = ?, insurance_coverage = ?, notes = ?
      WHERE id = ?
    `).run(
      body.name ?? 'Unnamed Location',
      body.description ?? '',
      body.type ?? 'other',
      body.insuranceCoverage ?? 0,
      body.notes ?? '',
      id,
    );

    const row = db.prepare('SELECT * FROM storage_locations WHERE id = ?').get(id) as Record<string, unknown>;
    const response: ApiResponse<StorageLocation> = { success: true, data: rowToStorageLocation(row) };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error updating location',
    };
    res.status(500).json(response);
  }
});

// DELETE /api/storage-locations/:id — delete a location (only if no holdings reference it)
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    // Check location exists
    const existing = db.prepare('SELECT id FROM storage_locations WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Location not found' } as ApiResponse<null>);
      return;
    }

    // Check for holdings at this location
    const holdings = db.prepare(
      'SELECT id, name FROM holdings WHERE storage_location_id = ?'
    ).all(id) as Record<string, unknown>[];

    if (holdings.length > 0) {
      const holdingNames = holdings.map((h) => h.name as string);
      res.status(409).json({
        success: false,
        error: `Cannot delete location with ${holdings.length} holding(s)`,
        data: { holdingNames },
      } as ApiResponse<{ holdingNames: string[] }>);
      return;
    }

    db.prepare('DELETE FROM storage_locations WHERE id = ?').run(id);
    res.json({ success: true, data: { deleted: true } } as ApiResponse<{ deleted: boolean }>);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error deleting location',
    };
    res.status(500).json(response);
  }
});

export default router;
