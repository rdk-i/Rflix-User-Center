const axios = require('axios');
const CircuitBreaker = require('opossum');
const logger = require('../utils/logger');

class JellyfinService {
  constructor() {
    this.baseUrl = process.env.JELLYFIN_URL;
    this.apiKey = process.env.JELLYFIN_API_KEY;
    this.isConfigured = !!(this.baseUrl && this.apiKey);

    if (!this.isConfigured) {
      logger.warn('Jellyfin service not configured. Some features will be unavailable until setup is complete.');
    }

    // Axios instance with default config
    this.client = axios.create({
      baseURL: this.baseUrl || 'http://localhost', // Placeholder to prevent crash
      headers: {
        'X-Emby-Token': this.apiKey || '',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // Circuit breaker configuration
    const breakerOptions = {
      timeout: 10000, // 10 seconds
      errorThresholdPercentage: 50,
      resetTimeout: 30000, // 30 seconds
    };

    // Wrap axios requests in circuit breaker
    this.breaker = new CircuitBreaker(this._makeRequest.bind(this), breakerOptions);

    // Circuit breaker event listeners
    this.breaker.on('open', () => logger.warn('Jellyfin circuit breaker opened'));
    this.breaker.on('halfOpen', () => logger.info('Jellyfin circuit breaker half-open'));
    this.breaker.on('close', () => logger.info('Jellyfin circuit breaker closed'));
  }

  async _makeRequest(config) {
    if (!this.isConfigured) {
      throw new Error('Jellyfin service is not configured. Please complete the setup wizard.');
    }

    try {
      const response = await this.client(config);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error('Jellyfin API error:', error.message);
      throw this._mapError(error);
    }
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
