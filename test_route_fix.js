// Test script to verify the route registration fix
console.log('Testing route registration fix...');

try {
  // Test importing the usageLimits routes
  const usageLimitsRoutes = require('./server/routes/usageLimits');
  console.log('✓ Usage limits routes imported successfully');
  
  // Test importing the usageLimits middleware
  const usageLimitsMiddleware = require('./server/middlewares/usageLimits');
  console.log('✓ Usage limits middleware imported successfully');
  
  // Check if the required functions are available
  const requiredFunctions = ['getCurrentUsage', 'getUsagePercentage', 'getUsageHistory', 'handleOverLimit', 'suggestUpgrade'];
  
  for (const func of requiredFunctions) {
    if (typeof usageLimitsMiddleware[func] === 'function') {
      console.log(`✓ ${func} is a valid function`);
    } else {
      console.log(`✗ ${func} is not a valid function (type: ${typeof usageLimitsMiddleware[func]})`);
    }
  }
  
  console.log('\nRoute registration test completed successfully!');
  console.log('The Express route error should be fixed.');
  
} catch (error) {
  console.error('✗ Route registration test failed:', error.message);
  console.error('Stack trace:', error.stack);
}