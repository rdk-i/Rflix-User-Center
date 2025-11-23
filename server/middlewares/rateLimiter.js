const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const db = require('../config/database');

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    
    // Log to audit_log
    try {
      const stmt = db.prepare(`
        INSERT INTO audit_log (action, details, timestamp, ip, userAgent)
        VALUES (?, ?, datetime('now'), ?, ?)
      `);
      stmt.run('RATE_LIMIT', JSON.stringify({ path: req.path }), req.ip, req.get('user-agent'));
    } catch (error) {
      logger.error('Failed to log rate limit:', error);
    }

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
      },
    });
  },
});

// Login-specific rate limiter
const loginLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX) || 5,
  message: {
    success: false,
    error: {
      code: 'LOGIN_RATE_LIMIT',
      message: 'Too many login attempts, please try again in a minute.',
    },
  },
  skipSuccessfulRequests: true,
});

// Admin-specific rate limiter
const adminLimiter = rateLimit({
  windowMs: 60000,
  max: parseInt(process.env.RATE_LIMIT_ADMIN_MAX) || 50,
  message: {
    success: false,
    error: {
      code: 'ADMIN_RATE_LIMIT',
      message: 'Too many admin requests, please slow down.',
    },
  },
});

// Registration rate limiter
const registrationLimiter = rateLimit({
  windowMs: 900000, // 15 minutes
  max: 20,
  message: {
    success: false,
    error: {
      code: 'REGISTRATION_RATE_LIMIT',
      message: 'Too many registration attempts from this IP.',
    },
  },
});

module.exports = {
  globalLimiter,
  loginLimiter,
  adminLimiter,
  registrationLimiter,
};
