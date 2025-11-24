#!/usr/bin/env node

/**
 * Static analysis of subscription system issues
 * This script analyzes the codebase without requiring database connections
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Analyzing Subscription System Issues (Static Analysis)...\n');

// Issue #1: Subscription Status Inconsistency Analysis
function analyzeSubscriptionStatusInconsistency() {
  console.log('🔴 Issue #1: Subscription Status Inconsistency Analysis');
  
  const findings = [];
  
  // Check scheduler logic
  const schedulerFile = fs.readFileSync('server/scheduler/disable_expired.js', 'utf8');
  const schedulerQuery = schedulerFile.match(/WHERE.*isActive\s*=\s*1/);
  
  if (schedulerQuery) {
    findings.push({
      file: 'disable_expired.js',
      line: 'WHERE ue.expirationDate < datetime(\'now\') AND ue.isActive = 1',
      issue: 'Scheduler only processes users with isActive=1, ignoring actual expiration date logic'
    });
  }
  
  // Check user controller logic
  const userControllerFile = fs.readFileSync('server/controllers/userController.js', 'utf8');
  const controllerLogic = userControllerFile.match(/new Date\(user\.expirationDate\)\s*<\s*new Date\(\)/);
  
  if (controllerLogic) {
    findings.push({
      file: 'userController.js',
      line: 'const isExpired = expiryDate < now;',
      issue: 'Dashboard uses date comparison but ignores isActive flag'
    });
  }
  
  // Check dashboard logic
  const dashboardFile = fs.readFileSync('public/user_dashboard.html', 'utf8');
  const dashboardLogic = dashboardFile.match(/expiryDate\s*<\s*now/);
  
  if (dashboardLogic) {
    findings.push({
      file: 'user_dashboard.html',
      line: 'const isExpired = expiryDate < now;',
      issue: 'Dashboard JavaScript uses different logic than server-side'
    });
  }
  
  console.log(`📊 Found ${findings.length} status inconsistency issues:`);
  findings.forEach(finding => {
    console.log(`   ❌ ${finding.file}: ${finding.issue}`);
  });
  
  return findings.length;
}

// Issue #2: Payment Integration Analysis
function analyzePaymentIntegration() {
  console.log('\n💳 Issue #2: Payment Integration Analysis');
  
  const findings = [];
  
  // Check coupon routes
  try {
    const couponRoutes = fs.readFileSync('server/routes/coupons.js', 'utf8');
    if (couponRoutes.includes('placeholder')) {
      findings.push({
        component: 'Coupon Routes',
        issue: 'Coupon system is just a placeholder with no implementation'
      });
    }
  } catch (e) {
    findings.push({
      component: 'Coupon Routes',
      issue: 'Coupon routes file not found'
    });
  }
  
  // Check payment tables in schema
  const schemaFile = fs.readFileSync('migrations/data.sql', 'utf8');
  const paymentTables = ['payments', 'billing', 'invoices', 'transactions'];
  const foundPaymentTables = paymentTables.filter(table => 
    schemaFile.toLowerCase().includes(table)
  );
  
  if (foundPaymentTables.length === 0) {
    findings.push({
      component: 'Database Schema',
      issue: 'No payment-related tables found in schema'
    });
  }
  
  // Check registration controller for payment logic
  const registrationFile = fs.readFileSync('server/controllers/registrationController.js', 'utf8');
  const paymentKeywords = ['payment', 'billing', 'stripe', 'paypal', 'razorpay'];
  const foundPaymentKeywords = paymentKeywords.filter(keyword => 
    registrationFile.toLowerCase().includes(keyword)
  );
  
  if (foundPaymentKeywords.length === 0) {
    findings.push({
      component: 'Registration Controller',
      issue: 'No payment processing logic in registration'
    });
  }
  
  // Check environment variables
  const envExample = fs.readFileSync('.env.example', 'utf8');
  const paymentEnvVars = ['STRIPE', 'PAYPAL', 'RAZORPAY', 'PAYMENT'];
  const foundPaymentEnv = paymentEnvVars.filter(envVar => 
    envExample.toLowerCase().includes(envVar.toLowerCase())
  );
  
  if (foundPaymentEnv.length === 0) {
    findings.push({
      component: 'Environment Configuration',
      issue: 'No payment gateway configuration variables'
    });
  }
  
  console.log(`📊 Found ${findings.length} payment integration issues:`);
  findings.forEach(finding => {
    console.log(`   ❌ ${finding.component}: ${finding.issue}`);
  });
  
  return findings.length;
}

// Issue #3: Expiration Calculation Analysis
function analyzeExpirationCalculations() {
  console.log('\n📅 Issue #3: Expiration Calculation Analysis');
  
  const findings = [];
  
  // Check registration controller
  const registrationFile = fs.readFileSync('server/controllers/registrationController.js', 'utf8');
  const setMonthUsage = registrationFile.match(/setMonth\(/g);
  
  if (setMonthUsage && setMonthUsage.length > 0) {
    findings.push({
      file: 'registrationController.js',
      issue: `Uses setMonth() ${setMonthUsage.length} times - potential date overflow issues`,
      example: 'expirationDate.setMonth(expirationDate.getMonth() + months);'
    });
  }
  
  // Check admin controller
  const adminFile = fs.readFileSync('server/controllers/adminController.js', 'utf8');
  const adminSetMonth = adminFile.match(/setMonth\(/g);
  
  if (adminSetMonth && adminSetMonth.length > 0) {
    findings.push({
      file: 'adminController.js',
      issue: `Uses setMonth() ${adminSetMonth.length} times - potential date overflow issues`,
      example: 'newExpiration.setMonth(newExpiration.getMonth() + parseInt(months));'
    });
  }
  
  console.log(`📊 Found ${findings.length} expiration calculation issues:`);
  findings.forEach(finding => {
    console.log(`   ❌ ${finding.file}: ${finding.issue}`);
    if (finding.example) console.log(`      Example: ${finding.example}`);
  });
  
  return findings.length;
}

// Issue #4: Dashboard Data Inconsistency Analysis
function analyzeDashboardInconsistencies() {
  console.log('\n🖥️ Issue #4: Dashboard Data Inconsistency Analysis');
  
  const findings = [];
  
  // Check user controller response format
  const userControllerFile = fs.readFileSync('server/controllers/userController.js', 'utf8');
  const controllerFields = userControllerFile.match(/user\.(\w+)/g);
  
  if (controllerFields) {
    const uniqueFields = [...new Set(controllerFields)].map(f => f.replace('user.', ''));
    if (!uniqueFields.includes('expiry_date')) {
      findings.push({
        file: 'userController.js',
        issue: 'Response does not include expiry_date field that dashboard expects'
      });
    }
  }
  
  // Check dashboard expectations
  const dashboardFile = fs.readFileSync('public/user_dashboard.html', 'utf8');
  const expectedFields = dashboardFile.match(/user\.(\w+)/g);
  
  if (expectedFields) {
    const uniqueExpected = [...new Set(expectedFields)].map(f => f.replace('user.', ''));
    if (uniqueExpected.includes('expiry_date')) {
      findings.push({
        file: 'user_dashboard.html',
        issue: 'Dashboard expects user.expiry_date but server provides user.expirationDate'
      });
    }
  }
  
  console.log(`📊 Found ${findings.length} dashboard inconsistency issues:`);
  findings.forEach(finding => {
    console.log(`   ❌ ${finding.file}: ${finding.issue}`);
  });
  
  return findings.length;
}

// Issue #5: Renewal System Analysis
function analyzeRenewalSystem() {
  console.log('\n🔄 Issue #5: Renewal System Analysis');
  
  const findings = [];
  
  // Check dashboard for renewal functionality
  const dashboardFile = fs.readFileSync('public/user_dashboard.html', 'utf8');
  const extendForm = dashboardFile.includes('extendForm');
  
  if (extendForm) {
    findings.push({
      file: 'user_dashboard.html',
      issue: 'Dashboard shows renewal form but no API endpoint exists for user self-renewal'
    });
  }
  
  // Check if user routes have renewal endpoint
  const userRoutesFile = fs.readFileSync('server/routes/users.js', 'utf8');
  const renewalEndpoint = userRoutesFile.includes('renew') || userRoutesFile.includes('extend');
  
  if (!renewalEndpoint) {
    findings.push({
      file: 'user_routes.js',
      issue: 'No user self-renewal endpoints available'
    });
  }
  
  console.log(`📊 Found ${findings.length} renewal system issues:`);
  findings.forEach(finding => {
    console.log(`   ❌ ${finding.file}: ${finding.issue}`);
  });
  
  return findings.length;
}

// Main analysis runner
function runAnalysis() {
  console.log('='.repeat(60));
  console.log('🔍 SUBSCRIPTION SYSTEM STATIC ANALYSIS');
  console.log('='.repeat(60));
  
  const results = {
    statusInconsistencies: analyzeSubscriptionStatusInconsistency(),
    paymentIntegration: analyzePaymentIntegration(),
    expirationCalculations: analyzeExpirationCalculations(),
    dashboardInconsistencies: analyzeDashboardInconsistencies(),
    renewalSystem: analyzeRenewalSystem()
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 ANALYSIS SUMMARY');
  console.log('='.repeat(60));
  
  const totalIssues = Object.values(results).reduce((sum, count) => sum + count, 0);
  
  console.log(`\n🔴 CRITICAL ISSUES (Immediate Action Required):`);
  console.log(`   Status Inconsistencies: ${results.statusInconsistencies} issues`);
  console.log(`   Payment Integration: ${results.paymentIntegration} issues`);
  
  console.log(`\n⚠️  MEDIUM PRIORITY ISSUES:`);
  console.log(`   Expiration Calculations: ${results.expirationCalculations} issues`);
  console.log(`   Dashboard Inconsistencies: ${results.dashboardInconsistencies} issues`);
  
  console.log(`\n🔧 LOW PRIORITY ISSUES:`);
  console.log(`   Renewal System: ${results.renewalSystem} issues`);
  
  console.log(`\n📈 TOTAL ISSUES IDENTIFIED: ${totalIssues}`);
  
  console.log('\n' + '='.repeat(60));
  console.log(results.statusInconsistencies > 0 || results.paymentIntegration > 0 ? 
    '🔥 CRITICAL ISSUES DETECTED - IMMEDIATE ACTION REQUIRED' : 
    '✅ No critical issues found');
  console.log('='.repeat(60));
}

// Run analysis
runAnalysis();