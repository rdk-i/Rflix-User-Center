const db = require('../config/database');
const logger = require('../utils/logger');

class UserController {
  /**
   * Get current user info
   */
  async getCurrentUser(req, res, next) {
    try {
      const userId = req.user.id;

      const user = db.prepare(`
        SELECT 
          u.id, u.email, u.jellyfinUserId, u.role, u.created_at,
          e.expirationDate, e.packageMonths, e.isActive,
          n.emailEnabled, n.pushEnabled, n.telegramEnabled, n.telegramChatId
        FROM api_users u
        LEFT JOIN user_expiration e ON u.id = e.userId
        LEFT JOIN user_notifications n ON u.id = n.userId
        WHERE u.id = ?
      `).get(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      // Format response
      const response = {
        id: user.id,
        email: user.email,
        username: user.email.split('@')[0],
        role: user.role,
        created_at: user.created_at,
        subscription: user.expirationDate ? {
          expirationDate: user.expirationDate,
          packageMonths: user.packageMonths,
          isActive: Boolean(user.isActive),
          // DEBUG: Add calculated status for validation
          calculatedStatus: new Date(user.expirationDate) < new Date() ? 'expired' : 'active',
          statusMismatch: Boolean(user.isActive) !== (new Date(user.expirationDate) >= new Date())
        } : null,
        notifications: {
          emailEnabled: Boolean(user.emailEnabled),
          pushEnabled: Boolean(user.pushEnabled),
          telegramEnabled: Boolean(user.telegramEnabled),
          telegramChatId: user.telegramChatId,
        },
      };
      
      // DEBUG: Log status mismatches
      if (response.subscription && response.subscription.statusMismatch) {
        logger.warn(`User subscription status mismatch detected`, {
          userId: user.id,
          email: user.email,
          isActive: user.isActive,
          expirationDate: user.expirationDate,
          calculatedStatus: response.subscription.calculatedStatus
        });
      }

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      next(error);
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(req, res, next) {
    try {
      const userId = req.user.id;
      const { emailEnabled, pushEnabled, telegramEnabled, telegramChatId } = req.body;

      const updates = [];
      const params = [];

      if (emailEnabled !== undefined) {
        updates.push('emailEnabled = ?');
        params.push(emailEnabled ? 1 : 0);
      }

      if (pushEnabled !== undefined) {
        updates.push('pushEnabled = ?');
        params.push(pushEnabled ? 1 : 0);
      }

      if (telegramEnabled !== undefined) {
        updates.push('telegramEnabled = ?');
        params.push(telegramEnabled ? 1 : 0);
      }

      if (telegramChatId !== undefined) {
        updates.push('telegramChatId = ?');
        params.push(telegramChatId);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_UPDATES',
            message: 'No updates provided',
          },
        });
      }

      params.push(userId);

      db.prepare(`
        UPDATE user_notifications 
        SET ${updates.join(', ')}
        WHERE userId = ?
      `).run(...params);

      logger.info(`Notification preferences updated for user ${userId}`);

      res.json({
        success: true,
        data: {
          message: 'Notification preferences updated successfully',
        },
      });
    } catch (error) {
      logger.error('Update notification preferences error:', error);
      next(error);
    }
  }

  /**
   * Change password
   */
  async changePassword(req, res, next) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Current and new password are required',
          },
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'New password must be at least 8 characters',
          },
        });
      }

      // Get user
      const user = db.prepare('SELECT * FROM api_users WHERE id = ?').get(userId);
      
      // Verify current password
      const authService = require('../services/authService');
      const isValid = await authService.comparePassword(currentPassword, user.password_hash);
      
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'Current password is incorrect',
          },
        });
      }

      // Hash new password
      const newPasswordHash = await authService.hashPassword(newPassword);

      // Update database
      db.prepare(`
        UPDATE api_users 
        SET password_hash = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(newPasswordHash, userId);

      logger.info(`Password changed for user ${userId}`);

      res.json({
        success: true,
        data: {
          message: 'Password changed successfully',
        },
      });
    } catch (error) {
      logger.error('Change password error:', error);
      next(error);
    }
  }
}

module.exports = new UserController();
