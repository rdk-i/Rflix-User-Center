console.log('Testing auth middleware to find the root cause...\n');

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

// Mock modules
require.cache[require.resolve('./server/config/database')] = {
  exports: mockDb
};
require.cache[require.resolve('./server/utils/logger')] = {
  exports: mockLogger
};

console.log('1. Testing auth middleware import...');
try {
  delete require.cache[require.resolve('./server/middlewares/auth')];
  const auth = require('./server/middlewares/auth');
  
  console.log('✓ Auth middleware imported successfully');
  console.log('Auth exports:', Object.keys(auth));
  console.log('authenticateToken type:', typeof auth.authenticateToken);
  console.log('requireAdmin type:', typeof auth.requireAdmin);
  
  if (typeof auth.authenticateToken === 'function') {
    console.log('✓ authenticateToken is a function (length:', auth.authenticateToken.length, ')');
  } else {
    console.error('✗ authenticateToken is not a function:', typeof auth.authenticateToken);
  }
  
  if (typeof auth.requireAdmin === 'function') {
    console.log('✓ requireAdmin is a function (length:', auth.requireAdmin.length, ')');
  } else {
    console.error('✗ requireAdmin is not a function:', typeof auth.requireAdmin);
  }
  
} catch (error) {
  console.error('✗ Auth middleware import failed:', error.message);
  console.error('Stack:', error.stack);
}

console.log('\n2. Testing auth middleware with Express...');
const express = require('express');
const router = express.Router();

try {
  const { authenticateToken } = require('./server/middlewares/auth');
  
  console.log('Testing router.get() with auth middleware...');
  router.get('/test', authenticateToken, (req, res) => {
    res.json({ success: true });
  });
  console.log('✓ router.get() with auth middleware succeeded');
  
} catch (error) {
  console.error('✗ router.get() with auth middleware failed:', error.message);
  console.error('Stack:', error.stack);
}

console.log('\n3. Testing auth middleware in isolation...');
try {
  const { authenticateToken } = require('./server/middlewares/auth');
  
  // Test calling the function directly
  const mockReq = { headers: {} };
  const mockRes = {};
  let nextCalled = false;
  const mockNext = () => { nextCalled = true; };
  
  authenticateToken(mockReq, mockRes, mockNext);
  console.log('✓ authenticateToken function executed');
  console.log('next() was called:', nextCalled);
  
} catch (error) {
  console.error('✗ authenticateToken function execution failed:', error.message);
}