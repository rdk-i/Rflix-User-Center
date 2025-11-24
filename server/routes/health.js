const express = require('express');
const router = express.Router();
const jellyfinService = require('../services/jellyfinService');
const emailService = require('../services/emailService');
const telegramService = require('../services/telegramService');
const captchaService = require('../services/captchaService');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Health check endpoint for monitoring service status
 */
router.get('/', async (req, res) => {
  try {
    const healthChecks = await Promise.allSettled([
      checkDatabaseHealth(),
      checkJellyfinHealth(),
      checkEmailHealth(),
      checkTelegramHealth(),
      checkCaptchaHealth()
    ]);

    const results = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      services: {
        database: healthChecks[0],
        jellyfin: healthChecks[1],
        email: healthChecks[2],
        telegram: healthChecks[3],
        captcha: healthChecks[4]
      }
    };

    // Determine overall status
    const failedServices = Object.values(results.services).filter(
      service => service.status === 'rejected' || (service.value && service.value.status === 'unhealthy')
    );

    if (failedServices.length > 0) {
      results.status = 'degraded';
      results.failedServices = failedServices.length;
    }

    // Return appropriate status code
    const statusCode = results.status === 'healthy' ? 200 : 503;

    logger.info('Health check completed', {
      status: results.status,
      failedServices: failedServices.length,
      responseTime: Date.now() - req.startTime
    });

    res.status(statusCode).json(results);
  } catch (error) {
    logger.error('Health check endpoint error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Detailed service health information
 */
router.get('/detailed', async (req, res) => {
  try {
    const startTime = Date.now();
    
    const healthData = {
      timestamp: new Date().toISOString(),
      services: {
        jellyfin: jellyfinService.getHealthStatus(),
        email: emailService.getHealthStatus(),
        telegram: getTelegramHealth(),
        captcha: getCaptchaHealth(),
        database: getDatabaseHealth()
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      }
    };

    const duration = Date.now() - startTime;
    healthData.responseTime = duration;

    logger.info('Detailed health check completed', {
      responseTime: duration,
      servicesChecked: Object.keys(healthData.services).length
    });

    res.json(healthData);
  } catch (error) {
    logger.error('Detailed health check error:', error);
    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

/**
 * Force health check refresh for specific services
 */
router.post('/refresh', async (req, res) => {
  try {
    const { services } = req.body;
    const results = {};

    if (!services || services.length === 0) {
      return res.status(400).json({
        error: 'Services array is required'
      });
    }

    for (const service of services) {
      try {
        switch (service) {
          case 'jellyfin':
            results.jellyfin = await jellyfinService.performHealthCheck();
            break;
          case 'email':
            results.email = await emailService.verifyConnection();
            break;
          case 'telegram':
            // Telegram health check - try to get bot info
            if (process.env.TELEGRAM_BOT_TOKEN) {
              const axios = require('axios');
              const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`, { timeout: 5000 });
              results.telegram = { healthy: response.data.ok, botName: response.data.result?.username };
            } else {
              results.telegram = { healthy: false, reason: 'Not configured' };
            }
            break;
          case 'captcha':
            // Test CAPTCHA services with dummy request
            results.captcha = await testCaptchaServices();
            break;
          case 'database':
            const dbStart = Date.now();
            db.prepare('SELECT 1').get();
            results.database = { healthy: true, responseTime: Date.now() - dbStart };
            break;
          default:
            results[service] = { error: 'Unknown service' };
        }
      } catch (error) {
        results[service] = { 
          healthy: false, 
          error: error.message,
          code: error.code 
        };
      }
    }

    logger.info('Health check refresh completed', {
      servicesRefreshed: services,
      results: Object.keys(results)
    });

    res.json({
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error) {
    logger.error('Health refresh error:', error);
    res.status(500).json({
      error: 'Refresh failed',
      message: error.message
    });
  }
});

// Helper functions
async function checkDatabaseHealth() {
  try {
    const startTime = Date.now();
    db.prepare('SELECT 1').get();
    const duration = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime: duration,
      message: 'Database connection OK'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      code: error.code
    };
  }
}

async function checkJellyfinHealth() {
  try {
    const healthStatus = jellyfinService.getHealthStatus();
    return {
      status: healthStatus.status === 'healthy' ? 'healthy' : 'unhealthy',
      details: healthStatus
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

async function checkEmailHealth() {
  try {
    const healthStatus = emailService.getHealthStatus();
    return {
      status: healthStatus.status === 'healthy' ? 'healthy' : 'unhealthy',
      details: healthStatus
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

function getTelegramHealth() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return {
    status: token ? 'configured' : 'not_configured',
    configured: !!token
  };
}

function getCaptchaHealth() {
  const turnstileKey = process.env.TURNSTILE_SECRET_KEY;
  const recaptchaKey = process.env.RECAPTCHA_SECRET;
  
  return {
    status: (turnstileKey || recaptchaKey) ? 'configured' : 'not_configured',
    providers: {
      turnstile: !!turnstileKey,
      recaptcha: !!recaptchaKey
    }
  };
}

function getDatabaseHealth() {
  try {
    const startTime = Date.now();
    db.prepare('SELECT 1').get();
    const duration = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime: duration,
      message: 'Database connection OK'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

async function testCaptchaServices() {
  const results = {};
  
  if (process.env.TURNSTILE_SECRET_KEY) {
    try {
      const axios = require('axios');
      // Test with dummy token to check service availability
      const response = await axios.post(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        { secret: process.env.TURNSTILE_SECRET_KEY, response: 'dummy' },
        { timeout: 5000 }
      );
      results.turnstile = { healthy: true, status: response.status };
    } catch (error) {
      results.turnstile = { healthy: false, error: error.message };
    }
  }
  
  if (process.env.RECAPTCHA_SECRET) {
    try {
      const axios = require('axios');
      const response = await axios.post(
        'https://www.google.com/recaptcha/api/siteverify',
        null,
        { 
          params: { secret: process.env.RECAPTCHA_SECRET, response: 'dummy' },
          timeout: 5000 
        }
      );
      results.recaptcha = { healthy: true, status: response.status };
    } catch (error) {
      results.recaptcha = { healthy: false, error: error.message };
    }
  }
  
  return results;
}

module.exports = router;