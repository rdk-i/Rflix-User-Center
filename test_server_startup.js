console.log('Testing server startup simulation...');

// Mock environment variables
process.env.SETUP_COMPLETED = 'true';
process.env.PORT = '3001';
process.env.CORS_ORIGIN = '*';

// Mock database with more realistic behavior
const mockDb = {
  prepare: (sql) => {
    console.log('Database query:', sql.substring(0, 50) + '...');
    return {
      get: () => ({ isAdmin: true }),
      all: () => [],
      run: () => ({ changes: 1 })
    };
  },
  close: () => console.log('Database closed')
};

const mockLogger = {
  info: (msg) => console.log('[INFO]', msg),
  error: (msg, err) => console.log('[ERROR]', msg, err?.message || '')
};

const mockNotificationService = {
  sendUsageAlert: () => Promise.resolve(),
  sendLimitWarning: () => Promise.resolve(),
  sendOverLimitNotification: () => Promise.resolve(),
  sendUpgradeSuggestion: () => Promise.resolve()
};

// Mock modules
require.cache[require.resolve('./server/config/database')] = {
  exports: mockDb
};
require.cache[require.resolve('./server/utils/logger')] = {
  exports: mockLogger
};
require.cache[require.resolve('./server/services/notificationService')] = {
  exports: mockNotificationService
};

// Mock auth middleware
require.cache[require.resolve('./server/middlewares/auth')] = {
  exports: (req, res, next) => {
    req.user = { id: 1 };
    next();
  }
};

require.cache[require.resolve('./server/middlewares/auditLogger')] = {
  exports: (action) => (req, res, next) => next()
};

// Mock error handler
require.cache[require.resolve('./server/middlewares/errorHandler')] = {
  exports: (err, req, res, next) => {
    console.log('Error handler called:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Mock rate limiters
require.cache[require.resolve('./server/middlewares/rateLimiter')] = {
  exports: {}
};

// Mock scheduler
require.cache[require.resolve('./server/scheduler')] = {
  exports: {
    start: () => console.log('Scheduler started'),
    stop: () => console.log('Scheduler stopped')
  }
};

// Mock WebSocket server
class MockWebSocketServer {
  constructor(server) {
    console.log('WebSocket server initialized');
  }
}

require.cache[require.resolve('./server/websocket')] = {
  exports: MockWebSocketServer
};

// Now try to load the usage limits routes exactly as the server does
console.log('\nTesting usage limits route import (line 23 in server/index.js)...');
try {
  const usageLimitsRoutes = require('./server/routes/usageLimits');
  console.log('✓ usageLimitsRoutes imported successfully');
  console.log('usageLimitsRoutes type:', typeof usageLimitsRoutes);
  console.log('usageLimitsRoutes is function:', typeof usageLimitsRoutes === 'function');
} catch (error) {
  console.error('✗ Error importing usageLimitsRoutes:', error.message);
  console.error('Stack:', error.stack);
}

// Test the actual server startup
console.log('\nTesting server startup...');
try {
  // Clear any existing cache for the server
  delete require.cache[require.resolve('./server/index')];
  
  // Try to start the server
  require('./server/index');
  console.log('✓ Server started successfully');
  
} catch (error) {
  console.error('✗ Error starting server:', error.message);
  console.error('Stack:', error.stack);
  
  // Try to get more specific error information
  if (error.message.includes('Route.get() requires a callback function')) {
    console.log('\nThis is the exact error we are trying to fix!');
    console.log('The error occurs at:', error.stack.split('\n')[1]);
  }
}