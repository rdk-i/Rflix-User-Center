const jellyfinService = require('../services/jellyfinService');
const authService = require('../services/authService');
const db = require('../config/database');
const logger = require('../utils/logger');

class AdminController {
  /**
   * Get all users
   */
  async getAllUsers(req, res, next) {
    try {
      const users = db.prepare(`
        SELECT 
          u.id, u.email, u.jellyfinUserId, u.role, u.created_at,
          e.expirationDate, e.packageMonths, e.isActive
        FROM api_users u
        LEFT JOIN user_expiration e ON u.id = e.userId
        WHERE u.role != 'admin'
        ORDER BY u.created_at DESC
      `).all();

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      logger.error('Get all users error:', error);
      next(error);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(req, res, next) {
    try {
      const { userId } = req.params;

      const user = db.prepare(`
        SELECT 
          u.*, 
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

      // Remove password hash from response
      delete user.password_hash;

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Get user by ID error:', error);
      next(error);
    }
  }

  /**
   * Create user manually (admin)
   */
  async createUser(req, res, next) {
    try {
      const { username, email, password, packageMonths } = req.body;

      if (!username || !email || !password || !packageMonths) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'All fields are required',
          },
        });
      }

      // Check if email exists
      const existing = db.prepare('SELECT * FROM api_users WHERE email = ?').get(email);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'Email already exists',
          },
        });
      }

      // Create in Jellyfin
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

      // Hash password
      const passwordHash = await authService.hashPassword(password);

      // Create in database
      const insertUser = db.prepare(`
        INSERT INTO api_users (email, password_hash, jellyfinUserId, role)
        VALUES (?, ?, ?, 'user')
      `);
      const userResult = insertUser.run(email, passwordHash, jellyfinUserId);
      const userId = userResult.lastInsertRowid;

      // Calculate expiration
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + parseInt(packageMonths));

      // Create expiration
      db.prepare(`
        INSERT INTO user_expiration (userId, jellyfinUserId, expirationDate, packageMonths, isActive)
        VALUES (?, ?, ?, ?, 1)
      `).run(userId, jellyfinUserId, expirationDate.toISOString(), packageMonths);

      // Create notification preferences
      db.prepare(`
        INSERT INTO user_notifications (userId)
        VALUES (?)
      `).run(userId);

      logger.info(`User created by admin: ${email}`);

      res.status(201).json({
        success: true,
        data: {
          userId,
          email,
          jellyfinUserId,
        },
      });
    } catch (error) {
      logger.error('Create user error:', error);
      next(error);
    }
  }

  /**
   * Disable user
   */
  async disableUser(req, res, next) {
    try {
      const { userId } = req.params;

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

      // Store before state for audit
      req.audit = { before: { isActive: true } };

      // Disable in Jellyfin
      await jellyfinService.disableUser(user.jellyfinUserId);

      // Update database
      db.prepare(`
        UPDATE user_expiration 
        SET isActive = 0, updated_at = datetime('now')
        WHERE userId = ?
      `).run(userId);

      req.audit.after = { isActive: false };

      logger.info(`User disabled: ${user.email}`);

      res.json({
        success: true,
        data: {
          message: 'User disabled successfully',
        },
      });
    } catch (error) {
      logger.error('Disable user error:', error);
      next(error);
    }
  }

  /**
   * Enable user
   */
  async enableUser(req, res, next) {
    try {
      const { userId } = req.params;

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

      req.audit = { before: { isActive: false } };

      // Enable in Jellyfin
      await jellyfinService.enableUser(user.jellyfinUserId);

      // Update database
      db.prepare(`
        UPDATE user_expiration 
        SET isActive = 1, updated_at = datetime('now')
        WHERE userId = ?
      `).run(userId);

      req.audit.after = { isActive: true };

      logger.info(`User enabled: ${user.email}`);

      res.json({
        success: true,
        data: {
          message: 'User enabled successfully',
        },
      });
    } catch (error) {
      logger.error('Enable user error:', error);
      next(error);
    }
  }

  /**
   * Delete user
   */
  async deleteUser(req, res, next) {
    try {
      const { userId } = req.params;

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

      // Delete from Jellyfin
      await jellyfinService.deleteUser(user.jellyfinUserId);

      // Delete from database (cascade)
      db.prepare('DELETE FROM api_users WHERE id = ?').run(userId);

      logger.info(`User deleted: ${user.email}`);

      res.json({
        success: true,
        data: {
          message: 'User deleted successfully',
        },
      });
    } catch (error) {
      logger.error('Delete user error:', error);
      next(error);
    }
  }

  /**
   * Extend user subscription
   */
  async extendSubscription(req, res, next) {
    try {
      const { userId } = req.params;
      const { months } = req.body;

      if (!months || months < 1 || months > 12) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MONTHS',
            message: 'Months must be between 1 and 12',
          },
        });
      }

      const expiration = db.prepare('SELECT * FROM user_expiration WHERE userId = ?').get(userId);
      if (!expiration) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_NOT_FOUND',
            message: 'Subscription not found',
          },
        });
      }

      // Calculate new expiration
      const currentExpiration = new Date(expiration.expirationDate);
      const newExpiration = new Date(currentExpiration);
      newExpiration.setMonth(newExpiration.getMonth() + parseInt(months));

      // Update database
      db.prepare(`
        UPDATE user_expiration 
        SET expirationDate = ?, updated_at = datetime('now')
        WHERE userId = ?
      `).run(newExpiration.toISOString(), userId);

      logger.info(`Subscription extended for user ${userId} by ${months} months`);

      res.json({
        success: true,
        data: {
          message: 'Subscription extended successfully',
          newExpirationDate: newExpiration.toISOString(),
        },
      });
    } catch (error) {
      logger.error('Extend subscription error:', error);
      next(error);
    }
  }

  /**
   * Get dashboard stats
   */
  async getDashboardStats(req, res, next) {
    try {
      // Database stats
      const totalUsers = db.prepare("SELECT COUNT(*) as count FROM api_users WHERE role != 'admin'").get().count;
      const activeSubs = db.prepare("SELECT COUNT(*) as count FROM user_expiration WHERE isActive = 1").get().count;
      // Mock pending requests for now (or implement pending table later)
      const pendingRequests = 0; 

      // Jellyfin connection check
      let jellyfinConnected = false;
      try {
        // Simple ping to Jellyfin with short timeout (2s)
        await jellyfinService.client.get('/System/Info/Public', { timeout: 2000 });
        jellyfinConnected = true;
      } catch (error) {
        // logger.warn('Jellyfin ping failed:', error.message); // Optional logging
        jellyfinConnected = false;
      }

      res.json({
        success: true,
        data: {
          totalUsers,
          activeSubs,
          pendingRequests,
          jellyfinConnected
        }
      });
    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      next(error);
    }
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(req, res, next) {
    try {
      const { limit = 100, offset = 0, action, startDate, endDate } = req.query;

      let query = 'SELECT * FROM audit_log WHERE 1=1';
      const params = [];

      if (action) {
        query += ' AND action = ?';
        params.push(action);
      }

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const logs = db.prepare(query).all(...params);

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      logger.error('Get audit logs error:', error);
      next(error);
    }
  }
}

module.exports = new AdminController();
