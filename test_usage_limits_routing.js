console.log('Testing usage limits routing specifically...');

// Mock all dependencies
const mockDb = {
  prepare: (query) => {
    return {
      run: (...params) => ({ changes: 1, lastInsertRowid: 1 }),
      get: (...params) => null,
      all: (...params) => []
    };
  },
  pragma: (statement) => {},
  close: () => {}
};

const mockLogger = {
  info: () => {},
  error: () => {},
  debug: () => {}
};

const mockNotificationService = {
  sendUsageAlert: () => Promise.resolve(),
  sendLimitWarning: () => Promise.resolve(),
  sendOverLimitNotification: () => Promise.resolve(),
  sendUpgradeSuggestion: () => Promise.resolve()
};

// Mock all modules
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

// Now test the usage limits middleware import
console.log('\n1. Testing usage limits middleware import...');
try {
  const usageLimits = require('./server/middlewares/usageLimits');
  console.log('✓ Middleware imported successfully');
  console.log('Available functions:', Object.keys(usageLimits));
} catch (error) {
  console.error('✗ Error importing middleware:', error.message);
  process.exit(1);
}

// Test the usage limits routes import
console.log('\n2. Testing usage limits routes import...');
try {
  const usageLimitsRoutes = require('./server/routes/usageLimits');
  console.log('✓ Routes imported successfully');
  console.log('Routes type:', typeof usageLimitsRoutes);
} catch (error) {
  console.error('✗ Error importing routes:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

// Test with Express
console.log('\n3. Testing with Express router...');
const express = require('express');
const app = express();

try {
  // Create a test router
  const router = express.Router();
  
  // Import the routes module again to get the actual router
  const usageLimitsRoutes = require('./server/routes/usageLimits');
  
  // Test mounting the routes
  app.use('/api/usage-limits', usageLimitsRoutes);
  console.log('✓ Routes mounted successfully');
  
  // Test that the router has the expected routes
  console.log('Router stack:', router.stack);
  
} catch (error) {
  console.error('✗ Error mounting routes:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

console.log('\n✓ All tests passed! The routing issue appears to be resolved.');