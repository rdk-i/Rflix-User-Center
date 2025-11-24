console.log('Simulating server startup to find the circular dependency...\n');

// Mock the full server environment
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

// Mock all modules that might be involved in circular dependencies
require.cache[require.resolve('./server/config/database')] = {
  exports: mockDb
};
require.cache[require.resolve('./server/utils/logger')] = {
  exports: mockLogger
};
require.cache[require.resolve('./server/services/notificationService')] = {
  exports: mockNotificationService
};

require.cache[require.resolve('./server/middlewares/auth')] = {
  exports: {
    authenticateToken: (req, res, next) => next(),
    requireAdmin: (req, res, next) => next()
  }
};

require.cache[require.resolve('./server/middlewares/auditLogger')] = {
  exports: (action) => (req, res, next) => next()
};

require.cache[require.resolve('./server/middlewares/errorHandler')] = {
  exports: (err, req, res, next) => next()
};

require.cache[require.resolve('./server/middlewares/rateLimiter')] = {
  exports: {
    globalLimiter: (req, res, next) => next(),
    loginLimiter: (req, res, next) => next(),
    adminLimiter: (req, res, next) => next(),
    registrationLimiter: (req, res, next) => next()
  }
};

class MockWebSocketServer {
  constructor(server) {}
}

require.cache[require.resolve('./server/websocket')] = {
  exports: MockWebSocketServer
};

require.cache[require.resolve('./server/scheduler')] = {
  exports: {
    start: () => {},
    stop: () => {}
  }
};

console.log('1. Testing middleware import in isolation...');
try {
  delete require.cache[require.resolve('./server/middlewares/usageLimits')];
  const usageLimits = require('./server/middlewares/usageLimits');
  console.log('✓ Middleware imported successfully in isolation');
  console.log('getCurrentUsage:', typeof usageLimits.getCurrentUsage);
} catch (error) {
  console.error('✗ Middleware import failed in isolation:', error.message);
}

console.log('\n2. Testing routes import in isolation...');
try {
  delete require.cache[require.resolve('./server/routes/usageLimits')];
  const usageLimitsRoutes = require('./server/routes/usageLimits');
  console.log('✓ Routes imported successfully in isolation');
} catch (error) {
  console.error('✗ Routes import failed in isolation:', error.message);
}

console.log('\n3. Testing the problematic line directly...');
// Let's manually check what happens at line 50
const express = require('express');
const router = express.Router();

// Simulate the exact same import pattern as the routes file
let usageLimits;
try {
  usageLimits = require('./server/middlewares/usageLimits');
  console.log('✓ Middleware loaded in test context');
} catch (error) {
  console.error('✗ Middleware failed to load in test context:', error.message);
  usageLimits = null;
}

function getUsageLimitsFunction(funcName) {
  if (!usageLimits || typeof usageLimits[funcName] !== 'function') {
    console.log(`WARNING: usageLimits.${funcName} not available, using fallback`);
    return (req, res) => {
      res.status(503).json({
        success: false,
        error: 'Usage limits service temporarily unavailable'
      });
    };
  }
  return usageLimits[funcName];
}

console.log('Testing getUsageLimitsFunction...');
const getCurrentUsageFunc = getUsageLimitsFunction('getCurrentUsage');
console.log('Function type:', typeof getCurrentUsageFunc);

console.log('Testing router.get()...');
try {
  router.get('/test', getCurrentUsageFunc);
  console.log('✓ router.get() succeeded');
} catch (error) {
  console.error('✗ router.get() failed:', error.message);
}

console.log('\n4. Checking if there are any circular dependencies...');
// Let's check what modules the middleware imports
const middlewareContent = require('fs').readFileSync('./server/middlewares/usageLimits.js', 'utf8');
console.log('Middleware imports:');
const imports = middlewareContent.match(/require\([^)]+\)/g) || [];
imports.forEach(imp => console.log('  ', imp));

console.log('\n5. Checking what the routes file imports...');
const routesContent = require('fs').readFileSync('./server/routes/usageLimits.js', 'utf8');
console.log('Routes imports:');
const routeImports = routesContent.match(/require\([^)]+\)/g) || [];
routeImports.forEach(imp => console.log('  ', imp));