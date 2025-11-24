const axios = require('axios');
const CircuitBreaker = require('opossum');
const logger = require('../utils/logger');

class JellyfinService {
  constructor() {
    this.baseUrl = process.env.JELLYFIN_URL;
    this.apiKey = process.env.JELLYFIN_API_KEY;
    this.isConfigured = !!(this.baseUrl && this.apiKey);
    this.healthStatus = 'unknown';
    this.lastHealthCheck = null;
    this.failedRequests = 0;
    this.totalRequests = 0;

    if (!this.isConfigured) {
      logger.warn('Jellyfin service not configured. Some features will be unavailable until setup is complete.');
      this.healthStatus = 'not_configured';
    }

    // Enhanced axios instance with better error handling
    this.client = axios.create({
      baseURL: this.baseUrl || 'http://localhost', // Placeholder to prevent crash
      headers: {
        'X-Emby-Token': this.apiKey || '',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
      // Add retry configuration
      retries: 3,
      retryDelay: 1000,
    });

    // Add request/response interceptors for better logging
    this.client.interceptors.request.use(
      (config) => {
        this.totalRequests++;
        config.metadata = { startTime: Date.now() };
        logger.debug(`Jellyfin API request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Jellyfin request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        logger.debug(`Jellyfin API response: ${response.status} in ${duration}ms`);
        return response;
      },
      (error) => {
        this.failedRequests++;
        const duration = error.config?.metadata?.startTime ? Date.now() - error.config.metadata.startTime : 0;
        logger.error(`Jellyfin API error: ${error.response?.status || 'NETWORK'} in ${duration}ms`, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(error);
      }
    );

    // Enhanced circuit breaker configuration
    const breakerOptions = {
      timeout: 10000, // 10 seconds
      errorThresholdPercentage: 50,
      resetTimeout: 30000, // 30 seconds
      volumeThreshold: 5, // Minimum requests before circuit opens
      resetTimeout: 30000,
      enableVolumeThreshold: true,
    };

    // Wrap axios requests in circuit breaker
    this.breaker = new CircuitBreaker(this._makeRequest.bind(this), breakerOptions);

    // Enhanced circuit breaker event listeners
    this.breaker.on('open', () => {
      this.healthStatus = 'degraded';
      logger.warn('Jellyfin circuit breaker opened', {
        failedRequests: this.failedRequests,
        totalRequests: this.totalRequests,
        failureRate: (this.failedRequests / this.totalRequests * 100).toFixed(2) + '%'
      });
    });
    
    this.breaker.on('halfOpen', () => {
      logger.info('Jellyfin circuit breaker half-open', {
        failedRequests: this.failedRequests,
        totalRequests: this.totalRequests
      });
    });
    
    this.breaker.on('close', () => {
      this.healthStatus = 'healthy';
      logger.info('Jellyfin circuit breaker closed', {
        failedRequests: this.failedRequests,
        totalRequests: this.totalRequests
      });
    });

    // Initial health check
    if (this.isConfigured) {
      this.performHealthCheck().catch(err =>
        logger.warn('Initial Jellyfin health check failed:', err.message)
      );
    }
  }

  /**
   * Health check method to validate Jellyfin connectivity
   */
  async performHealthCheck() {
    if (!this.isConfigured) {
      this.healthStatus = 'not_configured';
      return { healthy: false, reason: 'Service not configured' };
    }

    try {
      const startTime = Date.now();
      const response = await this.client.get('/System/Info/Public', { timeout: 5000 });
      const duration = Date.now() - startTime;
      
      this.healthStatus = 'healthy';
      this.lastHealthCheck = new Date();
      
      logger.info(`Jellyfin health check passed in ${duration}ms`, {
        serverName: response.data?.ServerName,
        version: response.data?.Version,
        responseTime: duration
      });
      
      return { healthy: true, responseTime: duration, info: response.data };
    } catch (error) {
      this.healthStatus = 'unhealthy';
      this.lastHealthCheck = new Date();
      
      logger.error('Jellyfin health check failed:', {
        error: error.message,
        code: error.code,
        status: error.response?.status,
        url: this.baseUrl
      });
      
      return { healthy: false, error: error.message, code: error.code };
    }
  }

  /**
   * Get current service health status
   */
  getHealthStatus() {
    return {
      status: this.healthStatus,
      lastCheck: this.lastHealthCheck,
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      failureRate: this.totalRequests > 0 ? (this.failedRequests / this.totalRequests * 100).toFixed(2) + '%' : '0%',
      isConfigured: this.isConfigured,
      circuitBreaker: {
        state: this.breaker.opened ? 'open' : this.breaker.halfOpen ? 'half-open' : 'closed',
        stats: this.breaker.stats
      }
    };
  }

  async _makeRequest(config) {
    if (!this.isConfigured) {
      logger.warn('Jellyfin request attempted but service not configured');
      throw new Error('Jellyfin service is not configured. Please complete the setup wizard.');
    }

    // Add retry logic with exponential backoff
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client(config);
        
        // Reset failed requests counter on success
        if (attempt > 1) {
          logger.info(`Jellyfin request succeeded on attempt ${attempt}`, {
            url: config.url,
            method: config.method
          });
        }
        
        return {
          success: true,
          data: response.data,
          attempt: attempt
        };
      } catch (error) {
        lastError = error;
        
        // Log retry attempt
        logger.warn(`Jellyfin request attempt ${attempt} failed:`, {
          url: config.url,
          method: config.method,
          error: error.message,
          code: error.code,
          status: error.response?.status
        });
        
        // Don't retry on certain errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          logger.error('Jellyfin authentication error, not retrying');
          break;
        }
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          logger.error('Jellyfin connection error, not retrying');
          break;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          logger.info(`Retrying Jellyfin request in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error('Jellyfin API failed after all retry attempts:', {
      url: config.url,
      method: config.method,
      attempts: maxRetries,
      finalError: lastError.message
    });
    
    throw this._mapError(lastError);
  }

  _mapError(error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return {
        code: 'JELLYFIN_UNAVAILABLE',
        message: 'Jellyfin server is not available',
        statusCode: 503,
      };
    }
    
    if (error.code === 'ECONNABORTED') {
      return {
        code: 'JELLYFIN_TIMEOUT',
        message: 'Jellyfin server request timeout',
        statusCode: 504,
      };
    }

    if (error.response) {
      if (error.response.status === 401 || error.response.status === 403) {
        return {
          code: 'JELLYFIN_AUTH_FAILURE',
          message: 'Jellyfin authentication failed',
          statusCode: 401,
        };
      }
      return {
        code: 'JELLYFIN_BAD_REQUEST',
        message: error.response.data?.message || 'Jellyfin request failed',
        statusCode: error.response.status,
      };
    }

    return {
      code: 'JELLYFIN_ERROR',
      message: error.message || 'Unknown Jellyfin error',
      statusCode: 500,
    };
  }

  /**
   * Create a new user in Jellyfin
   */
  async createUser(name, password) {
    return this.breaker.fire({
      method: 'POST',
      url: '/Users/New',
      data: { Name: name, Password: password },
    });
  }

  /**
   * Update user password
   */
  async updateUserPassword(userId, newPassword) {
    return this.breaker.fire({
      method: 'POST',
      url: `/Users/${userId}/Password`,
      data: { CurrentPassword: '', NewPassword: newPassword },
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    return this.breaker.fire({
      method: 'GET',
      url: `/Users/${userId}`,
    });
  }

  /**
   * Get all users
   */
  async getAllUsers() {
    return this.breaker.fire({
      method: 'GET',
      url: '/Users',
    });
  }

  /**
   * Update user policy (enable/disable)
   */
  async updateUserPolicy(userId, policy) {
    return this.breaker.fire({
      method: 'POST',
      url: `/Users/${userId}/Policy`,
      data: policy,
    });
  }

  /**
   * Disable user
   */
  async disableUser(userId) {
    return this.updateUserPolicy(userId, { IsDisabled: true });
  }

  /**
   * Enable user
   */
  async enableUser(userId) {
    return this.updateUserPolicy(userId, { IsDisabled: false });
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    return this.breaker.fire({
      method: 'DELETE',
      url: `/Users/${userId}`,
    });
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    return this.breaker.fire({
      method: 'GET',
      url: '/Statistics/Users',
    });
  }

  /**
   * Get playback statistics
   */
  async getPlaybackStats() {
    return this.breaker.fire({
      method: 'GET',
      url: '/Statistics/Playback',
    });
  }

  /**
   * Get user views
   */
  async getUserViews(userId) {
    return this.breaker.fire({
      method: 'GET',
      url: `/Users/${userId}/Views`,
    });
  }

  /**
   * Get item playback info
   */
  async getItemPlaybackInfo(itemId) {
    return this.breaker.fire({
      method: 'GET',
      url: `/Items/${itemId}/PlaybackInfo`,
    });
  }
}

module.exports = new JellyfinService();
