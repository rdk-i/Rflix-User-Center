const db = require('../config/database');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Scheduler task to send subscription expiration warnings
 * This runs daily to check for users whose subscriptions are expiring soon
 */
async function sendExpirationWarnings() {
  const startTime = new Date();
  logger.info('Running send_expiration_warnings task', {
    timestamp: startTime.toISOString()
  });

  try {
    // Check if notifications are enabled globally
    const notificationEnabled = db.prepare("SELECT value FROM system_config WHERE key = 'notification_enabled'").get();
    if (notificationEnabled && notificationEnabled.value === 'false') {
      logger.info('Notifications globally disabled, skipping expiration warnings');
      return;
    }

    // Get users with expiring subscriptions
    const warningDays = [30, 14, 7, 3, 1]; // Days before expiration to send warnings
    const maxDays = Math.max(...warningDays);
    
    const expiringUsers = db.prepare(`
      SELECT 
        u.id, u.email, ue.expirationDate, ue.packageMonths, ue.isActive,
        n.emailEnabled, n.telegramEnabled, n.telegramChatId,
        ue.last_warning_sent, ue.warning_sent_days,
        datetime('now') as current_time
      FROM api_users u
      JOIN user_expiration ue ON u.id = ue.userId
      JOIN user_notifications n ON u.id = n.userId
      WHERE ue.isActive = 1 
        AND ue.expirationDate > datetime('now')
        AND ue.expirationDate <= datetime('now', '+' || ? || ' days')
        AND (n.emailEnabled = 1 OR n.telegramEnabled = 1)
      ORDER BY ue.expirationDate ASC
    `).all(maxDays);

    logger.info(`Found ${expiringUsers.length} users with expiring subscriptions`);

    let processedCount = 0;
    let successCount = 0;
    let skippedCount = 0;
    const failedUsers = [];

    // Process users in batches to avoid overwhelming services
    const batchSize = parseInt(process.env.NOTIFICATION_BATCH_SIZE || '10');
    
    for (let i = 0; i < expiringUsers.length; i += batchSize) {
      const batch = expiringUsers.slice(i, i + batchSize);
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(expiringUsers.length / batchSize)}`);

      const batchResults = await Promise.allSettled(
        batch.map(user => processUserWarning(user, warningDays))
      );

      batchResults.forEach((result, index) => {
        const user = batch[index];
        if (result.status === 'fulfilled') {
          processedCount++;
          if (result.value.success) {
            if (result.value.skipped) {
              skippedCount++;
            } else {
              successCount++;
            }
          } else {
            failedUsers.push({
              userId: user.id,
              email: user.email,
              error: result.value.error || 'Unknown error'
            });
          }
        } else {
          processedCount++;
          failedUsers.push({
            userId: user.id,
            email: user.email,
            error: result.reason?.message || 'Processing error'
          });
        }
      });

      // Small delay between batches to be gentle on external services
      if (i + batchSize < expiringUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const endTime = new Date();
    const duration = endTime - startTime;

    // Log summary
    logger.info(`send_expiration_warnings task completed`, {
      processedCount,
      successCount,
      skippedCount,
      failedCount: failedUsers.length,
      duration: `${duration}ms`,
      successRate: `${((successCount / processedCount) * 100).toFixed(2)}%`
    });

    // Log failed users for investigation
    if (failedUsers.length > 0) {
      logger.warn(`${failedUsers.length} users failed to receive expiration warnings`, {
        failedUsers: failedUsers.slice(0, 5) // Store first 5 failures for debugging
      });
    }

    // Log to scheduler_log
    db.prepare(`
      INSERT INTO scheduler_log (taskName, startTime, endTime, duration, status, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'send_expiration_warnings',
      startTime.toISOString(),
      endTime.toISOString(),
      duration,
      failedUsers.length > 0 ? 'partial_success' : 'success',
      JSON.stringify({
        processedCount,
        successCount,
        skippedCount,
        failedCount: failedUsers.length,
        failedUsers: failedUsers.slice(0, 5)
      })
    );

  } catch (error) {
    const endTime = new Date();
    const duration = endTime - startTime;

    logger.error('Critical error in send_expiration_warnings task:', {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    // Log error to scheduler_log
    db.prepare(`
      INSERT INTO scheduler_log (taskName, startTime, endTime, duration, status, errorMessage)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'send_expiration_warnings',
      startTime.toISOString(),
      endTime.toISOString(),
      duration,
      'error',
      error.message
    );
  }
}

/**
 * Process individual user expiration warning
 */
async function processUserWarning(user, warningDays) {
  const userStartTime = Date.now();
  
  try {
    logger.debug(`Processing expiration warning for user: ${user.email}`);
    
    const expirationDate = new Date(user.expirationDate);
    const now = new Date();
    const daysRemaining = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
    
    // Check if we should send warning for this day
    if (!warningDays.includes(daysRemaining)) {
      return { success: true, skipped: true, reason: 'Not a warning day' };
    }

    // Check if this warning was recently sent (within 24 hours)
    const recentWarning = db.prepare(`
      SELECT * FROM notification_log
      WHERE userId = ? 
        AND type = 'expiration_warning'
        AND timestamp > datetime('now', '-24 hours')
        AND success = 1
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(user.id);

    if (recentWarning) {
      logger.debug(`Skipping expiration warning for ${user.email} - recently sent`);
      return { success: true, skipped: true, reason: 'Recently sent' };
    }

    // Check quiet hours if configured
    const quietHoursCheck = checkQuietHours(user);
    if (!quietHoursCheck.allow) {
      logger.debug(`Skipping notification for ${user.email} - quiet hours (${quietHoursCheck.reason})`);
      
      // Schedule for later
      scheduleNotificationForLater(user.id, 'expiration_warning', daysRemaining, quietHoursCheck.nextAllowed);
      
      return { success: true, skipped: true, reason: 'Quiet hours', scheduled: true };
    }

    // Send the warning notification
    const result = await notificationService.sendExpirationWarning(user.id, daysRemaining);
    
    const duration = Date.now() - userStartTime;
    
    if (result.success) {
      logger.info(`Successfully sent expiration warning to: ${user.email} (${daysRemaining} days) in ${duration}ms`);
      
      // Update last warning sent timestamp
      db.prepare(`
        UPDATE user_expiration
        SET last_warning_sent = datetime('now'), warning_sent_days = ?
        WHERE userId = ?
      `).run(daysRemaining, user.id);
      
      return { success: true, daysRemaining, duration };
    } else {
      logger.warn(`Failed to send expiration warning to: ${user.email}`, {
        error: result.error,
        daysRemaining
      });
      
      return { success: false, error: result.error, daysRemaining };
    }

  } catch (error) {
    const duration = Date.now() - userStartTime;
    
    logger.error(`Failed to process expiration warning for ${user.email}:`, {
      error: error.message,
      userId: user.id,
      duration: `${duration}ms`
    });

    return { success: false, error: error.message };
  }
}

/**
 * Check if current time is within quiet hours
 */
function checkQuietHours(user) {
  try {
    if (!user.quiet_hours_start || !user.quiet_hours_end) {
      return { allow: true, reason: 'No quiet hours configured' };
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const startTime = parseTime(user.quiet_hours_start);
    const endTime = parseTime(user.quiet_hours_end);
    
    let inQuietHours = false;
    
    if (startTime <= endTime) {
      // Same day quiet hours (e.g., 22:00-08:00)
      inQuietHours = currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight quiet hours (e.g., 22:00-06:00)
      inQuietHours = currentTime >= startTime || currentTime <= endTime;
    }
    
    if (inQuietHours) {
      // Calculate next allowed time
      let nextAllowed = new Date(now);
      if (startTime <= endTime && currentTime <= endTime) {
        // Current time is before end of quiet hours
        nextAllowed.setHours(Math.floor(endTime / 60), endTime % 60, 0, 0);
      } else {
        // Quiet hours end tomorrow
        nextAllowed.setDate(nextAllowed.getDate() + 1);
        nextAllowed.setHours(Math.floor(endTime / 60), endTime % 60, 0, 0);
      }
      
      return {
        allow: false,
        reason: 'Quiet hours',
        nextAllowed: nextAllowed.toISOString()
      };
    }
    
    return { allow: true, reason: 'Outside quiet hours' };
    
  } catch (error) {
    logger.error('Error checking quiet hours:', error);
    return { allow: true, reason: 'Error in quiet hours check' };
  }
}

/**
 * Parse time string (HH:MM) to minutes
 */
function parseTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Schedule notification for later delivery
 */
function scheduleNotificationForLater(userId, type, daysRemaining, scheduledFor) {
  try {
    const notificationData = {
      userId,
      type,
      daysRemaining,
      scheduledFor
    };
    
    db.prepare(`
      INSERT INTO notification_schedule (userId, notification_type, scheduled_for, data, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(userId, type, scheduledFor, JSON.stringify(notificationData));
    
    logger.info(`Scheduled expiration warning for user ${userId} at ${scheduledFor}`);
    
  } catch (error) {
    logger.error(`Failed to schedule notification for later:`, error);
  }
}

/**
 * Process scheduled notifications that are due
 */
async function processScheduledNotifications() {
  try {
    const dueNotifications = db.prepare(`
      SELECT * FROM notification_schedule
      WHERE scheduled_for <= datetime('now')
        AND status = 'pending'
      ORDER BY scheduled_for ASC
      LIMIT 50
    `).all();

    if (dueNotifications.length === 0) {
      return;
    }

    logger.info(`Processing ${dueNotifications.length} scheduled notifications`);

    for (const notification of dueNotifications) {
      try {
        const data = JSON.parse(notification.data);
        
        // Send the notification
        const result = await notificationService.sendExpirationWarning(
          notification.userId,
          data.daysRemaining
        );

        // Update schedule status
        db.prepare(`
          UPDATE notification_schedule
          SET status = ?, sent_at = datetime('now')
          WHERE id = ?
        `).run(result.success ? 'sent' : 'failed', notification.id);

      } catch (error) {
        logger.error(`Failed to process scheduled notification ${notification.id}:`, error);
        
        db.prepare(`
          UPDATE notification_schedule
          SET status = 'failed', error = ?
          WHERE id = ?
        `).run(error.message, notification.id);
      }
    }
    
  } catch (error) {
    logger.error('Failed to process scheduled notifications:', error);
  }
}

module.exports = sendExpirationWarnings;