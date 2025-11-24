const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

class AuthService {
  constructor() {
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    this.jwtSecret = process.env.JWT_SECRET;
    this.accessExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshExpiry = process.env.JWT_REFRESH_EXPIRY || '30d';
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password) {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        jellyfinUserId: user.jellyfinUserId,
      },
      this.jwtSecret,
      { expiresIn: this.accessExpiry }
    );
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        type: 'refresh',
      },
      this.jwtSecret,
      { expiresIn: this.refreshExpiry }
    );
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      logger.error('Token verification failed:', error.message);
      return null;
    }
  }

  /**
   * Blacklist token (for logout)
   */
  blacklistToken(token) {
    try {
      const decoded = this.verifyToken(token);
      if (!decoded) return false;

      const expiresAt = new Date(decoded.exp * 1000);
      
      const stmt = db.prepare(`
        INSERT INTO token_blacklist (token, expiresAt)
        VALUES (?, ?)
      `);
      stmt.run(token, expiresAt.toISOString());
      
      return true;
    } catch (error) {
      logger.error('Failed to blacklist token:', error);
      return false;
    }
  }

  /**
   * Check if token is blacklisted
   */
  isTokenBlacklisted(token) {
    try {
      const result = db.prepare('SELECT * FROM token_blacklist WHERE token = ?').get(token);
      return !!result;
    } catch (error) {
      logger.error('Failed to check token blacklist:', error);
      return false;
    }
  }

  /**
   * Clean expired tokens from blacklist
   */
  cleanExpiredBlacklist() {
    try {
      const stmt = db.prepare(`DELETE FROM token_blacklist WHERE expiresAt < datetime('now')`);
      const result = stmt.run();
      logger.info(`Cleaned ${result.changes} expired tokens from blacklist`);
      return result.changes;
    } catch (error) {
      logger.error('Failed to clean token blacklist:', error);
      return 0;
    }
  }

  /**
   * Authenticate user by email and password
   */
  async authenticateUser(email, password) {
    try {
      const user = db.prepare('SELECT * FROM api_users WHERE email = ?').get(email);
      
      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }

      const isValid = await this.comparePassword(password, user.password_hash);
      
      if (!isValid) {
        return { success: false, error: 'Invalid credentials' };
      }

      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          jellyfinUserId: user.jellyfinUserId,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken);
      
      if (!decoded || decoded.type !== 'refresh') {
        return { success: false, error: 'Invalid refresh token' };
      }

      const user = db.prepare('SELECT * FROM api_users WHERE id = ?').get(decoded.id);
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const accessToken = this.generateAccessToken(user);

      return {
        success: true,
        accessToken,
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      return { success: false, error: 'Token refresh failed' };
    }
  }
}

module.exports = new AuthService();
