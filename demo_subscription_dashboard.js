/**
 * Demo Script for Subscription Dashboard
 * Shows how to use the various features of the subscription management system
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const ADMIN_TOKEN = 'your-admin-token-here'; // Replace with actual admin token

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

console.log('🚀 Subscription Dashboard Demo\n');

async function runDemo() {
  try {
    console.log('1️⃣ Fetching Dashboard Analytics...');
    const analytics = await getAnalytics();
    console.log(`   📊 Monthly Revenue: $${analytics.metrics.totalRevenue?.total || 0}`);
    console.log(`   👥 Active Subscriptions: ${analytics.metrics.activeSubscriptions?.count || 0}`);
    console.log(`   💰 Total Users: ${analytics.metrics.totalUsers?.count || 0}\n`);

    console.log('2️⃣ Creating a New Package...');
    const newPackage = await createPackage({
      name: 'Premium Plus',
      description: 'Ultimate streaming experience with all features',
      price: 39.99,
      duration: 30,
      status: 'active',
      features: {
        '4K Ultra HD': true,
        'Dolby Atmos': true,
        'Unlimited Devices': true,
        'Priority Support': true,
        'Offline Downloads': true
      },
      limits: {
        apiCalls: 10000,
        storage: 5120,
        bandwidth: 100,
        devices: 10
      }
    });
    console.log(`   ✅ Created package: ${newPackage.name} (ID: ${newPackage.id})\n`);

    console.log('3️⃣ Listing All Packages...');
    const packages = await getPackages();
    console.log(`   📦 Found ${packages.length} packages:`);
    packages.forEach(pkg => {
      console.log(`      • ${pkg.name} - $${pkg.price} (${pkg.activeSubscriptions || 0} active subs)`);
    });
    console.log();

    console.log('4️⃣ Fetching User Subscriptions...');
    const userSubscriptions = await getUserSubscriptions();
    console.log(`   👥 Found ${userSubscriptions.length} users with subscriptions:`);
    userSubscriptions.slice(0, 5).forEach(user => {
      console.log(`      • ${user.username || user.email} - ${user.packageName || 'No Package'} (${user.subscriptionStatus})`);
    });
    if (userSubscriptions.length > 5) {
      console.log(`      ... and ${userSubscriptions.length - 5} more`);
    }
    console.log();

    console.log('5️⃣ Processing a Test Payment...');
    const payment = await processPayment({
      amount: 29.99,
      currency: 'USD',
      paymentMethod: 'stripe',
      packageId: packages[0]?.id || 1,
      description: 'Demo payment for testing'
    });
    console.log(`   💳 Payment processed: $${payment.amount} (${payment.paymentMethod})\n`);

    console.log('6️⃣ Fetching Payment History...');
    const payments = await getPaymentHistory();
    console.log(`   💰 Found ${payments.length} payments:`);
    payments.slice(0, 3).forEach(payment => {
      console.log(`      • $${payment.amount} - ${payment.status} (${payment.paymentMethod})`);
    });
    if (payments.length > 3) {
      console.log(`      ... and ${payments.length - 3} more`);
    }
    console.log();

    console.log('7️⃣ Testing Real-time Updates (WebSocket)...');
    await testWebSocketUpdates();
    console.log();

    console.log('8️⃣ Exporting Analytics Data...');
    const exportData = await exportAnalytics('json');
    console.log(`   📊 Exported analytics data with ${exportData.packageAnalytics?.length || 0} packages\n`);

    console.log('9️⃣ Updating Settings...');
    await updateSettings({
      paymentGateway: {
        stripePublishableKey: 'pk_test_demo_key',
        stripeSecretKey: 'sk_test_demo_key',
        paypalClientId: 'paypal_demo_client_id'
      },
      subscription: {
        enableFreeTrials: true,
        autoRenewSubscriptions: true,
        gracePeriodDays: 7
      }
    });
    console.log('   ⚙️ Settings updated successfully\n');

    console.log('🎉 Demo completed successfully!');
    console.log('\n💡 Key Features Demonstrated:');
    console.log('   • Real-time analytics dashboard with charts');
    console.log('   • Package creation and management');
    console.log('   • User subscription tracking');
    console.log('   • Payment processing and history');
    console.log('   • WebSocket real-time updates');
    console.log('   • Settings configuration');
    console.log('   • Data export functionality');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Helper functions for API calls
async function getAnalytics() {
  const response = await api.get('/api/subscriptions/admin/dashboard');
  return response.data.data;
}

async function getPackages() {
  const response = await api.get('/api/subscriptions/packages');
  return response.data.data;
}

async function createPackage(packageData) {
  const response = await api.post('/api/subscriptions/packages', packageData);
  return response.data.data;
}

async function getUserSubscriptions() {
  const response = await api.get('/api/subscriptions/admin/users');
  return response.data.data.users;
}

async function processPayment(paymentData) {
  const response = await api.post('/api/subscriptions/payment', paymentData);
  return response.data.data;
}

async function getPaymentHistory() {
  const response = await api.get('/api/subscriptions/payments/history');
  return response.data.data.payments;
}

async function exportAnalytics(format = 'json') {
  const response = await api.get(`/api/subscriptions/analytics/export?format=${format}`);
  return response.data.data;
}

async function updateSettings(settings) {
  const response = await api.post('/api/subscriptions/admin/settings', settings);
  return response.data.data;
}

// WebSocket testing
async function testWebSocketUpdates() {
  return new Promise((resolve) => {
    const WebSocket = require('ws');
    const ws = new WebSocket(`${WS_URL.replace('http', 'ws')}?token=${ADMIN_TOKEN}`);
    
    ws.on('open', () => {
      console.log('   ✅ Connected to WebSocket');
      
      // Subscribe to updates
      ws.send(JSON.stringify({
        type: 'subscribe',
        payload: {
          types: ['subscription:created', 'package:updated', 'payment:completed']
        }
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      console.log(`   📨 Received: ${message.type}`);
      
      if (message.type === 'subscription:confirmed') {
        console.log('   ✅ Subscribed to real-time updates');
        
        // Trigger a test update by creating a package
        setTimeout(async () => {
          try {
            await createPackage({
              name: 'WebSocket Test Package',
              description: 'Package to test real-time updates',
              price: 24.99,
              duration: 30,
              status: 'active'
            });
            console.log('   ✅ Test package created, waiting for WebSocket notification...');
          } catch (error) {
            console.log('   ⚠️  Could not create test package:', error.message);
          }
        }, 1000);
      }
    });
    
    ws.on('error', (error) => {
      console.log('   ❌ WebSocket error:', error.message);
    });
    
    // Close connection after demo
    setTimeout(() => {
      ws.close();
      console.log('   ✅ WebSocket connection closed');
      resolve();
    }, 5000);
  });
}

// Run the demo
if (require.main === module) {
  console.log('🎯 Starting Subscription Dashboard Demo...\n');
  runDemo().then(() => {
    console.log('\n✨ Demo completed!');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 Demo failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runDemo,
  getAnalytics,
  getPackages,
  createPackage,
  getUserSubscriptions,
  processPayment,
  getPaymentHistory,
  exportAnalytics,
  updateSettings
};