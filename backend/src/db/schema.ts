import fs from 'fs';
import path from 'path';
import { getDb } from './connection.js';

export function initializeSchema(): void {
  const db = getDb();

  // Run the initial migration
  const migrationPath = path.resolve(import.meta.dirname, 'migrations', '001_initial.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  // bun:sqlite exec handles multiple statements separated by semicolons
  db.exec(sql);

  console.log('[pmvault-db] schema initialized');
}
