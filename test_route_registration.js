console.log('Testing route registration...');

// Mock database and dependencies
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

// Mock auth and auditLogger
require.cache[require.resolve('./server/middlewares/auth')] = {
  exports: (req, res, next) => {
    req.user = { id: 1 };
    next();
  }
};

require.cache[require.resolve('./server/middlewares/auditLogger')] = {
  exports: (action) => (req, res, next) => next()
};

// Import usage limits middleware
const usageLimits = require('./server/middlewares/usageLimits');

console.log('Middleware functions available:');
console.log('- getCurrentUsage:', typeof usageLimits.getCurrentUsage);
console.log('- getUsagePercentage:', typeof usageLimits.getUsagePercentage);
console.log('- getUsageHistory:', typeof usageLimits.getUsageHistory);
console.log('- handleOverLimit:', typeof usageLimits.handleOverLimit);
console.log('- suggestUpgrade:', typeof usageLimits.suggestUpgrade);

// Now try to create a simple Express router and register the routes
const express = require('express');
const router = express.Router();

console.log('\nTesting route registration...');

try {
  // Test individual route registrations
  console.log('Testing line 25: router.get("/current", auth, usageLimits.getCurrentUsage)');
  router.get('/current', (req, res, next) => next(), usageLimits.getCurrentUsage);
  console.log('✓ Line 25 passed');
  
  console.log('Testing line 28: router.get("/percentage", auth, usageLimits.getUsagePercentage)');
  router.get('/percentage', (req, res, next) => next(), usageLimits.getUsagePercentage);
  console.log('✓ Line 28 passed');
  
  console.log('Testing line 31: router.get("/history", auth, usageLimits.getUsageHistory)');
  router.get('/history', (req, res, next) => next(), usageLimits.getUsageHistory);
  console.log('✓ Line 31 passed');
  
  console.log('Testing line 126: router.post("/handle-over-limit", auth, usageLimits.handleOverLimit, auditLogger)');
  router.post('/handle-over-limit', (req, res, next) => next(), usageLimits.handleOverLimit, (req, res, next) => next());
  console.log('✓ Line 126 passed');
  
  console.log('Testing line 129: router.post("/suggest-upgrade", auth, usageLimits.suggestUpgrade, auditLogger)');
  router.post('/suggest-upgrade', (req, res, next) => next(), usageLimits.suggestUpgrade, (req, res, next) => next());
  console.log('✓ Line 129 passed');
  
  console.log('\n✓ All route registrations passed individually');
  
} catch (error) {
  console.error('✗ Error during route registration:', error.message);
  console.error('Stack:', error.stack);
}

// Now try to load the actual route file
console.log('\nTesting full route file loading...');
try {
  delete require.cache[require.resolve('./server/routes/usageLimits')];
  const usageLimitsRoutes = require('./server/routes/usageLimits');
  console.log('✓ Full route file loaded successfully');
} catch (error) {
  console.error('✗ Error loading full route file:', error.message);
  console.error('Stack:', error.stack);
}