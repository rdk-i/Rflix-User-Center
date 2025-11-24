#!/usr/bin/env node

/**
 * Test script to validate subscription system issues identified in analysis
 * This script will help confirm the 2 most critical issues:
 * 1. Subscription status inconsistencies
 * 2. Missing payment integration
 */

const db = require('./server/config/database');
const logger = require('./server/utils/logger');

console.log('🔍 Testing Subscription System Issues...\n');

// Issue #1: Subscription Status Inconsistency Test
async function testSubscriptionStatusInconsistency() {
  console.log('🔴 Issue #1: Subscription Status Inconsistency Test');
  
  try {
    // Find users with mismatched status
    const inconsistentUsers = db.prepare(`
      SELECT ue.userId, ue.expirationDate, ue.isActive, u.email,
             CASE 
               WHEN ue.expirationDate < datetime('now') AND ue.isActive = 1 THEN 'EXPIRED_BUT_ACTIVE'
               WHEN ue.expirationDate >= datetime('now') AND ue.isActive = 0 THEN 'ACTIVE_BUT_DISABLED'
               ELSE 'CONSISTENT'
             END as status_check
      FROM user_expiration ue
      JOIN api_users u ON ue.userId = u.id
    `).all();
    
    const problems = inconsistentUsers.filter(u => u.status_check !== 'CONSISTENT');
    
    console.log(`📊 Found ${inconsistentUsers.length} total users`);
    console.log(`❌ Found ${problems.length} users with status inconsistencies:`);
    
    problems.forEach(user => {
      console.log(`   - User ${user.email} (${user.userId}): ${user.status_check}`);
      console.log(`     Expiration: ${user.expirationDate}, isActive: ${user.isActive}`);
    });
    
    return problems.length;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return -1;
  }
}

// Issue #2: Payment Integration Test
async function testPaymentIntegration() {
  console.log('\n💳 Issue #2: Payment Integration Test');
  
  try {
    // Check if payment tables exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE '%payment%' OR name LIKE '%billing%' OR name LIKE '%invoice%'
    `).all();
    
    console.log(`📊 Payment-related tables found: ${tables.length}`);
    if (tables.length > 0) {
      tables.forEach(table => console.log(`   - ${table.name}`));
    } else {
      console.log('   ❌ No payment tables found');
    }
    
    // Check if coupon system is implemented
    const couponRoutes = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name = 'coupons'
    `).get();
    
    if (couponRoutes) {
      const couponCount = db.prepare('SELECT COUNT(*) as count FROM coupons').get().count;
      console.log(`   📋 Coupons table exists with ${couponCount} coupons`);
    } else {
      console.log('   ❌ No coupons table found');
    }
    
    // Check environment variables for payment
    const paymentEnvVars = [
      'STRIPE_SECRET_KEY',
      'PAYPAL_CLIENT_ID', 
      'PAYPAL_SECRET',
      'RAZORPAY_KEY_ID',
      'PAYMENT_GATEWAY'
    ];
    
    const configuredPayments = paymentEnvVars.filter(envVar => process.env[envVar]);
    console.log(`   🔑 Payment environment variables configured: ${configuredPayments.length}`);
    configuredPayments.forEach(envVar => console.log(`     - ${envVar}=***`));
    
    // Check if registration process includes payment
    const registrationFields = db.prepare(`
      SELECT field_key FROM registration_fields 
      WHERE field_key LIKE '%payment%' OR field_key LIKE '%billing%'
    `).all();
    
    console.log(`   📝 Payment-related registration fields: ${registrationFields.length}`);
    registrationFields.forEach(field => console.log(`     - ${field.field_key}`));
    
    return {
      hasPaymentTables: tables.length > 0,
      hasCoupons: !!couponRoutes,
      configuredPayments: configuredPayments.length,
      registrationFields: registrationFields.length
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return { hasPaymentTables: false, hasCoupons: false, configuredPayments: 0, registrationFields: 0 };
  }
}

// Test expiration date calculation issues
async function testExpirationCalculations() {
  console.log('\n📅 Testing Expiration Date Calculation Issues');
  
  try {
    // Test month-end scenarios
    const testCases = [
      { startDate: '2024-01-31', months: 1, expected: '2024-02-29' }, // Leap year
      { startDate: '2024-05-31', months: 1, expected: '2024-06-30' },
      { startDate: '2024-12-31', months: 1, expected: '2025-01-31' },
      { startDate: '2024-01-31', months: 12, expected: '2025-01-31' }
    ];
    
    console.log('🧪 Testing setMonth() behavior:');
    testCases.forEach(testCase => {
      const date = new Date(testCase.startDate);
      const originalDate = date.getDate();
      date.setMonth(date.getMonth() + testCase.months);
      
      const actual = date.toISOString().split('T')[0];
      const passed = actual === testCase.expected;
      
      console.log(`   ${passed ? '✅' : '❌'} ${testCase.startDate} + ${testCase.months} months = ${actual} (expected: ${testCase.expected})`);
      if (!passed) {
        console.log(`       Original day: ${originalDate}, Result day: ${date.getDate()}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 SUBSCRIPTION SYSTEM ISSUE VALIDATION');
  console.log('='.repeat(60));
  
  const results = {
    statusInconsistencies: await testSubscriptionStatusInconsistency(),
    paymentIntegration: await testPaymentIntegration(),
    expirationIssues: await testExpirationCalculations()
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY OF FINDINGS');
  console.log('='.repeat(60));
  
  console.log(`\n🔴 CRITICAL ISSUE #1 - Status Inconsistencies:`);
  console.log(`   ${results.statusInconsistencies} users have mismatched subscription status`);
  console.log(`   ${results.statusInconsistencies > 0 ? '⚠️  REQUIRES IMMEDIATE FIX' : '✅ No issues found'}`);
  
  console.log(`\n💳 CRITICAL ISSUE #2 - Payment Integration:`);
  console.log(`   Payment tables: ${results.paymentIntegration.hasPaymentTables ? '✅ Found' : '❌ Missing'}`);
  console.log(`   Coupon system: ${results.paymentIntegration.hasCoupons ? '✅ Implemented' : '❌ Missing'}`);
  console.log(`   Payment gateways: ${results.paymentIntegration.configuredPayments} configured`);
  console.log(`   Payment fields: ${results.paymentIntegration.registrationFields} in registration`);
  
  if (!results.paymentIntegration.hasPaymentTables && results.paymentIntegration.configuredPayments === 0) {
    console.log(`   ⚠️  NO PAYMENT SYSTEM IMPLEMENTED - REQUIRES IMMEDIATE ATTENTION`);
  }
  
  console.log(`\n📅 EXPIRATION CALCULATION ISSUES:`);
  console.log(`   Test results shown above - potential date overflow issues`);
  
  console.log('\n' + '='.repeat(60));
  console.log(results.statusInconsistencies > 0 || !results.paymentIntegration.hasPaymentTables ? 
    '🔥 CRITICAL ISSUES DETECTED - IMMEDIATE ACTION REQUIRED' : 
    '✅ No critical issues found');
  console.log('='.repeat(60));
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});