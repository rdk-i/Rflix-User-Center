console.log('Testing Express route registration to reproduce the exact error...');

// Mock all dependencies first
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

// Import usage limits middleware
const usageLimits = require('./server/middlewares/usageLimits');

// Test each function to make sure they are proper Express middleware
console.log('\n1. Testing middleware functions...');
const testFunctions = ['getCurrentUsage', 'getUsagePercentage', 'getUsageHistory', 'handleOverLimit', 'suggestUpgrade'];

testFunctions.forEach(funcName => {
  const func = usageLimits[funcName];
  console.log(`${funcName}:`, typeof func);
  console.log(`${funcName}.length:`, func?.length); // Should be 2 for Express middleware
  
  // Test if it's actually callable
  try {
    // Create a mock req/res/next
    const mockReq = { user: { id: 1 }, body: {} };
    const mockRes = { 
      json: (data) => console.log(`${funcName} would respond with:`, JSON.stringify(data).substring(0, 100) + '...'),
      status: (code) => ({ json: (data) => console.log(`${funcName} would respond with status ${code}:`, JSON.stringify(data).substring(0, 100) + '...') })
    };
    const mockNext = () => console.log(`${funcName} would call next()`);
    
    // Call the function to see what happens
    const result = func(mockReq, mockRes, mockNext);
    console.log(`${funcName} returned:`, typeof result, result);
  } catch (error) {
    console.error(`${funcName} error:`, error.message);
  }
  console.log('---');
});

// Now test the actual route registration
console.log('\n2. Testing actual route registration...');
const express = require('express');
const router = express.Router();

try {
  // Clear cache and import the routes fresh
  delete require.cache[require.resolve('./server/routes/usageLimits')];
  const usageLimitsRoutes = require('./server/routes/usageLimits');
  
  console.log('Routes imported successfully');
  console.log('Routes type:', typeof usageLimitsRoutes);
  
  // Test mounting
  const app = express();
  app.use('/api/usage-limits', usageLimitsRoutes);
  console.log('✓ Routes mounted successfully');
  
} catch (error) {
  console.error('✗ Error during route registration:', error.message);
  console.error('Stack:', error.stack);
  
  if (error.message.includes('Route.get() requires a callback function')) {
    console.log('\n🎯 FOUND THE EXACT ERROR!');
    console.log('Error details:', error.message);
    console.log('This means one of the middleware functions is not a proper function.');
  }
}

// Let's also check what happens if we try to use the functions directly
console.log('\n3. Testing direct function usage...');
try {
  const express = require('express');
  const app = express();
  
  // Try to use the functions directly as Express would
  testFunctions.forEach(funcName => {
    const func = usageLimits[funcName];
    console.log(`Testing ${funcName} with app.get...`);
    try {
      app.get('/test-' + funcName, func);
      console.log(`✓ ${funcName} registered successfully`);
    } catch (error) {
      console.error(`✗ ${funcName} failed:`, error.message);
    }
  });
  
} catch (error) {
  console.error('✗ Error in direct function test:', error.message);
}