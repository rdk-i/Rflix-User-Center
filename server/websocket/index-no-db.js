const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class SubscriptionWebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws/subscriptions',
      verifyClient: this.verifyClient.bind(this)
    });
    
    this.clients = new Map();
    this.subscriptions = new Map();
    
    this.setupEventHandlers();
    this.startHealthCheck();
  }

  verifyClient(info, cb) {
    const token = this.extractToken(info.req);
    
    if (!token) {
      cb(false, 401, 'Unauthorized');
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      info.req.user = decoded;
      cb(true);
    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      cb(false, 401, 'Unauthorized');
    }
  }

  extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Also check query parameter for token
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('token');
  }

  setupEventHandlers() {
    this.wss.on('connection', (ws, req) => {
      const userId = req.user.id;
      const userRole = req.user.role;
      
      logger.info(`WebSocket connection established for user ${userId}`);
      
      // Store client connection
      this.clients.set(userId, {
        ws,
        role: userRole,
        subscriptions: new Set(),
        lastPing: Date.now()
      });
      
      // Send welcome message
      this.sendToClient(userId, {
        type: 'connection:established',
        payload: {
          userId,
          role: userRole,
          timestamp: new Date().toISOString()
        }
      });
      
      // Set up client message handlers
      ws.on('message', (message) => {
        this.handleClientMessage(userId, message);
      });
      
      ws.on('close', (code, reason) => {
        logger.info(`WebSocket connection closed for user ${userId}: ${code} - ${reason}`);
        this.handleClientDisconnect(userId);
      });
      
      ws.on('error', (error) => {
        logger.error(`WebSocket error for user ${userId}:`, error);
        this.handleClientDisconnect(userId);
      });
      
      ws.on('pong', () => {
        const client = this.clients.get(userId);
        if (client) {
          client.lastPing = Date.now();
        }
      });
    });
  }

  handleClientMessage(userId, message) {
    try {
      const data = JSON.parse(message);
      const { type, payload } = data;
      
      logger.debug(`Received message from user ${userId}:`, { type, payload });
      
      switch (type) {
        case 'subscribe':
          this.handleSubscribe(userId, payload);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscribe(userId, payload);
          break;
          
        case 'ping':
          this.handlePing(userId, payload);
          break;
          
        case 'auth':
          this.handleAuth(userId, payload);
          break;
          
        default:
          logger.warn(`Unknown message type from user ${userId}:`, type);
      }
    } catch (error) {
      logger.error(`Failed to handle message from user ${userId}:`, error);
      this.sendToClient(userId, {
        type: 'error',
        payload: {
          message: 'Invalid message format',
          error: error.message
        }
      });
    }
  }

  handleSubscribe(userId, payload) {
    const client = this.clients.get(userId);
    if (!client) return;
    
    const { types } = payload;
    if (!Array.isArray(types)) {
      this.sendToClient(userId, {
        type: 'error',
        payload: { message: 'Invalid subscription types' }
      });
      return;
    }
    
    types.forEach(type => {
      client.subscriptions.add(type);
      
      if (!this.subscriptions.has(type)) {
        this.subscriptions.set(type, new Set());
      }
      this.subscriptions.get(type).add(userId);
    });
    
    logger.info(`User ${userId} subscribed to:`, types);
    
    this.sendToClient(userId, {
      type: 'subscription:confirmed',
      payload: { types }
    });
  }

  handleUnsubscribe(userId, payload) {
    const client = this.clients.get(userId);
    if (!client) return;
    
    const { types } = payload;
    if (!Array.isArray(types)) {
      this.sendToClient(userId, {
        type: 'error',
        payload: { message: 'Invalid unsubscription types' }
      });
      return;
    }
    
    types.forEach(type => {
      client.subscriptions.delete(type);
      
      if (this.subscriptions.has(type)) {
        this.subscriptions.get(type).delete(userId);
      }
    });
    
    logger.info(`User ${userId} unsubscribed from:`, types);
    
    this.sendToClient(userId, {
      type: 'unsubscription:confirmed',
      payload: { types }
    });
  }

  handlePing(userId, payload) {
    const client = this.clients.get(userId);
    if (client) {
      client.lastPing = Date.now();
      
      this.sendToClient(userId, {
        type: 'pong',
        payload: {
          timestamp: Date.now(),
          serverTime: new Date().toISOString()
        }
      });
    }
  }

  handleAuth(userId, payload) {
    const { token } = payload;
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Update client info
      const client = this.clients.get(userId);
      if (client) {
        client.role = decoded.role;
      }
      
      logger.info(`User ${userId} re-authenticated successfully`);
      
      this.sendToClient(userId, {
        type: 'auth:success',
        payload: {
          userId: decoded.id,
          role: decoded.role
        }
      });
    } catch (error) {
      logger.error(`Authentication failed for user ${userId}:`, error);
      
      this.sendToClient(userId, {
        type: 'auth:failed',
        payload: { message: 'Authentication failed' }
      });
      
      // Close connection after failed auth
      setTimeout(() => {
        this.closeClientConnection(userId, 1008, 'Authentication failed');
      }, 1000);
    }
  }

  handleClientDisconnect(userId) {
    const client = this.clients.get(userId);
    if (!client) return;
    
    // Remove from subscriptions
    client.subscriptions.forEach(type => {
      if (this.subscriptions.has(type)) {
        this.subscriptions.get(type).delete(userId);
      }
    });
    
    this.clients.delete(userId);
    logger.info(`Client ${userId} disconnected and cleaned up`);
  }

  sendToClient(userId, message) {
    const client = this.clients.get(userId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error(`Failed to send message to user ${userId}:`, error);
      return false;
    }
  }

  broadcast(message, filter = null) {
    let sentCount = 0;
    
    this.clients.forEach((client, userId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (!filter || filter(userId, client)) {
          try {
            client.ws.send(JSON.stringify(message));
            sentCount++;
          } catch (error) {
            logger.error(`Failed to broadcast to user ${userId}:`, error);
          }
        }
      }
    });
    
    return sentCount;
  }

  broadcastToType(type, message, excludeUserId = null) {
    const subscribers = this.subscriptions.get(type);
    if (!subscribers || subscribers.size === 0) {
      return 0;
    }
    
    let sentCount = 0;
    
    subscribers.forEach(userId => {
      if (userId !== excludeUserId) {
        if (this.sendToClient(userId, message)) {
          sentCount++;
        }
      }
    });
    
    return sentCount;
  }

  closeClientConnection(userId, code = 1000, reason = '') {
    const client = this.clients.get(userId);
    if (client) {
      client.ws.close(code, reason);
    }
  }

  startHealthCheck(interval = 30000) {
    this.healthCheckInterval = setInterval(() => {
      const now = Date.now();
      
      this.clients.forEach((client, userId) => {
        // Check if client hasn't responded to ping in a while
        if (now - client.lastPing > interval * 2) {
          logger.warn(`Client ${userId} appears to be unresponsive, closing connection`);
          this.closeClientConnection(userId, 1001, 'Client unresponsive');
          return;
        }
        
        // Send ping if connection is open
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, interval);
  }

  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // Subscription management methods
  notifySubscriptionCreated(subscriptionData, excludeUserId = null) {
    return this.broadcastToType('subscription:created', {
      type: 'subscription:created',
      payload: subscriptionData,
      timestamp: new Date().toISOString()
    }, excludeUserId);
  }

  notifySubscriptionUpdated(subscriptionData, excludeUserId = null) {
    return this.broadcastToType('subscription:updated', {
      type: 'subscription:updated',
      payload: subscriptionData,
      timestamp: new Date().toISOString()
    }, excludeUserId);
  }

  notifySubscriptionCancelled(subscriptionData, excludeUserId = null) {
    return this.broadcastToType('subscription:cancelled', {
      type: 'subscription:cancelled',
      payload: subscriptionData,
      timestamp: new Date().toISOString()
    }, excludeUserId);
  }

  notifyPaymentCompleted(paymentData, excludeUserId = null) {
    return this.broadcastToType('payment:completed', {
      type: 'payment:completed',
      payload: paymentData,
      timestamp: new Date().toISOString()
    }, excludeUserId);
  }

  notifyPaymentFailed(paymentData, excludeUserId = null) {
    return this.broadcastToType('payment:failed', {
      type: 'payment:failed',
      payload: paymentData,
      timestamp: new Date().toISOString()
    }, excludeUserId);
  }

  notifyPaymentRefunded(refundData, excludeUserId = null) {
    return this.broadcastToType('payment:refunded', {
      type: 'payment:refunded',
      payload: refundData,
      timestamp: new Date().toISOString()
    }, excludeUserId);
  }

  notifyPackageCreated(packageData, excludeUserId = null) {
    return this.broadcastToType('package:created', {
      type: 'package:created',
      payload: packageData,
      timestamp: new Date().toISOString()
    }, excludeUserId);
  }

  notifyPackageUpdated(packageData, excludeUserId = null) {
    return this.broadcastToType('package:updated', {
      type: 'package:updated',
      payload: packageData,
      timestamp: new Date().toISOString()
    }, excludeUserId);
  }

  notifyPackageDeleted(packageData, excludeUserId = null) {
    return this.broadcastToType('package:deleted', {
      type: 'package:deleted',
      payload: packageData,
      timestamp: new Date().toISOString()
    }, excludeUserId);
  }

  notifyAnalyticsUpdate(analyticsData, excludeUserId = null) {
    return this.broadcastToType('analytics:metrics', {
      type: 'analytics:metrics',
      payload: analyticsData,
      timestamp: new Date().toISOString()
    }, excludeUserId);
  }

  notifySystem(title, message, type = 'info', excludeUserId = null) {
    const notificationType = type === 'warning' || type === 'error' ? 'system:alert' : 'system:notification';
    
    return this.broadcastToType(notificationType, {
      type: notificationType,
      payload: {
        title,
        message,
        type,
        timestamp: new Date().toISOString()
      }
    }, excludeUserId);
  }

  // Admin-specific broadcasts
  notifyAdmins(message, excludeUserId = null) {
    return this.broadcast(message, (userId, client) => {
      return client.role === 'admin' && userId !== excludeUserId;
    });
  }

  // Get connection statistics
  getStats() {
    return {
      totalConnections: this.clients.size,
      activeSubscriptions: this.subscriptions.size,
      subscriptionsByType: Array.from(this.subscriptions.entries()).map(([type, users]) => ({
        type,
        subscriberCount: users.size
      }))
    };
  }
}

module.exports = SubscriptionWebSocketServer;