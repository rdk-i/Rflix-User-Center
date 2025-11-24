const db = require('./server/config/database');
const logger = require('./server/utils/logger');

/**
 * Test script for countdown system functionality
 */
async function testCountdownSystem() {
  logger.info('Starting countdown system test...');
  
  try {
    // Test 1: Create a test package with 30 days duration
    logger.info('Test 1: Creating test package with 30 days duration');
    const createPackage = db.prepare(`
      INSERT INTO packages (name, duration_days, price, is_active)
      VALUES (?, ?, ?, ?)
    `);
    
    const packageResult = createPackage.run('Test Package 30 Days', 30, 50000, 1);
    const packageId = packageResult.lastInsertRowid;
    logger.info(`✓ Created test package with ID: ${packageId}`);
    
    // Test 2: Create a test user
    logger.info('Test 2: Creating test user');
    const createUser = db.prepare(`
      INSERT INTO api_users (email, password_hash, jellyfinUserId, role)
      VALUES (?, ?, ?, ?)
    `);
    
    const userResult = createUser.run('test@example.com', 'hashed_password', 'test_jellyfin_id', 'user');
    const userId = userResult.lastInsertRowid;
    logger.info(`✓ Created test user with ID: ${userId}`);
    
    // Test 3: Create user expiration entry
    logger.info('Test 3: Creating user expiration entry');
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30); // 30 days from now
    
    const createExpiration = db.prepare(`
      INSERT INTO user_expiration (userId, jellyfinUserId, packageId, expirationDate, isActive)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    createExpiration.run(userId, 'test_jellyfin_id', packageId, expirationDate.toISOString(), 1);
    logger.info(`✓ Created expiration entry with date: ${expirationDate.toISOString()}`);
    
    // Test 4: Verify countdown calculation
    logger.info('Test 4: Verifying countdown calculation');
    const getUserWithExpiration = db.prepare(`
      SELECT 
        u.id, u.email,
        e.expirationDate, e.isActive,
        p.name as packageName, p.duration_days
      FROM api_users u
      LEFT JOIN user_expiration e ON u.id = e.userId
      LEFT JOIN packages p ON e.packageId = p.id
      WHERE u.id = ?
    `);
    
    const userData = getUserWithExpiration.get(userId);
    
    // Calculate countdown (same logic as in userController)
    const expiration = new Date(userData.expirationDate);
    const now = new Date();
    const timeDiff = expiration - now;
    const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    const isExpired = timeDiff < 0;
    
    let countdownText;
    if (isExpired) {
      countdownText = 'Expired';
    } else if (daysRemaining === 0) {
      countdownText = 'Expires Today';
    } else if (daysRemaining === 1) {
      countdownText = 'Expires Tomorrow';
    } else {
      countdownText = `Sisa ${daysRemaining} hari`;
    }
    
    logger.info(`✓ Countdown calculation results:`);
    logger.info(`  - Expiration Date: ${userData.expirationDate}`);
    logger.info(`  - Days Remaining: ${daysRemaining}`);
    logger.info(`  - Is Expired: ${isExpired}`);
    logger.info(`  - Countdown Text: ${countdownText}`);
    
    // Test 5: Verify scheduler integration
    logger.info('Test 5: Verifying scheduler integration');
    const getExpiredUsers = db.prepare(`
      SELECT ue.*, u.email
      FROM user_expiration ue
      JOIN api_users u ON ue.userId = u.id
      WHERE ue.expirationDate < datetime('now') AND ue.isActive = 1
    `);
    
    const expiredUsers = getExpiredUsers.all();
    logger.info(`✓ Found ${expiredUsers.length} users that should be disabled by scheduler`);
    
    // Test 6: Test with expired user
    logger.info('Test 6: Testing with expired user');
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 5); // 5 days ago
    
    const createExpiredUser = db.prepare(`
      INSERT INTO api_users (email, password_hash, jellyfinUserId, role)
      VALUES (?, ?, ?, ?)
    `);
    
    const expiredUserResult = createExpiredUser.run('expired@example.com', 'hashed_password', 'expired_jellyfin_id', 'user');
    const expiredUserId = expiredUserResult.lastInsertRowid;
    
    const createExpiredExpiration = db.prepare(`
      INSERT INTO user_expiration (userId, jellyfinUserId, packageId, expirationDate, isActive)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    createExpiredExpiration.run(expiredUserId, 'expired_jellyfin_id', packageId, expiredDate.toISOString(), 1);
    
    // Test expired user countdown
    const expiredUserData = getUserWithExpiration.get(expiredUserId);
    const expiredExpiration = new Date(expiredUserData.expirationDate);
    const expiredTimeDiff = expiredExpiration - now;
    const expiredDaysRemaining = Math.ceil(expiredTimeDiff / (1000 * 60 * 60 * 24));
    const expiredIsExpired = expiredTimeDiff < 0;
    
    let expiredCountdownText;
    if (expiredIsExpired) {
      expiredCountdownText = 'Expired';
    } else if (expiredDaysRemaining === 0) {
      expiredCountdownText = 'Expires Today';
    } else if (expiredDaysRemaining === 1) {
      expiredCountdownText = 'Expires Tomorrow';
    } else {
      expiredCountdownText = `Sisa ${expiredDaysRemaining} hari`;
    }
    
    logger.info(`✓ Expired user countdown results:`);
    logger.info(`  - Expiration Date: ${expiredUserData.expirationDate}`);
    logger.info(`  - Days Remaining: ${expiredDaysRemaining}`);
    logger.info(`  - Is Expired: ${expiredIsExpired}`);
    logger.info(`  - Countdown Text: ${expiredCountdownText}`);
    
    // Cleanup test data
    logger.info('Cleaning up test data...');
    db.prepare('DELETE FROM user_expiration WHERE userId IN (?, ?)').run(userId, expiredUserId);
    db.prepare('DELETE FROM api_users WHERE id IN (?, ?)').run(userId, expiredUserId);
    db.prepare('DELETE FROM packages WHERE id = ?').run(packageId);
    
    logger.info('✓ Test data cleaned up');
    
    logger.info('🎉 All countdown system tests completed successfully!');
    
  } catch (error) {
    logger.error('Test failed:', error);
    throw error;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testCountdownSystem()
    .then(() => {
      logger.info('Test completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = testCountdownSystem;