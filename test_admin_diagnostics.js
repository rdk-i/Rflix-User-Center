#!/usr/bin/env node

/**
 * Comprehensive Admin Dashboard Diagnostic Tool
 * Tests all admin functionality and identifies critical issues
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

// Test results storage
const testResults = {
  timestamp: new Date().toISOString(),
  tests: [],
  criticalIssues: [],
  warnings: [],
  recommendations: []
};

// Logger
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };
  
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  
  // Store in results
  if (level === 'error') {
    testResults.criticalIssues.push(logEntry);
  } else if (level === 'warn') {
    testResults.warnings.push(logEntry);
  }
}

// Test function wrapper
async function runTest(testName, testFunction) {
  log('info', `Running test: ${testName}`);
  const startTime = Date.now();
  
  try {
    const result = await testFunction();
    const duration = Date.now() - startTime;
    
    testResults.tests.push({
      name: testName,
      status: 'passed',
      duration,
      result
    });
    
    log('info', `Test passed: ${testName} (${duration}ms)`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    testResults.tests.push({
      name: testName,
      status: 'failed',
      duration,
      error: error.message
    });
    
    log('error', `Test failed: ${testName} (${duration}ms)`, {
      error: error.message,
      stack: error.stack
    });
    
    return null;
  }
}

// Test 1: Dashboard Statistics
async function testDashboardStats() {
  if (!ADMIN_TOKEN) {
    throw new Error('ADMIN_TOKEN not provided');
  }

  const response = await axios.get(`${BASE_URL}/api/admin/stats`, {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
  });

  const { data } = response.data;
  
  // Validate response structure
  if (!data || typeof data.totalUsers !== 'number' || typeof data.nowPlaying !== 'number') {
    throw new Error('Invalid dashboard stats response structure');
  }
  
  // Check for common issues
  if (data.pendingRequests === undefined) {
    log('warn', 'Missing pendingRequests in dashboard stats');
  }
  
  if (data.totalUsers === 0 && data.jellyfinConnected) {
    log('warn', 'Dashboard shows 0 users but Jellyfin is connected - possible sync issue');
  }
  
  return data;
}

// Test 2: User Management
async function testUserManagement() {
  // Test getting all users
  const usersResponse = await axios.get(`${BASE_URL}/api/admin/users/jellyfin`, {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
  });

  const { data: users } = usersResponse.data;
  
  if (!Array.isArray(users)) {
    throw new Error('Invalid users response structure');
  }
  
  log('info', `Found ${users.length} users in system`);
  
  // Test individual user operations if users exist
  if (users.length > 0) {
    const testUser = users[0];
    
    // Test get user by ID
    const userResponse = await axios.get(`${BASE_URL}/api/admin/users/${testUser.Id || testUser.id}`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
    
    if (!userResponse.data.success) {
      log('warn', `Failed to get user details for ${testUser.Id}`);
    }
  }
  
  return users;
}

// Test 3: Form Builder
async function testFormBuilder() {
  // Test getting form fields
  const fieldsResponse = await axios.get(`${BASE_URL}/api/form-fields`);
  const { data: fields } = fieldsResponse.data;
  
  if (!Array.isArray(fields)) {
    throw new Error('Invalid form fields response structure');
  }
  
  log('info', `Found ${fields.length} form fields`);
  
  // Test field validation
  const systemFields = fields.filter(f => f.is_system);
  const customFields = fields.filter(f => !f.is_system);
  
  log('info', `System fields: ${systemFields.length}, Custom fields: ${customFields.length}`);
  
  // Check for common issues
  const requiredFields = fields.filter(f => f.required);
  if (requiredFields.length < 3) {
    log('warn', 'Very few required fields detected - may cause registration issues');
  }
  
  return fields;
}

// Test 4: Pending Registrations
async function testPendingRegistrations() {
  try {
    const pendingResponse = await axios.get(`${BASE_URL}/api/registration/pending`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
    
    const { data: pending } = pendingResponse.data;
    
    if (!Array.isArray(pending)) {
      throw new Error('Invalid pending registrations response structure');
    }
    
    log('info', `Found ${pending.length} pending registrations`);
    
    return pending;
  } catch (error) {
    // This endpoint might not exist or require different auth
    log('warn', 'Could not test pending registrations endpoint', error.message);
    return [];
  }
}

// Test 5: Audit Logs
async function testAuditLogs() {
  try {
    const logsResponse = await axios.get(`${BASE_URL}/api/admin/logs`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
    
    const { data: logs } = logsResponse.data;
    
    if (!Array.isArray(logs)) {
      throw new Error('Invalid audit logs response structure');
    }
    
    log('info', `Found ${logs.length} audit log entries`);
    
    // Check for recent activity
    const recentLogs = logs.filter(log => {
      const logDate = new Date(log.timestamp);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return logDate > oneHourAgo;
    });
    
    if (recentLogs.length === 0) {
      log('warn', 'No recent audit log activity detected');
    }
    
    return logs;
  } catch (error) {
    log('warn', 'Could not test audit logs endpoint', error.message);
    return [];
  }
}

// Test 6: System Settings
async function testSystemSettings() {
  try {
    const settingsResponse = await axios.get(`${BASE_URL}/api/admin/settings`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
    
    const { data: settings } = settingsResponse.data;
    
    if (!settings || typeof settings !== 'object') {
      throw new Error('Invalid settings response structure');
    }
    
    log('info', 'Settings retrieved successfully');
    
    // Check for critical settings
    if (!settings.jellyfinUrl) {
      log('warn', 'Jellyfin URL not configured');
    }
    
    if (settings.allowRegistration === undefined) {
      log('warn', 'Registration setting not found');
    }
    
    return settings;
  } catch (error) {
    log('warn', 'Could not test system settings', error.message);
    return null;
  }
}

// Test 7: Jellyfin Connection
async function testJellyfinConnection() {
  try {
    const jellyfinResponse = await axios.post(`${BASE_URL}/api/admin/test-jellyfin`, {
      url: 'http://localhost:8096',
      apiKey: 'test-key'
    }, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
    
    // This should fail with test credentials, but we want to see the error handling
    log('info', 'Jellyfin test endpoint accessible');
    return jellyfinResponse.data;
  } catch (error) {
    if (error.response && error.response.status === 500) {
      log('warn', 'Jellyfin test failed as expected with test credentials');
      return { expectedFailure: true };
    }
    throw error;
  }
}

// Test 8: Database Backup
async function testDatabaseBackup() {
  try {
    const backupResponse = await axios.post(`${BASE_URL}/api/admin/backup`, {}, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
    
    const { data: backup } = backupResponse.data;
    
    if (!backup || !backup.filename) {
      throw new Error('Invalid backup response structure');
    }
    
    log('info', `Backup created: ${backup.filename}`);
    
    // Check if backup file exists
    const backupPath = path.join(__dirname, 'backups', backup.filename);
    if (fs.existsSync(backupPath)) {
      const stats = fs.statSync(backupPath);
      log('info', `Backup file verified: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    } else {
      log('warn', 'Backup file not found on disk');
    }
    
    return backup;
  } catch (error) {
    log('error', 'Database backup test failed', error.message);
    throw error;
  }
}

// Generate recommendations based on test results
function generateRecommendations() {
  const recommendations = [];
  
  // Dashboard issues
  if (testResults.criticalIssues.some(issue => issue.message.includes('dashboard'))) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Dashboard',
      issue: 'Dashboard statistics calculation issues',
      recommendation: 'Fix pendingRequests counting logic and improve Jellyfin connection handling'
    });
  }
  
  // User management issues
  if (testResults.criticalIssues.some(issue => issue.message.includes('user'))) {
    recommendations.push({
      priority: 'HIGH',
      category: 'User Management',
      issue: 'User synchronization problems',
      recommendation: 'Implement proper sync_status tracking and error recovery'
    });
  }
  
  // Form builder issues
  if (testResults.criticalIssues.some(issue => issue.message.includes('form'))) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Form Builder',
      issue: 'Form field validation issues',
      recommendation: 'Add duplicate field checking and improve validation logic'
    });
  }
  
  // Approval workflow issues
  if (testResults.criticalIssues.some(issue => issue.message.includes('approval'))) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Approval Workflow',
      issue: 'User approval process failures',
      recommendation: 'Improve Jellyfin sync retry logic and add rollback mechanisms'
    });
  }
  
  // Backup issues
  if (testResults.criticalIssues.some(issue => issue.message.includes('backup'))) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Backup',
      issue: 'Database backup failures',
      recommendation: 'Verify backup directory permissions and implement backup verification'
    });
  }
  
  // General recommendations
  recommendations.push({
    priority: 'MEDIUM',
    category: 'General',
    issue: 'Insufficient error logging',
    recommendation: 'Add more detailed logging throughout admin functions for better debugging'
  });
  
  recommendations.push({
    priority: 'LOW',
    category: 'Monitoring',
    issue: 'No health check endpoints',
    recommendation: 'Implement health check endpoints for proactive monitoring'
  });
  
  return recommendations;
}

// Main test runner
async function runAllTests() {
  log('info', 'Starting Admin Dashboard Diagnostic Tests');
  log('info', `Base URL: ${BASE_URL}`);
  log('info', `Admin Token: ${ADMIN_TOKEN ? 'Provided' : 'Not provided'}`);
  
  if (!ADMIN_TOKEN) {
    log('error', 'ADMIN_TOKEN environment variable is required');
    return;
  }
  
  const tests = [
    ['Dashboard Statistics', testDashboardStats],
    ['User Management', testUserManagement],
    ['Form Builder', testFormBuilder],
    ['Pending Registrations', testPendingRegistrations],
    ['Audit Logs', testAuditLogs],
    ['System Settings', testSystemSettings],
    ['Jellyfin Connection', testJellyfinConnection],
    ['Database Backup', testDatabaseBackup]
  ];
  
  for (const [testName, testFunction] of tests) {
    await runTest(testName, testFunction);
  }
  
  // Generate recommendations
  testResults.recommendations = generateRecommendations();
  
  // Save results
  const resultsPath = path.join(__dirname, 'admin_diagnostic_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
  
  log('info', 'Diagnostic tests completed');
  log('info', `Results saved to: ${resultsPath}`);
  log('info', `Critical issues found: ${testResults.criticalIssues.length}`);
  log('info', `Warnings: ${testResults.warnings.length}`);
  log('info', `Recommendations: ${testResults.recommendations.length}`);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Diagnostic test runner failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testResults
};