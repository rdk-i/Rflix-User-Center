const db = require('../config/database');
const logger = require('../utils/logger');

class ConfigController {
  /**
   * Get captcha provider configuration
   */
  getCaptchaProvider(req, res, next) {
    try {
      const provider = process.env.CAPTCHA_PROVIDER || 'turnstile';
      
      res.json({
        success: true,
        data: {
          provider,
        },
      });
    } catch (error) {
      logger.error('Get captcha provider error:', error);
      next(error);
    }
  }

  /**
   * Get captcha site key (public)
   */
  getCaptchaSiteKey(req, res, next) {
    try {
      const provider = process.env.CAPTCHA_PROVIDER || 'turnstile';
      let siteKey;

      if (provider === 'turnstile' || provider === 'cloudflare') {
        siteKey = process.env.TURNSTILE_SITE_KEY;
      } else if (provider === 'recaptcha' || provider === 'google') {
        siteKey = process.env.RECAPTCHA_SITE_KEY;
      }

      res.json({
        success: true,
        data: {
          siteKey: siteKey || '',
        },
      });
    } catch (error) {
      logger.error('Get captcha site key error:', error);
      next(error);
    }
  }
}

module.exports = new ConfigController();
