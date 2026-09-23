require('dotenv').config();

const { initializeDatabase, closeDatabase } = require('../db/database');

initializeDatabase()
  .then(async () => {
    console.log('PostgreSQL schema initialized.');
    await closeDatabase();
  })
  .catch(async error => {
    console.error(`[Database initialization error] ${error.message}`);
    await closeDatabase().catch(() => {});
    process.exitCode = 1;
  });