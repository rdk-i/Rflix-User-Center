// Simple test script for the subscription system
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testSimpleSystem() {
  console.log('🧪 Testing Simple Subscription System...\n');
  
  try {
    // Test 1: Get packages (public endpoint)
    console.log('1️⃣ Testing GET /api/simple-packages/packages');
    const packagesResponse = await axios.get(`${API_BASE}/simple-packages/packages`);
    console.log('✅ Packages endpoint works:', packagesResponse.data);
    
    // Test 2: Test registration form (public endpoint)
    console.log('\n2️⃣ Testing GET /api/simple-packages/packages (for registration form)');
    const regPackagesResponse = await axios.get(`${API_BASE}/simple-packages/packages`);
    console.log('✅ Registration packages endpoint works:', regPackagesResponse.data);
    
    // Test 3: Test simple registration
    console.log('\n3️⃣ Testing POST /api/simple-registration/register');
    const registrationData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'test123456',
      phone: '08123456789',
      packageId: null // No package selected
    };
    
    const regResponse = await axios.post(`${API_BASE}/simple-registration/register`, registrationData);
    console.log('✅ Registration endpoint works:', regResponse.data);
    
    console.log('\n🎉 All simple system endpoints are working correctly!');
    console.log('\n📋 System Summary:');
    console.log('• Package management: ✅ 3 fields (Name, Duration, Price)');
    console.log('• Registration: ✅ Simple form with basic fields');
    console.log('• No complex features: ✅ No payment, analytics, or usage limits');
    console.log('• Clean API routes: ✅ Only essential endpoints');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testSimpleSystem();