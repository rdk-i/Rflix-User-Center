const db = require('../config/database');
const jellyfinService = require('../services/jellyfinService');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * Scheduler task to disable expired users with enhanced error handling
 */
async function disableExpiredUsers() {
  const startTime = new Date();
  logger.info('Running disable_expired_users task', {
    timestamp: startTime.toISOString(),
    jellyfinHealth: jellyfinService.getHealthStatus()
  });

  try {
    // Pre-check Jellyfin health before processing
    const jellyfinHealth = await jellyfinService.performHealthCheck();
    if (!jellyfinHealth.healthy) {
      logger.warn('Jellyfin service unhealthy, skipping user disable operations', {
        error: jellyfinHealth.error,
        healthStatus: jellyfinService.getHealthStatus()
      });
      
      // Still update local database to mark users as expired locally
      await disableUsersLocally();
      return;
    }

    // Find users with expired subscriptions that are still active
    const expiredUsers = db.prepare(`
      SELECT ue.*, u.email, u.jellyfinUserId
      FROM user_expiration ue
      JOIN api_users u ON ue.userId = u.id
      WHERE ue.expirationDate < datetime('now') AND ue.isActive = 1
      ORDER BY ue.expirationDate ASC
    `).all();
    
    // DEBUG: Log status inconsistency detection
    const allUsers = db.prepare(`
      SELECT ue.userId, ue.expirationDate, ue.isActive, u.email,
             CASE
               WHEN ue.expirationDate < datetime('now') AND ue.isActive = 1 THEN 'EXPIRED_BUT_ACTIVE'
               WHEN ue.expirationDate >= datetime('now') AND ue.isActive = 0 THEN 'ACTIVE_BUT_DISABLED'
               ELSE 'CONSISTENT'
             END as status_check
      FROM user_expiration ue
      JOIN api_users u ON ue.userId = u.id
    `).all();
    
    const inconsistencies = allUsers.filter(u => u.status_check !== 'CONSISTENT');
    if (inconsistencies.length > 0) {
      logger.warn(`Subscription status inconsistencies detected: ${inconsistencies.length} users`, {
        inconsistencies: inconsistencies.map(u => ({
          userId: u.userId,
          email: u.email,
          expirationDate: u.expirationDate,
          isActive: u.isActive,
          status: u.status_check
        }))
      });
    }

    logger.info(`Found ${expiredUsers.length} expired users to process`);

    let disabledCount = 0;
    let failedCount = 0;
    const failedUsers = [];

    // Process users in batches to avoid overwhelming Jellyfin
    const batchSize = 5;
    for (let i = 0; i < expiredUsers.length; i += batchSize) {
      const batch = expiredUsers.slice(i, i + batchSize);
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(expiredUsers.length / batchSize)}`);

      const batchResults = await Promise.allSettled(
        batch.map(user => processExpiredUser(user))
      );

      batchResults.forEach((result, index) => {
        const user = batch[index];
        if (result.status === 'fulfilled' && result.value.success) {
          disabledCount++;
        } else {
          failedCount++;
          failedUsers.push({
            userId: user.userId,
            jellyfinUserId: user.jellyfinUserId,
            email: user.email,
            error: result.reason?.message || result.value?.error || 'Unknown error'
          });
        }
      });

      // Small delay between batches to be gentle on Jellyfin
      if (i + batchSize < expiredUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const endTime = new Date();
    const duration = endTime - startTime;

    // Log summary
    logger.info(`disable_expired_users task completed`, {
      totalUsers: expiredUsers.length,
      disabledCount,
      failedCount,
      duration: `${duration}ms`,
      successRate: `${((disabledCount / expiredUsers.length) * 100).toFixed(2)}%`
    });

    // Log failed users for investigation
    if (failedUsers.length > 0) {
      logger.warn(`${failedUsers.length} users failed to disable`, {
        failedUsers: failedUsers.map(u => ({ userId: u.userId, email: u.email, error: u.error }))
      });
    }

    // Log to scheduler_log
    db.prepare(`
      INSERT INTO scheduler_log (taskName, startTime, endTime, duration, status, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'disable_expired_users',
      startTime.toISOString(),
      endTime.toISOString(),
      duration,
      failedCount > 0 ? 'partial_success' : 'success',
      JSON.stringify({
        totalUsers: expiredUsers.length,
        disabledCount,
        failedCount,
        failedUsers: failedUsers.slice(0, 5) // Store first 5 failures for debugging
      })
    );

  } catch (error) {
    const endTime = new Date();
    const duration = endTime - startTime;

    logger.error('Critical error in disable_expired_users task:', {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    // Log error to scheduler_log
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
  }
}

/**
 * Process individual expired user with enhanced error handling
 */
async function processExpiredUser(user) {
  const userStartTime = Date.now();
  
  try {
    logger.debug(`Processing expired user: ${user.email} (${user.jellyfinUserId})`);

    // Disable user in Jellyfin with retry logic
    const jellyfinResult = await jellyfinService.disableUser(user.jellyfinUserId);
    
    if (!jellyfinResult.success) {
      logger.warn(`Failed to disable Jellyfin user: ${user.jellyfinUserId}`, {
        error: jellyfinResult.error,
        userEmail: user.email
      });
      
      // Still update local database to prevent repeated attempts
      updateUserLocally(user.userId, 'jellyfin_failed');
      
      return {
        success: false,
        error: jellyfinResult.error || 'Jellyfin disable failed',
        userId: user.userId
      };
    }

    // Update database
    const updateResult = db.prepare(`
      UPDATE user_expiration
      SET isActive = 0, updated_at = datetime('now')
      WHERE id = ?
    `).run(user.id);

    if (updateResult.changes === 0) {
      logger.warn(`No database changes for user: ${user.userId}`);
    }

    const duration = Date.now() - userStartTime;
    logger.info(`Successfully disabled expired user: ${user.email} in ${duration}ms`);

    // Send notification email if enabled
    await sendExpirationNotification(user);

    return { success: true, userId: user.userId };

  } catch (error) {
    const duration = Date.now() - userStartTime;
    
    logger.error(`Failed to process expired user ${user.email}:`, {
      error: error.message,
      userId: user.userId,
      jellyfinUserId: user.jellyfinUserId,
      duration: `${duration}ms`
    });

    return {
      success: false,
      error: error.message,
      userId: user.userId
    };
  }
}

/**
 * Update user status locally when Jellyfin is unavailable
 */
function updateUserLocally(userId, reason = 'jellyfin_unavailable') {
  try {
    const result = db.prepare(`
      UPDATE user_expiration
      SET isActive = 0, updated_at = datetime('now'), disable_reason = ?
      WHERE userId = ?
    `).run(reason, userId);

    logger.info(`Updated user locally: ${userId} (${reason})`, {
      changes: result.changes
    });

    return result.changes > 0;
  } catch (error) {
    logger.error(`Failed to update user locally: ${userId}`, { error: error.message });
    return false;
  }
}

/**
 * Disable users locally when external service is unavailable
 */
async function disableUsersLocally() {
  try {
    const expiredUsers = db.prepare(`
      SELECT ue.*, u.email
      FROM user_expiration ue
      JOIN api_users u ON ue.userId = u.id
      WHERE ue.expirationDate < datetime('now') AND ue.isActive = 1
    `).all();

    let updatedCount = 0;
    
    for (const user of expiredUsers) {
      if (updateUserLocally(user.userId, 'jellyfin_unavailable')) {
        updatedCount++;
      }
    }

    logger.info(`Updated ${updatedCount} users locally due to Jellyfin unavailability`);
    return updatedCount;
  } catch (error) {
    logger.error('Failed to disable users locally:', error);
    return 0;
  }
}

/**
 * Send expiration notification to user
 */
async function sendExpirationNotification(user) {
  try {
    // Check if user has email notifications enabled
    const notificationPrefs = db.prepare(`
      SELECT emailEnabled FROM user_notifications
      WHERE userId = ?
    `).get(user.userId);

    if (!notificationPrefs?.emailEnabled) {
      logger.debug(`Email notifications disabled for user: ${user.email}`);
      return;
    }

    // Send expiration email
    const result = await emailService.sendEmail(
      user.email,
      'Rflix Subscription Expired',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #D63031;">Subscription Expired</h2>
        <p>Hello,</p>
        <p>Your Rflix subscription has expired and your account has been disabled.</p>
        <p>To regain access, please renew your subscription.</p>
        <p>Login: ${process.env.APP_URL || 'http://localhost:3000'}/user_login.html</p>
        <p>Thank you!</p>
        <p style="color: #888; font-size: 12px;">This is an automated message. Please do not reply.</p>
      </div>
      `,
      { priority: 'high' }
    );

    if (result.success) {
      logger.info(`Expiration notification sent to: ${user.email}`);
    } else {
      logger.warn(`Failed to send expiration notification to: ${user.email}`, {
        error: result.error
      });
    }
  } catch (error) {
    logger.error(`Failed to send expiration notification: ${user.email}`, {
      error: error.message
    });
  }
}

module.exports = disableExpiredUsers;
