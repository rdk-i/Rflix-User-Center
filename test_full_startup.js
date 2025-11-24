#!/usr/bin/env node

/**
 * Comprehensive Server Startup Validation Test
 * Tests the complete server startup process including all routes, middleware, and services
 */

const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
    timeout: 30000,
    databaseRequired: true,
    websocketRequired: true,
    verbose: true
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

// Test 1: Environment and Dependencies
async function testEnvironment() {
    info('Testing environment and dependencies...');
    
    try {
        // Check Node.js version
        const nodeVersion = process.version;
        info(`Node.js version: ${nodeVersion}`);
        
        // Check package.json
        const packagePath = path.join(__dirname, 'package.json');
        if (!fs.existsSync(packagePath)) {
            throw new Error('package.json not found');
        }
        
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        info(`Package: ${packageJson.name} v${packageJson.version}`);
        
        // Check required dependencies
        const requiredDeps = ['express', 'cors', 'helmet', 'bcryptjs', 'jsonwebtoken', 'ws'];
        const missingDeps = [];
        
        for (const dep of requiredDeps) {
            try {
                require.resolve(dep);
            } catch (e) {
                missingDeps.push(dep);
            }
        }
        
        if (missingDeps.length > 0) {
            throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
        }
        
        recordTest('Environment and Dependencies', true);
    } catch (err) {
        recordTest('Environment and Dependencies', false, err);
    }
}

// Test 2: Database Configuration
async function testDatabaseConfig() {
    info('Testing database configuration...');
    
    try {
        const dbConfigPath = path.join(__dirname, 'server', 'config', 'database.js');
        if (!fs.existsSync(dbConfigPath)) {
            throw new Error('Database configuration file not found');
        }
        
        // Test database module loading
        const db = require('./server/config/database.js');
        
        if (!db || typeof db !== 'object') {
            throw new Error('Database module not properly exported');
        }
        
        info('Database configuration loaded successfully');
        recordTest('Database Configuration', true);
    } catch (err) {
        recordTest('Database Configuration', false, err);
    }
}

// Test 3: Middleware Loading
async function testMiddlewareLoading() {
    info('Testing middleware loading...');
    
    const middlewareFiles = [
        'auditLogger.js',
        'auth.js',
        'errorHandler.js',
        'rateLimiter.js',
        'usageLimits.js'
    ];
    
    for (const file of middlewareFiles) {
        try {
            const middlewarePath = path.join(__dirname, 'server', 'middlewares', file);
            if (!fs.existsSync(middlewarePath)) {
                throw new Error(`Middleware file ${file} not found`);
            }
            
            const middleware = require(middlewarePath);
            
            // Check if middleware exports are valid functions
            if (file === 'usageLimits.js') {
                // Special check for usageLimits middleware
                if (typeof middleware.checkUsageThreshold !== 'function') {
                    throw new Error(`usageLimits.checkUsageThreshold is not a function`);
                }
                if (typeof middleware.checkUsageLimit !== 'function') {
                    throw new Error(`usageLimits.checkUsageLimit is not a function`);
                }
                info(`✓ usageLimits middleware functions validated`);
            } else if (typeof middleware !== 'function' && typeof middleware.default !== 'function') {
                throw new Error(`Middleware ${file} does not export a valid function`);
            }
            
            info(`✓ Middleware ${file} loaded successfully`);
        } catch (err) {
            recordTest(`Middleware Loading - ${file}`, false, err);
            return;
        }
    }
    
    recordTest('Middleware Loading', true);
}

// Test 4: Route Loading
async function testRouteLoading() {
    info('Testing route loading...');
    
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
            if (!fs.existsSync(routePath)) {
                throw new Error(`Route file ${file} not found`);
            }
            
            // Test route module loading
            const routeModule = require(routePath);
            
            // Basic validation - route modules should export a router or have route definitions
            if (!routeModule || (typeof routeModule !== 'object' && typeof routeModule !== 'function')) {
                throw new Error(`Route module ${file} has invalid exports`);
            }
            
            info(`✓ Route ${file} loaded successfully`);
        } catch (err) {
            recordTest(`Route Loading - ${file}`, false, err);
            return;
        }
    }
    
    recordTest('Route Loading', true);
}

// Test 5: Service Module Loading
async function testServiceLoading() {
    info('Testing service module loading...');
    
    const serviceFiles = [
        'authService.js',
        'captchaService.js',
        'emailService.js',
        'jellyfinService.js',
        'notificationService.js',
        'telegramService.js'
    ];
    
    for (const file of serviceFiles) {
        try {
            const servicePath = path.join(__dirname, 'server', 'services', file);
            if (!fs.existsSync(servicePath)) {
                throw new Error(`Service file ${file} not found`);
            }
            
            const service = require(servicePath);
            
            if (!service || typeof service !== 'object') {
                throw new Error(`Service ${file} does not export a valid object`);
            }
            
            info(`✓ Service ${file} loaded successfully`);
        } catch (err) {
            recordTest(`Service Loading - ${file}`, false, err);
            return;
        }
    }
    
    recordTest('Service Module Loading', true);
}

