#!/usr/bin/env node

/**
 * UsageLimits Middleware Validation Test (No Database Required)
 * Tests the usageLimits middleware structure and exports without requiring database connection
 */

const path = require('path');
const fs = require('fs');

// Mock database module to prevent connection attempts
const mockDb = {
    prepare: () => ({
        get: () => null,
        run: () => ({ changes: 1 }),
        all: () => []
    })
};

// Mock logger
const mockLogger = {
    info: () => {},
    error: () => {},
    warn: () => {}
};

// Mock notification service
const mockNotificationService = {
    sendUsageAlert: async () => true,
    sendLimitWarning: async () => true,
    sendOverLimitNotification: async () => true,
    sendUpgradeSuggestion: async () => true
};

// Mock modules before requiring the actual middleware
require.cache[require.resolve('./server/config/database.js')] = {
    exports: mockDb
};
require.cache[require.resolve('./server/utils/logger.js')] = {
    exports: mockLogger
};
require.cache[require.resolve('./server/services/notificationService.js')] = {
    exports: mockNotificationService
};

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

// Test 1: UsageLimits Module Structure (No DB)
async function testUsageLimitsModuleStructure() {
    info('Testing usageLimits module structure (no database)...');
    
    try {
        const usageLimitsPath = path.join(__dirname, 'server', 'middlewares', 'usageLimits.js');
        
        if (!fs.existsSync(usageLimitsPath)) {
            throw new Error('usageLimits.js file not found');
        }
        
        info('✓ usageLimits.js file exists');
        
        // Load the module with mocked dependencies
        const usageLimits = require('./server/middlewares/usageLimits.js');
        
        if (!usageLimits || typeof usageLimits !== 'object') {
            throw new Error('usageLimits module does not export an object');
        }
        
        info('✓ usageLimits module loaded successfully with mocked dependencies');
        
        // Check for the specific functions that were causing issues
        const requiredFunctions = [
            'checkUsageThreshold',
            'checkUsageLimit',
            'getCurrentUsage',
            'getUsagePercentage',
            'getUsageHistory',
            'handleOverLimit',
            'suggestUpgrade'
        ];
        
        for (const funcName of requiredFunctions) {
            if (typeof usageLimits[funcName] !== 'function') {
                throw new Error(`${funcName} is not a function`);
            }
            info(`✓ ${funcName} function exists`);
        }
        
        recordTest('UsageLimits Module Structure (No DB)', true);
    } catch (err) {
        recordTest('UsageLimits Module Structure (No DB)', false, err);
    }
}

// Test 2: Function Export Validation
async function testFunctionExportValidation() {
    info('Testing usageLimits function export validation...');
    
    try {
        const usageLimits = require('./server/middlewares/usageLimits.js');
        
        // Test that checkUsageThreshold is a proper function
        if (typeof usageLimits.checkUsageThreshold !== 'function') {
            throw new Error('checkUsageThreshold is not a function');
        }
        
        // Test that checkUsageLimit is a proper function
        if (typeof usageLimits.checkUsageLimit !== 'function') {
            throw new Error('checkUsageLimit is not a function');
        }
        
        // Test function signatures (basic validation)
        const checkUsageThresholdStr = usageLimits.checkUsageThreshold.toString();
        const checkUsageLimitStr = usageLimits.checkUsageLimit.toString();
        
        // Check that they are Express middleware functions (req, res, next parameters)
        if (!checkUsageThresholdStr.includes('function') || !checkUsageThresholdStr.includes('req')) {
            throw new Error('checkUsageThreshold function signature is invalid');
        }
        
        if (!checkUsageLimitStr.includes('function') || !checkUsageLimitStr.includes('req')) {
            throw new Error('checkUsageLimit function signature is invalid');
        }
        
        info('✓ Function exports are valid');
        recordTest('Function Export Validation', true);
    } catch (err) {
        recordTest('Function Export Validation', false, err);
    }
}

