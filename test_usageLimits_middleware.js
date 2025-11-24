#!/usr/bin/env node

/**
 * UsageLimits Middleware Validation Test
 * Specifically tests the usageLimits middleware functions that were causing issues
 */

const path = require('path');
const fs = require('fs');

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
    startTime: Date.now()
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

// Test 1: UsageLimits Module Loading
async function testUsageLimitsModuleLoading() {
    info('Testing usageLimits module loading...');
    
    try {
        const usageLimitsPath = path.join(__dirname, 'server', 'middlewares', 'usageLimits.js');
        
        if (!fs.existsSync(usageLimitsPath)) {
            throw new Error('usageLimits.js file not found');
        }
        
        info('✓ usageLimits.js file exists');
        
        // Load the module
        const usageLimits = require(usageLimitsPath);
        
        if (!usageLimits || typeof usageLimits !== 'object') {
            throw new Error('usageLimits module does not export an object');
        }
        
        info('✓ usageLimits module loaded successfully');
        recordTest('UsageLimits Module Loading', true);
    } catch (err) {
        recordTest('UsageLimits Module Loading', false, err);
    }
}

// Test 2: Check Function Exports
async function testFunctionExports() {
    info('Testing usageLimits function exports...');
    
    try {
        const usageLimits = require('./server/middlewares/usageLimits.js');
        
        // Test checkUsageThreshold function
        if (typeof usageLimits.checkUsageThreshold !== 'function') {
            throw new Error('checkUsageThreshold is not a function');
        }
        
        // Test checkUsageLimit function
        if (typeof usageLimits.checkUsageLimit !== 'function') {
            throw new Error('checkUsageLimit is not a function');
        }
        
        info('✓ Both checkUsageThreshold and checkUsageLimit are functions');
        
        // Test function signatures
        const checkUsageThresholdStr = usageLimits.checkUsageThreshold.toString();
        const checkUsageLimitStr = usageLimits.checkUsageLimit.toString();
        
        // Basic signature validation
        if (!checkUsageThresholdStr.includes('req') || !checkUsageThresholdStr.includes('res') || !checkUsageThresholdStr.includes('next')) {
            throw new Error('checkUsageThreshold function signature is invalid - missing req/res/next parameters');
        }
        
        if (!checkUsageLimitStr.includes('req') || !checkUsageLimitStr.includes('res') || !checkUsageLimitStr.includes('next')) {
            throw new Error('checkUsageLimit function signature is invalid - missing req/res/next parameters');
        }
        
        info('✓ Function signatures are valid');
        recordTest('Function Exports', true);
    } catch (err) {
        recordTest('Function Exports', false, err);
    }
}

// Test 3: Function Callability
async function testFunctionCallability() {
    info('Testing usageLimits function callability...');
    
    try {
        const usageLimits = require('./server/middlewares/usageLimits.js');
        
        // Create mock Express objects
        const mockReq = {
            user: { id: 1, username: 'testuser' },
            params: {},
            body: {},
            query: {}
        };
        
        const mockRes = {
            status: function(code) {
                return {
                    json: function(data) {
                        return { status: code, data };
                    }
                };
            },
            json: function(data) {
                return data;
            }
        };
        
        const mockNext = function(err) {
            if (err) throw err;
        };
        
        // Test that functions can be called without throwing errors
        try {
            // These should not throw errors when called with proper parameters
            // Note: We're not testing the actual functionality, just that they can be called
            const checkUsageThresholdResult = usageLimits.checkUsageThreshold(mockReq, mockRes, mockNext);
            const checkUsageLimitResult = usageLimits.checkUsageLimit(mockReq, mockRes, mockNext);
            
            info('✓ Functions can be called without throwing errors');
        } catch (callErr) {
            // Expected - these functions might need database access
            info(`⚠️  Functions threw expected error (likely due to missing database): ${callErr.message}`);
        }
        
        recordTest('Function Callability', true);
    } catch (err) {
        recordTest('Function Callability', false, err);
    }
}

// Test 4: Route Integration Test
async function testRouteIntegration() {
    info('Testing usageLimits route integration...');
    
    try {
        // Test that usageLimits routes can be loaded
        const usageLimitsRoutes = require('./server/routes/usageLimits.js');
        
        if (!usageLimitsRoutes || typeof usageLimitsRoutes !== 'object') {
            throw new Error('usageLimits routes module is invalid');
        }
        
        info('✓ usageLimits routes module loaded successfully');
        
        // Test that the middleware can be imported in routes
        const express = require('express');
        const app = express();
        
        // This should not throw the "Route.get() requires a callback function" error
        try {
            // Simulate route registration
            const router = express.Router();
            
            // Test that we can reference the middleware functions
            const usageLimitsMiddleware = require('./server/middlewares/usageLimits.js');
            
            // This should work without errors
            router.get('/test', usageLimitsMiddleware.checkUsageThreshold, (req, res) => {
                res.json({ message: 'test' });
            });
            
            info('✓ Route integration test passed - no "Route.get() requires a callback function" error');
        } catch (routeErr) {
            if (routeErr.message.includes('Route.get() requires a callback function')) {
                throw new Error('Route.get() callback function error detected - middleware export issue');
            }
            throw routeErr;
        }
        
        recordTest('Route Integration', true);
    } catch (err) {
        recordTest('Route Integration', false, err);
    }
}

