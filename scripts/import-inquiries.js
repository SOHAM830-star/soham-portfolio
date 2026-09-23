const fs = require('fs');
const path = require('path');
const { getPool, initializeDatabase, closeDatabase } = require('../db/database');

const sourceFile = path.join(__dirname, '..', 'data', 'inquiries.json');

function normalizeRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const email = typeof record.email === 'string' ? record.email.trim() : '';
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  if (!name || !email || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return {
    name: name.slice(0, 120),
    email: email.slice(0, 254),
    phone: typeof record.phone === 'string' ? record.phone.trim().slice(0, 40) || null : null,
    role: typeof record.role === 'string' ? record.role.trim().slice(0, 160) || null : null,
    portfolio: typeof record.portfolio === 'string' ? record.portfolio.trim().slice(0, 500) || null : null,
    budget: typeof record.budget === 'string' ? record.budget.trim().slice(0, 300) || null : null,
    message: message.slice(0, 5000),
    createdAt: record.isoDate || null
  };
}

async function importRecords() {
  if (!fs.existsSync(sourceFile)) {
    console.log('No data/inquiries.json file found. Nothing to import.');
    return;
  }
  const raw = fs.readFileSync(sourceFile, 'utf8').replace(/^\uFEFF/, '').trim();
  const records = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(records)) throw new Error('data/inquiries.json must contain an array.');

  await initializeDatabase();
  let imported = 0;
  let skipped = 0;
  for (const sourceRecord of records) {
    const record = normalizeRecord(sourceRecord);
    if (!record) {
      skipped += 1;
      continue;
    }
    const createdAt = record.createdAt && !Number.isNaN(Date.parse(record.createdAt)) ? new Date(record.createdAt) : null;
    const result = await getPool().query(
      `INSERT INTO inquiries (name, email, phone, role, portfolio, budget, message, created_at)
       SELECT $1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, CURRENT_TIMESTAMP)
       WHERE NOT EXISTS (
         SELECT 1 FROM inquiries WHERE email = $2 AND message = $7 AND ($8::timestamptz IS NULL OR created_at = $8::timestamptz)
       )`,
      [record.name, record.email, record.phone, record.role, record.portfolio, record.budget, record.message, createdAt]
    );
    if (result.rowCount === 1) imported += 1;
    else skipped += 1;
  }
  console.log(`Inquiry import complete: ${imported} imported, ${skipped} skipped.`);
}

importRecords()
  .catch(error => {
    console.error(`[Inquiry import error] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => {});
  });
