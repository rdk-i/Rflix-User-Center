const authService = require('../services/authService');
const captchaService = require('../services/captchaService');
const db = require('../config/database');
const logger = require('../utils/logger');

class AuthController {
  /**
   * Login endpoint
   */
  async login(req, res, next) {
    try {
      const { email, password, captchaToken, provider } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CREDENTIALS',
            message: 'Email and password are required',
          },
        });
      }

      // Get captcha provider from config
      const captchaProvider = provider || process.env.CAPTCHA_PROVIDER || 'turnstile';

      // Verify captcha if token provided
      if (captchaToken && captchaProvider !== 'none') {
        const captchaResult = await captchaService.verify(captchaProvider, captchaToken);
        
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

      // Authenticate user
      const result = await authService.authenticateUser(email, password);

      if (!result.success) {
        // Log failed login attempt
        db.prepare(`
          INSERT INTO audit_log (action, details, timestamp, ip, userAgent)
          VALUES (?, ?, datetime('now'), ?, ?)
        `).run(
          'LOGIN_FAILED',
          JSON.stringify({ email }),
          req.ip,
          req.get('user-agent') || 'unknown'
        );

        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        });
      }

      // Set refresh token as HttpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Log successful login
      db.prepare(`
        INSERT INTO audit_log (adminId, action, details, timestamp, ip, userAgent)
        VALUES (?, ?, ?, datetime('now'), ?, ?)
      `).run(
        result.user.id,
        'LOGIN_SUCCESS',
        JSON.stringify({ email }),
        req.ip,
        req.get('user-agent') || 'unknown'
      );

      res.json({
        success: true,
        data: {
          user: result.user,
          token: result.accessToken,
        },
      });
    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  }

  /**
   * Refresh token endpoint
   */
  async refresh(req, res, next) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NO_REFRESH_TOKEN',
            message: 'Refresh token required',
          },
        });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      if (!result.success) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: result.error,
          },
        });
      }

      res.json({
        success: true,
        data: {
          token: result.accessToken,
        },
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      next(error);
    }
  }

  /**
   * Logout endpoint
   */
  async logout(req, res, next) {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (token) {
        authService.blacklistToken(token);
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }
}

module.exports = new AuthController();
