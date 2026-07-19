import { Database } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.resolve(import.meta.dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'pmvault.db');

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    db = new Database(DB_PATH, { create: true });

    // Enable WAL mode and foreign keys
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');

    console.log(`[pmvault-db] connected to ${DB_PATH}`);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[pmvault-db] connection closed');
  }
}
