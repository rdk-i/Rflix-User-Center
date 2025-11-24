const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Middleware to verify JWT token and attach user to request
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NO_TOKEN',
        message: 'Access token required',
      },
    });
  }

  // Check if token is blacklisted
  try {
    const blacklisted = db.prepare('SELECT * FROM token_blacklist WHERE token = ?').get(token);
    if (blacklisted) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_BLACKLISTED',
          message: 'Token has been revoked',
        },
      });
    }
  } catch (error) {
    logger.error('Error checking token blacklist:', error);
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
        },
      });
    }

    req.user = user;
    next();
  });
}

/**
 * Middleware to check if user is admin
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
  }
  next();
}

/**
 * Middleware to check if user has required permissions
 */
function authorize(requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Get user roles and permissions
    try {
      const userRoles = db.prepare(`
        SELECT r.permissions 
        FROM user_roles ur 
        JOIN roles r ON ur.roleId = r.id 
        WHERE ur.userId = ?
      `).all(req.user.id);

      const userPermissions = new Set();
      userRoles.forEach(role => {
        const permissions = JSON.parse(role.permissions);
        permissions.forEach(p => userPermissions.add(p));
      });

      const hasPermission = requiredPermissions.every(p => userPermissions.has(p));

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'You do not have permission to perform this action',
          },
        });
      }

      next();
    } catch (error) {
      logger.error('Error checking permissions:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'PERMISSION_CHECK_FAILED',
          message: 'Failed to verify permissions',
        },
      });
    }
  };
}

module.exports = {
  authenticateToken,
  requireAdmin,
  authorize,
};
