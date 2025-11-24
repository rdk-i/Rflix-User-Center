const authService = require('../services/authService');
const captchaService = require('../services/captchaService');
const jellyfinService = require('../services/jellyfinService');
const notificationService = require('../services/notificationService');
const db = require('../config/database');
const logger = require('../utils/logger');

class SimpleRegistrationController {
  /**
   * Handle user registration with simplified package system
   */
  async register(req, res, next) {
    try {
      const { username, email, password, packageId, recaptchaToken } = req.body;
      
      logger.info('Registration attempt with simplified package system', {
        email,
        username,
        packageId
      });

      // Validation
      if (!username || !email || !password || !packageId) {
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

      // Validate package ID
      const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND is_active = 1').get(packageId);
      if (!pkg) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PACKAGE',
            message: 'Invalid or inactive package selected',
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
      let jellyfinUserId;
      let jellyfinResult;
      
      try {
        // Check Jellyfin health before attempting user creation
        const jellyfinHealth = await jellyfinService.performHealthCheck();
        if (!jellyfinHealth.healthy) {
          logger.warn('Jellyfin service unhealthy during registration', {
            email,
            username,
            jellyfinError: jellyfinHealth.error
          });
          
          // Allow registration to proceed with local-only user for manual Jellyfin sync later
          return await createLocalRegistrationOnly(req, res, {
            email, username, password, packageId, profileData: req.body
          });
        }

        jellyfinResult = await jellyfinService.createUser(username, password);
        
        if (!jellyfinResult.success) {
          logger.error('Jellyfin user creation failed', {
            email,
            username,
            error: jellyfinResult.error
          });
          
          // Check if this is a recoverable error
          if (jellyfinResult.error?.code === 'JELLYFIN_TIMEOUT' ||
              jellyfinResult.error?.code === 'JELLYFIN_UNAVAILABLE') {
            
            // Allow registration to proceed locally for manual sync later
            return await createLocalRegistrationOnly(req, res, {
              email, username, password, packageId, profileData: req.body
            });
          }
          
          return res.status(500).json({
            success: false,
            error: {
              code: 'JELLYFIN_ERROR',
              message: 'Failed to create Jellyfin user',
              details: jellyfinResult.error?.message
            },
          });
        }

        jellyfinUserId = jellyfinResult.data.Id;

        // Disable user immediately (pending approval)
        try {
          await jellyfinService.disableUser(jellyfinUserId);
        } catch (disableError) {
          logger.warn('Failed to disable Jellyfin user, will retry during approval', {
            email,
            username,
            jellyfinUserId,
            error: disableError.message
          });
        }

      } catch (jellyfinError) {
        logger.error('Critical Jellyfin integration error during registration', {
          email,
          username,
          error: jellyfinError.message
        });

        // For critical errors, allow local registration with manual sync flag
        return await createLocalRegistrationOnly(req, res, {
          email, username, password, packageId, profileData: req.body
        });
      }

      // Hash password
      const passwordHash = await authService.hashPassword(password);

      // Create user in database
      const insertUser = db.prepare(`
        INSERT INTO api_users (email, password_hash, jellyfinUserId, role, profile_data)
        VALUES (?, ?, ?, 'user', ?)
      `);
      
      // Filter out core fields to store rest in profile_data
      const coreFields = ['username', 'email', 'password', 'confirmPassword', 'packageId', 'recaptchaToken', 'provider'];
      const profileData = {};
      Object.keys(req.body).forEach(key => {
        if (!coreFields.includes(key)) {
          profileData[key] = req.body[key];
        }
      });

      const userResult = insertUser.run(email, passwordHash, jellyfinUserId, JSON.stringify(profileData));
      const userId = userResult.lastInsertRowid;

      // Calculate expiration date based on package duration
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + pkg.duration_days);

      // Create user expiration entry (inactive until approved)
      db.prepare(`
        INSERT INTO user_expiration (userId, jellyfinUserId, packageId, expirationDate, isActive)
        VALUES (?, ?, ?, ?, 0)
      `).run(userId, jellyfinUserId, packageId, expirationDate.toISOString());

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
        JSON.stringify({ email, username, packageId, packageName: pkg.name }),
        req.ip,
        req.get('user-agent') || 'unknown'
      );

      logger.info(`New registration: ${email} (pending approval) with package ${pkg.name}`);

      res.status(201).json({
        success: true,
        data: {
          message: 'Registration successful! Your account is pending admin approval.',
          userId,
          email,
          packageName: pkg.name,
          durationDays: pkg.duration_days,
          price: pkg.price
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
          p.name as packageName, p.duration_days, p.price,
          e.expirationDate
        FROM api_users u
        LEFT JOIN user_expiration e ON u.id = e.userId
        LEFT JOIN packages p ON e.packageId = p.id
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
      return await approveRegistrationWithSync(req, res, userId);
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

/**
 * Create local-only registration when external services are unavailable
 */
async function createLocalRegistrationOnly(req, res, registrationData) {
  const { email, username, password, packageId, profileData } = registrationData;
  
  logger.warn('Creating local-only registration due to external service failure', {
    email,
    username,
    reason: 'jellyfin_unavailable'
  });

  try {
    // Get package details
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(packageId);
    if (!pkg) {
      throw new Error('Invalid package ID');
    }

    // Hash password
    const passwordHash = await authService.hashPassword(password);

    // Create user in database with placeholder Jellyfin ID
    const placeholderJellyfinId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const insertUser = db.prepare(`
      INSERT INTO api_users (email, password_hash, jellyfinUserId, role, profile_data, sync_status)
      VALUES (?, ?, ?, 'user', ?, 'pending_sync')
    `);
    
    const userResult = insertUser.run(email, passwordHash, placeholderJellyfinId, JSON.stringify(profileData || {}));
    const userId = userResult.lastInsertRowid;

    // Calculate expiration date based on package duration
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + pkg.duration_days);

    // Create user expiration entry (inactive until approved and synced)
    db.prepare(`
      INSERT INTO user_expiration (userId, jellyfinUserId, packageId, expirationDate, isActive, sync_status)
      VALUES (?, ?, ?, ?, 0, 'pending_sync')
    `).run(userId, placeholderJellyfinId, packageId, expirationDate.toISOString());

    // Create notification preferences
    db.prepare(`
      INSERT INTO user_notifications (userId, emailEnabled, pushEnabled, telegramEnabled)
      VALUES (?, 0, 0, 0)
    `).run(userId);

    // Log registration with sync status
    db.prepare(`
      INSERT INTO audit_log (action, details, timestamp, ip, userAgent)
      VALUES (?, ?, datetime('now'), ?, ?)
    `).run(
      'USER_REGISTERED_LOCAL_ONLY',
      JSON.stringify({ email, username, packageId, packageName: pkg.name, syncStatus: 'pending_sync' }),
      req.ip,
      req.get('user-agent') || 'unknown'
    );

    logger.info(`Local-only registration created: ${email} (pending Jellyfin sync) with package ${pkg.name}`);

    res.status(201).json({
      success: true,
      data: {
        message: 'Registration successful! Your account is pending admin approval and Jellyfin synchronization.',
        userId,
        email,
        packageName: pkg.name,
        durationDays: pkg.duration_days,
        price: pkg.price,
        syncStatus: 'pending_sync',
        note: 'Due to temporary service issues, your account will be manually synced to Jellyfin by an administrator.'
      },
    });

  } catch (error) {
    logger.error('Local registration failed:', {
      email,
      username,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_ERROR',
        message: 'Registration failed due to system error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
}

/**
 * Enhanced approval process with Jellyfin sync retry
 */
async function approveRegistrationWithSync(req, res, userId) {
  let retryCount = 0;
  const maxRetries = 3;

  logger.info(`Starting approval process for user ${userId}`);

  while (retryCount < maxRetries) {
    try {
      logger.debug(`Approval attempt ${retryCount + 1} for user ${userId}`);

      // Get user with sync status and package info
      const user = db.prepare(`
        SELECT u.*, ue.sync_status, p.name as packageName, p.duration_days
        FROM api_users u
        LEFT JOIN user_expiration ue ON u.id = ue.userId
        LEFT JOIN packages p ON ue.packageId = p.id
        WHERE u.id = ?
      `).get(userId);

      if (!user) {
        logger.warn(`User not found during approval: ${userId}`);
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }

      logger.debug(`User found for approval: ${user.email}, sync_status: ${user.sync_status}, package: ${user.packageName}`);

      // Check if user needs Jellyfin sync
      if (user.sync_status === 'pending_sync' || user.jellyfinUserId.startsWith('pending_')) {
        logger.info(`Syncing user to Jellyfin: ${user.email} (attempt ${retryCount + 1})`);
        
        try {
          // Create user in Jellyfin
          const jellyfinResult = await jellyfinService.createUser(
            user.email.split('@')[0], // Use email prefix as username
            'temp_password_' + Date.now() // Generate temporary password
          );

          if (!jellyfinResult.success) {
            throw new Error(`Jellyfin sync failed: ${jellyfinResult.error}`);
          }

          const newJellyfinUserId = jellyfinResult.data.Id;
          
          logger.info(`User created in Jellyfin: ${user.email} -> ${newJellyfinUserId}`);

          // Update user with new Jellyfin ID
          const userUpdate = db.prepare(`
            UPDATE api_users
            SET jellyfinUserId = ?, sync_status = 'synced', updated_at = datetime('now')
            WHERE id = ?
          `).run(newJellyfinUserId, userId);

          if (userUpdate.changes === 0) {
            throw new Error('Failed to update user with new Jellyfin ID');
          }

          // Update expiration record
          const expirationUpdate = db.prepare(`
            UPDATE user_expiration
            SET jellyfinUserId = ?, sync_status = 'synced', updated_at = datetime('now')
            WHERE userId = ?
          `).run(newJellyfinUserId, userId);

          if (expirationUpdate.changes === 0) {
            logger.warn(`No expiration record found for user ${userId}, creating new one`);
            db.prepare(`
              INSERT INTO user_expiration (userId, jellyfinUserId, expirationDate, packageId, isActive, sync_status)
              SELECT u.id, ?, datetime('now', '+30 days'), 1, 0, 'synced'
              FROM api_users u
              WHERE u.id = ?
            `).run(newJellyfinUserId, userId);
          }

          logger.info(`User synced to Jellyfin: ${user.email} -> ${newJellyfinUserId}`);
          
          // Continue with normal approval process using new Jellyfin ID
          user.jellyfinUserId = newJellyfinUserId;
          
        } catch (syncError) {
          retryCount++;
          logger.warn(`Jellyfin sync attempt ${retryCount} failed for ${user.email}:`, {
            error: syncError.message
          });
          
          if (retryCount >= maxRetries) {
            logger.error(`Max retries reached for Jellyfin sync of user ${userId}`);
            return res.status(500).json({
              success: false,
              error: {
                code: 'JELLYFIN_SYNC_FAILED',
                message: 'Failed to sync user to Jellyfin after multiple attempts',
                details: 'Please check Jellyfin service status and retry manually'
              }
            });
          }
          
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, retryCount) * 1000;
          logger.info(`Retrying Jellyfin sync in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      logger.debug(`Enabling user in Jellyfin: ${user.jellyfinUserId}`);
      // Enable user in Jellyfin
      const jellyfinResult = await jellyfinService.enableUser(user.jellyfinUserId);
      
      if (!jellyfinResult.success) {
        throw new Error(`Failed to enable Jellyfin user: ${jellyfinResult.error}`);
      }

      logger.debug(`Jellyfin user enabled successfully: ${user.jellyfinUserId}`);

      // Activate subscription
      const updateResult = db.prepare(`
        UPDATE user_expiration
        SET isActive = 1, sync_status = 'synced', updated_at = datetime('now')
        WHERE userId = ?
      `).run(userId);

      if (updateResult.changes === 0) {
        logger.error(`Failed to activate subscription for user ${userId}`);
        throw new Error('Failed to activate user subscription');
      }

      logger.debug(`Subscription activated for user ${userId}`);

      // Log successful approval with sync
      db.prepare(`
        INSERT INTO audit_log (adminId, action, targetUserId, details, timestamp, ip, userAgent)
        VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
      `).run(
        req.user.id,
        'USER_APPROVED_WITH_SYNC',
        userId,
        JSON.stringify({ email: user.email, syncStatus: 'synced', packageName: user.packageName }),
        req.ip,
        req.get('user-agent') || 'unknown'
      );

      logger.info(`User approved with sync: ${user.email} by admin ${req.user.id} with package ${user.packageName}`);

      // Send welcome notification
      await notificationService.sendWelcomeNotification(user.id, user);

      return res.json({
        success: true,
        data: {
          message: 'User approved and synced to Jellyfin successfully',
          userId,
          email: user.email,
          syncStatus: 'synced',
          packageName: user.packageName,
          durationDays: user.duration_days
        },
      });

    } catch (error) {
      logger.error(`Approval with sync failed (attempt ${retryCount + 1}):`, {
        userId,
        error: error.message
      });
      
      if (retryCount >= maxRetries - 1) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'APPROVAL_FAILED',
            message: 'Failed to approve user after multiple attempts',
            details: error.message
          }
        });
      }
      
      retryCount++;
      const delay = Math.pow(2, retryCount) * 1000;
      logger.info(`Retrying approval in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = new SimpleRegistrationController();