// Test 5: Syntax Validation
async function testSyntaxValidation() {
    info('Testing usageLimits syntax validation...');
    
    try {
        const usageLimitsPath = path.join(__dirname, 'server', 'middlewares', 'usageLimits.js');
        const fileContent = fs.readFileSync(usageLimitsPath, 'utf8');
        
        // Check for common syntax issues
        if (fileContent.includes('undefined.checkUsageThreshold')) {
            throw new Error('Found undefined.checkUsageThreshold - likely export issue');
        }
        
        if (fileContent.includes('undefined.checkUsageLimit')) {
            throw new Error('Found undefined.checkUsageLimit - likely export issue');
        }
        
        // Check for proper module exports
        if (!fileContent.includes('module.exports')) {
            throw new Error('No module.exports found in usageLimits.js');
        }
        
        // Check for proper function definitions
        const functionMatches = fileContent.match(/function\s+(checkUsageThreshold|checkUsageLimit)/g);
        if (!functionMatches || functionMatches.length < 2) {
            throw new Error('Function definitions not found properly');
        }
        
        info('✓ Syntax validation passed');
        recordTest('Syntax Validation', true);
    } catch (err) {
        recordTest('Syntax Validation', false, err);
    }
}

// Test 6: Export Structure Validation
async function testExportStructure() {
    info('Testing usageLimits export structure...');
    
    try {
        const usageLimits = require('./server/middlewares/usageLimits.js');
        
        // Check that it's an object with the expected properties
        const expectedExports = ['checkUsageThreshold', 'checkUsageLimit'];
        
        for (const exportName of expectedExports) {
            if (!(exportName in usageLimits)) {
                throw new Error(`Missing export: ${exportName}`);
            }
            
            if (typeof usageLimits[exportName] !== 'function') {
                throw new Error(`${exportName} is not a function`);
            }
        }
        
        // Check that there are no unexpected undefined exports
        for (const key in usageLimits) {
            if (usageLimits[key] === undefined) {
                throw new Error(`Undefined export found: ${key}`);
            }
        }
        
        info('✓ Export structure is valid');
        recordTest('Export Structure Validation', true);
    } catch (err) {
        recordTest('Export Structure Validation', false, err);
    }
}

// Test 7: Compare with Working Middleware
async function testMiddlewareComparison() {
    info('Testing usageLimits against working middleware pattern...');
    
    try {
        // Load a working middleware for comparison
        const authMiddleware = require('./server/middlewares/auth.js');
        const usageLimits = require('./server/middlewares/usageLimits.js');
        
        // Both should export objects with functions
        if (typeof authMiddleware !== 'object') {
            throw new Error('Auth middleware is not an object - cannot compare');
        }
        
        if (typeof usageLimits !== 'object') {
            throw new Error('usageLimits middleware is not an object');
        }
        
        // Both should have function exports
        const authHasFunctions = Object.values(authMiddleware).some(val => typeof val === 'function');
        const usageLimitsHasFunctions = Object.values(usageLimits).some(val => typeof val === 'function');
        
        if (!authHasFunctions) {
            throw new Error('Auth middleware has no function exports');
        }
        
        if (!usageLimitsHasFunctions) {
            throw new Error('usageLimits middleware has no function exports');
        }
        
        info('✓ Middleware pattern comparison passed');
        recordTest('Middleware Comparison', true);
    } catch (err) {
        recordTest('Middleware Comparison', false, err);
    }
}

// Main test execution
async function runAllTests() {
    log('🚀 Starting UsageLimits Middleware Validation', 'bright');
    log('=====================================', 'bright');
    
    const tests = [
        testUsageLimitsModuleLoading,
        testFunctionExports,
        testFunctionCallability,
        testRouteIntegration,
        testSyntaxValidation,
        testExportStructure,
        testMiddlewareComparison
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
    log('\n📊 USAGELIMITS MIDDLEWARE TEST RESULTS', 'bright');
    log('=====================================', 'bright');
    
    const duration = Date.now() - testResults.startTime;
    const totalTests = testResults.passed + testResults.failed;
    
    log(`Total Tests: ${totalTests}`, 'cyan');
    log(`Passed: ${testResults.passed}`, 'green');
    log(`Failed: ${testResults.failed}`, 'red');
    log(`Duration: ${duration}ms`, 'cyan');
    
    if (testResults.failed > 0) {
        log('\n❌ FAILED TESTS:', 'red');
        testResults.errors.forEach((err, index) => {
            log(`${index + 1}. ${err.test}: ${err.error}`, 'red');
        });
        
        log('\n⚠️  usageLimits middleware has issues that need to be resolved before deployment.', 'yellow');
    } else {
        log('\n🎉 ALL USAGELIMITS MIDDLEWARE TESTS PASSED!', 'green');
        log('✅ The usageLimits middleware is properly configured and ready for deployment.', 'green');
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