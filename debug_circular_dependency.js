console.log('Debugging circular dependency issue...\n');

// Let's trace the import process step by step
console.log('Step 1: Importing middleware first...');
try {
  delete require.cache[require.resolve('./server/middlewares/usageLimits')];
  const usageLimits = require('./server/middlewares/usageLimits');
  
  console.log('✓ Middleware imported successfully');
  console.log('getCurrentUsage at import time:', typeof usageLimits.getCurrentUsage);
  console.log('getCurrentUsage function:', usageLimits.getCurrentUsage);
  
} catch (error) {
  console.error('✗ Middleware import failed:', error.message);
}

console.log('\nStep 2: Now let\'s see what happens when we import the routes...');

// Mock dependencies first
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
  exports: {
    authenticateToken: (req, res, next) => next(),
    requireAdmin: (req, res, next) => next()
  }
};

require.cache[require.resolve('./server/middlewares/auditLogger')] = {
  exports: (action) => (req, res, next) => next()
};

console.log('\nStep 3: Clearing all caches and importing routes...');
try {
  // Clear all caches
  delete require.cache[require.resolve('./server/middlewares/usageLimits')];
  delete require.cache[require.resolve('./server/middlewares/auth')];
  delete require.cache[require.resolve('./server/middlewares/auditLogger')];
  delete require.cache[require.resolve('./server/config/database')];
  delete require.cache[require.resolve('./server/utils/logger')];
  delete require.cache[require.resolve('./server/routes/usageLimits')];
  
  console.log('All caches cleared');
  
  // Let's add some debug logging to see what's happening
  const originalRequire = require;
  
  // Override require to add debug logging
  require = function(id) {
    console.log(`\n📦 Requiring: ${id}`);
    const result = originalRequire.apply(this, arguments);
    
    // If this is the usageLimits middleware, log its state
    if (id === './server/middlewares/usageLimits' || id.includes('usageLimits')) {
      console.log('📋 usageLimits middleware state:');
      if (result && typeof result === 'object') {
        Object.keys(result).forEach(key => {
          console.log(`  ${key}: ${typeof result[key]}`);
        });
      }
    }
    
    return result;
  };
  
  console.log('\n🚀 Attempting to import usage limits routes...');
  const usageLimitsRoutes = originalRequire('./server/routes/usageLimits');
  console.log('✓ Routes imported successfully');
  
} catch (error) {
  console.error('✗ Routes import failed:', error.message);
  
  // Let's check what the middleware looks like after the failure
  console.log('\nStep 4: Checking middleware state after failure...');
  try {
    const usageLimits = require('./server/middlewares/usageLimits');
    console.log('Middleware state after routes import failure:');
    console.log('getCurrentUsage type:', typeof usageLimits.getCurrentUsage);
    console.log('getCurrentUsage value:', usageLimits.getCurrentUsage);
  } catch (e) {
    console.error('Could not check middleware state:', e.message);
  }
}