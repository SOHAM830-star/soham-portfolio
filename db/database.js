const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Configure PostgreSQL before starting the server.');
  }
  if (!pool) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false }
  });
}
  return pool;
}

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await getPool().query(schema);
}

async function closeDatabase() {
  if (pool) await pool.end();
}

module.exports = { getPool, initializeDatabase, closeDatabase };
