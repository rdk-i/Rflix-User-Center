const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

// Helper to write .env file
const writeEnv = (config) => {
  const envPath = path.join(__dirname, '../../.env');
  let envContent = '';

  // Default values
  const defaults = {
    DB_PATH: './data/rflix.db',
    BCRYPT_SALT_ROUNDS: 12,
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '30d',
    SMTP_SECURE: 'false',
    LOG_LEVEL: 'info',
    LOG_FILE: './logs/app.log'
  };

  const finalConfig = { ...defaults, ...config, SETUP_COMPLETED: 'true' };

  for (const [key, value] of Object.entries(finalConfig)) {
    if (key !== 'ADMIN_EMAIL' && key !== 'ADMIN_PASSWORD') {
      envContent += `${key}=${value}\n`;
    }
  }

  fs.writeFileSync(envPath, envContent);
};

router.post('/config', (req, res) => {
  try {
    writeEnv(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Setup config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/migrate', (req, res) => {
  const migrateScript = path.join(__dirname, '../../migrations/run.js');
  
  exec(`node "${migrateScript}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Migration error: ${error}`);
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true, output: stdout });
  });
});

router.post('/create-admin', async (req, res) => {
  const { email, password } = req.body;
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/rflix.db');

  try {
    const db = new Database(dbPath);
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM api_users WHERE email = ?').get(email);

    if (existingUser) {
      // Update existing user to be admin
      const stmt = db.prepare(`
        UPDATE api_users 
        SET password_hash = ?, role = 'admin', updated_at = ?
        WHERE email = ?
      `);
      stmt.run(hashedPassword, new Date().toISOString(), email);
    } else {
      // Insert new admin
      const stmt = db.prepare(`
        INSERT INTO api_users (email, password_hash, role, created_at)
        VALUES (?, ?, 'admin', ?)
      `);
      stmt.run(email, hashedPassword, new Date().toISOString());
    }
    
    // Ensure user has super-admin role in user_roles table
    const user = db.prepare('SELECT id FROM api_users WHERE email = ?').get(email);
    const superAdminRole = db.prepare("SELECT id FROM roles WHERE name = 'super-admin'").get();
    
    if (user && superAdminRole) {
      const existingRole = db.prepare('SELECT * FROM user_roles WHERE userId = ? AND roleId = ?').get(user.id, superAdminRole.id);
      if (!existingRole) {
        db.prepare('INSERT INTO user_roles (userId, roleId) VALUES (?, ?)').run(user.id, superAdminRole.id);
      }
    }

    db.close();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Create admin error:', error);
    // Return detailed error for debugging
    res.status(500).json({ success: false, error: `DB Error: ${error.message}` });
  }
});

router.post('/restart', (req, res) => {
  res.json({ success: true });
  
  // Exit process to trigger PM2 restart
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

module.exports = router;
