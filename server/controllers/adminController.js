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

  async getDashboardStats(req, res, next) {
    try {
      let totalUsers = 0;
      let nowPlaying = 0;
      let pendingRequests = 0;
      let jellyfinConnected = false;
      let recentActivity = [];

      // Try to fetch real data from Jellyfin
      try {
        // Ping Jellyfin
        await jellyfinService.client.get('/System/Info/Public', { timeout: 2000 });
        jellyfinConnected = true;

        // Get all users from Jellyfin
        const usersResponse = await jellyfinService.getAllUsers();
        if (usersResponse.success) {
          totalUsers = usersResponse.data.length;
        }

        // Get active sessions (Now Playing)
        const sessionsResponse = await jellyfinService.client.get('/Sessions');
        if (sessionsResponse.data) {
          const activeSessions = sessionsResponse.data.filter(s => s.NowPlayingItem);
          nowPlaying = activeSessions.length;

          // Build recent activity from active sessions
          recentActivity = activeSessions.slice(0, 5).map(session => ({
            user: session.UserName || 'Unknown',
            action: `watching ${session.NowPlayingItem?.Name || 'content'}`,
            time: 'Now'
          }));
        }

        // If no active sessions, get recent activity from audit log
        if (recentActivity.length === 0) {
          const auditLogs = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 5').all();
          recentActivity = auditLogs.map(log => ({
            user: log.adminId ? `Admin #${log.adminId}` : 'System',
            action: log.action,
            time: new Date(log.timestamp).toLocaleTimeString()
          }));
        }
      } catch (error) {
        logger.warn('Failed to fetch Jellyfin stats:', error.message);
        jellyfinConnected = false;
      }

      // Fallback: Get stats from local database if Jellyfin is unavailable
      if (!jellyfinConnected) {
        totalUsers = db.prepare("SELECT COUNT(*) as count FROM api_users WHERE role != 'admin'").get().count;
        nowPlaying = 0;
        recentActivity = [];
      }

      res.json({
        success: true,
        data: {
          totalUsers,
          nowPlaying,
          pendingRequests,
          jellyfinConnected,
          recentActivity
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

  /**
   * Get settings
   */
  async getSettings(req, res, next) {
    try {
      const fs = require('fs');
      const path = require('path');
      const backupsDir = path.join(__dirname, '../../backups');
      
      let lastBackup = 'Never';
      if (fs.existsSync(backupsDir)) {
        const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.db'));
        if (files.length > 0) {
          const latest = files.sort().reverse()[0];
          const stats = fs.statSync(path.join(backupsDir, latest));
          lastBackup = stats.mtime.toLocaleString();
        }
      }

      res.json({
        success: true,
        data: {
          siteName: process.env.SITE_NAME || 'Rflix',
          jellyfinUrl: process.env.JELLYFIN_URL || '',
          allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',
          autoBackup: process.env.AUTO_BACKUP !== 'false',
          lastBackup
        }
      });
    } catch (error) {
      logger.error('Get settings error:', error);
      next(error);
    }
  }

  /**
   * Test Jellyfin connection
   */
  async testJellyfinConnection(req, res, next) {
    try {
      const { url, apiKey } = req.body;
      const axios = require('axios');

      const testClient = axios.create({
        baseURL: url,
        headers: { 'X-Emby-Token': apiKey },
        timeout: 5000
      });

      await testClient.get('/System/Info/Public');

      res.json({
        success: true,
        data: { message: 'Connection successful' }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'JELLYFIN_TEST_FAILED',
          message: error.message || 'Connection failed'
        }
      });
    }
  }

  /**
   * Update Jellyfin configuration
   */
  async updateJellyfinConfig(req, res, next) {
    try {
      const { url, apiKey } = req.body;
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(__dirname, '../../.env');

      // Read current .env
      let envContent = fs.readFileSync(envPath, 'utf8');

      // Update or add Jellyfin config
      const updateEnvVar = (key, value) => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (envContent.match(regex)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      };

      updateEnvVar('JELLYFIN_URL', url);
      updateEnvVar('JELLYFIN_API_KEY', apiKey);

      fs.writeFileSync(envPath, envContent);

      logger.info('Jellyfin configuration updated');

      res.json({
        success: true,
        data: { message: 'Configuration updated. Please restart the server.' }
      });
    } catch (error) {
      logger.error('Update Jellyfin config error:', error);
      next(error);
    }
  }

  /**
   * Create database backup
   */
  async createBackup(req, res, next) {
    try {
      const fs = require('fs');
      const path = require('path');
      const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/rflix.db');
      const backupsDir = path.join(__dirname, '../../backups');
      
      // Create backups directory if not exists
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const backupFilename = `rflix-backup-${timestamp}.db`;
      const backupPath = path.join(backupsDir, backupFilename);

      // Copy database file
      fs.copyFileSync(dbPath, backupPath);

      logger.info(`Database backup created: ${backupFilename}`);

      res.json({
        success: true,
        data: {
          filename: backupFilename,
          path: backupPath,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Create backup error:', error);
      next(error);
    }
  }

  /**
   * Get all Jellyfin users
   */
  async getAllJellyfinUsers(req, res, next) {
    try {
      const jellyfinUsers = await jellyfinService.getAllUsers();
      
      if (!jellyfinUsers.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'JELLYFIN_ERROR',
            message: 'Failed to fetch users from Jellyfin'
          }
        });
      }

      // Merge with local database data (email, expiration, etc)
      const users = jellyfinUsers.data.map(jfUser => {
        const dbUser = db.prepare('SELECT * FROM api_users WHERE jellyfinUserId = ?').get(jfUser.Id);
        return {
          ...jfUser,
          email: dbUser?.email || null,
          expirationDate: dbUser ? db.prepare('SELECT expirationDate FROM user_expiration WHERE userId = ?').get(dbUser.id)?.expirationDate : null
        };
      });

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      logger.error('Get Jellyfin users error:', error);
      next(error);
    }
  }

  /**
   * Sync Jellyfin users to local database
   */
  async syncJellyfinUsers(req, res, next) {
    try {
      const jellyfinUsers = await jellyfinService.getAllUsers();
      
      if (!jellyfinUsers.success) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'JELLYFIN_ERROR',
            message: 'Failed to fetch users from Jellyfin'
          }
        });
      }

      let synced = 0;
      
      jellyfinUsers.data.forEach(jfUser => {
        // Check if user already exists
        const existing = db.prepare('SELECT id FROM api_users WHERE jellyfinUserId = ?').get(jfUser.Id);
        
        if (!existing) {
          // Insert new user with placeholder email (can be updated later)
          const placeholderEmail = `${jfUser.Name.toLowerCase().replace(/\s+/g, '_')}@jellyfin.local`;
          
          db.prepare(`
            INSERT INTO api_users (email, jellyfinUserId, password_hash, role)
            VALUES (?, ?, '', 'user')
          `).run(placeholderEmail, jfUser.Id);
          synced++;
        }
      });

      logger.info(`Synced ${synced} new users from Jellyfin`);

      res.json({
        success: true,
        data: { synced }
      });
    } catch (error) {
      logger.error('Sync Jellyfin users error:', error);
      next(error);
    }
  }
}

module.exports = new AdminController();
