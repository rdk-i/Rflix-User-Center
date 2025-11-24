const express = require('express');
const router = express.Router();
const db = require('../config/database');
const usageLimits = require('../middlewares/usageLimits');
const auth = require('../middlewares/auth');
const auditLogger = require('../middlewares/auditLogger');
const logger = require('../utils/logger');

/**
 * Usage Limits API Routes
 * Provides endpoints for usage monitoring and management
 */

// Public health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'usage-limits',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// Get current usage statistics (authenticated)
router.get('/current', auth, usageLimits.getCurrentUsage);

// Get usage percentage breakdown (authenticated)
router.get('/percentage', auth, usageLimits.getUsagePercentage);

// Get usage history (authenticated)
router.get('/history', auth, usageLimits.getUsageHistory);

// Get usage dashboard data (authenticated)
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const dashboardData = db.prepare(`
      SELECT 
        u.email,
        ue.packageId,
        p.name as packageName,
        ut.storage_used,
        ut.streams_active,
        ut.concurrent_users,
        ut.api_calls,
        ut.stream_duration,
        st.storage_limit,
        st.streams_limit,
        st.concurrent_users_limit,
        st.api_calls_limit,
        st.stream_duration_limit,
        CAST(ut.storage_used AS REAL) / st.storage_limit * 100 as storage_percentage,
        CAST(ut.streams_active AS REAL) / st.streams_limit * 100 as streams_percentage,
        CAST(ut.concurrent_users AS REAL) / st.concurrent_users_limit * 100 as concurrent_users_percentage,
        CAST(ut.api_calls AS REAL) / st.api_calls_limit * 100 as api_calls_percentage,
        CAST(ut.stream_duration AS REAL) / st.stream_duration_limit * 100 as stream_duration_percentage,
        uv.violations_count,
        ue.last_violation,
        ue.is_throttled
      FROM api_users u
      LEFT JOIN user_expiration ue ON u.id = ue.userId
      LEFT JOIN packages p ON ue.packageId = p.id
      LEFT JOIN usage_tracking ut ON u.id = ut.userId
      LEFT JOIN subscription_tiers st ON 
        CASE 
          WHEN p.name IN ('1 Month') THEN st.tier_name = 'basic'
          WHEN p.name IN ('3 Months', '6 Months') THEN st.tier_name = 'premium'
          WHEN p.name IN ('12 Months') THEN st.tier_name = 'enterprise'
          ELSE st.tier_name = 'basic'
        END
      LEFT JOIN (
        SELECT userId, COUNT(*) as violations_count
        FROM usage_violations
        WHERE is_resolved = 0
        GROUP BY userId
      ) uv ON u.id = uv.userId
      WHERE u.id = ? AND ue.isActive = 1
    `).get(userId);

    if (!dashboardData) {
      return res.status(404).json({
        success: false,
        error: 'User subscription data not found'
      });
    }

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error('Failed to get usage dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage dashboard data'
    });
  }
});

// Check usage threshold (authenticated)
router.post('/check-threshold', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { threshold = 80 } = req.body;
    
    const thresholdExceeded = await usageLimits.checkUsageThreshold(userId, threshold);
    
    res.json({
      success: true,
      data: {
        thresholdExceeded,
        threshold
      }
    });
  } catch (error) {
    logger.error('Failed to check usage threshold:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check usage threshold'
    });
  }
});

// Handle over-limit situation (authenticated)
router.post('/handle-over-limit', auth, usageLimits.handleOverLimit, auditLogger('HANDLE_OVER_LIMIT'));

// Suggest upgrade (authenticated)
router.post('/suggest-upgrade', auth, usageLimits.suggestUpgrade, auditLogger('SUGGEST_UPGRADE'));

// Admin routes for managing usage limits

