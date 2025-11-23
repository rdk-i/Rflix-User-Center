const authService = require('../services/authService');
const captchaService = require('../services/captchaService');
const jellyfinService = require('../services/jellyfinService');
const db = require('../config/database');
const logger = require('../utils/logger');

class RegistrationController {
  /**
   * Handle user registration
   */
  async register(req, res, next) {
    try {
      const { username, email, password, packageMonths, recaptchaToken } = req.body;

      // Validation
      if (!username || !email || !password || !packageMonths) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Username, email, password, and package are required',
          },
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'Password must be at least 8 characters',
          },
        });
      }

      const months = parseInt(packageMonths);
      if (isNaN(months) || months < 1 || months > 12) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PACKAGE',
            message: 'Package must be between 1 and 12 months',
          },
        });
      }

      // Verify reCAPTCHA
      if (recaptchaToken) {
        const captchaResult = await captchaService.verify('recaptcha', recaptchaToken);
        
        if (!captchaResult.success) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_CAPTCHA',
              message: 'Captcha verification failed',
            },
          });
        }
      }

      // Check if email already exists
      const existingUser = db.prepare('SELECT * FROM api_users WHERE email = ?').get(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'Email already registered',
          },
        });
      }

      // Create user in Jellyfin (as disabled/pending)
      const jellyfinResult = await jellyfinService.createUser(username, password);
      
      if (!jellyfinResult.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'JELLYFIN_ERROR',
            message: 'Failed to create Jellyfin user',
          },
        });
      }

      const jellyfinUserId = jellyfinResult.data.Id;

      // Disable user immediately (pending approval)
      await jellyfinService.disableUser(jellyfinUserId);

      // Hash password
      const passwordHash = await authService.hashPassword(password);

      // Create user in database
      const insertUser = db.prepare(`
        INSERT INTO api_users (email, password_hash, jellyfinUserId, role)
        VALUES (?, ?, ?, 'user')
      `);
      const userResult = insertUser.run(email, passwordHash, jellyfinUserId);
      const userId = userResult.lastInsertRowid;

      // Calculate expiration date
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + months);

      // Create user expiration entry (inactive until approved)
      db.prepare(`
        INSERT INTO user_expiration (userId, jellyfinUserId, expirationDate, packageMonths, isActive)
        VALUES (?, ?, ?, ?, 0)
      `).run(userId, jellyfinUserId, expirationDate.toISOString(), months);

      // Create notification preferences
      db.prepare(`
        INSERT INTO user_notifications (userId, emailEnabled, pushEnabled, telegramEnabled)
        VALUES (?, 0, 0, 0)
      `).run(userId);

      // Log registration
      db.prepare(`
        INSERT INTO audit_log (action, details, timestamp, ip, userAgent)
        VALUES (?, ?, datetime('now'), ?, ?)
      `).run(
        'USER_REGISTERED',
        JSON.stringify({ email, username, packageMonths: months }),
        req.ip,
        req.get('user-agent') || 'unknown'
      );

      logger.info(`New registration: ${email} (pending approval)`);

      res.status(201).json({
        success: true,
        data: {
          message: 'Registration successful! Your account is pending admin approval.',
          userId,
          email,
          packageMonths: months,
        },
      });
    } catch (error) {
      logger.error('Registration error:', error);
      next(error);
    }
  }

  /**
   * Get all pending registrations (admin only)
   */
  async getPendingRegistrations(req, res, next) {
    try {
      const pending = db.prepare(`
        SELECT 
          u.id, u.email, u.jellyfinUserId, u.created_at,
          e.packageMonths, e.expirationDate
        FROM api_users u
        LEFT JOIN user_expiration e ON u.id = e.userId
        WHERE e.isActive = 0
        ORDER BY u.created_at DESC
      `).all();

      res.json({
        success: true,
        data: pending,
      });
    } catch (error) {
      logger.error('Get pending registrations error:', error);
      next(error);
    }
  }

  /**
   * Approve registration (admin only)
   */
  async approveRegistration(req, res, next) {
    try {
      const { userId } = req.params;

      // Get user
      const user = db.prepare('SELECT * FROM api_users WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      // Enable user in Jellyfin
      const jellyfinResult = await jellyfinService.enableUser(user.jellyfinUserId);
      
      if (!jellyfinResult.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'JELLYFIN_ERROR',
            message: 'Failed to enable Jellyfin user',
          },
        });
      }

      // Activate subscription
      db.prepare(`
        UPDATE user_expiration 
        SET isActive = 1, updated_at = datetime('now')
        WHERE userId = ?
      `).run(userId);

      // Log approval
      db.prepare(`
        INSERT INTO audit_log (adminId, action, targetUserId, details, timestamp, ip, userAgent)
        VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
      `).run(
        req.user.id,
        'USER_APPROVED',
        userId,
        JSON.stringify({ email: user.email }),
        req.ip,
        req.get('user-agent') || 'unknown'
      );

      logger.info(`User approved: ${user.email} by admin ${req.user.id}`);

      res.json({
        success: true,
        data: {
          message: 'User approved successfully',
          userId,
        },
      });
    } catch (error) {
      logger.error('Approve registration error:', error);
      next(error);
    }
  }

  /**
   * Reject registration (admin only)
   */
  async rejectRegistration(req, res, next) {
    try {
      const { userId } = req.params;

      // Get user
      const user = db.prepare('SELECT * FROM api_users WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      // Delete user from Jellyfin
      await jellyfinService.deleteUser(user.jellyfinUserId);

      // Delete from database (cascade will handle related records)
      db.prepare('DELETE FROM api_users WHERE id = ?').run(userId);

      // Log rejection
      db.prepare(`
        INSERT INTO audit_log (adminId, action, details, timestamp, ip, userAgent)
        VALUES (?, ?, ?, datetime('now'), ?, ?)
      `).run(
        req.user.id,
        'USER_REJECTED',
        JSON.stringify({ email: user.email }),
        req.ip,
        req.get('user-agent') || 'unknown'
      );

      logger.info(`User rejected: ${user.email} by admin ${req.user.id}`);

      res.json({
        success: true,
        data: {
          message: 'User rejected and deleted',
        },
      });
    } catch (error) {
      logger.error('Reject registration error:', error);
      next(error);
    }
  }
}

module.exports = new RegistrationController();