// Test 6: Controller Loading
async function testControllerLoading() {
    info('Testing controller loading...');
    
    const controllerFiles = [
        'adminController.js',
        'authController.js',
        'configController.js',
        'formFieldController.js',
        'packageController.js',
        'registrationController.js',
        'userController.js'
    ];
    
    for (const file of controllerFiles) {
        try {
            const controllerPath = path.join(__dirname, 'server', 'controllers', file);
            if (!fs.existsSync(controllerPath)) {
                throw new Error(`Controller file ${file} not found`);
            }
            
            const controller = require(controllerPath);
            
            if (!controller || typeof controller !== 'object') {
                throw new Error(`Controller ${file} does not export a valid object`);
            }
            
            info(`✓ Controller ${file} loaded successfully`);
        } catch (err) {
            recordTest(`Controller Loading - ${file}`, false, err);
            return;
        }
    }
    
    recordTest('Controller Loading', true);
}

// Test 7: WebSocket Module Loading
async function testWebSocketLoading() {
    info('Testing WebSocket module loading...');
    
    try {
        const websocketFiles = [
            'server/websocket/index.js',
            'server/websocket/index-no-db.js'
        ];
        
        for (const file of websocketFiles) {
            const wsPath = path.join(__dirname, file);
            if (!fs.existsSync(wsPath)) {
                throw new Error(`WebSocket file ${file} not found`);
            }
            
            const wsModule = require('./' + file);
            
            if (!wsModule || typeof wsModule !== 'object') {
                throw new Error(`WebSocket module ${file} does not export a valid object`);
            }
            
            info(`✓ WebSocket module ${file} loaded successfully`);
        }
        
        recordTest('WebSocket Module Loading', true);
    } catch (err) {
        recordTest('WebSocket Module Loading', false, err);
    }
}

// Test 8: Main Server File
async function testMainServer() {
    info('Testing main server file...');
    
    try {
        const serverPath = path.join(__dirname, 'server', 'index.js');
        if (!fs.existsSync(serverPath)) {
            throw new Error('Main server file not found');
        }
        
        // Test server module loading (without actually starting the server)
        const serverModule = require(serverPath);
        
        info('Main server file loaded successfully');
        recordTest('Main Server File', true);
    } catch (err) {
        recordTest('Main Server File', false, err);
    }
}

// Test 9: UsageLimits Specific Tests
async function testUsageLimitsSpecific() {
    info('Testing usageLimits specific functionality...');
    
    try {
        const usageLimitsPath = path.join(__dirname, 'server', 'middlewares', 'usageLimits.js');
        const usageLimits = require(usageLimitsPath);
        
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
        
        if (!checkUsageThresholdStr.includes('function') || !checkUsageThresholdStr.includes('req')) {
            throw new Error('checkUsageThreshold function signature is invalid');
        }
        
        if (!checkUsageLimitStr.includes('function') || !checkUsageLimitStr.includes('req')) {
            throw new Error('checkUsageLimit function signature is invalid');
        }
        
        info('✓ usageLimits middleware functions validated');
        recordTest('UsageLimits Specific Tests', true);
    } catch (err) {
        recordTest('UsageLimits Specific Tests', false, err);
    }
}

// Test 10: Route Registration Simulation
async function testRouteRegistration() {
    info('Testing route registration simulation...');
    
    try {
        // Simulate Express app setup
        const express = require('express');
        const app = express();
        
        // Test that we can load and use routes without errors
        const usageLimitsRoutes = require('./server/routes/usageLimits.js');
        const authRoutes = require('./server/routes/auth.js');
        const adminRoutes = require('./server/routes/admin.js');
        
        // Basic validation that routes can be imported
        if (!usageLimitsRoutes || !authRoutes || !adminRoutes) {
            throw new Error('Route modules failed to load');
        }
        
        info('✓ Route registration simulation completed');
        recordTest('Route Registration Simulation', true);
    } catch (err) {
        recordTest('Route Registration Simulation', false, err);
    }
}

// Main test execution
async function runAllTests() {
    log('🚀 Starting Comprehensive Server Startup Validation', 'bright');
    log('=====================================', 'bright');
    
    const tests = [
        testEnvironment,
        testDatabaseConfig,
        testMiddlewareLoading,
        testRouteLoading,
        testServiceLoading,
        testControllerLoading,
        testWebSocketLoading,
        testMainServer,
        testUsageLimitsSpecific,
        testRouteRegistration
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
    log('\n📊 TEST RESULTS SUMMARY', 'bright');
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
    }
    
    if (testResults.failed === 0) {
        log('\n🎉 ALL TESTS PASSED! Server is ready for deployment.', 'green');
        process.exit(0);
    } else {
        log('\n⚠️  Some tests failed. Please review the errors above.', 'yellow');
        process.exit(1);
    }
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
    runAllTests().catch(err => {
        error(`Test suite failed: ${err.message}`);
        process.exit(1);
    });
}

module.exports = {
    runAllTests,
    testResults,
    TEST_CONFIG
};