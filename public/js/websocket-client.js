/**
 * WebSocket Client for Real-time Subscription Updates
 * Integrates with the subscription dashboard for live data updates
 */

class SubscriptionWebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 5000;
    this.maxReconnectAttempts = 5;
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.subscriptions = new Set();
    this.messageHandlers = new Map();
    
    // Default message handlers
    this.setupDefaultHandlers();
  }

  setupDefaultHandlers() {
    // Subscription updates
    this.on('subscription:created', (data) => {
      console.log('New subscription created:', data);
      this.handleSubscriptionCreated(data);
    });

    this.on('subscription:updated', (data) => {
      console.log('Subscription updated:', data);
      this.handleSubscriptionUpdated(data);
    });

    this.on('subscription:cancelled', (data) => {
      console.log('Subscription cancelled:', data);
      this.handleSubscriptionCancelled(data);
    });

    // Payment updates
    this.on('payment:completed', (data) => {
      console.log('Payment completed:', data);
      this.handlePaymentCompleted(data);
    });

    this.on('payment:failed', (data) => {
      console.log('Payment failed:', data);
      this.handlePaymentFailed(data);
    });

    this.on('payment:refunded', (data) => {
      console.log('Payment refunded:', data);
      this.handlePaymentRefunded(data);
    });

    // Package updates
    this.on('package:created', (data) => {
      console.log('Package created:', data);
      this.handlePackageCreated(data);
    });

    this.on('package:updated', (data) => {
      console.log('Package updated:', data);
      this.handlePackageUpdated(data);
    });

    this.on('package:deleted', (data) => {
      console.log('Package deleted:', data);
      this.handlePackageDeleted(data);
    });

    // Analytics updates
    this.on('analytics:metrics', (data) => {
      console.log('Analytics metrics updated:', data);
      this.handleAnalyticsUpdate(data);
    });

    // System notifications
    this.on('system:notification', (data) => {
      console.log('System notification:', data);
      this.handleSystemNotification(data);
    });

    this.on('system:alert', (data) => {
      console.log('System alert:', data);
      this.handleSystemAlert(data);
    });
  }

  connect(url = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    const wsUrl = url || this.getWebSocketUrl();
    console.log('Connecting to WebSocket:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/subscriptions`;
  }

  setupEventListeners() {
    this.ws.onopen = (event) => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.onConnectionOpen(event);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.onConnectionError(error);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.onConnectionClose(event);
      
      if (!event.wasClean) {
        this.scheduleReconnect();
      }
    };
  }

  handleMessage(data) {
    const { type, payload, timestamp } = data;
    
    if (this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type);
      handlers.forEach(handler => {
        try {
          handler(payload, timestamp);
        } catch (error) {
          console.error(`Error in message handler for ${type}:`, error);
        }
      });
    } else {
      console.warn('No handler registered for message type:', type);
    }
  }

  on(eventType, handler) {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, new Set());
    }
    this.messageHandlers.get(eventType).add(handler);
  }

  off(eventType, handler) {
    if (this.messageHandlers.has(eventType)) {
      this.messageHandlers.get(eventType).delete(handler);
      if (this.messageHandlers.get(eventType).size === 0) {
        this.messageHandlers.delete(eventType);
      }
    }
  }

  send(type, payload) {
    if (!this.isConnected) {
      console.warn('WebSocket not connected, message not sent:', type);
      return false;
    }

    try {
      const message = {
        type,
        payload,
        timestamp: new Date().toISOString()
      };
      
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }

  subscribeToUpdates(updateTypes) {
    if (!Array.isArray(updateTypes)) {
      updateTypes = [updateTypes];
    }

    updateTypes.forEach(type => {
      this.subscriptions.add(type);
      this.send('subscribe', { types: [type] });
    });
  }

  unsubscribeFromUpdates(updateTypes) {
    if (!Array.isArray(updateTypes)) {
      updateTypes = [updateTypes];
    }

    updateTypes.forEach(type => {
      this.subscriptions.delete(type);
      this.send('unsubscribe', { types: [type] });
    });
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.onMaxReconnectAttemptsReached();
      return;
    }

    this.reconnectAttempts++;
    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${this.reconnectInterval}ms`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.isConnected = false;
    this.subscriptions.clear();
  }

  // Event handler methods (can be overridden by implementations)
  onConnectionOpen(event) {
    console.log('Connection opened');
    this.send('auth', { token: this.getAuthToken() });
  }

  onConnectionClose(event) {
    console.log('Connection closed');
  }

  onConnectionError(error) {
    console.error('Connection error:', error);
  }

  onMaxReconnectAttemptsReached() {
    console.error('Maximum reconnection attempts reached');
    this.showConnectionError('Unable to connect to real-time updates. Please refresh the page.');
  }

  // Default message handlers
  handleSubscriptionCreated(data) {
    this.refreshDashboardData('subscriptions');
  }

  handleSubscriptionUpdated(data) {
    this.refreshDashboardData('subscriptions');
  }

  handleSubscriptionCancelled(data) {
    this.refreshDashboardData('subscriptions');
  }

  handlePaymentCompleted(data) {
    this.refreshDashboardData('payments');
  }

  handlePaymentFailed(data) {
    this.refreshDashboardData('payments');
  }

  handlePaymentRefunded(data) {
    this.refreshDashboardData('payments');
  }

  handlePackageCreated(data) {
    this.refreshDashboardData('packages');
  }

  handlePackageUpdated(data) {
    this.refreshDashboardData('packages');
  }

  handlePackageDeleted(data) {
    this.refreshDashboardData('packages');
  }

  handleAnalyticsUpdate(data) {
    this.refreshDashboardData('analytics');
  }

  handleSystemNotification(data) {
    this.showNotification(data.title, data.message, data.type || 'info');
  }

  handleSystemAlert(data) {
    this.showAlert(data.title, data.message, data.type || 'warning');
  }

  // Helper methods
  getAuthToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  refreshDashboardData(section) {
    // This method should be overridden by the dashboard implementation
    console.log(`Refreshing ${section} data`);
    
    // Dispatch custom event for dashboard to handle
    window.dispatchEvent(new CustomEvent('dashboard:refresh', {
      detail: { section: section }
    }));
  }

  showNotification(title, message, type = 'info') {
    // This method should be overridden by the dashboard implementation
    console.log(`Notification [${type}]: ${title} - ${message}`);
    
    // Dispatch custom event for dashboard to handle
    window.dispatchEvent(new CustomEvent('notification:show', {
      detail: { title, message, type }
    }));
  }

  showAlert(title, message, type = 'warning') {
    // This method should be overridden by the dashboard implementation
    console.log(`Alert [${type}]: ${title} - ${message}`);
    
    // Dispatch custom event for dashboard to handle
    window.dispatchEvent(new CustomEvent('alert:show', {
      detail: { title, message, type }
    }));
  }

  showConnectionError(message) {
    // This method should be overridden by the dashboard implementation
    console.error('Connection error:', message);
    
    // Dispatch custom event for dashboard to handle
    window.dispatchEvent(new CustomEvent('connection:error', {
      detail: { message }
    }));
  }

  // Health check
  startHealthCheck(interval = 30000) {
    this.healthCheckInterval = setInterval(() => {
      if (this.isConnected) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, interval);
  }

  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // Reconnection with exponential backoff
  reconnectWithBackoff() {
    const backoffDelay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts), 60000);
    console.log(`Reconnecting with backoff delay: ${backoffDelay}ms`);
    
    setTimeout(() => {
      this.connect();
    }, backoffDelay);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SubscriptionWebSocketClient;
} else {
  window.SubscriptionWebSocketClient = SubscriptionWebSocketClient;
}

// Auto-initialize if dashboard is detected
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('#subscriptions-dashboard') || 
      document.querySelector('.subscription-dashboard')) {
    
    const wsClient = new SubscriptionWebSocketClient();
    
    // Configure for subscription dashboard
    wsClient.on('dashboard:refresh', (event) => {
      const { section } = event.detail;
      
      // Call appropriate refresh function based on section
      switch(section) {
        case 'analytics':
          if (typeof loadAnalyticsData === 'function') {
            loadAnalyticsData();
          }
          break;
        case 'packages':
          if (typeof loadPackages === 'function') {
            loadPackages();
          }
          break;
        case 'subscriptions':
        case 'users':
          if (typeof loadUserSubscriptions === 'function') {
            loadUserSubscriptions();
          }
          break;
        case 'payments':
          if (typeof loadPayments === 'function') {
            loadPayments();
          }
          break;
      }
    });
    
    wsClient.on('notification:show', (event) => {
      const { title, message, type } = event.detail;
      showAlert(`${title}: ${message}`, type);
    });
    
    wsClient.on('alert:show', (event) => {
      const { title, message, type } = event.detail;
      showAlert(`${title}: ${message}`, type);
    });
    
    wsClient.on('connection:error', (event) => {
      const { message } = event.detail;
      showAlert(`Connection Error: ${message}`, 'error');
    });
    
    // Connect to WebSocket
    wsClient.connect();
    
    // Subscribe to relevant updates
    wsClient.subscribeToUpdates([
      'subscription:created',
      'subscription:updated',
      'subscription:cancelled',
      'payment:completed',
      'payment:failed',
      'payment:refunded',
      'package:created',
      'package:updated',
      'package:deleted',
      'analytics:metrics',
      'system:notification',
      'system:alert'
    ]);
    
    // Start health check
    wsClient.startHealthCheck();
    
    // Store reference globally for debugging
    window.subscriptionWSClient = wsClient;
  }
});