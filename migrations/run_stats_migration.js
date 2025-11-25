const db = require('../server/config/database');
const fs = require('fs');
const path = require('path');
const logger = require('../server/utils/logger');

async function runMigration() {
  try {
    logger.info('Running stats history migration...');
    const migrationPath = path.join(__dirname, 'add_stats_history.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    db.exec(migrationSql);
    logger.info('Stats history migration completed successfully.');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
