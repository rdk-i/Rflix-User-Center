const db = require('../config/database');
const jellyfinService = require('../services/jellyfinService');
const logger = require('../utils/logger');

/**
 * Scheduler task to disable expired users
 */
async function disableExpiredUsers() {
  const startTime = new Date();
  logger.info('Running disable_expired_users task');

  try {
    // Find users with expired subscriptions that are still active
    const expiredUsers = db.prepare(`
      SELECT * FROM user_expiration 
      WHERE expirationDate < datetime('now') AND isActive = 1
    `).all();

    let disabledCount = 0;

    for (const user of expiredUsers) {
      try {
        // Disable user in Jellyfin
        const result = await jellyfinService.disableUser(user.jellyfinUserId);

        if (result.success) {
          // Update database
          db.prepare(`
            UPDATE user_expiration 
            SET isActive = 0, updated_at = datetime('now') 
            WHERE id = ?
          `).run(user.id);

          disabledCount++;
          logger.info(`Disabled expired user: ${user.jellyfinUserId}`);
        }
      } catch (error) {
        logger.error(`Failed to disable user ${user.jellyfinUserId}:`, error);
      }
    }

    const endTime = new Date();
    const duration = endTime - startTime;

    // Log to scheduler_log
    db.prepare(`
      INSERT INTO scheduler_log (taskName, startTime, endTime, duration, status)
      VALUES (?, ?, ?, ?, ?)
    `).run('disable_expired_users', startTime.toISOString(), endTime.toISOString(), duration, 'success');

    logger.info(`Disabled ${disabledCount} expired users in ${duration}ms`);
  } catch (error) {
    const endTime = new Date();
    const duration = endTime - startTime;

    // Log error
    db.prepare(`
      INSERT INTO scheduler_log (taskName, startTime, endTime, duration, status, errorMessage)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'disable_expired_users',
      startTime.toISOString(),
      endTime.toISOString(),
      duration,
      'error',
      error.message
    );

    logger.error('Error in disable_expired_users task:', error);
  }
}

module.exports = disableExpiredUsers;
