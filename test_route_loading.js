#!/usr/bin/env node

/**
 * Route Loading Validation Test
 * Tests all route files to ensure they load correctly and can be registered with Express
 */

const path = require('path');
const fs = require('fs');
const express = require('express');

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    const timestamp = new Date().toISOString();
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function error(message) {
    log(`❌ ERROR: ${message}`, 'red');
}

function success(message) {
    log(`✅ SUCCESS: ${message}`, 'green');
}

function info(message) {
    log(`ℹ️  INFO: ${message}`, 'cyan');
}

function warning(message) {
    log(`⚠️  WARNING: ${message}`, 'yellow');
}

// Test results tracking
const testResults = {
    passed: 0,
    failed: 0,
    errors: [],
    startTime: Date.now(),
    routesTested: [],
    middlewareIssues: []
};

function recordTest(testName, passed, error = null) {
    if (passed) {
        testResults.passed++;
        success(`Test passed: ${testName}`);
    } else {
        testResults.failed++;
        error(`Test failed: ${testName}`);
        if (error) {
            testResults.errors.push({ test: testName, error: error.message || error });
            console.error(error);
        }
    }
}

// Test 1: Route Files Existence
async function testRouteFilesExistence() {
    info('Testing route files existence...');
    
    const routeFiles = [
        'admin.js',
        'auth.js',
        'config.js',
        'coupons.js',
        'formFields.js',
        'health.js',
        'notifications.js',
        'packages.js',
        'registration.js',
        'setup.js',
        'subscriptions.js',
        'usageLimits.js',
        'users.js'
    ];
    
    const routesDir = path.join(__dirname, 'server', 'routes');
    
    try {
        if (!fs.existsSync(routesDir)) {
            throw new Error('Routes directory does not exist');
        }
        
        for (const file of routeFiles) {
            const filePath = path.join(routesDir, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Route file ${file} not found`);
            }
            info(`✓ ${file} exists`);
        }
        
        recordTest('Route Files Existence', true);
    } catch (err) {
        recordTest('Route Files Existence', false, err);
    }
}

// Test 2: Route Module Loading
async function testRouteModuleLoading() {
    info('Testing route module loading...');
    
    const routeFiles = [
        'admin.js',
        'auth.js',
        'config.js',
        'coupons.js',
        'formFields.js',
        'health.js',
        'notifications.js',
        'packages.js',
        'registration.js',
        'setup.js',
        'subscriptions.js',
        'usageLimits.js',
        'users.js'
    ];
    
    for (const file of routeFiles) {
        try {
            const routePath = path.join(__dirname, 'server', 'routes', file);
            const routeModule = require(routePath);
            
            // Routes should export a router or be a valid module
            if (!routeModule) {
                throw new Error(`${file} exports null or undefined`);
            }
            
            // Check if it's a router (has use, get, post methods) or a valid object
            const isRouter = routeModule.use && routeModule.get && routeModule.post;
            const isValidObject = typeof routeModule === 'object';
            
            if (!isRouter && !isValidObject) {
                throw new Error(`${file} does not export a valid router or object`);
            }
            
            info(`✓ ${file} module loaded successfully`);
            testResults.routesTested.push(file);
        } catch (err) {
            recordTest(`Route Module Loading - ${file}`, false, err);
            return;
        }
    }
    
    recordTest('Route Module Loading', true);
}

// Test 3: Express Route Registration
async function testExpressRouteRegistration() {
    info('Testing Express route registration...');
    
    try {
        const app = express();
        
        // Test each route file can be used with Express
        const routeFiles = [
            'admin.js',
            'auth.js',
            'config.js',
            'coupons.js',
            'formFields.js',
            'health.js',
            'notifications.js',
            'packages.js',
            'registration.js',
            'setup.js',
            'subscriptions.js',
            'usageLimits.js',
            'users.js'
        ];
        
        for (const file of routeFiles) {
            try {
                const routeModule = require(`./server/routes/${file}`);
                
                // Test that the route can be used with app.use()
                // This should not throw "Route.get() requires a callback function" error
                app.use(`/test-${file.replace('.js', '')}`, routeModule);
                
                info(`✓ ${file} can be registered with Express`);
            } catch (err) {
                if (err.message.includes('Route.get() requires a callback function')) {
                    testResults.middlewareIssues.push(file);
                    throw new Error(`${file} causes "Route.get() requires a callback function" error - likely middleware export issue`);
                }
                throw new Error(`${file} registration failed: ${err.message}`);
            }
        }
        
        recordTest('Express Route Registration', true);
    } catch (err) {
        recordTest('Express Route Registration', false, err);
    }
}

// Test 4: Middleware Integration Test
async function testMiddlewareIntegration() {
    info('Testing middleware integration with routes...');
    
    try {
        // Test that routes can use middleware functions
        const app = express();
        
        // Load middleware
        const authMiddleware = require('./server/middlewares/auth.js');
        const usageLimitsMiddleware = require('./server/middlewares/usageLimits.js');
        
        // Test usageLimits routes specifically (this was the problematic one)
        const usageLimitsRoutes = require('./server/routes/usageLimits.js');
        
        // This should work without the "Route.get() requires a callback function" error
        app.use('/api/usage-limits', usageLimitsRoutes);
        
        info('✓ usageLimits routes registered successfully without callback function errors');
        
        // Test other routes with middleware
        const authRoutes = require('./server/routes/auth.js');
        app.use('/api/auth', authRoutes);
        
        const adminRoutes = require('./server/routes/admin.js');
        app.use('/api/admin', adminRoutes);
        
        info('✓ Routes with middleware integration test passed');
        recordTest('Middleware Integration', true);
    } catch (err) {
        recordTest('Middleware Integration', false, err);
    }
}

// Test 5: Route Structure Validation
async function testRouteStructureValidation() {
    info('Testing route structure validation...');
    
    const routeFiles = [
        'admin.js',
        'auth.js',
        'config.js',
        'coupons.js',
        'formFields.js',
        'health.js',
        'notifications.js',
        'packages.js',
        'registration.js',
        'setup.js',
        'subscriptions.js',
        'usageLimits.js',
        'users.js'
    ];
    
    try {
        for (const file of routeFiles) {
            const routePath = path.join(__dirname, 'server', 'routes', file);
            const fileContent = fs.readFileSync(routePath, 'utf8');
            
            // Check for common issues
            if (fileContent.includes('router.get()') && !fileContent.includes('router.get(')) {
                warning(`${file} contains empty router.get() calls`);
            }
            
            if (fileContent.includes('router.post()') && !fileContent.includes('router.post(')) {
                warning(`${file} contains empty router.post() calls`);
            }
            
            // Check for proper router initialization
            if (!fileContent.includes('express.Router()') && !fileContent.includes('Router()')) {
                warning(`${file} might not be using express.Router()`);
            }
            
            // Check for proper exports
            if (!fileContent.includes('module.exports')) {
                warning(`${file} might not be exporting the router properly`);
            }
            
            info(`✓ ${file} structure validation completed`);
        }
        
        recordTest('Route Structure Validation', true);
    } catch (err) {
        recordTest('Route Structure Validation', false, err);
    }
}

// Test 6: Specific Route Issues (usageLimits focus)
async function testSpecificRouteIssues() {
    info('Testing specific route issues (usageLimits focus)...');
    
    try {
        // Focus on usageLimits routes that were causing issues
        const usageLimitsPath = path.join(__dirname, 'server', 'routes', 'usageLimits.js');
        const usageLimitsContent = fs.readFileSync(usageLimitsPath, 'utf8');
        
        // Check for the specific error pattern that was causing issues
        const problematicPatterns = [
            /router\.get\s*\(\s*['"][^'"]*['"]\s*,\s*\)\s*/g, // Empty callback
            /router\.post\s*\(\s*['"][^'"]*['"]\s*,\s*\)\s*/g, // Empty callback
            /undefined\s*\.\s*checkUsageThreshold/g, // Undefined reference
            /undefined\s*\.\s*checkUsageLimit/g // Undefined reference
        ];
        
        for (const pattern of problematicPatterns) {
            const matches = usageLimitsContent.match(pattern);
            if (matches) {
                throw new Error(`Found problematic pattern in usageLimits.js: ${matches[0]}`);
            }
        }
        
        // Test that middleware functions are properly referenced
        if (!usageLimitsContent.includes('checkUsageThreshold') || !usageLimitsContent.includes('checkUsageLimit')) {
            warning('usageLimits.js does not reference checkUsageThreshold or checkUsageLimit functions');
        }
        
        info('✓ usageLimits route specific issues test passed');
        
        // Test other potentially problematic routes
        const subscriptionRoutes = require('./server/routes/subscriptions.js');
        const adminRoutes = require('./server/routes/admin.js');
        
        // These should load without issues
        if (!subscriptionRoutes || !adminRoutes) {
            throw new Error('Subscription or admin routes failed to load');
        }
        
        recordTest('Specific Route Issues', true);
    } catch (err) {
        recordTest('Specific Route Issues', false, err);
    }
}

// Test 7: Route Dependencies Test
async function testRouteDependencies() {
    info('Testing route dependencies...');
    
    try {
        // Test that routes can load their dependencies
        const routesDir = path.join(__dirname, 'server', 'routes');
        const routeFiles = fs.readdirSync(routesDir).filter(file => file.endsWith('.js'));
        
        for (const file of routeFiles) {
            try {
                // Clear require cache to test fresh loading
                const routePath = path.join(routesDir, file);
                delete require.cache[require.resolve(routePath)];
                
                // Load route fresh
                const routeModule = require(routePath);
                
                info(`✓ ${file} dependencies loaded successfully`);
            } catch (err) {
                throw new Error(`${file} dependency loading failed: ${err.message}`);
            }
        }
        
        recordTest('Route Dependencies', true);
    } catch (err) {
        recordTest('Route Dependencies', false, err);
    }
}

// Test 8: Router Instance Validation
async function testRouterInstanceValidation() {
    info('Testing router instance validation...');
    
    try {
        const express = require('express');
        
        // Create a test router
        const testRouter = express.Router();
        
        // Test that we can add routes to it
        testRouter.get('/test', (req, res) => res.json({ test: true }));
        testRouter.post('/test', (req, res) => res.json({ test: true }));
        
        // Test that route modules return valid routers
        const usageLimitsRoutes = require('./server/routes/usageLimits.js');
        
        // Check if it has router methods
        const routerMethods = ['use', 'get', 'post', 'put', 'delete'];
        const hasRouterMethods = routerMethods.every(method => 
            typeof usageLimitsRoutes[method] === 'function'
        );
        
        if (!hasRouterMethods) {
            throw new Error('usageLimits routes do not have proper router methods');
        }
        
        info('✓ Router instance validation passed');
        recordTest('Router Instance Validation', true);
    } catch (err) {
        recordTest('Router Instance Validation', false, err);
    }
}

// Main test execution
async function runAllTests() {
    log('🚀 Starting Route Loading Validation', 'bright');
    log('=====================================', 'bright');
    
    const tests = [
        testRouteFilesExistence,
        testRouteModuleLoading,
        testExpressRouteRegistration,
        testMiddlewareIntegration,
        testRouteStructureValidation,
        testSpecificRouteIssues,
        testRouteDependencies,
        testRouterInstanceValidation
    ];
    
    for (const test of tests) {
        try {
            await test();
        } catch (err) {
            error(`Test execution failed: ${err.message}`);
            testResults.failed++;
            testResults.errors.push({ test: test.name, error: err.message });
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Final results
    log('\n📊 ROUTE LOADING TEST RESULTS', 'bright');
    log('=====================================', 'bright');
    
    const duration = Date.now() - testResults.startTime;
    const totalTests = testResults.passed + testResults.failed;
    
    log(`Total Tests: ${totalTests}`, 'cyan');
    log(`Passed: ${testResults.passed}`, 'green');
    log(`Failed: ${testResults.failed}`, 'red');
    log(`Routes Tested: ${testResults.routesTested.length}`, 'cyan');
    log(`Duration: ${duration}ms`, 'cyan');
    
    if (testResults.middlewareIssues.length > 0) {
        log(`\n⚠️  Middleware Issues Found In: ${testResults.middlewareIssues.join(', ')}`, 'yellow');
    }
    
    if (testResults.failed > 0) {
        log('\n❌ FAILED TESTS:', 'red');
        testResults.errors.forEach((err, index) => {
            log(`${index + 1}. ${err.test}: ${err.error}`, 'red');
        });
        
        log('\n⚠️  Route loading has issues that need to be resolved before deployment.', 'yellow');
    } else {
        log('\n🎉 ALL ROUTE LOADING TESTS PASSED!', 'green');
        log('✅ All routes are properly configured and ready for deployment.', 'green');
    }
    
    return testResults.failed === 0;
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    error(`Uncaught Exception: ${err.message}`);
    console.error(err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
});

// Run tests if this script is executed directly
if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(err => {
        error(`Test suite failed: ${err.message}`);
        process.exit(1);
    });
}

module.exports = {
    runAllTests,
    testResults
};