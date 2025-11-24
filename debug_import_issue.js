console.log('Debugging the import issue...\n');

// Test the import step by step
console.log('1. Testing direct middleware import...');
try {
  delete require.cache[require.resolve('./server/middlewares/usageLimits')];
  const usageLimits = require('./server/middlewares/usageLimits');
  
  console.log('Middleware imported successfully');
  console.log('Available functions:', Object.keys(usageLimits));
  console.log('getCurrentUsage type:', typeof usageLimits.getCurrentUsage);
  console.log('getCurrentUsage value:', usageLimits.getCurrentUsage);
  
  if (typeof usageLimits.getCurrentUsage === 'function') {
    console.log('✓ getCurrentUsage is a function');
  } else {
    console.log('✗ getCurrentUsage is not a function:', typeof usageLimits.getCurrentUsage);
    console.log('getCurrentUsage value:', JSON.stringify(usageLimits.getCurrentUsage, null, 2));
  }
} catch (error) {
  console.error('✗ Middleware import failed:', error.message);
}

console.log('\n2. Testing routes import with fresh cache...');
try {
  // Clear all related caches
  delete require.cache[require.resolve('./server/middlewares/usageLimits')];
  delete require.cache[require.resolve('./server/middlewares/auth')];
  delete require.cache[require.resolve('./server/middlewares/auditLogger')];
  delete require.cache[require.resolve('./server/config/database')];
  delete require.cache[require.resolve('./server/utils/logger')];
  delete require.cache[require.resolve('./server/routes/usageLimits')];
  
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
  
  require.cache[require.resolve('./server/config/database')] = {
    exports: mockDb
  };
  require.cache[require.resolve('./server/utils/logger')] = {
    exports: mockLogger
  };
  
  console.log('Dependencies mocked, importing routes...');
  
  const usageLimitsRoutes = require('./server/routes/usageLimits');
  console.log('✓ Routes imported successfully');
  
} catch (error) {
  console.error('✗ Routes import failed:', error.message);
  console.error('Stack trace:', error.stack);
  
  // Let's try to get more specific error information
  if (error.message.includes('Route.get() requires a callback function')) {
    console.log('\n🎯 This is the exact error we need to fix!');
    console.log('The error occurs at:', error.stack.split('\n')[1]);
  }
}

console.log('\n3. Testing middleware import again after routes failed...');
try {
  const usageLimits = require('./server/middlewares/usageLimits');
  console.log('Middleware functions after routes import attempt:');
  console.log('getCurrentUsage type:', typeof usageLimits.getCurrentUsage);
  console.log('getCurrentUsage:', usageLimits.getCurrentUsage);
} catch (error) {
  console.error('✗ Middleware import failed after routes:', error.message);
}