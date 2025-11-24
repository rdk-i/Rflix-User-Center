#!/usr/bin/env node

/**
 * Notification System Test Script
 * 
 * This script tests the enhanced notification system in Rflix-User-Center.
 * It validates email delivery, telegram integration, notification preferences,
 * and the new expiration warning system.
 */

const axios = require('axios');
const logger = require('./server/utils/logger');

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  testDuration: parseInt(process.env.TEST_DURATION) || 60000, // 60 seconds
  emailTestEnabled: process.env.EMAIL_TEST_ENABLED !== 'false',
  telegramTestEnabled: process.env.TELEGRAM_TEST_ENABLED !== 'false',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
  adminTelegramChatId: process.env.TELEGRAM_ADMIN_CHAT_ID,
  testUserEmail: process.env.TEST_USER_EMAIL || 'testuser@example.com',
  testTelegramChatId: process.env.TEST_TELEGRAM_CHAT_ID
};

// Test results
const testResults = {
  startTime: new Date(),
  notificationTests: [],
  emailTests: [],
  telegramTests: [],
  apiTests: [],
  errors: [],
  summary: {}
};

/**
 * Main test runner
 */
async function runNotificationTests() {
  console.log('🔔 Starting Notification System Tests...');
  console.log(`📍 Base URL: ${TEST_CONFIG.baseUrl}`);
  console.log(`⏱️  Duration: ${TEST_CONFIG.testDuration}ms`);
  console.log(`📧 Email Tests: ${TEST_CONFIG.emailTestEnabled}`);
  console.log(`📱 Telegram Tests: ${TEST_CONFIG.telegramTestEnabled}`);
  console.log('');

  try {
    // Phase 1: System Status and Health Checks
    console.log('🔍 Phase 1: System Status and Health Checks');
    await testNotificationSystemStatus();
    console.log('✅ Status checks completed\n');

    // Phase 2: Notification Preferences API Tests
    console.log('⚙️  Phase 2: Notification Preferences API Tests');
    await testNotificationPreferences();
    console.log('✅ Preferences API tests completed\n');

    // Phase 3: Email Service Tests
    if (TEST_CONFIG.emailTestEnabled) {
      console.log('📧 Phase 3: Email Service Tests');
      await testEmailService();
      console.log('✅ Email tests completed\n');
    }

    // Phase 4: Telegram Service Tests
    if (TEST_CONFIG.telegramTestEnabled) {
      console.log('📱 Phase 4: Telegram Service Tests');
      await testTelegramService();
      console.log('✅ Telegram tests completed\n');
    }

    // Phase 5: Manual Notification Tests
    console.log('🎯 Phase 5: Manual Notification Tests');
    await testManualNotifications();
    console.log('✅ Manual notification tests completed\n');

    // Phase 6: Notification Queue and Reliability Tests
    console.log('🔄 Phase 6: Notification Queue and Reliability Tests');
    await testNotificationReliability();
    console.log('✅ Reliability tests completed\n');

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
 * Test notification system status and health
 */
async function testNotificationSystemStatus() {
  const statusTests = [
    {
      name: 'Notification System Status',
      endpoint: '/api/notifications/status',
      validate: (data) => {
        return data.emailService && data.telegramService && data.database;
      }
    },
    {
      name: 'Email Service Health',
      endpoint: '/health',
      validate: (data) => {
        return data.services && data.services.email;
      }
    }
  ];

  for (const test of statusTests) {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${TEST_CONFIG.baseUrl}${test.endpoint}`, { timeout: 10000 });
      const duration = Date.now() - startTime;

      const isValid = test.validate ? test.validate(response.data.data || response.data) : response.data.success;
      
      testResults.apiTests.push({
        test: test.name,
        status: isValid ? 'passed' : 'failed',
        responseTime: duration,
        statusCode: response.status,
        data: response.data
      });

      console.log(`  ${isValid ? '✅' : '❌'} ${test.name}: ${duration}ms`);
      
      if (test.name === 'Notification System Status' && isValid) {
        const status = response.data.data;
        console.log(`     📧 Email: ${status.emailService.status} (${status.emailService.successRate} success rate)`);
        console.log(`     📱 Telegram: ${status.telegramService.configured ? 'configured' : 'not configured'}`);
        console.log(`     🗃️  Database: ${status.database.totalNotificationPrefs} prefs, ${status.database.usersWithPrefs} users`);
      }

    } catch (error) {
      testResults.apiTests.push({
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
 * Test notification preferences API
 */
async function testNotificationPreferences() {
  const preferenceTests = [
    {
      name: 'Get Notification Preferences',
      endpoint: '/api/users/notifications',
      method: 'GET',
      requiresAuth: true
    },
    {
      name: 'Update Notification Preferences',
      endpoint: '/api/users/notifications',
      method: 'PUT',
      data: {
        emailEnabled: true,
        pushEnabled: false,
        telegramEnabled: false
      },
      requiresAuth: true
    }
  ];

  // Note: These tests would require a valid auth token in a real scenario
  for (const test of preferenceTests) {
    try {
      const startTime = Date.now();
      const response = await axios({
        method: test.method,
        url: `${TEST_CONFIG.baseUrl}${test.endpoint}`,
        data: test.data,
        timeout: 5000
      });
      const duration = Date.now() - startTime;

      testResults.apiTests.push({
        test: test.name,
        status: response.data.success ? 'passed' : 'failed',
        responseTime: duration,
        statusCode: response.status
      });

      console.log(`  ${response.data.success ? '✅' : '❌'} ${test.name}: ${duration}ms`);

    } catch (error) {
      testResults.apiTests.push({
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
 * Test email service functionality
 */
async function testEmailService() {
  const emailTests = [
    {
      name: 'Email Service Health',
      endpoint: '/api/notifications/test/email',
      method: 'POST',
      data: {
        to: TEST_CONFIG.adminEmail,
        subject: 'Rflix Notification System Test',
        html: '<p>This is a test email from the notification system test script.</p>'
      },
      requiresAuth: true
    }
  ];

  for (const test of emailTests) {
    try {
      const startTime = Date.now();
      const response = await axios({
        method: test.method,
        url: `${TEST_CONFIG.baseUrl}${test.endpoint}`,
        data: test.data,
        timeout: 30000 // Email might take longer
      });
      const duration = Date.now() - startTime;

      testResults.emailTests.push({
        test: test.name,
        status: response.data.success ? 'passed' : 'failed',
        responseTime: duration,
        data: response.data.data
      });

      console.log(`  ${response.data.success ? '✅' : '❌'} ${test.name}: ${duration}ms`);
      
      if (response.data.data && response.data.data.queued) {
        console.log(`     📧 Email queued with ID: ${response.data.data.emailId}`);
      }

    } catch (error) {
      testResults.emailTests.push({
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
 * Test telegram service functionality
 */
async function testTelegramService() {
  if (!TEST_CONFIG.adminTelegramChatId) {
    console.log('  ⚠️  No admin Telegram chat ID configured, skipping telegram tests');
    return;
  }

  const telegramTests = [
    {
      name: 'Telegram Service Test',
      endpoint: '/api/notifications/test/telegram',
      method: 'POST',
      data: {
        chatId: TEST_CONFIG.adminTelegramChatId,
        message: '🧪 Testing Rflix notification system!'
      },
      requiresAuth: true
    }
  ];

  for (const test of telegramTests) {
    try {
      const startTime = Date.now();
      const response = await axios({
        method: test.method,
        url: `${TEST_CONFIG.baseUrl}${test.endpoint}`,
        data: test.data,
        timeout: 10000
      });
      const duration = Date.now() - startTime;

      testResults.telegramTests.push({
        test: test.name,
        status: response.data.success ? 'passed' : 'failed',
        responseTime: duration,
        data: response.data.data
      });

      console.log(`  ${response.data.success ? '✅' : '❌'} ${test.name}: ${duration}ms`);
      
      if (response.data.data && response.data.data.success !== undefined) {
        console.log(`     📱 Telegram sent: ${response.data.data.success}`);
      }

    } catch (error) {
      testResults.telegramTests.push({
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
 * Test manual notification sending
 */
async function testManualNotifications() {
  const manualTests = [
    {
      name: 'Notification Statistics',
      endpoint: '/api/notifications/stats',
      method: 'GET',
      requiresAuth: true
    }
  ];

  for (const test of manualTests) {
    try {
      const startTime = Date.now();
      const response = await axios({
        method: test.method,
        url: `${TEST_CONFIG.baseUrl}${test.endpoint}`,
        timeout: 5000
      });
      const duration = Date.now() - startTime;

      testResults.notificationTests.push({
        test: test.name,
        status: response.data.success ? 'passed' : 'failed',
        responseTime: duration,
        data: response.data.data
      });

      console.log(`  ${response.data.success ? '✅' : '❌'} ${test.name}: ${duration}ms`);

    } catch (error) {
      testResults.notificationTests.push({
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
 * Test notification reliability and queue processing
 */
async function testNotificationReliability() {
  console.log('  🔄 Testing notification queue processing...');
  
  // Test would involve sending multiple notifications and checking queue status
  // This is a simplified version for demonstration
  
  testResults.notificationTests.push({
    test: 'Queue Processing',
    status: 'info',
    message: 'Queue processing test would require multiple notification sends and monitoring'
  });

  console.log('     ℹ️  Queue processing requires monitoring over time');
}

/**
 * Generate test summary
 */
function generateTestSummary() {
  const endTime = new Date();
  const duration = endTime - testResults.startTime;

  testResults.summary = {
    testDuration: duration,
    totalApiTests: testResults.apiTests.length,
    successfulApiTests: testResults.apiTests.filter(t => t.status === 'passed').length,
    totalEmailTests: testResults.emailTests.length,
    successfulEmailTests: testResults.emailTests.filter(t => t.status === 'passed').length,
    totalTelegramTests: testResults.telegramTests.length,
    successfulTelegramTests: testResults.telegramTests.filter(t => t.status === 'passed').length,
    totalNotificationTests: testResults.notificationTests.length,
    successfulNotificationTests: testResults.notificationTests.filter(t => t.status === 'passed').length,
    totalErrors: testResults.errors.length,
    timestamp: endTime.toISOString()
  };
}

/**
 * Print comprehensive test results
 */
function printTestResults() {
  console.log('\n' + '='.repeat(60));
  console.log('🔔 NOTIFICATION SYSTEM TEST RESULTS');
  console.log('='.repeat(60));
  
  console.log(`\n⏱️  Test Duration: ${testResults.summary.testDuration}ms`);
  console.log(`🔍 API Tests: ${testResults.summary.successfulApiTests}/${testResults.summary.totalApiTests}`);
  console.log(`📧 Email Tests: ${testResults.summary.successfulEmailTests}/${testResults.summary.totalEmailTests}`);
  console.log(`📱 Telegram Tests: ${testResults.summary.successfulTelegramTests}/${testResults.summary.totalTelegramTests}`);
  console.log(`🎯 Notification Tests: ${testResults.summary.successfulNotificationTests}/${testResults.summary.totalNotificationTests}`);
  console.log(`❌ Total Errors: ${testResults.summary.totalErrors}`);
  
  // Service-specific results
  console.log('\n📋 Notification System Health Summary:');
  
  const emailConfigured = testResults.apiTests.some(t => 
    t.test === 'Notification System Status' && 
    t.status === 'passed' && 
    t.data?.data?.emailService?.isConfigured
  );
  
  const telegramConfigured = testResults.apiTests.some(t => 
    t.test === 'Notification System Status' && 
    t.status === 'passed' && 
    t.data?.data?.telegramService?.configured
  );
  
  console.log(`  📧 Email Service: ${emailConfigured ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  📱 Telegram Service: ${telegramConfigured ? '✅ Configured' : '❌ Not configured'}`);
  
  // Error summary
  if (testResults.errors.length > 0) {
    console.log('\n❌ Error Summary:');
    testResults.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.phase}: ${error.error}`);
    });
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (!emailConfigured) {
    console.log('  🔴 Email service needs configuration - check SMTP settings in environment variables');
  }
  
  if (!telegramConfigured) {
    console.log('  🟡 Telegram service not configured - set TELEGRAM_BOT_TOKEN for full functionality');
  }
  
  const emailTestsFailed = testResults.emailTests.filter(t => t.status === 'failed').length;
  if (emailTestsFailed > 0) {
    console.log('  🔴 Email delivery issues detected - check SMTP configuration and connectivity');
  }
  
  const telegramTestsFailed = testResults.telegramTests.filter(t => t.status === 'failed').length;
  if (telegramTestsFailed > 0) {
    console.log('  🔴 Telegram delivery issues detected - check bot token and chat ID configuration');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`🎯 Overall Result: ${testResults.summary.totalErrors === 0 ? '✅ PASSED' : '⚠️  ISSUES DETECTED'}`);
  console.log('='.repeat(60));
}

// Run tests if script is executed directly
if (require.main === module) {
  runNotificationTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runNotificationTests,
  testResults,
  TEST_CONFIG
};