// Get all users with usage data (admin only)
router.get('/admin/users', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = db.prepare('SELECT isAdmin FROM api_users WHERE id = ?').get(req.user.id);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const users = db.prepare(`
      SELECT 
        u.id,
        u.email,
        u.username,
        ue.packageId,
        p.name as packageName,
        ut.storage_used,
        ut.streams_active,
        ut.concurrent_users,
        ut.api_calls,
        ut.stream_duration,
        st.storage_limit,
        st.streams_limit,
        st.concurrent_users_limit,
        st.api_calls_limit,
        st.stream_duration_limit,
        CAST(ut.storage_used AS REAL) / st.storage_limit * 100 as storage_percentage,
        CAST(ut.streams_active AS REAL) / st.streams_limit * 100 as streams_percentage,
        CAST(ut.concurrent_users AS REAL) / st.concurrent_users_limit * 100 as concurrent_users_percentage,
        CAST(ut.api_calls AS REAL) / st.api_calls_limit * 100 as api_calls_percentage,
        uv.violations_count,
        ue.last_violation,
        ue.is_throttled,
        ue.isActive as subscription_active
      FROM api_users u
      LEFT JOIN user_expiration ue ON u.id = ue.userId
      LEFT JOIN packages p ON ue.packageId = p.id
      LEFT JOIN usage_tracking ut ON u.id = ut.userId
      LEFT JOIN subscription_tiers st ON 
        CASE 
          WHEN p.name IN ('1 Month') THEN st.tier_name = 'basic'
          WHEN p.name IN ('3 Months', '6 Months') THEN st.tier_name = 'premium'
          WHEN p.name IN ('12 Months') THEN st.tier_name = 'enterprise'
          ELSE st.tier_name = 'basic'
        END
      LEFT JOIN (
        SELECT userId, COUNT(*) as violations_count
        FROM usage_violations
        WHERE is_resolved = 0
        GROUP BY userId
      ) uv ON u.id = uv.userId
      ORDER BY u.created_at DESC
    `).all();

    res.json({
      success: true,
      data: users,
      total: users.length
    });
  } catch (error) {
    logger.error('Failed to get users usage data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get users usage data'
    });
  }
});

// Get usage violations (admin only)
router.get('/admin/violations', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT isAdmin FROM api_users WHERE id = ?').get(req.user.id);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { resolved = 'false', userId, limit = 50 } = req.query;
    
    let query = `
      SELECT 
        uv.*,
        u.email,
        u.username
      FROM usage_violations uv
      JOIN api_users u ON uv.userId = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (resolved !== 'all') {
      query += ' AND uv.is_resolved = ?';
      params.push(resolved === 'true' ? 1 : 0);
    }
    
    if (userId) {
      query += ' AND uv.userId = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY uv.violation_timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    const violations = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: violations,
      total: violations.length
    });
  } catch (error) {
    logger.error('Failed to get usage violations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage violations'
    });
  }
});

// Resolve usage violation (admin only)
router.patch('/admin/violations/:id/resolve', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT isAdmin FROM api_users WHERE id = ?').get(req.user.id);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const violationId = req.params.id;
    const { resolutionNotes = '' } = req.body;

    const result = db.prepare(`
      UPDATE usage_violations 
      SET is_resolved = 1, 
          resolution_timestamp = datetime('now'),
          resolution_notes = ?
      WHERE id = ?
    `).run(resolutionNotes, violationId);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Violation not found'
      });
    }

    res.json({
      success: true,
      message: 'Violation resolved successfully'
    });
  } catch (error) {
    logger.error('Failed to resolve violation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve violation'
    });
  }
});

// Update custom usage limits for a user (admin only)
router.patch('/admin/users/:userId/limits', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT isAdmin FROM api_users WHERE id = ?').get(req.user.id);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const userId = req.params.userId;
    const {
      storage_limit,
      streams_limit,
      concurrent_users_limit,
      api_calls_limit,
      stream_duration_limit,
      grace_period,
      throttle_delay
    } = req.body;

    // Check if custom limits already exist
    const existing = db.prepare('SELECT id FROM usage_limits WHERE userId = ?').get(userId);
    
    if (existing) {
      // Update existing limits
      db.prepare(`
        UPDATE usage_limits 
        SET storage_limit = ?,
            streams_limit = ?,
            concurrent_users_limit = ?,
            api_calls_limit = ?,
            stream_duration_limit = ?,
            grace_period = ?,
            throttle_delay = ?,
            updated_at = datetime('now')
        WHERE userId = ?
      `).run(
        storage_limit,
        streams_limit,
        concurrent_users_limit,
        api_calls_limit,
        stream_duration_limit,
        grace_period,
        throttle_delay,
        userId
      );
    } else {
      // Insert new limits
      db.prepare(`
        INSERT INTO usage_limits 
        (userId, storage_limit, streams_limit, concurrent_users_limit, api_calls_limit, 
         stream_duration_limit, grace_period, throttle_delay)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        storage_limit,
        streams_limit,
        concurrent_users_limit,
        api_calls_limit,
        stream_duration_limit,
        grace_period,
        throttle_delay
      );
    }

    res.json({
      success: true,
      message: 'Custom usage limits updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update custom limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update custom usage limits'
    });
  }
});

