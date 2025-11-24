// Test server with WebSocket functionality (no database dependency)
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const logger = require('./server/utils/logger');
const SubscriptionWebSocketServer = require('./server/websocket/index-no-db');

const app = express();
const server = http.createServer(app);
const PORT = 8888;

// Initialize WebSocket server
logger.info('Initializing WebSocket server...');
try {
  const wsServer = new SubscriptionWebSocketServer(server);
  logger.info('✓ WebSocket server initialized successfully');
  
  // Make WebSocket server available to routes
  app.use((req, res, next) => {
    req.wsServer = wsServer;
    next();
  });
  
} catch (error) {
  logger.error('✗ WebSocket server initialization failed:', error);
  process.exit(1);
}

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    websocket: 'connected',
    timestamp: new Date().toISOString()
  });
});

// WebSocket test endpoint
app.get('/ws-test', (req, res) => {
  res.json({
    message: 'WebSocket server is running',
    wsUrl: `ws://localhost:${PORT}/ws/subscriptions`,
    health: `http://localhost:${PORT}/health`
  });
});

// WebSocket stats endpoint
app.get('/ws-stats', (req, res) => {
  const stats = req.wsServer.getStats();
  res.json({
    stats,
    timestamp: new Date().toISOString()
  });
});

// Test WebSocket broadcast endpoint
app.post('/ws-test-broadcast', (req, res) => {
  const { type, message } = req.body;
  
  if (!type || !message) {
    return res.status(400).json({ error: 'type and message are required' });
  }
  
  try {
    const sentCount = req.wsServer.notifySystem('Test Broadcast', message, type);
    res.json({
      success: true,
      sentCount,
      message: `Broadcast sent to ${sentCount} clients`
    });
  } catch (error) {
    res.status(500).json({ error: 'Broadcast failed', details: error.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(PORT, () => {
  logger.info(`✓ WebSocket test server running on port ${PORT}`);
  logger.info(`✓ WebSocket server: ws://localhost:${PORT}/ws/subscriptions`);
  logger.info(`✓ Health check: http://localhost:${PORT}/health`);
  logger.info(`✓ WebSocket stats: http://localhost:${PORT}/ws-stats`);
  logger.info(`✓ Test broadcast: POST http://localhost:${PORT}/ws-test-broadcast`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    process.exit(0);
  });
});