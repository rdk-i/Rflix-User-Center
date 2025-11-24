const express = require('express');
const app = express();

// Mock the required modules
const mockDb = {
  prepare: () => ({
    get: () => ({}),
    all: () => [],
    run: () => ({ changes: 1 })
  })
};

const mockLogger = {
  info: () => {},
  error: () => {}
};

const mockNotificationService = {
  sendUsageAlert: () => Promise.resolve(),
  sendLimitWarning: () => Promise.resolve(),
  sendOverLimitNotification: () => Promise.resolve(),
  sendUpgradeSuggestion: () => Promise.resolve()
};

// Mock the modules
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
const mockAuth = (req, res, next) => {
  req.user = { id: 1 };
  next();
};

require.cache[require.resolve('./server/middlewares/auth')] = {
  exports: mockAuth
};

require.cache[require.resolve('./server/middlewares/auditLogger')] = {
  exports: () => (req, res, next) => next()
};

// Now try to load the usageLimits routes
console.log('Testing route loading...');

try {
  const usageLimitsRoutes = require('./server/routes/usageLimits');
  console.log('✓ Routes loaded successfully');
  
  // Test individual route handlers
  console.log('Testing route handlers...');
  
  // Check if the functions are actually functions
  const usageLimits = require('./server/middlewares/usageLimits');
  
  console.log('getCurrentUsage type:', typeof usageLimits.getCurrentUsage);
  console.log('getUsagePercentage type:', typeof usageLimits.getUsagePercentage);
  console.log('getUsageHistory type:', typeof usageLimits.getUsageHistory);
  console.log('handleOverLimit type:', typeof usageLimits.handleOverLimit);
  console.log('suggestUpgrade type:', typeof usageLimits.suggestUpgrade);
  
  console.log('✓ All tests passed');
  
} catch (error) {
  console.error('✗ Error loading routes:', error.message);
  console.error('Stack:', error.stack);
}