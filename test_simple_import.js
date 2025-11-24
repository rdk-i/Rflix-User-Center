console.log('Testing simple import to understand the root cause...\n');

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

console.log('1. Testing middleware import with detailed error catching...');
try {
  delete require.cache[require.resolve('./server/middlewares/usageLimits')];
  const usageLimits = require('./server/middlewares/usageLimits');
  
  console.log('✓ Middleware imported successfully');
  console.log('Available functions:', Object.keys(usageLimits));
  
  // Test each function individually
  const functions = ['getCurrentUsage', 'getUsagePercentage', 'getUsageHistory', 'handleOverLimit', 'suggestUpgrade'];
  functions.forEach(funcName => {
    const func = usageLimits[funcName];
    console.log(`${funcName}: ${typeof func} (length: ${func?.length})`);
  });
  
} catch (error) {
  console.error('✗ Middleware import failed:', error.message);
  console.error('Full error:', error);
  console.error('Stack:', error.stack);
}

console.log('\n2. Testing routes import with the current approach...');
try {
  delete require.cache[require.resolve('./server/routes/usageLimits')];
  
  // Let's see what the current routes file looks like
  const routesContent = require('fs').readFileSync('./server/routes/usageLimits.js', 'utf8');
  console.log('Routes file first 50 lines:');
  console.log(routesContent.split('\n').slice(0, 50).join('\n'));
  
  console.log('\nAttempting to import routes...');
  const usageLimitsRoutes = require('./server/routes/usageLimits');
  console.log('✓ Routes imported successfully');
  
} catch (error) {
  console.error('✗ Routes import failed:', error.message);
  console.error('Error at line:', error.stack.split('\n').find(line => line.includes('usageLimits.js')) || 'Unknown line');
}