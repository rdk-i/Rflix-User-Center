console.log('Testing the helper function directly...\n');

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

console.log('1. Testing the exact same helper function pattern...');

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
    return (req, res) => {
      res.status(503).json({
        success: false,
        error: 'Usage limits service temporarily unavailable'
      });
    };
  }
  return usageLimits[funcName];
}

console.log('2. Testing getUsageLimitsFunction...');
const getCurrentUsageFunc = getUsageLimitsFunction('getCurrentUsage');
console.log('getCurrentUsageFunc type:', typeof getCurrentUsageFunc);
console.log('getCurrentUsageFunc:', getCurrentUsageFunc);

if (typeof getCurrentUsageFunc === 'function') {
  console.log('✓ Helper function returned a function');
  
  // Test calling it
  const mockReq = { user: { id: 1 } };
  const mockRes = {
    status: (code) => ({
      json: (data) => console.log(`Response: status ${code}, data:`, data)
    })
  };
  
  console.log('3. Testing function call...');
  getCurrentUsageFunc(mockReq, mockRes);
  
} else {
  console.error('✗ Helper function did not return a function');
  console.log('Returned value:', getCurrentUsageFunc);
}

console.log('\n4. Testing with Express router...');
const express = require('express');
const router = express.Router();

try {
  router.get('/test', getUsageLimitsFunction('getCurrentUsage'));
  console.log('✓ Router.get() succeeded with helper function');
} catch (error) {
  console.error('✗ Router.get() failed:', error.message);
}