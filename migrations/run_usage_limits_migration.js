#!/usr/bin/env node

/**
 * Usage Limits System Migration Runner
 * Executes the usage limits database migration
 */

const fs = require('fs');
const path = require('path');
const db = require('../server/config/database');
const logger = require('../server/utils/logger');

// Migration file path
const migrationFile = path.join(__dirname, 'add_usage_limits_system.sql');

/**
 * Execute SQL migration file
 */
async function runMigration() {
  logger.info('Starting usage limits system migration...');
  
  try {
    // Read migration file
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
    
    // Split SQL statements (handle both single and multi-line statements)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    logger.info(`Found ${statements.length} SQL statements to execute`);
    
    // Start transaction
    db.prepare('BEGIN TRANSACTION').run();
    
    let executedStatements = 0;
    let failedStatements = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        // Skip comment lines and empty statements
        if (statement.includes('--') || statement.length < 10) continue;
        
        logger.debug(`Executing statement ${i + 1}: ${statement.substring(0, 50)}...`);
        
        db.prepare(statement).run();
        executedStatements++;
        
      } catch (error) {
        failedStatements++;
        logger.warn(`Statement ${i + 1} failed (may be expected for existing objects): ${error.message}`);
        
        // Continue execution for expected errors (like existing tables/indexes)
        if (!error.message.includes('already exists') && 
            !error.message.includes('duplicate column name')) {
          throw error;
        }
      }
    }
    
    // Commit transaction
    db.prepare('COMMIT').run();
    
    logger.info(`Migration completed successfully`);
    logger.info(`Executed: ${executedStatements} statements`);
    logger.info(`Failed (expected): ${failedStatements} statements`);
    
    // Verify migration results
    await verifyMigration();
    
  } catch (error) {
    // Rollback transaction on error
    db.prepare('ROLLBACK').run();
    logger.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Verify migration results
 */
async function verifyMigration() {
  logger.info('Verifying migration results...');
  
  try {
    const tables = [
      'usage_tracking',
      'usage_history',
      'usage_limits',
      'usage_violations',
      'usage_notifications',
      'usage_analytics',
      'subscription_tiers'
    ];
    
    const views = [
      'usage_dashboard',
      'usage_violations_summary',
      'usage_trends'
    ];
    
    // Check tables
    for (const table of tables) {
      const result = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      ).get(table);
      
      if (result) {
        logger.info(`✅ Table '${table}' created successfully`);
      } else {
        logger.warn(`⚠️  Table '${table}' not found`);
      }
    }
    
    // Check views
    for (const view of views) {
      const result = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='view' AND name=?"
      ).get(view);
      
      if (result) {
        logger.info(`✅ View '${view}' created successfully`);
      } else {
        logger.warn(`⚠️  View '${view}' not found`);
      }
    }
    
    // Check subscription tiers data
    const tiers = db.prepare('SELECT COUNT(*) as count FROM subscription_tiers').get();
    logger.info(`✅ Subscription tiers data: ${tiers.count} tiers configured`);
    
    // Check indexes
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND name LIKE 'idx_usage_%'
    `).all();
    
    logger.info(`✅ Usage tracking indexes: ${indexes.length} indexes created`);
    
    logger.info('✅ Migration verification completed');
    
  } catch (error) {
    logger.error('Migration verification failed:', error);
    throw error;
  }
}

/**
 * Insert sample data for testing
 */
async function insertSampleData() {
  logger.info('Inserting sample data for testing...');
  
  try {
    // Check if we have test users
    const testUsers = db.prepare(`
      SELECT id, email FROM api_users 
      WHERE email LIKE '%test%' OR email LIKE '%demo%'
      LIMIT 5
    `).all();
    
    if (testUsers.length === 0) {
      logger.warn('No test users found. Sample data insertion skipped.');
      return;
    }
    
    // Insert sample usage tracking data
    for (const user of testUsers) {
      // Check if usage tracking already exists
      const existing = db.prepare('SELECT id FROM usage_tracking WHERE userId = ?').get(user.id);
      
      if (!existing) {
        db.prepare(`
          INSERT INTO usage_tracking (userId, storage_used, streams_active, concurrent_users, api_calls, stream_duration)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          user.id,
          Math.floor(Math.random() * 5000000000), // 0-5GB storage
          Math.floor(Math.random() * 3), // 0-3 streams
          1, // 1 concurrent user
          Math.floor(Math.random() * 500), // 0-500 API calls
          Math.floor(Math.random() * 43200000) // 0-12 hours stream duration
        );
        
        logger.info(`✅ Sample usage data created for user ${user.email}`);
      }
    }
    
    // Insert sample usage history
    for (const user of testUsers) {
      // Check if history already exists
      const historyCount = db.prepare('SELECT COUNT(*) as count FROM usage_history WHERE userId = ?').get(user.id);
      
      if (historyCount.count === 0) {
        // Insert 7 days of sample history
        for (let i = 0; i < 7; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          
          db.prepare(`
            INSERT INTO usage_history (userId, metric_type, metric_value, timestamp)
            VALUES (?, 'storage', ?, ?)
          `).run(user.id, Math.floor(Math.random() * 1000000000), date.toISOString());
          
          db.prepare(`
            INSERT INTO usage_history (userId, metric_type, metric_value, timestamp)
            VALUES (?, 'api_call', ?, ?)
          `).run(user.id, Math.floor(Math.random() * 100), date.toISOString());
        }
        
        logger.info(`✅ Sample usage history created for user ${user.email}`);
      }
    }
    
    logger.info('✅ Sample data insertion completed');
    
  } catch (error) {
    logger.error('Sample data insertion failed:', error);
    throw error;
  }
}

/**
 * Main migration runner
 */
async function main() {
  logger.info('==========================================');
  logger.info('Usage Limits System Migration');
  logger.info('==========================================');
  
  try {
    // Run migration
    await runMigration();
    
    // Insert sample data
    await insertSampleData();
    
    logger.info('==========================================');
    logger.info('✅ Migration completed successfully!');
    logger.info('==========================================');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Test the usage limits system with: node test_usage_limits_system.js');
    logger.info('2. Check API endpoints at: http://localhost:3000/api/usage-limits/');
    logger.info('3. Review admin dashboard for usage monitoring');
    logger.info('');
    
  } catch (error) {
    logger.error('==========================================');
    logger.error('❌ Migration failed!');
    logger.error('==========================================');
    logger.error(error.message);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  runMigration,
  verifyMigration,
  insertSampleData
};