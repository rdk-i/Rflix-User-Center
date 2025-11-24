/**
 * Manual test for countdown system using API endpoints
 * This test verifies the countdown functionality without direct database access
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

// Test data
const testPackage = {
  name: 'Test Package 30 Days',
  duration_days: 30,
  price: 50000
};

const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
  packageId: null // Will be set after package creation
};

async function testCountdownSystem() {
  console.log('🧪 Starting manual countdown system test...\n');

  try {
    // Test 1: Create a test package
    console.log('📦 Test 1: Creating test package');
    
    // First, let's check if we can get existing packages
    try {
      const packagesResponse = await axios.get(`${API_BASE}/api/packages`);
      if (packagesResponse.data.success && packagesResponse.data.data.length > 0) {
        const existingPackage = packagesResponse.data.data[0];
        testUser.packageId = existingPackage.id;
        console.log(`✅ Using existing package: ${existingPackage.name} (${existingPackage.duration_days} days)`);
      } else {
        console.log('❌ No packages found, need to create one');
        return;
      }
    } catch (error) {
      console.log('❌ Failed to fetch packages:', error.message);
      return;
    }

    // Test 2: Test registration with package
    console.log('\n👤 Test 2: Testing user registration with package');
    try {
      const registrationResponse = await axios.post(`${API_BASE}/api/simple-registration/register`, testUser);
      if (registrationResponse.data.success) {
        console.log('✅ Registration successful:', registrationResponse.data.data);
        console.log(`   - Package: ${registrationResponse.data.data.packageName}`);
        console.log(`   - Duration: ${registrationResponse.data.data.durationDays} days`);
      } else {
        console.log('❌ Registration failed:', registrationResponse.data.error);
        return;
      }
    } catch (error) {
      console.log('❌ Registration error:', error.message);
      return;
    }

    // Test 3: Test user login and get user data with countdown
    console.log('\n🔐 Test 3: Testing user login and getting user data');
    
    // First, let's try to login as admin to get a token
    try {
      const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
        email: 'admin@rflix.local',
        password: 'admin123'
      });
      
      if (loginResponse.data.success) {
        const token = loginResponse.data.data.token;
        console.log('✅ Admin login successful');
        
        // Now get user data with countdown
        try {
          const userResponse = await axios.get(`${API_BASE}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (userResponse.data.success) {
            const userData = userResponse.data.data;
            console.log('✅ User data retrieved successfully');
            console.log('📊 User Data:');
            console.log(`   - Email: ${userData.email}`);
            console.log(`   - Role: ${userData.role}`);
            
            if (userData.subscription) {
              const sub = userData.subscription;
              console.log('\n📅 Subscription Details:');
              console.log(`   - Status: ${sub.isActive ? 'Active' : 'Inactive'}`);
              console.log(`   - Expired: ${sub.isExpired ? 'Yes' : 'No'}`);
              console.log(`   - Days Remaining: ${sub.daysRemaining}`);
              console.log(`   - Countdown Text: ${sub.countdownText}`);
              console.log(`   - Expiration Date: ${sub.expirationDate}`);
              
              // Verify countdown calculation
              const expectedDays = Math.ceil((new Date(sub.expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
              console.log(`   - Expected Days: ${expectedDays}`);
              console.log(`   - Countdown Match: ${sub.daysRemaining === expectedDays ? '✅' : '❌'}`);
            } else {
              console.log('⚠️  No subscription data found');
            }
          } else {
            console.log('❌ Failed to get user data:', userResponse.data.error);
          }
        } catch (error) {
          console.log('❌ Failed to get user data:', error.message);
        }
      } else {
        console.log('❌ Admin login failed:', loginResponse.data.error);
      }
    } catch (error) {
      console.log('❌ Login error:', error.message);
    }

    console.log('\n🎉 Manual countdown system test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
console.log('🚀 Starting countdown system manual test...\n');
testCountdownSystem();