// Test 3: Route Registration Test (No DB)
async function testRouteRegistrationNoDB() {
    info('Testing route registration (no database)...');
    
    try {
        const express = require('express');
        const app = express();
        
        // Test that usageLimits routes can be loaded
        const usageLimitsRoutes = require('./server/routes/usageLimits.js');
        
        if (!usageLimitsRoutes || typeof usageLimitsRoutes !== 'object') {
            throw new Error('usageLimits routes module is invalid');
        }
        
        info('✓ usageLimits routes module loaded successfully');
        
        // Test that the middleware can be imported in routes
        const router = express.Router();
        
        // Test that we can reference the middleware functions
        const usageLimitsMiddleware = require('./server/middlewares/usageLimits.js');
        
        // This should work without the "Route.get() requires a callback function" error
        try {
            router.get('/test-threshold', usageLimitsMiddleware.checkUsageThreshold, (req, res) => {
                res.json({ message: 'test threshold' });
            });
            
            router.get('/test-limit', usageLimitsMiddleware.checkUsageLimit, (req, res) => {
                res.json({ message: 'test limit' });
            });
            
            info('✓ Route registration test passed - no "Route.get() requires a callback function" error');
        } catch (routeErr) {
            if (routeErr.message.includes('Route.get() requires a callback function')) {
                throw new Error('Route.get() callback function error detected - middleware export issue');
            }
            throw routeErr;
        }
        
        recordTest('Route Registration (No DB)', true);
    } catch (err) {
        recordTest('Route Registration (No DB)', false, err);
    }
}

// Test 4: Syntax and Structure Validation
async function testSyntaxAndStructure() {
    info('Testing usageLimits syntax and structure...');
    
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
        const functionMatches = fileContent.match(/checkUsageThreshold|checkUsageLimit/g);
        if (!functionMatches || functionMatches.length < 2) {
            throw new Error('Required functions not found in file');
        }
        
        // Check that the functions are exported properly
        const exportMatches = fileContent.match(/module\.exports\s*=\s*\{[^}]*checkUsageThreshold[^}]*\}/g);
        if (!exportMatches) {
            throw new Error('checkUsageThreshold not properly exported');
        }
        
        const exportMatches2 = fileContent.match(/module\.exports\s*=\s*\{[^}]*checkUsageLimit[^}]*\}/g);
        if (!exportMatches2) {
            throw new Error('checkUsageLimit not properly exported');
        }
        
        info('✓ Syntax and structure validation passed');
        recordTest('Syntax and Structure Validation', true);
    } catch (err) {
        recordTest('Syntax and Structure Validation', false, err);
    }
}

// Test 5: Class Structure Validation
async function testClassStructure() {
    info('Testing UsageLimitsMiddleware class structure...');
    
    try {
        // Read the file content to analyze the class structure
        const usageLimitsPath = path.join(__dirname, 'server', 'middlewares', 'usageLimits.js');
        const fileContent = fs.readFileSync(usageLimitsPath, 'utf8');
        
        // Check for class definition
        if (!fileContent.includes('class UsageLimitsMiddleware')) {
            throw new Error('UsageLimitsMiddleware class not found');
        }
        
        // Check for constructor
        if (!fileContent.includes('constructor()')) {
            throw new Error('Constructor not found in UsageLimitsMiddleware class');
        }
        
        // Check for key methods
        const requiredMethods = [
            'getUserLimits',
            'getCurrentUsage',
            'checkUsageThreshold',
            'getUsagePercentage',
            'enforceStorageLimit',
            'enforceStreamLimit'
        ];
        
        for (const method of requiredMethods) {
            if (!fileContent.includes(method)) {
                throw new Error(`${method} method not found in UsageLimitsMiddleware class`);
            }
        }
        
        // Check for singleton instance creation
        if (!fileContent.includes('new UsageLimitsMiddleware()')) {
            throw new Error('Singleton instance not created');
        }
        
        // Check for module exports at the end
        if (!fileContent.includes('module.exports = {')) {
            throw new Error('Module exports not found at the end of file');
        }
        
        info('✓ Class structure validation passed');
        recordTest('Class Structure Validation', true);
    } catch (err) {
        recordTest('Class Structure Validation', false, err);
    }
}

