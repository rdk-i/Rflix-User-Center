const logger = require('../utils/logger');
const disableExpiredUsers = require('./disable_expired');
const backupDatabase = require('./backup_db');
const authService = require('../services/authService');

class Scheduler {
  constructor() {
    this.intervals = [];
    this.isRunning = false;
  }

  /**
   * Start all scheduled tasks
   */
  start() {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting scheduler...');

    // Disable expired users task
    const disableExpiredInterval = parseInt(process.env.DISABLE_EXPIRED_INTERVAL) || 3600000; // 1 hour
    this.intervals.push({
      name: 'disable_expired_users',
      interval: setInterval(() => disableExpiredUsers(), disableExpiredInterval),
    });
    logger.info(`Scheduled disable_expired_users every ${disableExpiredInterval}ms`);

    // Backup database task
    const backupInterval = parseInt(process.env.BACKUP_DB_INTERVAL) || 86400000; // 24 hours
    this.intervals.push({
      name: 'backup_db',
      interval: setInterval(() => backupDatabase(), backupInterval),
    });
    logger.info(`Scheduled backup_db every ${backupInterval}ms`);

    // Clean expired token blacklist (runs at midnight)
    this.intervals.push({
      name: 'clean_token_blacklist',
      interval: setInterval(() => {
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() === 0) {
          authService.cleanExpiredBlacklist();
        }
      }, 60000), // Check every minute
    });
    logger.info('Scheduled clean_token_blacklist daily at midnight');

    this.isRunning = true;
    logger.info('Scheduler started successfully');
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Scheduler is not running');
      return;
    }

    logger.info('Stopping scheduler...');

    this.intervals.forEach(({ name, interval }) => {
      clearInterval(interval);
      logger.info(`Stopped ${name}`);
    });

    this.intervals = [];
    this.isRunning = false;
    logger.info('Scheduler stopped successfully');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      tasks: this.intervals.map(i => i.name),
    };
  }
}

module.exports = new Scheduler();
