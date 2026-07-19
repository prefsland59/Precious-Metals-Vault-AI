import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import type { ApiResponse, StorageLocation } from '@pmvault/shared';

const router = Router();
const DEMO_USER_ID = 'user-demo-001';

function rowToStorageLocation(row: Record<string, unknown>): StorageLocation {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || undefined,
    type: row.type as StorageLocation['type'],
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

export default router;
