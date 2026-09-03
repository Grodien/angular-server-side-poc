import { pool } from './pool.js';

// Matches the existing "company" table schema in driver_advisory_system.
// Uses IF NOT EXISTS so it never overwrites an existing table.
const createTable = `
  CREATE TABLE IF NOT EXISTS company (
    id          INTEGER PRIMARY KEY,
    code        TEXT NOT NULL,
    short_name  TEXT,
    tenant_id   INTEGER
  );
`;

async function migrate() {
  try {
    await pool.query(createTable);
    console.log('Migration completed: "company" table is ready.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
