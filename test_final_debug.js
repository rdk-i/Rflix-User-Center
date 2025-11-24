console.log('Final debug test to see exactly what\'s happening...\n');

// Mock dependencies
const mockDb = {
  prepare: () => ({
    run: () => ({ changes: 1 }),
    get: () => null,
    all: () => []
  })
};

const mockLogger = {
  info: () => {},
  error: () => {},
  debug: () => {},
  warn: () => {}
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

console.log('1. Testing the exact helper function from the routes file...');

// Replicate the exact same code from the routes file
let usageLimits;
try {
  usageLimits = require('./server/middlewares/usageLimits');
  console.log('✓ Middleware loaded successfully');
} catch (error) {
  console.error('✗ Middleware load failed:', error.message);
  usageLimits = null;
}

function getUsageLimitsFunction(funcName) {
  if (!usageLimits || typeof usageLimits[funcName] !== 'function') {
    console.log(`Creating fallback for ${funcName}`);
    const fallback = (req, res) => {
      console.log(`Fallback function called for ${funcName}`);
      res.status(503).json({
        success: false,
        error: 'Usage limits service temporarily unavailable'
      });
    };
    console.log('Fallback function type:', typeof fallback);
    return fallback;
  }
  return usageLimits[funcName];
}

console.log('2. Testing getUsageLimitsFunction...');
const getCurrentUsageFunc = getUsageLimitsFunction('getCurrentUsage');
console.log('getCurrentUsageFunc type:', typeof getCurrentUsageFunc);
console.log('getCurrentUsageFunc:', getCurrentUsageFunc);

console.log('3. Testing the lazy evaluation pattern...');
const lazyFunc = (req, res, next) => {
  const func = getUsageLimitsFunction('getCurrentUsage');
  console.log('Lazy evaluation - func type:', typeof func);
  return func(req, res, next);
};

console.log('lazyFunc type:', typeof lazyFunc);

console.log('4. Testing with Express router...');
const express = require('express');
const router = express.Router();

try {
  router.get('/test', (req, res, next) => {
    const func = getUsageLimitsFunction('getCurrentUsage');
    return func(req, res, next);
  });
  console.log('✓ router.get() succeeded with lazy evaluation');
} catch (error) {
  console.error('✗ router.get() failed:', error.message);
  console.error('Stack:', error.stack);
}

console.log('\n5. Testing the actual problematic line...');
// This is the exact line that's failing
try {
  const testRouter = express.Router();
  testRouter.get('/current', (req, res, next) => {
    const func = getUsageLimitsFunction('getCurrentUsage');
    return func(req, res, next);
  });
  console.log('✓ Exact problematic line succeeded');
} catch (error) {
  console.error('✗ Exact problematic line failed:', error.message);
  console.error('Full error object:', error);
  console.error('Error constructor:', error.constructor.name);
}