const emailService = require('./emailService');
const telegramService = require('./telegramService');
const db = require('../config/database');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.notificationTypes = {
      WELCOME: 'welcome',
      EXPIRATION_WARNING: 'expiration_warning',
      SUBSCRIPTION_EXPIRED: 'subscription_expired',
      ADMIN_ALERT: 'admin_alert',
      SYSTEM_ALERT: 'system_alert',
      PASSWORD_RESET: 'password_reset',
      ACCOUNT_DISABLED: 'account_disabled'
    };

    this.warningDays = [30, 14, 7, 3, 1]; // Days before expiration to send warnings
  }

  /**
   * Send welcome notification to new user
   */
  async sendWelcomeNotification(userId, userData = null) {
    try {
      logger.info(`Sending welcome notification for user ${userId}`);
      
      const user = userData || this.getUserWithPreferences(userId);
      if (!user) {
        logger.warn(`User not found for welcome notification: ${userId}`);
        return { success: false, error: 'User not found' };
      }

      const notifications = [];
      const username = user.email.split('@')[0];

      // Email notification
      if (user.emailEnabled) {
        notifications.push(
          emailService.sendWelcomeEmail(user.email, username)
            .then(result => this.logNotification(userId, 'email', this.notificationTypes.WELCOME, result))
        );
      }

      // Telegram notification
      if (user.telegramEnabled && user.telegramChatId) {
        notifications.push(
          telegramService.sendWelcomeMessage(user.telegramChatId, username)
            .then(result => this.logNotification(userId, 'telegram', this.notificationTypes.WELCOME, result))
        );
      }

      // Execute notifications in parallel
      const results = await Promise.allSettled(notifications);
      
      return this.processResults(results, 'Welcome notification');
      
    } catch (error) {
      logger.error(`Welcome notification failed for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send subscription expiration warning
   */
  async sendExpirationWarning(userId, daysRemaining) {
    try {
      logger.info(`Sending expiration warning for user ${userId}, ${daysRemaining} days remaining`);
      
      const user = this.getUserWithPreferences(userId);
      if (!user) {
        logger.warn(`User not found for expiration warning: ${userId}`);
        return { success: false, error: 'User not found' };
      }

      // Check if this warning has already been sent recently
      const recentWarning = this.getRecentNotification(userId, this.notificationTypes.EXPIRATION_WARNING, 24);
      if (recentWarning) {
        logger.info(`Expiration warning already sent recently for user ${userId}`);
        return { success: true, skipped: true, reason: 'Recently sent' };
      }

      const notifications = [];
      const username = user.email.split('@')[0];

      // Email notification
      if (user.emailEnabled) {
        notifications.push(
          emailService.sendExpirationWarning(user.email, username, daysRemaining)
            .then(result => this.logNotification(userId, 'email', this.notificationTypes.EXPIRATION_WARNING, result))
        );
      }

      // Telegram notification
      if (user.telegramEnabled && user.telegramChatId) {
        notifications.push(
          telegramService.sendExpirationWarning(user.telegramChatId, username, daysRemaining)
            .then(result => this.logNotification(userId, 'telegram', this.notificationTypes.EXPIRATION_WARNING, result))
        );
      }

      const results = await Promise.allSettled(notifications);
      
      return this.processResults(results, `Expiration warning (${daysRemaining} days)`);
      
    } catch (error) {
      logger.error(`Expiration warning failed for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send subscription expired notification
   */
  async sendSubscriptionExpiredNotification(userId) {
    try {
      logger.info(`Sending subscription expired notification for user ${userId}`);
      
      const user = this.getUserWithPreferences(userId);
      if (!user) {
        logger.warn(`User not found for expired notification: ${userId}`);
        return { success: false, error: 'User not found' };
      }

      const notifications = [];
      const username = user.email.split('@')[0];

      // Email notification
      if (user.emailEnabled) {
        notifications.push(
          emailService.sendSubscriptionExpired(user.email, username)
            .then(result => this.logNotification(userId, 'email', this.notificationTypes.SUBSCRIPTION_EXPIRED, result))
        );
      }

      // Telegram notification
      if (user.telegramEnabled && user.telegramChatId) {
        notifications.push(
          telegramService.sendSubscriptionExpired(user.telegramChatId, username)
            .then(result => this.logNotification(userId, 'telegram', this.notificationTypes.SUBSCRIPTION_EXPIRED, result))
        );
      }

      const results = await Promise.allSettled(notifications);
      
      return this.processResults(results, 'Subscription expired notification');
      
    } catch (error) {
      logger.error(`Subscription expired notification failed for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send admin notification for new registration
   */
  async sendNewRegistrationAlert(email, packageMonths) {
    try {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      
      if (!adminChatId) {
        logger.warn('Admin chat ID not configured for new registration alerts');
        return { success: false, error: 'Admin chat ID not configured' };
      }

      logger.info(`Sending new registration alert for ${email}`);
      
      const result = await telegramService.sendNewRegistrationAlert(adminChatId, email, packageMonths);
      
      return this.logNotification(null, 'telegram', this.notificationTypes.ADMIN_ALERT, result);
      
    } catch (error) {
      logger.error(`New registration alert failed for ${email}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process all users for expiration warnings
   */
  async processExpirationWarnings() {
    try {
      logger.info('Processing expiration warnings for all users');
      
      const usersWithExpiringSubscriptions = db.prepare(`
        SELECT 
          u.id, u.email, ue.expirationDate, ue.isActive,
          n.emailEnabled, n.telegramEnabled, n.telegramChatId
        FROM api_users u
        JOIN user_expiration ue ON u.id = ue.userId
        JOIN user_notifications n ON u.id = n.userId
        WHERE ue.isActive = 1 
          AND ue.expirationDate > datetime('now')
          AND ue.expirationDate <= datetime('now', '+' || ? || ' days')
        ORDER BY ue.expirationDate ASC
      `).all(Math.max(...this.warningDays));

      let processedCount = 0;
      let successCount = 0;
      
      for (const user of usersWithExpiringSubscriptions) {
        const expirationDate = new Date(user.expirationDate);
        const now = new Date();
        const daysRemaining = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
        
        // Check if we should send warning for this day
        if (this.warningDays.includes(daysRemaining)) {
          processedCount++;
          
          const result = await this.sendExpirationWarning(user.id, daysRemaining);
          if (result.success) {
            successCount++;
          }
          
          // Small delay to avoid overwhelming services
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      logger.info(`Expiration warnings processed: ${successCount}/${processedCount} successful`);
      
      return {
        success: true,
        processed: processedCount,
        successful: successCount
      };
      
    } catch (error) {
      logger.error('Expiration warning processing failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user with notification preferences
   */
  getUserWithPreferences(userId) {
    try {
      return db.prepare(`
        SELECT 
          u.id, u.email,
          n.emailEnabled, n.pushEnabled, n.telegramEnabled, n.telegramChatId
        FROM api_users u
        LEFT JOIN user_notifications n ON u.id = n.userId
        WHERE u.id = ?
      `).get(userId);
    } catch (error) {
      logger.error(`Failed to get user preferences for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Log notification attempt to database
   */
  logNotification(userId, channel, type, result) {
    try {
      db.prepare(`
        INSERT INTO notification_log 
        (userId, channel, type, success, error, response, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        userId,
        channel,
        type,
        result.success ? 1 : 0,
        result.error || null,
        JSON.stringify(result)
      );
      
      return result;
    } catch (error) {
      logger.error(`Failed to log notification for user ${userId}:`, error);
      return result;
    }
  }

  /**
   * Get recent notification to prevent duplicates
   */
  getRecentNotification(userId, type, hours = 24) {
    try {
      return db.prepare(`
        SELECT * FROM notification_log
        WHERE userId = ? 
          AND type = ? 
          AND timestamp > datetime('now', '-' || ? || ' hours')
          AND success = 1
        ORDER BY timestamp DESC
        LIMIT 1
      `).get(userId, type, hours);
    } catch (error) {
      logger.error(`Failed to check recent notification for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Process results from parallel notification attempts
   */
  processResults(results, notificationType) {
    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.length - successful;
    
    const details = results.map((result, index) => ({
      index,
      status: result.status,
      value: result.status === 'fulfilled' ? result.value : null,
      reason: result.status === 'rejected' ? result.reason?.message : null
    }));

    logger.info(`${notificationType} completed: ${successful}/${results.length} successful`);
    
    return {
      success: successful > 0,
      successful,
      failed,
      total: results.length,
      details
    };
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(days = 30) {
    try {
      const stats = db.prepare(`
        SELECT 
          type,
          channel,
          COUNT(*) as total,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
          AVG(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100 as success_rate
        FROM notification_log
        WHERE timestamp > datetime('now', '-' || ? || ' days')
        GROUP BY type, channel
        ORDER BY total DESC
      `).all(days);

      const summary = db.prepare(`
        SELECT 
          COUNT(*) as total_notifications,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as total_successful,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as total_failed,
          AVG(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100 as overall_success_rate
        FROM notification_log
        WHERE timestamp > datetime('now', '-' || ? || ' days')
      `).get(days);

      return {
        success: true,
        data: {
          period: `${days} days`,
          summary,
          byType: stats
        }
      };
    } catch (error) {
      logger.error('Failed to get notification stats:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send usage alert for high usage
   */
  async sendUsageAlert(recipient, alertMessage) {
    try {
      logger.info(`Sending usage alert to ${recipient}`);
      
      // For email
      if (recipient.includes('@')) {
        return await emailService.sendUsageAlertEmail(recipient, alertMessage);
      }
      
      // For Telegram
      return await telegramService.sendUsageAlertMessage(recipient, alertMessage);
      
    } catch (error) {
      logger.error(`Usage alert failed for ${recipient}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send limit warning
   */
  async sendLimitWarning(recipient, limitType, limitValue) {
    try {
      logger.info(`Sending limit warning to ${recipient} for ${limitType}`);
      
      const message = `⚠️ Usage Limit Warning\n\nYou have reached your ${limitType} limit of ${limitValue}.\nPlease consider upgrading your subscription to avoid service interruption.`;
      
      // For email
      if (recipient.includes('@')) {
        return await emailService.sendLimitWarningEmail(recipient, limitType, limitValue, message);
      }
      
      // For Telegram
      return await telegramService.sendLimitWarningMessage(recipient, limitType, limitValue, message);
      
    } catch (error) {
      logger.error(`Limit warning failed for ${recipient}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send over-limit notification
   */
  async sendOverLimitNotification(recipient, limitType, limitValue) {
    try {
      logger.info(`Sending over-limit notification to ${recipient} for ${limitType}`);
      
      const message = `❌ Service Limited\n\nYour account has been restricted because you exceeded your ${limitType} limit of ${limitValue}.\nPlease upgrade your subscription to restore full access.`;
      
      // For email
      if (recipient.includes('@')) {
        return await emailService.sendOverLimitEmail(recipient, limitType, limitValue, message);
      }
      
      // For Telegram
      return await telegramService.sendOverLimitMessage(recipient, limitType, limitValue, message);
      
    } catch (error) {
      logger.error(`Over-limit notification failed for ${recipient}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send upgrade suggestion
   */
  async sendUpgradeSuggestion(recipient, suggestionMessage) {
    try {
      logger.info(`Sending upgrade suggestion to ${recipient}`);
      
      const message = `💡 Upgrade Suggestion\n\n${suggestionMessage}\n\nUpgrade now: /user_dashboard.html`;
      
      // For email
      if (recipient.includes('@')) {
        return await emailService.sendUpgradeSuggestionEmail(recipient, suggestionMessage);
      }
      
      // For Telegram
      return await telegramService.sendUpgradeSuggestionMessage(recipient, suggestionMessage);
      
    } catch (error) {
      logger.error(`Upgrade suggestion failed for ${recipient}:`, error);
      return { success: false, error: error.message };
    }
}
}

module.exports = new NotificationService();