const axios = require('axios');
const logger = require('../utils/logger');

class CaptchaService {
  /**
   * Verify captcha token based on provider
   */
  async verify(provider, token) {
    if (provider === 'none') {
      return { success: true };
    }

    if (provider === 'turnstile' || provider === 'cloudflare') {
      return this.verifyTurnstile(token);
    }

    if (provider === 'recaptcha' || provider === 'google') {
      return this.verifyRecaptcha(token);
    }

    throw new Error(`Unknown captcha provider: ${provider}`);
  }

  /**
   * Verify Cloudflare Turnstile token
   */
  async verifyTurnstile(token) {
    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    
    if (!secretKey) {
      logger.error('TURNSTILE_SECRET_KEY not configured');
      return { success: false, error: 'Captcha not configured' };
    }

    try {
      const response = await axios.post(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          secret: secretKey,
          response: token,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
        }
      );

      if (response.data.success) {
        return { success: true };
      } else {
        logger.warn('Turnstile verification failed:', response.data['error-codes']);
        return {
          success: false,
          error: 'Captcha verification failed',
          codes: response.data['error-codes'],
        };
      }
    } catch (error) {
      logger.error('Turnstile verification error:', error.message);
      return {
        success: false,
        error: 'Captcha verification service unavailable',
      };
    }
  }

  /**
   * Verify Google reCAPTCHA token
   */
  async verifyRecaptcha(token) {
    const secretKey = process.env.RECAPTCHA_SECRET;
    
    if (!secretKey) {
      logger.error('RECAPTCHA_SECRET not configured');
      return { success: false, error: 'Captcha not configured' };
    }

    try {
      const response = await axios.post(
        'https://www.google.com/recaptcha/api/siteverify',
        null,
        {
          params: {
            secret: secretKey,
            response: token,
          },
          timeout: 5000,
        }
      );

      if (response.data.success) {
        return { success: true, score: response.data.score };
      } else {
        logger.warn('reCAPTCHA verification failed:', response.data['error-codes']);
        return {
          success: false,
          error: 'Captcha verification failed',
          codes: response.data['error-codes'],
        };
      }
    } catch (error) {
      logger.error('reCAPTCHA verification error:', error.message);
      return {
        success: false,
        error: 'Captcha verification service unavailable',
      };
    }
  }
}

module.exports = new CaptchaService();
