console.log('Testing server startup with detailed error handling...');

// Set up environment
process.env.SETUP_COMPLETED = 'true';
process.env.PORT = '3002';
process.env.CORS_ORIGIN = '*';

// Enhanced mock database
const mockDb = {
  prepare: (query) => {
    console.log('DB Query:', query.substring(0, 50) + '...');
    return {
      run: (...params) => ({ changes: 1, lastInsertRowid: 1 }),
      get: (...params) => {
        // Return different data based on query
        if (query.includes('isAdmin')) return { isAdmin: true };
        if (query.includes('api_users WHERE id')) return { id: 1, email: 'test@test.com' };
        return null;
      },
      all: (...params) => []
    };
  },
  pragma: (statement) => {},
  close: () => {}
};

const mockLogger = {
  info: (msg) => console.log('[INFO]', msg),
  error: (msg, err) => console.log('[ERROR]', msg, err?.message || ''),
  debug: (msg) => console.log('[DEBUG]', msg)
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
    req.user = { id: 1, email: 'test@test.com' };
    next();
  }
};

require.cache[require.resolve('./server/middlewares/auditLogger')] = {
  exports: (action) => (req, res, next) => next()
};

// Mock error handler
require.cache[require.resolve('./server/middlewares/errorHandler')] = {
  exports: (err, req, res, next) => {
    console.log('Error handler caught:', err.message);
    console.log('Error stack:', err.stack);
  }
};

// Mock other dependencies
require.cache[require.resolve('./server/middlewares/rateLimiter')] = {
  exports: {}
};

require.cache[require.resolve('./server/scheduler')] = {
  exports: {
    start: () => console.log('Scheduler started'),
    stop: () => console.log('Scheduler stopped')
  }
};

class MockWebSocketServer {
  constructor(server) {
    console.log('WebSocket server initialized');
  }
}

require.cache[require.resolve('./server/websocket')] = {
  exports: MockWebSocketServer
};

// Now try to load each route individually to find the problematic one
console.log('\n1. Testing individual route imports...');

const routes = [
  'auth',
  'users', 
  'admin',
  'config',
  'registration',
  'notifications',
  'coupons',
  'subscriptions',
  'packages',
  'usageLimits',
  'health'
];

let problematicRoute = null;

for (const routeName of routes) {
  try {
    console.log(`Testing ${routeName} routes...`);
    delete require.cache[require.resolve(`./server/routes/${routeName}`)];
    const routeModule = require(`./server/routes/${routeName}`);
    console.log(`✓ ${routeName} routes loaded successfully`);
  } catch (error) {
    console.error(`✗ ${routeName} routes failed:`, error.message);
    if (error.message.includes('Route.get() requires a callback function')) {
      console.log(`🎯 FOUND IT! The ${routeName} routes are causing the issue!`);
      problematicRoute = routeName;
      break;
    }
  }
}

if (problematicRoute) {
  console.log(`\n2. Investigating ${problematicRoute} routes in detail...`);
  // Let's examine the specific problematic route
  try {
    delete require.cache[require.resolve(`./server/routes/${problematicRoute}`)];
    
    // Let's manually check what's being exported
    const routeModule = require(`./server/routes/${problematicRoute}`);
    console.log(`${problematicRoute} route module type:`, typeof routeModule);
    console.log(`${problematicRoute} route module keys:`, Object.keys(routeModule));
    
    // If it's usageLimits, let's check the specific functions
    if (problematicRoute === 'usageLimits') {
      const usageLimits = require('./server/middlewares/usageLimits');
      console.log('Available functions:', Object.keys(usageLimits));
      
      // Test each problematic function
      ['getCurrentUsage', 'getUsagePercentage', 'getUsageHistory'].forEach(funcName => {
        const func = usageLimits[funcName];
        console.log(`${funcName}:`, typeof func, 'length:', func?.length);
        
        // Try to create a route with it
        const express = require('express');
        const testRouter = express.Router();
        try {
          testRouter.get('/test', func);
          console.log(`✓ ${funcName} works with router.get()`);
        } catch (error) {
          console.error(`✗ ${funcName} failed with router.get():`, error.message);
        }
      });
    }
  } catch (error) {
    console.error(`Error investigating ${problematicRoute}:`, error.message);
  }
} else {
  console.log('\n2. No routing errors found in individual tests.');
  console.log('The error might occur during server startup or when routes are mounted.');
  
  // Try to start a minimal server
  console.log('\n3. Testing minimal server startup...');
  try {
    const express = require('express');
    const app = express();
    
    // Import usage limits routes
    const usageLimitsRoutes = require('./server/routes/usageLimits');
    
    // Mount routes
    app.use('/api/usage-limits', usageLimitsRoutes);
    
    console.log('✓ Minimal server with usage limits routes started successfully');
    
    // Test a request
    const req = { 
      user: { id: 1 },
      method: 'GET',
      url: '/api/usage-limits/current'
    };
    const res = {
      json: (data) => console.log('Response:', data),
      status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) })
    };
    const next = () => console.log('Next called');
    
    // Simulate a request
    console.log('Testing GET /api/usage-limits/current...');
    const usageLimits = require('./server/middlewares/usageLimits');
    usageLimits.getCurrentUsage(req, res, next);
    
  } catch (error) {
    console.error('✗ Minimal server failed:', error.message);
    console.error('Stack:', error.stack);
  }
}