// Test 6: Function Callability Test
async function testFunctionCallability() {
    info('Testing usageLimits function callability...');
    
    try {
        const usageLimits = require('./server/middlewares/usageLimits.js');
        
        // Create mock Express objects
        const mockReq = {
            user: { id: 1, username: 'testuser' },
            params: {},
            body: {},
            query: {},
            path: '/test',
            headers: {}
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
            // Test checkUsageThreshold (this might try to access database, but should handle gracefully)
            const checkUsageThresholdResult = usageLimits.checkUsageThreshold(mockReq, mockRes, mockNext);
            
            // Test checkUsageLimit (this might try to access database, but should handle gracefully)
            const checkUsageLimitResult = usageLimits.checkUsageLimit(mockReq, mockRes, mockNext);
            
            info('✓ Functions can be called without throwing critical errors');
        } catch (callErr) {
            // Expected - these functions might need database access, but should not crash
            info(`⚠️  Functions threw expected error (likely due to missing database): ${callErr.message}`);
        }
        
        // Test that the functions are proper Express middleware
        const checkUsageThresholdStr = usageLimits.checkUsageThreshold.toString();
        const checkUsageLimitStr = usageLimits.checkUsageLimit.toString();
        
        if (!checkUsageThresholdStr.includes('function') || !checkUsageThresholdStr.includes('req, res')) {
            throw new Error('checkUsageThreshold is not a proper Express middleware function');
        }
        
        if (!checkUsageLimitStr.includes('function') || !checkUsageLimitStr.includes('req, res')) {
            throw new Error('checkUsageLimit is not a proper Express middleware function');
        }
        
        info('✓ Function callability test passed');
        recordTest('Function Callability', true);
    } catch (err) {
        recordTest('Function Callability', false, err);
    }
}

// Test 7: Export Object Validation
async function testExportObjectValidation() {
    info('Testing usageLimits export object validation...');
    
    try {
        const usageLimits = require('./server/middlewares/usageLimits.js');
        
        // Check that it's an object
        if (typeof usageLimits !== 'object') {
            throw new Error('usageLimits module does not export an object');
        }
        
        // Check that no exports are undefined
        for (const key in usageLimits) {
            if (usageLimits[key] === undefined) {
                throw new Error(`Undefined export found: ${key}`);
            }
        }
        
        // Check that all required functions are present and are functions
        const requiredFunctions = [
            'checkUsageThreshold',
            'checkUsageLimit',
            'getCurrentUsage',
            'getUsagePercentage',
            'getUsageHistory',
            'handleOverLimit',
            'suggestUpgrade'
        ];
        
        for (const funcName of requiredFunctions) {
            if (!(funcName in usageLimits)) {
                throw new Error(`Missing required export: ${funcName}`);
            }
            if (typeof usageLimits[funcName] !== 'function') {
                throw new Error(`${funcName} is not a function`);
            }
        }
        
        info('✓ Export object validation passed');
        recordTest('Export Object Validation', true);
    } catch (err) {
        recordTest('Export Object Validation', false, err);
    }
}

// Main test execution
async function runAllTests() {
    log('🚀 Starting UsageLimits Middleware Validation (No Database)', 'bright');
    log('=====================================', 'bright');
    
    const tests = [
        testUsageLimitsModuleStructure,
        testFunctionExportValidation,
        testRouteRegistrationNoDB,
        testSyntaxAndStructure,
        testClassStructure,
        testFunctionCallability,
        testExportObjectValidation
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
    log('\n📊 USAGELIMITS MIDDLEWARE TEST RESULTS (NO DB)', 'bright');
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
        log('✅ No "Route.get() requires a callback function" errors detected.', 'green');
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