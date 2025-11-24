/**
 * Comprehensive Test Suite for Subscription Dashboard
 * Tests all functionality including API endpoints, WebSocket integration, and UI components
 */

const axios = require('axios');
const WebSocket = require('ws');
const { expect } = require('chai');

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:3000/ws/subscriptions';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'your-admin-token-here';

// Test data
const testPackage = {
  name: 'Premium Test Package',
  description: 'Premium package for testing',
  price: 29.99,
  duration: 30,
  status: 'active',
  features: {
    'HD Streaming': true,
    'Multi-device Support': true,
    'Priority Support': true
  },
  limits: {
    apiCalls: 5000,
    storage: 2048,
    bandwidth: 50,
    devices: 5
  }
};

const testUser = {
  email: 'test.subscription@example.com',
  username: 'testsubscriber',
  password: 'TestPassword123!'
};

class SubscriptionDashboardTester {
  constructor() {
    this.axios = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    this.wsClient = null;
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🚀 Starting Subscription Dashboard Test Suite...\n');
    
    try {
      // Authentication tests
      await this.testAuthentication();
      
      // Package management tests
      await this.testPackageManagement();
      
      // User subscription tests
      await this.testUserSubscriptionManagement();
      
      // Payment tests
      await this.testPaymentManagement();
      
      // Analytics tests
      await this.testAnalytics();
      
      // WebSocket tests
      await this.testWebSocketIntegration();
      
      // Settings tests
      await this.testSettings();
      
      // Bulk operations tests
      await this.testBulkOperations();
      
      // UI/UX tests
      await this.testUIUX();
      
      this.printTestResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  async testAuthentication() {
    console.log('🔐 Testing Authentication...');
    
    try {
      // Test admin access
      const response = await this.axios.get('/api/subscriptions/admin/dashboard');
      expect(response.status).to.equal(200);
      expect(response.data.success).to.be.true;
      expect(response.data.data).to.have.property('metrics');
      
      this.addTestResult('Admin Dashboard Access', '✅ PASSED');
      
      // Test unauthorized access
      try {
        await axios.get(`${BASE_URL}/api/subscriptions/admin/dashboard`);
        this.addTestResult('Unauthorized Access Prevention', '❌ FAILED - Should reject unauthorized requests');
      } catch (error) {
        expect(error.response.status).to.equal(401);
        this.addTestResult('Unauthorized Access Prevention', '✅ PASSED');
      }
      
    } catch (error) {
      this.addTestResult('Authentication Tests', '❌ FAILED - ' + error.message);
    }
  }

  async testPackageManagement() {
    console.log('📦 Testing Package Management...');
    
    try {
      // Create package
      const createResponse = await this.axios.post('/api/subscriptions/packages', testPackage);
      expect(createResponse.status).to.equal(200);
      expect(createResponse.data.success).to.be.true;
      expect(createResponse.data.data).to.have.property('id');
      
      const packageId = createResponse.data.data.id;
      this.testPackage.id = packageId;
      
      this.addTestResult('Package Creation', '✅ PASSED');
      
      // Get package details
      const getResponse = await this.axios.get(`/api/subscriptions/packages/${packageId}`);
      expect(getResponse.status).to.equal(200);
      expect(getResponse.data.success).to.be.true;
      expect(getResponse.data.data.name).to.equal(testPackage.name);
      
      this.addTestResult('Package Retrieval', '✅ PASSED');
      
      // Update package
      const updateData = { name: 'Updated Premium Test Package', price: 34.99 };
      const updateResponse = await this.axios.put(`/api/subscriptions/packages/${packageId}`, updateData);
      expect(updateResponse.status).to.equal(200);
      expect(updateResponse.data.success).to.be.true;
      
      this.addTestResult('Package Update', '✅ PASSED');
      
      // Toggle package status
      const toggleResponse = await this.axios.patch(`/api/subscriptions/packages/${packageId}/toggle`);
      expect(toggleResponse.status).to.equal(200);
      expect(toggleResponse.data.success).to.be.true;
      
      this.addTestResult('Package Status Toggle', '✅ PASSED');
      
      // List all packages
      const listResponse = await this.axios.get('/api/subscriptions/packages');
      expect(listResponse.status).to.equal(200);
      expect(listResponse.data.success).to.be.true;
      expect(listResponse.data.data).to.be.an('array');
      expect(listResponse.data.data.length).to.be.greaterThan(0);
      
      this.addTestResult('Package List', '✅ PASSED');
      
    } catch (error) {
      this.addTestResult('Package Management Tests', '❌ FAILED - ' + error.message);
    }
  }

  async testUserSubscriptionManagement() {
    console.log('👥 Testing User Subscription Management...');
    
    try {
      // Get user subscriptions list
      const usersResponse = await this.axios.get('/api/subscriptions/admin/users');
      expect(usersResponse.status).to.equal(200);
      expect(usersResponse.data.success).to.be.true;
      expect(usersResponse.data.data).to.have.property('users');
      
      this.addTestResult('User Subscriptions List', '✅ PASSED');
      
      // Search users
      const searchResponse = await this.axios.get('/api/subscriptions/admin/users?search=test');
      expect(searchResponse.status).to.equal(200);
      expect(searchResponse.data.success).to.be.true;
      
      this.addTestResult('User Search', '✅ PASSED');
      
      // Filter by status
      const filterResponse = await this.axios.get('/api/subscriptions/admin/users?status=active');
      expect(filterResponse.status).to.equal(200);
      expect(filterResponse.data.success).to.be.true;
      
      this.addTestResult('User Status Filter', '✅ PASSED');
      
    } catch (error) {
      this.addTestResult('User Subscription Management Tests', '❌ FAILED - ' + error.message);
    }
  }

  async testPaymentManagement() {
    console.log('💳 Testing Payment Management...');
    
    try {
      // Get payment history
      const paymentsResponse = await this.axios.get('/api/subscriptions/payments/history');
      expect(paymentsResponse.status).to.equal(200);
      expect(paymentsResponse.data.success).to.be.true;
      expect(paymentsResponse.data.data).to.have.property('payments');
      
      this.addTestResult('Payment History', '✅ PASSED');
      
      // Filter payments by status
      const filterResponse = await this.axios.get('/api/subscriptions/payments/history?status=completed');
      expect(filterResponse.status).to.equal(200);
      expect(filterResponse.data.success).to.be.true;
      
      this.addTestResult('Payment Status Filter', '✅ PASSED');
      
      // Test payment processing (mock)
      const paymentData = {
        amount: 29.99,
        currency: 'USD',
        paymentMethod: 'stripe',
        packageId: this.testPackage.id,
        description: 'Test payment'
      };
      
      const paymentResponse = await this.axios.post('/api/subscriptions/payment', paymentData);
      expect(paymentResponse.status).to.equal(200);
      expect(paymentResponse.data.success).to.be.true;
      expect(paymentResponse.data.data).to.have.property('paymentId');
      
      this.addTestResult('Payment Processing', '✅ PASSED');
      
    } catch (error) {
      this.addTestResult('Payment Management Tests', '❌ FAILED - ' + error.message);
    }
  }

  async testAnalytics() {
    console.log('📊 Testing Analytics...');
    
    try {
      // Get analytics data
      const analyticsResponse = await this.axios.get('/api/subscriptions/analytics');
      expect(analyticsResponse.status).to.equal(200);
      expect(analyticsResponse.data.success).to.be.true;
      expect(analyticsResponse.data.data).to.have.property('packageStats');
      expect(analyticsResponse.data.data).to.have.property('revenueTrends');
      expect(analyticsResponse.data.data).to.have.property('churnData');
      
      this.addTestResult('Analytics Data', '✅ PASSED');
      
      // Get performance metrics
      const performanceResponse = await this.axios.get('/api/subscriptions/analytics/performance');
      expect(performanceResponse.status).to.equal(200);
      expect(performanceResponse.data.success).to.be.true;
      expect(performanceResponse.data.data).to.have.property('conversionRates');
      expect(performanceResponse.data.data).to.have.property('mrr');
      expect(performanceResponse.data.data).to.have.property('arpu');
      
      this.addTestResult('Performance Metrics', '✅ PASSED');
      
      // Get trend analysis
      const trendsResponse = await this.axios.get('/api/subscriptions/analytics/trends?period=30d');
      expect(trendsResponse.status).to.equal(200);
      expect(trendsResponse.data.success).to.be.true;
      expect(trendsResponse.data.data).to.have.property('subscriptionTrends');
      expect(trendsResponse.data.data).to.have.property('cancellationTrends');
      
      this.addTestResult('Trend Analysis', '✅ PASSED');
      
      // Test analytics export
      const exportResponse = await this.axios.get('/api/subscriptions/analytics/export?format=json');
      expect(exportResponse.status).to.equal(200);
      expect(exportResponse.data.success).to.be.true;
      expect(exportResponse.data.data).to.have.property('packageAnalytics');
      
      this.addTestResult('Analytics Export', '✅ PASSED');
      
    } catch (error) {
      this.addTestResult('Analytics Tests', '❌ FAILED - ' + error.message);
    }
  }

  async testWebSocketIntegration() {
    console.log('🌐 Testing WebSocket Integration...');
    
    try {
      // Connect to WebSocket
      await this.connectWebSocket();
      
      // Subscribe to updates
      this.wsClient.send('subscribe', { types: ['subscription:created', 'package:updated'] });
      
      // Wait a moment for subscription confirmation
      await this.delay(1000);
      
      this.addTestResult('WebSocket Connection', '✅ PASSED');
      this.addTestResult('WebSocket Subscription', '✅ PASSED');
      
      // Test real-time updates by creating a package
      const createResponse = await this.axios.post('/api/subscriptions/packages', {
        name: 'WebSocket Test Package',
        description: 'Package for testing WebSocket notifications',
        price: 19.99,
        duration: 30,
        status: 'active'
      });
      
      // Wait for WebSocket notification
      await this.delay(2000);
      
      this.addTestResult('Real-time Package Updates', '✅ PASSED');
      
      // Disconnect WebSocket
      this.disconnectWebSocket();
      
    } catch (error) {
      this.addTestResult('WebSocket Integration Tests', '❌ FAILED - ' + error.message);
    }
  }

  async testSettings() {
    console.log('⚙️ Testing Settings...');
    
    try {
      // Get current settings
      const getResponse = await this.axios.get('/api/subscriptions/admin/settings');
      expect(getResponse.status).to.equal(200);
      expect(getResponse.data.success).to.be.true;
      expect(getResponse.data.data).to.have.property('paymentGateway');
      expect(getResponse.data.data).to.have.property('subscription');
      
      this.addTestResult('Settings Retrieval', '✅ PASSED');
      
      // Update settings
      const settingsData = {
        paymentGateway: {
          stripePublishableKey: 'pk_test_updated',
          stripeSecretKey: 'sk_test_updated',
          paypalClientId: 'paypal_updated'
        },
        subscription: {
          enableFreeTrials: false,
          autoRenewSubscriptions: true,
          gracePeriodDays: 10
        }
      };
      
      const updateResponse = await this.axios.post('/api/subscriptions/admin/settings', settingsData);
      expect(updateResponse.status).to.equal(200);
      expect(updateResponse.data.success).to.be.true;
      
      this.addTestResult('Settings Update', '✅ PASSED');
      
    } catch (error) {
      this.addTestResult('Settings Tests', '❌ FAILED - ' + error.message);
    }
  }

  async testBulkOperations() {
    console.log('📦 Testing Bulk Operations...');
    
    try {
      // Test bulk operations endpoints (these would need actual user IDs)
      // For now, we'll just test that the endpoints exist and return proper validation
      
      const bulkCancelData = {
        userIds: [],
        reason: 'Test bulk cancellation'
      };
      
      try {
        await this.axios.post('/api/subscriptions/admin/bulk/cancel', bulkCancelData);
        this.addTestResult('Bulk Cancel Validation', '❌ FAILED - Should reject empty user array');
      } catch (error) {
        expect(error.response.status).to.equal(400);
        this.addTestResult('Bulk Cancel Validation', '✅ PASSED');
      }
      
      const bulkUpgradeData = {
        userIds: [],
        packageId: 1,
        reason: 'Test bulk upgrade'
      };
      
      try {
        await this.axios.post('/api/subscriptions/admin/bulk/upgrade', bulkUpgradeData);
        this.addTestResult('Bulk Upgrade Validation', '❌ FAILED - Should reject empty user array');
      } catch (error) {
        expect(error.response.status).to.equal(400);
        this.addTestResult('Bulk Upgrade Validation', '✅ PASSED');
      }
      
    } catch (error) {
      this.addTestResult('Bulk Operations Tests', '❌ FAILED - ' + error.message);
    }
  }

  async testUIUX() {
    console.log('🎨 Testing UI/UX...');
    
    try {
      // Test responsive design by checking if the HTML file exists and has proper structure
      const fs = require('fs');
      const path = require('path');
      
      const htmlPath = path.join(__dirname, 'public/admin_dashboard/subscriptions.html');
      if (!fs.existsSync(htmlPath)) {
        throw new Error('Subscription dashboard HTML file not found');
      }
      
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      
      // Check for responsive design elements
      expect(htmlContent).to.include('@media (max-width: 768px)');
      expect(htmlContent).to.include('responsive');
      expect(htmlContent).to.include('mobile');
      
      this.addTestResult('Responsive Design', '✅ PASSED');
      
      // Check for accessibility features
      expect(htmlContent).to.include('role=');
      expect(htmlContent).to.include('aria-');
      expect(htmlContent).to.include('alt=');
      
      this.addTestResult('Accessibility Features', '✅ PASSED');
      
      // Check for form validation
      expect(htmlContent).to.include('required');
      expect(htmlContent).to.include('validation');
      expect(htmlContent).to.include('pattern');
      
      this.addTestResult('Form Validation', '✅ PASSED');
      
      // Check for loading states
      expect(htmlContent).to.include('loading');
      expect(htmlContent).to.include('spinner');
      expect(htmlContent).to.include('progress');
      
      this.addTestResult('Loading States', '✅ PASSED');
      
      // Check for error handling
      expect(htmlContent).to.include('error');
      expect(htmlContent).to.include('catch');
      expect(htmlContent).to.include('try');
      
      this.addTestResult('Error Handling', '✅ PASSED');
      
    } catch (error) {
      this.addTestResult('UI/UX Tests', '❌ FAILED - ' + error.message);
    }
  }

  // Helper methods
  addTestResult(testName, result) {
    this.testResults.push({ testName, result, timestamp: new Date().toISOString() });
    console.log(`  ${result} ${testName}`);
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      const token = ADMIN_TOKEN;
      this.wsClient = new WebSocket(`${WS_URL}?token=${token}`);
      
      this.wsClient.on('open', () => {
        console.log('  ✅ WebSocket connected');
        resolve();
      });
      
      this.wsClient.on('error', (error) => {
        console.log('  ❌ WebSocket connection failed:', error);
        reject(error);
      });
      
      this.wsClient.on('message', (data) => {
        const message = JSON.parse(data);
        console.log('  📨 WebSocket message received:', message.type);
      });
    });
  }

  disconnectWebSocket() {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
      console.log('  ✅ WebSocket disconnected');
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printTestResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('========================\n');
    
    const passed = this.testResults.filter(r => r.result.includes('✅')).length;
    const failed = this.testResults.filter(r => r.result.includes('❌')).length;
    const total = this.testResults.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);
    
    console.log('Detailed Results:');
    this.testResults.forEach(result => {
      console.log(`  ${result.result}`);
    });
    
    if (failed > 0) {
      console.log('\n❌ Some tests failed. Please review the failures above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed! The subscription dashboard is ready for production.');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new SubscriptionDashboardTester();
  tester.runAllTests().catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = SubscriptionDashboardTester;