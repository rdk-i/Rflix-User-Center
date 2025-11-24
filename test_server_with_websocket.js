// Test server with WebSocket functionality using mock database
require('dotenv').config();
const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const logger = require('./server/utils/logger');
const SubscriptionWebSocketServer = require('./server/websocket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3002;

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
app.use(cookieParser());

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
    health: 'ws://localhost:${PORT}/health'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(PORT, () => {
  logger.info(`✓ Test server running on port ${PORT}`);
  logger.info(`✓ WebSocket server: ws://localhost:${PORT}/ws/subscriptions`);
  logger.info(`✓ Health check: http://localhost:${PORT}/health`);
  logger.info(`✓ WebSocket test: http://localhost:${PORT}/ws-test`);
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