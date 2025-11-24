console.log('Testing detailed import analysis with mocked database...');

// Mock database first
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

// Mock the modules before requiring
require.cache[require.resolve('./server/config/database')] = {
  exports: mockDb
};
require.cache[require.resolve('./server/utils/logger')] = {
  exports: mockLogger
};
require.cache[require.resolve('./server/services/notificationService')] = {
  exports: mockNotificationService
};

// Now test the import
const usageLimits = require('./server/middlewares/usageLimits');

console.log('usageLimits object keys:', Object.keys(usageLimits));

// Test each function
console.log('\nTesting individual functions:');
console.log('getCurrentUsage exists:', 'getCurrentUsage' in usageLimits);
console.log('getCurrentUsage type:', typeof usageLimits.getCurrentUsage);

console.log('getUsagePercentage exists:', 'getUsagePercentage' in usageLimits);
console.log('getUsagePercentage type:', typeof usageLimits.getUsagePercentage);

console.log('getUsageHistory exists:', 'getUsageHistory' in usageLimits);
console.log('getUsageHistory type:', typeof usageLimits.getUsageHistory);

console.log('handleOverLimit exists:', 'handleOverLimit' in usageLimits);
console.log('handleOverLimit type:', typeof usageLimits.handleOverLimit);

console.log('suggestUpgrade exists:', 'suggestUpgrade' in usageLimits);
console.log('suggestUpgrade type:', typeof usageLimits.suggestUpgrade);

// Test if they are actually functions and can be called
console.log('\nTesting function lengths (should be 2 for Express middleware):');
try {
  console.log('getCurrentUsage.length:', usageLimits.getCurrentUsage.length);
  console.log('getUsagePercentage.length:', usageLimits.getUsagePercentage.length);
  console.log('getUsageHistory.length:', usageLimits.getUsageHistory.length);
  console.log('handleOverLimit.length:', usageLimits.handleOverLimit.length);
  console.log('suggestUpgrade.length:', usageLimits.suggestUpgrade.length);
} catch (error) {
  console.error('Error checking function lengths:', error.message);
}

// Test the actual route loading
console.log('\nTesting route loading...');
try {
  const usageLimitsRoutes = require('./server/routes/usageLimits');
  console.log('✓ Routes loaded successfully');
} catch (error) {
  console.error('✗ Error loading routes:', error.message);
}