// Reset user usage statistics (admin only)
router.post('/admin/users/:userId/reset-usage', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT isAdmin FROM api_users WHERE id = ?').get(req.user.id);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const userId = req.params.userId;
    const { resetType = 'all' } = req.body;
    
    // Start transaction
    db.prepare('BEGIN TRANSACTION').run();
    
    try {
      if (resetType === 'all' || resetType === 'storage') {
        db.prepare('UPDATE usage_tracking SET storage_used = 0 WHERE userId = ?').run(userId);
      }
      
      if (resetType === 'all' || resetType === 'streams') {
        db.prepare('UPDATE usage_tracking SET streams_active = 0, stream_duration = 0 WHERE userId = ?').run(userId);
      }
      
      if (resetType === 'all' || resetType === 'api_calls') {
        db.prepare('UPDATE usage_tracking SET api_calls = 0 WHERE userId = ?').run(userId);
      }
      
      if (resetType === 'all' || resetType === 'concurrent_users') {
        db.prepare('UPDATE usage_tracking SET concurrent_users = 0 WHERE userId = ?').run(userId);
      }
      
      if (resetType === 'all') {
        db.prepare('UPDATE usage_tracking SET last_updated = datetime("now") WHERE userId = ?').run(userId);
      }
      
      // Log the reset action
      db.prepare(`
        INSERT INTO audit_log (adminId, action, targetUserId, details, timestamp, ip)
        VALUES (?, 'USAGE_RESET', ?, ?, datetime('now'), ?)
      `).run(req.user.id, userId, JSON.stringify({ resetType }), req.ip);
      
      db.prepare('COMMIT').run();
      
      res.json({
        success: true,
        message: `Usage statistics reset successfully for ${resetType}`
      });
    } catch (error) {
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    logger.error('Failed to reset user usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset user usage statistics'
    });
  }
});

// Get usage analytics (admin only)
router.get('/admin/analytics', auth, async (req, res) => {
  try {
    const user = db.prepare('SELECT isAdmin FROM api_users WHERE id = ?').get(req.user.id);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { days = 30, userId } = req.query;
    
    let query = `
      SELECT 
        date,
        SUM(total_storage) as total_storage,
        SUM(total_streams) as total_streams,
        SUM(total_api_calls) as total_api_calls,
        SUM(total_stream_duration) as total_stream_duration,
        SUM(violations_count) as total_violations,
        COUNT(DISTINCT userId) as active_users
      FROM usage_analytics
      WHERE date >= date('now', '-' || ? || ' days')
    `;
    
    const params = [days];
    
    if (userId) {
      query += ' AND userId = ?';
      params.push(userId);
    }
    
    query += ' GROUP BY date ORDER BY date DESC';

    const analytics = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: analytics,
      period: `${days} days`
    });
  } catch (error) {
    logger.error('Failed to get usage analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage analytics'
    });
  }
});

module.exports = router;