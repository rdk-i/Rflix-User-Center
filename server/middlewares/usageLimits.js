const db = require('../config/database');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');

/**
 * Usage Limits and Enforcement System
 * Comprehensive middleware for tracking and enforcing usage limits
 */
class UsageLimitsMiddleware {
  constructor() {
    // Default limits by subscription tier
    this.defaultLimits = {
      basic: {
        storage: 10 * 1024 * 1024 * 1024, // 10GB
        streams: 2,
        concurrentUsers: 1,
        apiCalls: 1000,
        streamDuration: 24 * 60 * 60 * 1000, // 24 hours
        gracePeriod: 24 * 60 * 60 * 1000, // 24 hours
        throttleDelay: 1000 // 1 second
      },
      premium: {
        storage: 50 * 1024 * 1024 * 1024, // 50GB
        streams: 5,
        concurrentUsers: 3,
        apiCalls: 5000,
        streamDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
        gracePeriod: 48 * 60 * 60 * 1000, // 48 hours
        throttleDelay: 500 // 0.5 seconds
      },
      enterprise: {
        storage: 200 * 1024 * 1024 * 1024, // 200GB
        streams: 10,
        concurrentUsers: 10,
        apiCalls: 20000,
        streamDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
        gracePeriod: 72 * 60 * 60 * 1000, // 72 hours
        throttleDelay: 100 // 0.1 seconds
      }
    };

    // Usage tracking cache for performance
    this.usageCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get user's subscription tier and limits
   */
  async getUserLimits(userId) {
    try {
      const user = db.prepare(`
        SELECT u.id, ue.packageId, p.name as packageName, ue.isActive
        FROM api_users u
        JOIN user_expiration ue ON u.id = ue.userId
        LEFT JOIN packages p ON ue.packageId = p.id
        WHERE u.id = ? AND ue.isActive = 1
        ORDER BY ue.expirationDate DESC
        LIMIT 1
      `).get(userId);

      if (!user) {
        return this.defaultLimits.basic;
      }

      // Map package names to tiers
      const tierMap = {
        '1 Month': 'basic',
        '3 Months': 'premium',
        '6 Months': 'premium',
        '12 Months': 'enterprise'
      };

      const tier = tierMap[user.packageName] || 'basic';
      return this.defaultLimits[tier];
    } catch (error) {
      logger.error(`Failed to get user limits for ${userId}:`, error);
      return this.defaultLimits.basic;
    }
  }

  /**
   * Track storage usage per user
   */
  async trackStorageUsage(userId, fileSize = 0) {
    try {
      const currentUsage = await this.getCurrentUsage(userId);
      const limits = await this.getUserLimits(userId);
      
      const newStorageUsage = currentUsage.storage + fileSize;
      
      // Update usage tracking
      db.prepare(`
        INSERT OR REPLACE INTO usage_tracking 
        (userId, storage_used, streams_active, concurrent_users, api_calls, last_updated)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(
        userId,
        newStorageUsage,
        currentUsage.streams,
        currentUsage.concurrentUsers,
        currentUsage.apiCalls
      );

      // Log usage history
      db.prepare(`
        INSERT INTO usage_history 
        (userId, metric_type, metric_value, timestamp)
        VALUES (?, 'storage', ?, datetime('now'))
      `).run(userId, fileSize);

      // Update cache
      this.usageCache.set(userId, {
        ...currentUsage,
        storage: newStorageUsage,
        lastUpdated: Date.now()
      });

      logger.info(`Storage usage tracked for user ${userId}: ${fileSize} bytes, total: ${newStorageUsage}`);

      return {
        success: true,
        storageUsed: newStorageUsage,
        storageLimit: limits.storage,
        percentage: (newStorageUsage / limits.storage) * 100
      };
    } catch (error) {
      logger.error(`Failed to track storage usage for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Track streaming sessions and duration
   */
  async trackStreamUsage(userId, sessionDuration = 0, streamCount = 1) {
    try {
      const currentUsage = await this.getCurrentUsage(userId);
      const limits = await this.getUserLimits(userId);
      
      const newStreamCount = currentUsage.streams + streamCount;
      const newStreamDuration = currentUsage.streamDuration + sessionDuration;
      
      // Update usage tracking
      db.prepare(`
        UPDATE usage_tracking 
        SET streams_active = ?, stream_duration = ?, last_updated = datetime('now')
        WHERE userId = ?
      `).run(newStreamCount, newStreamDuration, userId);

      // Log usage history
      db.prepare(`
        INSERT INTO usage_history 
        (userId, metric_type, metric_value, timestamp)
        VALUES (?, 'stream', ?, datetime('now'))
      `).run(userId, sessionDuration);

      // Update cache
      this.usageCache.set(userId, {
        ...currentUsage,
        streams: newStreamCount,
        streamDuration: newStreamDuration,
        lastUpdated: Date.now()
      });

      logger.info(`Stream usage tracked for user ${userId}: ${streamCount} streams, ${sessionDuration}ms duration`);

      return {
        success: true,
        streamsActive: newStreamCount,
        streamLimit: limits.streams,
        streamDuration: newStreamDuration,
        durationLimit: limits.streamDuration,
        streamPercentage: (newStreamCount / limits.streams) * 100,
        durationPercentage: (newStreamDuration / limits.streamDuration) * 100
      };
    } catch (error) {
      logger.error(`Failed to track stream usage for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Track concurrent user sessions
   */
  async trackConcurrentUsers(userId, action = 'increment') {
    try {
      const currentUsage = await this.getCurrentUsage(userId);
      const limits = await this.getUserLimits(userId);
      
      let newConcurrentUsers = currentUsage.concurrentUsers;
      
      if (action === 'increment') {
        newConcurrentUsers++;
      } else if (action === 'decrement' && newConcurrentUsers > 0) {
        newConcurrentUsers--;
      }

      // Update usage tracking
      db.prepare(`
        UPDATE usage_tracking 
        SET concurrent_users = ?, last_updated = datetime('now')
        WHERE userId = ?
      `).run(newConcurrentUsers, userId);

      // Log usage history
      db.prepare(`
        INSERT INTO usage_history 
        (userId, metric_type, metric_value, timestamp)
        VALUES (?, 'concurrent_users', ?, datetime('now'))
      `).run(userId, newConcurrentUsers);

      // Update cache
      this.usageCache.set(userId, {
        ...currentUsage,
        concurrentUsers: newConcurrentUsers,
        lastUpdated: Date.now()
      });

      logger.info(`Concurrent users tracked for user ${userId}: ${newConcurrentUsers}`);

      return {
        success: true,
        concurrentUsers: newConcurrentUsers,
        concurrentLimit: limits.concurrentUsers,
        percentage: (newConcurrentUsers / limits.concurrentUsers) * 100
      };
    } catch (error) {
      logger.error(`Failed to track concurrent users for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Track API call frequency per subscription
   */
  async trackAPIUsage(userId, endpoint = 'unknown') {
    try {
      const currentUsage = await this.getCurrentUsage(userId);
      const limits = await this.getUserLimits(userId);
      
      const newApiCalls = currentUsage.apiCalls + 1;
      
      // Update usage tracking
      db.prepare(`
        UPDATE usage_tracking 
        SET api_calls = ?, last_updated = datetime('now')
        WHERE userId = ?
      `).run(newApiCalls, userId);

      // Log usage history
      db.prepare(`
        INSERT INTO usage_history 
        (userId, metric_type, metric_value, timestamp, details)
        VALUES (?, 'api_call', 1, datetime('now'), ?)
      `).run(userId, JSON.stringify({ endpoint }));

      // Update cache
      this.usageCache.set(userId, {
        ...currentUsage,
        apiCalls: newApiCalls,
        lastUpdated: Date.now()
      });

      logger.info(`API usage tracked for user ${userId}: ${endpoint}`);

      return {
        success: true,
        apiCalls: newApiCalls,
        apiLimit: limits.apiCalls,
        percentage: (newApiCalls / limits.apiCalls) * 100
      };
    } catch (error) {
      logger.error(`Failed to track API usage for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get current usage statistics
   */
  async getCurrentUsage(userId) {
    try {
      // Check cache first
      const cached = this.usageCache.get(userId);
      if (cached && (Date.now() - cached.lastUpdated) < this.cacheExpiry) {
        return cached;
      }

      // Get from database
      let usage = db.prepare(`
        SELECT * FROM usage_tracking WHERE userId = ?
      `).get(userId);

      if (!usage) {
        // Initialize usage tracking
        usage = {
          userId,
          storage_used: 0,
          streams_active: 0,
          concurrent_users: 0,
          api_calls: 0,
          stream_duration: 0,
          last_updated: new Date().toISOString()
        };
        
        db.prepare(`
          INSERT INTO usage_tracking 
          (userId, storage_used, streams_active, concurrent_users, api_calls, stream_duration, last_updated)
          VALUES (?, 0, 0, 0, 0, 0, datetime('now'))
        `).run(userId);
      }

      const result = {
        storage: usage.storage_used || 0,
        streams: usage.streams_active || 0,
        concurrentUsers: usage.concurrent_users || 0,
        apiCalls: usage.api_calls || 0,
        streamDuration: usage.stream_duration || 0,
        lastUpdated: Date.now()
      };

      // Update cache
      this.usageCache.set(userId, result);
      return result;
    } catch (error) {
      logger.error(`Failed to get current usage for user ${userId}:`, error);
      return {
        storage: 0,
        streams: 0,
        concurrentUsers: 0,
        apiCalls: 0,
        streamDuration: 0,
        lastUpdated: Date.now()
      };
    }
  }

  /**
   * Calculate usage percentage
   */
  async getUsagePercentage(userId) {
    try {
      const currentUsage = await this.getCurrentUsage(userId);
      const limits = await this.getUserLimits(userId);

      return {
        storage: {
          used: currentUsage.storage,
          limit: limits.storage,
          percentage: Math.min(100, (currentUsage.storage / limits.storage) * 100)
        },
        streams: {
          used: currentUsage.streams,
          limit: limits.streams,
          percentage: Math.min(100, (currentUsage.streams / limits.streams) * 100)
        },
        concurrentUsers: {
          used: currentUsage.concurrentUsers,
          limit: limits.concurrentUsers,
          percentage: Math.min(100, (currentUsage.concurrentUsers / limits.concurrentUsers) * 100)
        },
        apiCalls: {
          used: currentUsage.apiCalls,
          limit: limits.apiCalls,
          percentage: Math.min(100, (currentUsage.apiCalls / limits.apiCalls) * 100)
        },
        streamDuration: {
          used: currentUsage.streamDuration,
          limit: limits.streamDuration,
          percentage: Math.min(100, (currentUsage.streamDuration / limits.streamDuration) * 100)
        }
      };
    } catch (error) {
      logger.error(`Failed to get usage percentage for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Check if usage is approaching threshold
   */
  async checkUsageThreshold(userId, threshold = 80) {
    try {
      const usagePercentage = await this.getUsagePercentage(userId);
      if (!usagePercentage) return false;

      const alerts = [];
      
      if (usagePercentage.storage.percentage >= threshold) {
        alerts.push({
          type: 'storage',
          percentage: usagePercentage.storage.percentage,
          message: `Storage usage at ${usagePercentage.storage.percentage.toFixed(1)}%`
        });
      }
      
      if (usagePercentage.streams.percentage >= threshold) {
        alerts.push({
          type: 'streams',
          percentage: usagePercentage.streams.percentage,
          message: `Stream usage at ${usagePercentage.streams.percentage.toFixed(1)}%`
        });
      }
      
      if (usagePercentage.concurrentUsers.percentage >= threshold) {
        alerts.push({
          type: 'concurrent_users',
          percentage: usagePercentage.concurrentUsers.percentage,
          message: `Concurrent users at ${usagePercentage.concurrentUsers.percentage.toFixed(1)}%`
        });
      }
      
      if (usagePercentage.apiCalls.percentage >= threshold) {
        alerts.push({
          type: 'api_calls',
          percentage: usagePercentage.apiCalls.percentage,
          message: `API calls at ${usagePercentage.apiCalls.percentage.toFixed(1)}%`
        });
      }

      if (alerts.length > 0) {
        await this.sendUsageAlert(userId, alerts);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to check usage threshold for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get usage history
   */
  async getUsageHistory(userId, days = 30) {
    try {
      const history = db.prepare(`
        SELECT 
          metric_type,
          metric_value,
          timestamp,
          details
        FROM usage_history 
        WHERE userId = ? 
          AND timestamp > datetime('now', '-' || ? || ' days')
        ORDER BY timestamp DESC
      `).all(userId, days);

      return {
        success: true,
        data: history,
        period: `${days} days`
      };
    } catch (error) {
      logger.error(`Failed to get usage history for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enforce storage limit - block uploads if exceeded
   */
  async enforceStorageLimit(userId, requestedSize = 0) {
    try {
      const currentUsage = await this.getCurrentUsage(userId);
      const limits = await this.getUserLimits(userId);
      
      const projectedUsage = currentUsage.storage + requestedSize;
      
      if (projectedUsage > limits.storage) {
        // Log enforcement action
        db.prepare(`
          INSERT INTO audit_log (userId, action, details, timestamp, ip)
          VALUES (?, 'STORAGE_LIMIT_EXCEEDED', ?, datetime('now'), ?)
        `).run(userId, JSON.stringify({
          currentUsage: currentUsage.storage,
          requestedSize,
          limit: limits.storage,
          projectedUsage
        }), 'system');

        await this.sendLimitWarning(userId, 'storage', limits.storage);

        return {
          allowed: false,
          reason: 'Storage limit exceeded',
          currentUsage: currentUsage.storage,
          limit: limits.storage,
          requestedSize
        };
      }

      return {
        allowed: true,
        currentUsage: currentUsage.storage,
        limit: limits.storage,
        remaining: limits.storage - currentUsage.storage
      };
    } catch (error) {
      logger.error(`Failed to enforce storage limit for user ${userId}:`, error);
      return { allowed: false, reason: 'System error' };
    }
  }

  /**
   * Enforce stream limit - block streaming if limit reached
   */
  async enforceStreamLimit(userId) {
    try {
      const currentUsage = await this.getCurrentUsage(userId);
      const limits = await this.getUserLimits(userId);
      
      if (currentUsage.streams >= limits.streams) {
        // Log enforcement action
        db.prepare(`
          INSERT INTO audit_log (userId, action, details, timestamp, ip)
          VALUES (?, 'STREAM_LIMIT_EXCEEDED', ?, datetime('now'), ?)
        `).run(userId, JSON.stringify({
          currentStreams: currentUsage.streams,
          limit: limits.streams
        }), 'system');

        await this.sendLimitWarning(userId, 'streams', limits.streams);

        return {
          allowed: false,
          reason: 'Stream limit exceeded',
          currentStreams: currentUsage.streams,
          limit: limits.streams
        };
      }

      return {
        allowed: true,
        currentStreams: currentUsage.streams,
        limit: limits.streams,
        remaining: limits.streams - currentUsage.streams
      };
    } catch (error) {
      logger.error(`Failed to enforce stream limit for user ${userId}:`, error);
      return { allowed: false, reason: 'System error' };
    }
  }

  /**
   * Enforce concurrent user limit - block login if too many active
   */
  async enforceConcurrentUserLimit(userId) {
    try {
      const currentUsage = await this.getCurrentUsage(userId);
      const limits = await this.getUserLimits(userId);
      
      if (currentUsage.concurrentUsers >= limits.concurrentUsers) {
        // Log enforcement action
        db.prepare(`
          INSERT INTO audit_log (userId, action, details, timestamp, ip)
          VALUES (?, 'CONCURRENT_USER_LIMIT_EXCEEDED', ?, datetime('now'), ?)
        `).run(userId, JSON.stringify({
          currentUsers: currentUsage.concurrentUsers,
          limit: limits.concurrentUsers
        }), 'system');

        await this.sendLimitWarning(userId, 'concurrent_users', limits.concurrentUsers);

        return {
          allowed: false,
          reason: 'Concurrent user limit exceeded',
          currentUsers: currentUsage.concurrentUsers,
          limit: limits.concurrentUsers
        };
      }

      return {
        allowed: true,
        currentUsers: currentUsage.concurrentUsers,
        limit: limits.concurrentUsers,
        remaining: limits.concurrentUsers - currentUsage.concurrentUsers
      };
    } catch (error) {
      logger.error(`Failed to enforce concurrent user limit for user ${userId}:`, error);
      return { allowed: false, reason: 'System error' };
    }
  }

  /**
   * Enforce API rate limit based on subscription tier
   */
  async enforceAPIRateLimit(userId) {
    try {
      const currentUsage = await this.getCurrentUsage(userId);
      const limits = await this.getUserLimits(userId);
      
      // Reset daily counter if needed (simple implementation)
      const lastReset = await this.getLastAPIReset(userId);
      const now = new Date();
      const shouldReset = !lastReset || (now - new Date(lastReset)) > 24 * 60 * 60 * 1000;

      if (shouldReset) {
        await this.resetAPICalls(userId);
        currentUsage.apiCalls = 0;
      }

      if (currentUsage.apiCalls >= limits.apiCalls) {
        // Log enforcement action
        db.prepare(`
          INSERT INTO audit_log (userId, action, details, timestamp, ip)
          VALUES (?, 'API_RATE_LIMIT_EXCEEDED', ?, datetime('now'), ?)
        `).run(userId, JSON.stringify({
          currentCalls: currentUsage.apiCalls,
          limit: limits.apiCalls
        }), 'system');

        await this.sendLimitWarning(userId, 'api_calls', limits.apiCalls);

        return {
          allowed: false,
          reason: 'API rate limit exceeded',
          currentCalls: currentUsage.apiCalls,
          limit: limits.apiCalls,
          retryAfter: this.getRetryAfterTime()
        };
      }

      return {
        allowed: true,
        currentCalls: currentUsage.apiCalls,
        limit: limits.apiCalls,
        remaining: limits.apiCalls - currentUsage.apiCalls
      };
    } catch (error) {
      logger.error(`Failed to enforce API rate limit for user ${userId}:`, error);
      return { allowed: false, reason: 'System error' };
    }
  }

  /**
   * Handle users who exceed limits
   */
  async handleOverLimit(userId, limitType, limitValue) {
    try {
      const limits = await this.getUserLimits(userId);
      const overLimitData = {
        userId,
        limitType,
        limitValue,
        timestamp: new Date().toISOString(),
        gracePeriod: limits.gracePeriod
      };

      // Log over-limit event
      db.prepare(`
        INSERT INTO audit_log (userId, action, details, timestamp, ip)
        VALUES (?, 'OVER_LIMIT', ?, datetime('now'), ?)
      `).run(userId, JSON.stringify(overLimitData), 'system');

      // Update subscription status if needed
      db.prepare(`
        UPDATE user_expiration 
        SET isActive = 0, updated_at = datetime('now')
        WHERE userId = ?
      `).run(userId);

      await this.sendOverLimitNotification(userId, limitType, limitValue);

      return {
        success: true,
        message: 'User has been restricted due to limit exceeded',
        gracePeriod: limits.gracePeriod
      };
    } catch (error) {
      logger.error(`Failed to handle over-limit for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Suggest upgrade to higher package
   */
  async suggestUpgrade(userId, currentLimit, limitType) {
    try {
      const upgradeSuggestions = {
        storage: 'Consider upgrading to Premium or Enterprise for more storage',
        streams: 'Upgrade to Premium for more simultaneous streams',
        concurrent_users: 'Enterprise plan supports more concurrent users',
        api_calls: 'Higher tier plans include more API calls'
      };

      const suggestion = upgradeSuggestions[limitType] || 'Consider upgrading your subscription';

      await this.sendUpgradeSuggestion(userId, limitType, currentLimit, suggestion);

      return {
        success: true,
        suggestion,
        upgradeUrl: '/user_dashboard.html'
      };
    } catch (error) {
      logger.error(`Failed to suggest upgrade for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Implement grace period for over-limit
   */
  async implementGracePeriod(userId, limitType) {
    try {
      const limits = await this.getUserLimits(userId);
      const graceEndTime = new Date(Date.now() + limits.gracePeriod);

      // Log grace period
      db.prepare(`
        INSERT INTO audit_log (userId, action, details, timestamp, ip)
        VALUES (?, 'GRACE_PERIOD_STARTED', ?, datetime('now'), ?)
      `).run(userId, JSON.stringify({
        limitType,
        gracePeriod: limits.gracePeriod,
        graceEndTime: graceEndTime.toISOString()
      }), 'system');

      // Schedule grace period end
      setTimeout(() => {
        this.endGracePeriod(userId, limitType);
      }, limits.gracePeriod);

      return {
        success: true,
        graceEndTime,
        message: `Grace period active until ${graceEndTime.toISOString()}`
      };
    } catch (error) {
      logger.error(`Failed to implement grace period for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Implement throttling for over-limit users
   */
  async implementThrottling(userId, limitType) {
    try {
      const limits = await this.getUserLimits(userId);
      const throttleDelay = limits.throttleDelay;

      // Log throttling
      db.prepare(`
        INSERT INTO audit_log (userId, action, details, timestamp, ip)
        VALUES (?, 'THROTTLING_APPLIED', ?, datetime('now'), ?)
      `).run(userId, JSON.stringify({
        limitType,
        throttleDelay
      }), 'system');

      // Apply throttling delay
      await new Promise(resolve => setTimeout(resolve, throttleDelay));

      return {
        success: true,
        throttleDelay,
        message: `Service throttled by ${throttleDelay}ms`
      };
    } catch (error) {
      logger.error(`Failed to implement throttling for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send usage alert for high usage
   */
  async sendUsageAlert(userId, alerts) {
    try {
      const user = db.prepare(`
        SELECT u.email, n.emailEnabled, n.telegramEnabled, n.telegramChatId
        FROM api_users u
        LEFT JOIN user_notifications n ON u.id = n.userId
        WHERE u.id = ?
      `).get(userId);

      if (!user) return;

      const alertMessage = alerts.map(alert => alert.message).join('\n');
      
      // Send notifications
      const notifications = [];
      
      if (user.emailEnabled) {
        notifications.push(
          notificationService.sendUsageAlert(user.email, alertMessage)
        );
      }
      
      if (user.telegramEnabled && user.telegramChatId) {
        notifications.push(
          notificationService.sendUsageAlert(user.telegramChatId, alertMessage)
        );
      }

      await Promise.allSettled(notifications);
      
      logger.info(`Usage alerts sent to user ${userId}`);
    } catch (error) {
      logger.error(`Failed to send usage alert for user ${userId}:`, error);
    }
  }

  /**
   * Send limit warning
   */
  async sendLimitWarning(userId, limitType, limitValue) {
    try {
      const user = db.prepare(`
        SELECT u.email, n.emailEnabled, n.telegramEnabled, n.telegramChatId
        FROM api_users u
        LEFT JOIN user_notifications n ON u.id = n.userId
        WHERE u.id = ?
      `).get(userId);

      if (!user) return;

      const warningMessage = `Warning: You have reached your ${limitType} limit of ${limitValue}. Please consider upgrading your subscription.`;

      // Send notifications
      const notifications = [];
      
      if (user.emailEnabled) {
        notifications.push(
          notificationService.sendLimitWarning(user.email, limitType, limitValue)
        );
      }
      
      if (user.telegramEnabled && user.telegramChatId) {
        notifications.push(
          notificationService.sendLimitWarning(user.telegramChatId, limitType, limitValue)
        );
      }

      await Promise.allSettled(notifications);
      
      logger.info(`Limit warning sent to user ${userId} for ${limitType}`);
    } catch (error) {
      logger.error(`Failed to send limit warning for user ${userId}:`, error);
    }
  }

  /**
   * Send over-limit notification
   */
  async sendOverLimitNotification(userId, limitType, limitValue) {
    try {
      const user = db.prepare(`
        SELECT u.email, n.emailEnabled, n.telegramEnabled, n.telegramChatId
        FROM api_users u
        LEFT JOIN user_notifications n ON u.id = n.userId
        WHERE u.id = ?
      `).get(userId);

      if (!user) return;

      const overLimitMessage = `Your account has been restricted because you exceeded your ${limitType} limit of ${limitValue}. Please upgrade your subscription to continue using the service.`;

      // Send notifications
      const notifications = [];
      
      if (user.emailEnabled) {
        notifications.push(
          notificationService.sendOverLimitNotification(user.email, limitType, limitValue)
        );
      }
      
      if (user.telegramEnabled && user.telegramChatId) {
        notifications.push(
          notificationService.sendOverLimitNotification(user.telegramChatId, limitType, limitValue)
        );
      }

      await Promise.allSettled(notifications);
      
      logger.info(`Over-limit notification sent to user ${userId} for ${limitType}`);
    } catch (error) {
      logger.error(`Failed to send over-limit notification for user ${userId}:`, error);
    }
  }

  /**
   * Send upgrade suggestion
   */
  async sendUpgradeSuggestion(userId, limitType, currentLimit, suggestion) {
    try {
      const user = db.prepare(`
        SELECT u.email, n.emailEnabled, n.telegramEnabled, n.telegramChatId
        FROM api_users u
        LEFT JOIN user_notifications n ON u.id = n.userId
        WHERE u.id = ?
      `).get(userId);

      if (!user) return;

      const upgradeMessage = `${suggestion}\n\nCurrent limit: ${currentLimit}\nUpgrade your plan at: /user_dashboard.html`;

      // Send notifications
      const notifications = [];
      
      if (user.emailEnabled) {
        notifications.push(
          notificationService.sendUpgradeSuggestion(user.email, upgradeMessage)
        );
      }
      
      if (user.telegramEnabled && user.telegramChatId) {
        notifications.push(
          notificationService.sendUpgradeSuggestion(user.telegramChatId, upgradeMessage)
        );
      }

      await Promise.allSettled(notifications);
      
      logger.info(`Upgrade suggestion sent to user ${userId} for ${limitType}`);
    } catch (error) {
      logger.error(`Failed to send upgrade suggestion for user ${userId}:`, error);
    }
  }

  /**
   * Helper methods
   */
  async getLastAPIReset(userId) {
    try {
      const result = db.prepare(`
        SELECT timestamp FROM usage_history 
        WHERE userId = ? AND metric_type = 'api_reset'
        ORDER BY timestamp DESC LIMIT 1
      `).get(userId);
      
      return result ? result.timestamp : null;
    } catch (error) {
      return null;
    }
  }

  async resetAPICalls(userId) {
    try {
      db.prepare(`
        UPDATE usage_tracking 
        SET api_calls = 0, last_updated = datetime('now')
        WHERE userId = ?
      `).run(userId);
      
      db.prepare(`
        INSERT INTO usage_history 
        (userId, metric_type, metric_value, timestamp)
        VALUES (?, 'api_reset', 0, datetime('now'))
      `).run(userId);
    } catch (error) {
      logger.error(`Failed to reset API calls for user ${userId}:`, error);
    }
  }

  getRetryAfterTime() {
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    return Math.ceil((nextHour - new Date()) / 1000);
  }

  async endGracePeriod(userId, limitType) {
    try {
      logger.info(`Grace period ended for user ${userId}, limit type: ${limitType}`);
      
      db.prepare(`
        INSERT INTO audit_log (userId, action, details, timestamp, ip)
        VALUES (?, 'GRACE_PERIOD_ENDED', ?, datetime('now'), ?)
      `).run(userId, JSON.stringify({ limitType }), 'system');
    } catch (error) {
      logger.error(`Failed to end grace period for user ${userId}:`, error);
    }
  }
}

// Create singleton instance
const usageLimitsMiddleware = new UsageLimitsMiddleware();

// Export middleware functions
module.exports = {
  // Usage tracking middleware
  trackStorageUsage: (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();

    const fileSize = parseInt(req.headers['content-length']) || 0;
    
    usageLimitsMiddleware.trackStorageUsage(userId, fileSize)
      .then(result => {
        req.usageTracking = { storage: result };
        next();
      })
      .catch(error => {
        logger.error('Storage usage tracking failed:', error);
        next();
      });
  },

  trackStreamUsage: (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();

    const sessionDuration = parseInt(req.body?.duration) || 0;
    
    usageLimitsMiddleware.trackStreamUsage(userId, sessionDuration)
      .then(result => {
        req.usageTracking = { streams: result };
        next();
      })
      .catch(error => {
        logger.error('Stream usage tracking failed:', error);
        next();
      });
  },

  trackConcurrentUsers: (action = 'increment') => {
    return (req, res, next) => {
      const userId = req.user?.id;
      if (!userId) return next();

      usageLimitsMiddleware.trackConcurrentUsers(userId, action)
        .then(result => {
          req.usageTracking = { concurrentUsers: result };
          next();
        })
        .catch(error => {
          logger.error('Concurrent users tracking failed:', error);
          next();
        });
    };
  },

  trackAPIUsage: (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();

    const endpoint = req.path;
    
    usageLimitsMiddleware.trackAPIUsage(userId, endpoint)
      .then(result => {
        req.usageTracking = { apiCalls: result };
        next();
      })
      .catch(error => {
        logger.error('API usage tracking failed:', error);
        next();
      });
  },

  // Usage limits enforcement middleware
  enforceStorageLimit: async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();

    try {
      const requestedSize = parseInt(req.headers['content-length']) || 0;
      const enforcement = await usageLimitsMiddleware.enforceStorageLimit(userId, requestedSize);
      
      if (!enforcement.allowed) {
        return res.status(413).json({
          success: false,
          error: {
            code: 'STORAGE_LIMIT_EXCEEDED',
            message: enforcement.reason,
            currentUsage: enforcement.currentUsage,
            limit: enforcement.limit,
            requestedSize: enforcement.requestedSize
          }
        });
      }
      
      req.usageLimits = { storage: enforcement };
      next();
    } catch (error) {
      logger.error('Storage limit enforcement failed:', error);
      next();
    }
  },

  enforceStreamLimit: async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();

    try {
      const enforcement = await usageLimitsMiddleware.enforceStreamLimit(userId);
      
      if (!enforcement.allowed) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'STREAM_LIMIT_EXCEEDED',
            message: enforcement.reason,
            currentStreams: enforcement.currentStreams,
            limit: enforcement.limit
          }
        });
      }
      
      req.usageLimits = { streams: enforcement };
      next();
    } catch (error) {
      logger.error('Stream limit enforcement failed:', error);
      next();
    }
  },

  enforceConcurrentUserLimit: async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();

    try {
      const enforcement = await usageLimitsMiddleware.enforceConcurrentUserLimit(userId);
      
      if (!enforcement.allowed) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'CONCURRENT_USER_LIMIT_EXCEEDED',
            message: enforcement.reason,
            currentUsers: enforcement.currentUsers,
            limit: enforcement.limit
          }
        });
      }
      
      req.usageLimits = { concurrentUsers: enforcement };
      next();
    } catch (error) {
      logger.error('Concurrent user limit enforcement failed:', error);
      next();
    }
  },

  enforceAPIRateLimit: async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();

    try {
      const enforcement = await usageLimitsMiddleware.enforceAPIRateLimit(userId);
      
      if (!enforcement.allowed) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'API_RATE_LIMIT_EXCEEDED',
            message: enforcement.reason,
            currentCalls: enforcement.currentCalls,
            limit: enforcement.limit,
            retryAfter: enforcement.retryAfter
          },
          headers: {
            'Retry-After': enforcement.retryAfter
          }
        });
      }
      
      req.usageLimits = { apiCalls: enforcement };
      next();
    } catch (error) {
      logger.error('API rate limit enforcement failed:', error);
      next();
    }
  },

  // Real-time usage monitoring
  getCurrentUsage: (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    usageLimitsMiddleware.getCurrentUsage(userId)
      .then(usage => {
        res.json({
          success: true,
          data: usage
        });
      })
      .catch(error => {
        logger.error('Failed to get current usage:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get usage data'
        });
      });
  },

  getUsagePercentage: (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    usageLimitsMiddleware.getUsagePercentage(userId)
      .then(percentage => {
        res.json({
          success: true,
          data: percentage
        });
      })
      .catch(error => {
        logger.error('Failed to get usage percentage:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get usage percentage'
        });
      });
  },

  getUsageHistory: (req, res) => {
    const userId = req.user?.id;
    const days = parseInt(req.query.days) || 30;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    usageLimitsMiddleware.getUsageHistory(userId, days)
      .then(history => {
        res.json(history);
      })
      .catch(error => {
        logger.error('Failed to get usage history:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get usage history'
        });
      });
  },

  // Graceful degradation
  handleOverLimit: async (req, res) => {
    const userId = req.user?.id;
    const { limitType, limitValue } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    try {
      const result = await usageLimitsMiddleware.handleOverLimit(userId, limitType, limitValue);
      res.json(result);
    } catch (error) {
      logger.error('Failed to handle over-limit:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to handle over-limit'
      });
    }
  },

  suggestUpgrade: async (req, res) => {
    const userId = req.user?.id;
    const { currentLimit, limitType } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    try {
      const result = await usageLimitsMiddleware.suggestUpgrade(userId, currentLimit, limitType);
      res.json(result);
    } catch (error) {
      logger.error('Failed to suggest upgrade:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to suggest upgrade'
      });
    }
  }
};