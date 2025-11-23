const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/rflix.db');

let db;

try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  logger.info(`Database connected: ${dbPath}`);
} catch (error) {
  logger.error('Failed to connect to database:', error);
  process.exit(1);
}

module.exports = db;
