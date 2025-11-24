#!/usr/bin/env node

/**
 * Integration Reliability Test Script
 * 
 * This script tests the enhanced error handling and reliability improvements
 * for external API integrations in Rflix-User-Center.
 */

const axios = require('axios');
const logger = require('./server/utils/logger');

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  testDuration: parseInt(process.env.TEST_DURATION) || 30000, // 30 seconds
  concurrentRequests: parseInt(process.env.CONCURRENT_REQUESTS) || 5,
  jellyfinTestUrl: process.env.JELLYFIN_TEST_URL || 'http://localhost:8096',
  emailTestEnabled: process.env.EMAIL_TEST_ENABLED !== 'false',
  telegramTestEnabled: process.env.TELEGRAM_TEST_ENABLED !== 'false',
  captchaTestEnabled: process.env.CAPTCHA_TEST_ENABLED !== 'false'
};

// Test results
const testResults = {
  startTime: new Date(),
  healthChecks: [],
  apiCalls: [],
  errors: [],
  summary: {}
};

/**
 * Main test runner
 */
async function runIntegrationTests() {
  console.log('🧪 Starting Integration Reliability Tests...');
  console.log(`📍 Base URL: ${TEST_CONFIG.baseUrl}`);
  console.log(`⏱️  Duration: ${TEST_CONFIG.testDuration}ms`);
  console.log(`🔄 Concurrent Requests: ${TEST_CONFIG.concurrentRequests}`);
  console.log('');

  try {
    // Phase 1: Health Check Tests
    console.log('🔍 Phase 1: Health Check Tests');
    await testHealthEndpoints();
    console.log('✅ Health check tests completed\n');

    // Phase 2: Jellyfin Integration Tests
    console.log('🎬 Phase 2: Jellyfin Integration Tests');
    await testJellyfinIntegration();
    console.log('✅ Jellyfin tests completed\n');

    // Phase 3: Email Service Tests
    if (TEST_CONFIG.emailTestEnabled) {
      console.log('📧 Phase 3: Email Service Tests');
      await testEmailService();
      console.log('✅ Email tests completed\n');
    }

    // Phase 4: Circuit Breaker Tests
    console.log('🔌 Phase 4: Circuit Breaker Tests');
    await testCircuitBreaker();
    console.log('✅ Circuit breaker tests completed\n');

    // Phase 5: Concurrent Load Tests
    console.log('⚡ Phase 5: Concurrent Load Tests');
    await testConcurrentLoad();
    console.log('✅ Load tests completed\n');

    // Generate summary
    generateTestSummary();
    printTestResults();

  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    testResults.errors.push({
      phase: 'test_runner',
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Test health endpoints
 */
async function testHealthEndpoints() {
  const healthTests = [
    { name: 'Basic Health Check', endpoint: '/health' },
    { name: 'Detailed Health Check', endpoint: '/health/detailed' },
    { name: 'Health Refresh', endpoint: '/health/refresh', method: 'POST', data: { services: ['jellyfin', 'email'] } }
  ];

  for (const test of healthTests) {
    try {
      const startTime = Date.now();
      const response = await axios({
        method: test.method || 'GET',
        url: `${TEST_CONFIG.baseUrl}${test.endpoint}`,
        data: test.data,
        timeout: 10000
      });

      const duration = Date.now() - startTime;
      
      testResults.healthChecks.push({
        test: test.name,
        status: 'passed',
        responseTime: duration,
        statusCode: response.status,
        data: response.data
      });

      console.log(`  ✅ ${test.name}: ${duration}ms`);
      
      // Log detailed health info
      if (test.name === 'Detailed Health Check' && response.data.services) {
        Object.entries(response.data.services).forEach(([service, status]) => {
          const statusEmoji = status.status === 'healthy' ? '🟢' : 
                             status.status === 'degraded' ? '🟡' : '🔴';
          console.log(`     ${statusEmoji} ${service}: ${status.status}`);
        });
      }

    } catch (error) {
      testResults.healthChecks.push({
        test: test.name,
        status: 'failed',
        error: error.message,
        statusCode: error.response?.status
      });
      console.log(`  ❌ ${test.name}: ${error.message}`);
    }
  }
}

/**
 * Test Jellyfin integration with various scenarios
 */
async function testJellyfinIntegration() {
  const jellyfinTests = [
    { name: 'Jellyfin Health Status', test: async () => {
      const health = require('./server/services/jellyfinService').getHealthStatus();
      if (health.status === 'healthy') return { success: true, data: health };
      throw new Error(`Jellyfin unhealthy: ${health.status}`);
    }},
    
    { name: 'Jellyfin Direct Health Check', test: async () => {
      const service = require('./server/services/jellyfinService');
      return await service.performHealthCheck();
    }},
    
    { name: 'Get All Users (with retry)', test: async () => {
      const service = require('./server/services/jellyfinService');
      return await service.getAllUsers();
    }},
    
    { name: 'Invalid API Call', test: async () => {
      const service = require('./server/services/jellyfinService');
      try {
        await service.getUserById('nonexistent-user-id');
        throw new Error('Should have failed');
      } catch (error) {
        if (error.code === 'JELLYFIN_ERROR' || error.code === 'JELLYFIN_AUTH_FAILURE') {
          return { success: true, errorHandled: true };
        }
        throw error;
      }
    }}
  ];

  for (const test of jellyfinTests) {
    try {
      const startTime = Date.now();
      const result = await test.test();
      const duration = Date.now() - startTime;

      testResults.apiCalls.push({
        service: 'jellyfin',
        test: test.name,
        status: 'passed',
        responseTime: duration,
        result: result
      });

      console.log(`  ✅ ${test.name}: ${duration}ms`);
      
      // Log circuit breaker status
      if (result.circuitBreaker) {
        console.log(`     Circuit Breaker: ${result.circuitBreaker.state}`);
      }

    } catch (error) {
      testResults.apiCalls.push({
        service: 'jellyfin',
        test: test.name,
        status: 'failed',
        error: error.message
      });
      console.log(`  ❌ ${test.name}: ${error.message}`);
    }
  }
}

/**
 * Test email service functionality
 */
async function testEmailService() {
  const emailTests = [
    { name: 'Email Health Status', test: async () => {
      const health = require('./server/services/emailService').getHealthStatus();
      if (health.status === 'healthy' || health.status === 'not_configured') return { success: true, data: health };
      throw new Error(`Email service unhealthy: ${health.status}`);
    }},
    
    { name: 'Email Connection Verification', test: async () => {
      const service = require('./server/services/emailService');
      return await service.verifyConnection();
    }},
    
    { name: 'Email Queue Processing', test: async () => {
      const service = require('./server/services/emailService');
      
      // Add test email to queue
      const result = await service.sendEmail(
        'test@example.com',
        'Test Email',
        '<p>This is a test email for reliability testing</p>',
        { maxAttempts: 2 }
      );
      
      // Wait a bit for queue processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return result;
    }}
  ];

  for (const test of emailTests) {
    try {
      const startTime = Date.now();
      const result = await test.test();
      const duration = Date.now() - startTime;

      testResults.apiCalls.push({
        service: 'email',
        test: test.name,
        status: 'passed',
        responseTime: duration,
        result: result
      });

      console.log(`  ✅ ${test.name}: ${duration}ms`);
      
      if (result.data && result.data.queueSize !== undefined) {
        console.log(`     Queue size: ${result.data.queueSize}`);
      }

    } catch (error) {
      testResults.apiCalls.push({
        service: 'email',
        test: test.name,
        status: 'failed',
        error: error.message
      });
      console.log(`  ❌ ${test.name}: ${error.message}`);
    }
  }
}

/**
 * Test circuit breaker behavior
 */
async function testCircuitBreaker() {
  console.log('  🔄 Testing circuit breaker response to failures...');
  
  // This test simulates multiple failures to trigger circuit breaker
  const service = require('./server/services/jellyfinService');
  const initialHealth = service.getHealthStatus();
  
  console.log(`     Initial circuit breaker state: ${initialHealth.circuitBreaker?.state || 'unknown'}`);
  
  // Attempt multiple failed requests to trigger circuit breaker
  let failures = 0;
  for (let i = 0; i < 10; i++) {
    try {
      // Try to get a non-existent user to trigger failure
      await service.getUserById(`invalid-user-${i}`);
    } catch (error) {
      failures++;
    }
  }
  
  // Check circuit breaker status after failures
  const finalHealth = service.getHealthStatus();
  console.log(`     After ${failures} failures, circuit breaker state: ${finalHealth.circuitBreaker?.state || 'unknown'}`);
  console.log(`     Total requests: ${finalHealth.totalRequests}, Failed: ${finalHealth.failedRequests}`);
}

/**
 * Test concurrent load handling
 */
async function testConcurrentLoad() {
  const concurrentTests = [];
  
  for (let i = 0; i < TEST_CONFIG.concurrentRequests; i++) {
    concurrentTests.push(
      (async (index) => {
        try {
          const startTime = Date.now();
          const response = await axios.get(`${TEST_CONFIG.baseUrl}/health`);
          const duration = Date.now() - startTime;
          
          return {
            index,
            status: 'passed',
            responseTime: duration,
            statusCode: response.status
          };
        } catch (error) {
          return {
            index,
            status: 'failed',
            error: error.message,
            statusCode: error.response?.status
          };
        }
      })(i)
    );
  }

  const results = await Promise.all(concurrentTests);
  
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const avgResponseTime = results
    .filter(r => r.responseTime)
    .reduce((sum, r) => sum + r.responseTime, 0) / results.length;

  console.log(`     Concurrent requests: ${TEST_CONFIG.concurrentRequests}`);
  console.log(`     Passed: ${passed}, Failed: ${failed}`);
  console.log(`     Average response time: ${avgResponseTime.toFixed(2)}ms`);
  
  testResults.apiCalls.push({
    service: 'load_test',
    test: 'concurrent_requests',
    status: 'completed',
    concurrentRequests: TEST_CONFIG.concurrentRequests,
    passed,
    failed,
    avgResponseTime
  });
}

/**
 * Generate test summary
 */
function generateTestSummary() {
  const endTime = new Date();
  const duration = endTime - testResults.startTime;

  testResults.summary = {
    testDuration: duration,
    totalHealthChecks: testResults.healthChecks.length,
    successfulHealthChecks: testResults.healthChecks.filter(h => h.status === 'passed').length,
    totalApiCalls: testResults.apiCalls.length,
    successfulApiCalls: testResults.apiCalls.filter(a => a.status === 'passed').length,
    totalErrors: testResults.errors.length,
    servicesTested: ['jellyfin', 'email', 'load_test'],
    timestamp: endTime.toISOString()
  };
}

/**
 * Print comprehensive test results
 */
function printTestResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 INTEGRATION RELIABILITY TEST RESULTS');
  console.log('='.repeat(60));
  
  console.log(`\n⏱️  Test Duration: ${testResults.summary.testDuration}ms`);
  console.log(`🔍 Health Checks: ${testResults.summary.successfulHealthChecks}/${testResults.summary.totalHealthChecks}`);
  console.log(`📞 API Calls: ${testResults.summary.successfulApiCalls}/${testResults.summary.totalApiCalls}`);
  console.log(`❌ Total Errors: ${testResults.summary.totalErrors}`);
  
  // Service-specific results
  console.log('\n📋 Service Performance Summary:');
  const services = ['jellyfin', 'email'];
  
  services.forEach(service => {
    const serviceCalls = testResults.apiCalls.filter(c => c.service === service);
    const successful = serviceCalls.filter(c => c.status === 'passed').length;
    const avgResponseTime = serviceCalls
      .filter(c => c.responseTime)
      .reduce((sum, c) => sum + c.responseTime, 0) / serviceCalls.length || 0;
    
    console.log(`  ${service.toUpperCase()}: ${successful}/${serviceCalls.length} calls passed`);
    console.log(`    Average response time: ${avgResponseTime.toFixed(2)}ms`);
  });
  
  // Error summary
  if (testResults.errors.length > 0) {
    console.log('\n❌ Error Summary:');
    testResults.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.phase}: ${error.error}`);
    });
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  const jellyfinHealth = testResults.healthChecks.find(h => h.test.includes('Jellyfin'));
  if (jellyfinHealth && jellyfinHealth.status === 'failed') {
    console.log('  🔴 Jellyfin integration needs attention - check configuration and connectivity');
  }
  
  const emailHealth = testResults.healthChecks.find(h => h.test.includes('Email'));
  if (emailHealth && emailHealth.status === 'failed') {
    console.log('  🔴 Email service configuration issues detected');
  }
  
  const circuitBreakerTests = testResults.apiCalls.filter(c => c.test.includes('Circuit Breaker'));
  if (circuitBreakerTests.length === 0) {
    console.log('  🟡 Circuit breaker testing not completed - manual verification needed');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`🎯 Overall Result: ${testResults.summary.totalErrors === 0 ? '✅ PASSED' : '⚠️  ISSUES DETECTED'}`);
  console.log('='.repeat(60));
}

// Run tests if script is executed directly
if (require.main === module) {
  runIntegrationTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runIntegrationTests,
  testResults,
  TEST_CONFIG
};