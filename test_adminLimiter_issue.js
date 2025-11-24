console.log('Testing adminLimiter import issue...');

// Mock dependencies first
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
  debug: () => {},
  warn: () => {}
};

// Mock modules
require.cache[require.resolve('./server/config/database')] = {
  exports: mockDb
};
require.cache[require.resolve('./server/utils/logger')] = {
  exports: mockLogger
};

console.log('\n1. Testing rateLimiter import...');
try {
  const rateLimiter = require('./server/middlewares/rateLimiter');
  console.log('✓ rateLimiter imported successfully');
  console.log('rateLimiter exports:', Object.keys(rateLimiter));
  console.log('adminLimiter type:', typeof rateLimiter.adminLimiter);
  console.log('adminLimiter:', rateLimiter.adminLimiter);
} catch (error) {
  console.error('✗ Error importing rateLimiter:', error.message);
}

console.log('\n2. Testing adminLimiter directly...');
try {
  const { adminLimiter } = require('./server/middlewares/rateLimiter');
  console.log('✓ adminLimiter destructured successfully');
  console.log('adminLimiter type:', typeof adminLimiter);
  console.log('adminLimiter:', adminLimiter);
  console.log('adminLimiter is function:', typeof adminLimiter === 'function');
  console.log('adminLimiter.length:', adminLimiter?.length);
} catch (error) {
  console.error('✗ Error destructuring adminLimiter:', error.message);
}

console.log('\n3. Testing with Express...');
const express = require('express');
const app = express();

try {
  const { adminLimiter } = require('./server/middlewares/rateLimiter');
  
  if (typeof adminLimiter === 'function') {
    console.log('✓ adminLimiter is a function, testing with app.use...');
    app.use(adminLimiter);
    console.log('✓ adminLimiter mounted successfully');
  } else {
    console.error('✗ adminLimiter is not a function:', typeof adminLimiter);
  }
  
} catch (error) {
  console.error('✗ Error mounting adminLimiter:', error.message);
}

console.log('\n4. Testing subscriptions routes import...');
try {
  delete require.cache[require.resolve('./server/routes/subscriptions')];
  const subscriptionsRoutes = require('./server/routes/subscriptions');
  console.log('✓ subscriptions routes imported successfully');
  console.log('subscriptionsRoutes type:', typeof subscriptionsRoutes);
} catch (error) {
  console.error('✗ Error importing subscriptions routes:', error.message);
  console.error('Stack:', error.stack);
}

console.log('\n5. Testing packages routes import...');
try {
  delete require.cache[require.resolve('./server/routes/packages')];
  const packagesRoutes = require('./server/routes/packages');
  console.log('✓ packages routes imported successfully');
  console.log('packagesRoutes type:', typeof packagesRoutes);
} catch (error) {
  console.error('✗ Error importing packages routes:', error.message);
  console.error('Stack:', error.stack);
}