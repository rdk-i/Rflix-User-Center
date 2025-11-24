const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Scheduler task to backup database
 */
async function backupDatabase() {
  const startTime = new Date();
  logger.info('Running backup_db task', {
    timestamp: startTime.toISOString(),
    dbPath: process.env.DB_PATH || 'default',
    diagnostic: 'CRITICAL_ISSUE_1_BACKUP_CORRUPTION_RISK'
  });

  try {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/rflix.db');
    const backupDir = path.join(__dirname, '../../backups');

    // CRITICAL DIAGNOSTIC: Check database write activity
    const dbStats = fs.statSync(dbPath);
    const lastModified = dbStats.mtime;
    const fileSize = dbStats.size;
    
    logger.warn('CRITICAL_ISSUE_1: Database backup without transaction isolation', {
      lastModified: lastModified.toISOString(),
      fileSize: `${(fileSize / (1024 * 1024)).toFixed(2)} MB`,
      timeSinceLastWrite: `${Date.now() - lastModified.getTime()}ms`,
      riskLevel: 'HIGH',
      issue: 'File-level copy during active writes can corrupt backup'
    });

    logger.debug('Backup paths configured', {
      dbPath,
      backupDir
    });

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      logger.debug('Creating backup directory');
      fs.mkdirSync(backupDir, { recursive: true });
      logger.info('Backup directory created');
    }

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `rflix-${timestamp}.db`);

    logger.debug('Backup filename generated', {
      timestamp,
      backupPath
    });

    // Verify database file exists
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database file not found: ${dbPath}`);
    }

    // Copy database file
    logger.debug('Starting database file copy');
    
    // DIAGNOSTIC: Check if database is in WAL mode and has active writes
    try {
      const walPath = dbPath + '-wal';
      const journalPath = dbPath + '-journal';
      
      const hasWal = fs.existsSync(walPath);
      const hasJournal = fs.existsSync(journalPath);
      const walSize = hasWal ? fs.statSync(walPath).size : 0;
      
      if (hasWal && walSize > 0) {
        logger.error('CRITICAL_ISSUE_1_ACTIVE_WAL_DETECTED', {
          walSize: `${(walSize / 1024).toFixed(2)} KB`,
          risk: 'HIGH - Database has active WAL, backup may be inconsistent',
          recommendation: 'Use SQLite backup API or checkpoint before backup'
        });
      }
    } catch (walError) {
      logger.debug('WAL check error (non-critical):', walError.message);
    }
    
    fs.copyFileSync(dbPath, backupPath);
    logger.info('Database file copied successfully', {
      source: dbPath,
      destination: backupPath,
      warning: 'CRITICAL: Backup created without transaction isolation'
    });

    // Get backup file size
    const backupStats = fs.statSync(backupPath);
    const backupSizeMB = (backupStats.size / (1024 * 1024)).toFixed(2);

    logger.info(`Backup file created: ${backupPath} (${backupSizeMB} MB)`);

    // Remove old backups (keep last 30 days)
    logger.debug('Starting cleanup of old backups');
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const retentionDays = 30;
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

    let deletedCount = 0;
    files.forEach(file => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      const fileAge = now - stats.mtimeMs;

      if (fileAge > retentionMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
        logger.info(`Deleted old backup: ${file} (age: ${Math.floor(fileAge / (24 * 60 * 60 * 1000))} days)`);
      }
    });

    logger.info(`Cleanup completed: ${deletedCount} old backups deleted`);

    const endTime = new Date();
    const duration = endTime - startTime;

    // Log success
    db.prepare(`
      INSERT INTO scheduler_log (taskName, startTime, endTime, duration, status)
      VALUES (?, ?, ?, ?, ?)
    `).run('backup_db', startTime.toISOString(), endTime.toISOString(), duration, 'success');

    logger.info(`Database backup completed successfully`, {
      backupPath,
      backupSizeMB,
      duration: `${duration}ms`,
      deletedOldBackups: deletedCount
    });
  } catch (error) {
    const endTime = new Date();
    const duration = endTime - startTime;

    logger.error('Error in backup_db task:', {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

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

    logger.error('Database backup failed', {
      error: error.message,
      duration: `${duration}ms`
    });
  }
}

module.exports = backupDatabase;
