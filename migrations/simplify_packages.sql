-- Migration: Simplify Packages System
-- Date: 2025-11-24
-- Description: Simplify packages table to only essential fields and convert duration from months to days

-- Drop existing packages table and create simplified version
DROP TABLE IF EXISTS packages;

CREATE TABLE packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  duration_days INTEGER NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert simplified default packages
INSERT OR IGNORE INTO packages (id, name, duration_days, price, is_active) VALUES
  (1, '1 Bulan', 30, 50000, 1),
  (2, '3 Bulan', 90, 120000, 1),
  (3, '6 Bulan', 180, 230000, 1),
  (4, '12 Bulan', 365, 450000, 1);

-- Update user_expiration table to use package_id instead of packageMonths
-- First, backup existing data
CREATE TABLE IF NOT EXISTS user_expiration_backup AS SELECT * FROM user_expiration;

-- Drop and recreate user_expiration with package_id reference
DROP TABLE IF EXISTS user_expiration;

CREATE TABLE user_expiration (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  jellyfinUserId TEXT NOT NULL,
  packageId INTEGER,
  expirationDate DATETIME NOT NULL,
  isActive BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE,
  FOREIGN KEY (packageId) REFERENCES packages(id) ON DELETE SET NULL
);

-- Restore data with default package (1 month) for existing users
-- Only insert for users who have a jellyfinUserId
INSERT INTO user_expiration (userId, jellyfinUserId, packageId, expirationDate, isActive, created_at, updated_at)
SELECT 
  u.id, 
  u.jellyfinUserId, 
  1, -- Default to 1 month package
  datetime('now', '+1 month'), -- Set expiration 1 month from now
  0, -- Inactive by default (needs admin approval)
  datetime('now'),
  datetime('now')
FROM api_users u
WHERE u.jellyfinUserId IS NOT NULL AND u.jellyfinUserId != '';

-- Drop the backup table
DROP TABLE IF EXISTS user_expiration_backup;