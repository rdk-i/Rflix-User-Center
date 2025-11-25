const logger = require('../utils/logger');
const disableExpiredUsers = require('./disable_expired');
const backupDatabase = require('./backup_db');
const sendExpirationWarnings = require('./send_expiration_warnings');
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

    // Send expiration warnings task
    const expirationWarningInterval = parseInt(process.env.EXPIRATION_WARNING_INTERVAL) || 86400000; // 24 hours
    this.intervals.push({
      name: 'send_expiration_warnings',
      interval: setInterval(() => sendExpirationWarnings(), expirationWarningInterval),
    });
    logger.info(`Scheduled send_expiration_warnings every ${expirationWarningInterval}ms`);

    // Backup database task
    const backupInterval = parseInt(process.env.BACKUP_DB_INTERVAL) || 86400000; // 24 hours
    this.intervals.push({
      name: 'backup_db',
      interval: setInterval(() => backupDatabase(), backupInterval),
    });
    logger.info(`Scheduled backup_db every ${backupInterval}ms`);

    // Record Stats Task (Every 10 minutes)
    const recordStats = require('./record_stats');
    this.intervals.push({
      name: 'record_stats',
      interval: setInterval(() => recordStats(), 10 * 60 * 1000),
    });
    logger.info('Scheduled record_stats every 10 minutes');

    // Clean expired token blacklist (runs at midnight)
    this.intervals.push({
      name: 'clean_token_blacklist',
      interval: setInterval(() => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // CRITICAL DIAGNOSTIC: Log the flawed midnight execution logic
        if (currentHour === 0 && currentMinute === 0) {
          logger.info('CRITICAL_ISSUE_2: Token cleanup executing at midnight', {
            currentTime: now.toISOString(),
            hour: currentHour,
            minute: currentMinute,
            issue: 'Exact minute dependency - can miss execution',
            riskLevel: 'HIGH'
          });
          authService.cleanExpiredBlacklist();
        } else if (currentHour === 0) {
          // Log how many times we check but don't execute in the midnight hour
          logger.debug('CRITICAL_ISSUE_2: Midnight hour but not exact minute', {
            currentMinute: currentMinute,
            willExecute: 'NO - Exact minute dependency',
            risk: 'Can miss cleanup if server down at 00:00'
          });
        }
      }, 60000), // Check every minute
    });
    logger.info('Scheduled clean_token_blacklist daily at midnight - CRITICAL_ISSUE_2: Flawed exact-minute dependency');

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
