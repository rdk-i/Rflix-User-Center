console.log('Testing detailed import analysis...');

// Test the actual import
const usageLimits = require('./server/middlewares/usageLimits');

console.log('usageLimits object keys:', Object.keys(usageLimits));
console.log('usageLimits object:', usageLimits);

// Test each function
console.log('\nTesting individual functions:');
console.log('getCurrentUsage:', usageLimits.getCurrentUsage);
console.log('getCurrentUsage type:', typeof usageLimits.getCurrentUsage);

console.log('getUsagePercentage:', usageLimits.getUsagePercentage);
console.log('getUsagePercentage type:', typeof usageLimits.getUsagePercentage);

console.log('getUsageHistory:', usageLimits.getUsageHistory);
console.log('getUsageHistory type:', typeof usageLimits.getUsageHistory);

console.log('handleOverLimit:', usageLimits.handleOverLimit);
console.log('handleOverLimit type:', typeof usageLimits.handleOverLimit);

console.log('suggestUpgrade:', usageLimits.suggestUpgrade);
console.log('suggestUpgrade type:', typeof usageLimits.suggestUpgrade);

// Test if they are actually functions and can be called
console.log('\nTesting function calls (should not execute, just check if callable):');
try {
  console.log('getCurrentUsage.length:', usageLimits.getCurrentUsage.length);
  console.log('getUsagePercentage.length:', usageLimits.getUsagePercentage.length);
  console.log('getUsageHistory.length:', usageLimits.getUsageHistory.length);
  console.log('handleOverLimit.length:', usageLimits.handleOverLimit.length);
  console.log('suggestUpgrade.length:', usageLimits.suggestUpgrade.length);
} catch (error) {
  console.error('Error checking function lengths:', error.message);
}