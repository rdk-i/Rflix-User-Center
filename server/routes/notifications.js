const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const emailService = require('../services/emailService');
const telegramService = require('../services/telegramService');
const db = require('../config/database');
const auth = require('../middlewares/auth');

/**
 * Get notification system status and health
 */
router.get('/status', async (req, res) => {
  try {
    const emailHealth = emailService.getHealthStatus();
    const telegramHealth = {
      configured: !!process.env.TELEGRAM_BOT_TOKEN,
      botTokenLength: process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.length : 0
    };

    // Check notification preferences count
    const notificationCount = db.prepare('SELECT COUNT(*) as count FROM user_notifications').get();
    const usersWithNotifications = db.prepare('SELECT COUNT(DISTINCT userId) as count FROM user_notifications').get();

    res.json({
      success: true,
      data: {
        emailService: emailHealth,
        telegramService: telegramHealth,
        database: {
          totalNotificationPrefs: notificationCount.count,
          usersWithPrefs: usersWithNotifications.count
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Notification status check failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_FAILED',
        message: 'Failed to check notification system status'
      }
    });
  }
});

/**
 * Test email delivery (admin only)
 */
router.post('/test/email', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    
    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email recipient and subject are required'
        }
      });
    }

    logger.info(`Admin test email requested by ${req.user.email} to ${to}`);

    const result = await emailService.sendEmail(
      to,
      subject || 'Rflix Test Email',
      html || '<p>This is a test email from Rflix notification system.</p>',
      { priority: 'high', maxAttempts: 2 }
    );

    res.json({
      success: true,
      data: {
        message: 'Test email queued for delivery',
        emailId: result.emailId,
        queued: result.queued
      }
    });

  } catch (error) {
    logger.error('Test email failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TEST_EMAIL_FAILED',
        message: 'Failed to send test email'
      }
    });
  }
});

/**
 * Test telegram delivery (admin only)
 */
router.post('/test/telegram', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { chatId, message } = req.body;
    
    if (!chatId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CHAT_ID',
          message: 'Telegram chat ID is required'
        }
      });
    }

    logger.info(`Admin test telegram requested by ${req.user.email} to chat ${chatId}`);

    const result = await telegramService.sendMessage(
      chatId,
      message || '🧪 This is a test message from Rflix notification system.'
    );

    res.json({
      success: true,
      data: {
        message: 'Test telegram sent',
        success: result.success,
        error: result.error
      }
    });

  } catch (error) {
    logger.error('Test telegram failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TEST_TELEGRAM_FAILED',
        message: 'Failed to send test telegram'
      }
    });
  }
});

/**
 * Get user's notification preferences
 */
router.get('/preferences', auth.requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const preferences = db.prepare(`
      SELECT emailEnabled, pushEnabled, telegramEnabled, telegramChatId
      FROM user_notifications
      WHERE userId = ?
    `).get(userId);

    if (!preferences) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PREFERENCES_NOT_FOUND',
          message: 'Notification preferences not found'
        }
      });
    }

    res.json({
      success: true,
      data: preferences
    });

  } catch (error) {
    logger.error('Get notification preferences failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_PREFERENCES_FAILED',
        message: 'Failed to get notification preferences'
      }
    });
  }
});

/**
 * Send manual notification (admin only)
 */
router.post('/send', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { userId, type, subject, message, html } = req.body;
    
    if (!userId || !type || !message) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'User ID, notification type, and message are required'
        }
      });
    }

    // Get user details
    const user = db.prepare(`
      SELECT u.email, u.id, n.emailEnabled, n.telegramEnabled, n.telegramChatId
      FROM api_users u
      LEFT JOIN user_notifications n ON u.id = n.userId
      WHERE u.id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    logger.info(`Manual notification requested by admin ${req.user.email} for user ${user.email} (${type})`);

    const results = {
      email: null,
      telegram: null
    };

    // Send email notification
    if (type === 'email' || type === 'both') {
      if (user.emailEnabled) {
        const emailResult = await emailService.sendEmail(
          user.email,
          subject || 'Rflix Notification',
          html || `<p>${message}</p>`,
          { priority: 'high' }
        );
        results.email = {
          success: emailResult.success,
          queued: emailResult.queued,
          error: emailResult.error
        };
      } else {
        results.email = { success: false, error: 'Email notifications disabled' };
      }
    }

    // Send telegram notification
    if (type === 'telegram' || type === 'both') {
      if (user.telegramEnabled && user.telegramChatId) {
        const telegramResult = await telegramService.sendMessage(
          user.telegramChatId,
          message
        );
        results.telegram = {
          success: telegramResult.success,
          error: telegramResult.error
        };
      } else {
        results.telegram = { success: false, error: 'Telegram notifications disabled or chat ID missing' };
      }
    }

    // Log notification attempt
    db.prepare(`
      INSERT INTO notification_log (userId, type, subject, message, results, timestamp)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(userId, type, subject || 'Manual Notification', message, JSON.stringify(results));

    res.json({
      success: true,
      data: {
        message: 'Notification sent',
        results: results
      }
    });

  } catch (error) {
    logger.error('Manual notification failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFICATION_FAILED',
        message: 'Failed to send notification'
      }
    });
  }
});

// Legacy endpoint for backward compatibility
router.get('/', (req, res) => {
  logger.warn('Legacy notification endpoint accessed');
  res.json({
    success: true,
    data: { message: 'Notification system active - use /status for detailed info' },
  });
});

module.exports = router;
