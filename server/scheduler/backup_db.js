const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Scheduler task to backup database
 */
async function backupDatabase() {
  const startTime = new Date();
  logger.info('Running backup_db task');

  try {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/rflix.db');
    const backupDir = path.join(__dirname, '../../backups');

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `rflix-${timestamp}.db`);

    // Copy database file
    fs.copyFileSync(dbPath, backupPath);

    // Remove old backups (keep last 30 days)
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const retentionDays = 30;
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      const fileAge = now - stats.mtimeMs;

      if (fileAge > retentionMs) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted old backup: ${file}`);
      }
    });

    const endTime = new Date();
    const duration = endTime - startTime;

    // Log success
    db.prepare(`
      INSERT INTO scheduler_log (taskName, startTime, endTime, duration, status)
      VALUES (?, ?, ?, ?, ?)
    `).run('backup_db', startTime.toISOString(), endTime.toISOString(), duration, 'success');

    logger.info(`Database backup completed: ${backupPath}`);
  } catch (error) {
    const endTime = new Date();
    const duration = endTime - startTime;

    // Log error
    db.prepare(`
      INSERT INTO scheduler_log (taskName, startTime, endTime, duration, status, errorMessage)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'backup_db',
      startTime.toISOString(),
      endTime.toISOString(),
      duration,
      'error',
      error.message
    );

    logger.error('Error in backup_db task:', error);
  }
}

module.exports = backupDatabase;
