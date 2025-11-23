-- Migration: Add Packages Table
-- Date: 2025-11-24
-- Description: Menambahkan tabel packages dan kolom packageId ke user_expiration

-- Buat tabel packages
CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  durationMonths INTEGER NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  description TEXT,
  isActive BOOLEAN DEFAULT 1,
  displayOrder INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default packages
INSERT OR IGNORE INTO packages (id, name, durationMonths, price, description, displayOrder) VALUES
  (1, '1 Month', 1, 50000, 'Monthly subscription', 1),
  (2, '3 Months', 3, 135000, 'Quarterly subscription (10% discount)', 2),
  (3, '6 Months', 6, 255000, 'Semi-annual subscription (15% discount)', 3),
  (4, '12 Months', 12, 480000, 'Annual subscription (20% discount)', 4);

-- Cek apakah kolom packageId sudah ada
-- SQLite tidak support IF NOT EXISTS untuk ALTER TABLE, jadi kita gunakan workaround
-- Jika error "duplicate column name" muncul, abaikan saja (artinya kolom sudah ada)

-- Backup tabel user_expiration
CREATE TABLE IF NOT EXISTS user_expiration_backup AS SELECT * FROM user_expiration;

-- Drop dan recreate tabel user_expiration dengan kolom baru
DROP TABLE IF EXISTS user_expiration;

CREATE TABLE user_expiration (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  jellyfinUserId TEXT NOT NULL,
  packageId INTEGER,
  expirationDate DATETIME NOT NULL,
  packageMonths INTEGER NOT NULL DEFAULT 1,
  isActive BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE,
  FOREIGN KEY (packageId) REFERENCES packages(id) ON DELETE SET NULL
);

-- Restore data dari backup
INSERT INTO user_expiration (id, userId, jellyfinUserId, expirationDate, packageMonths, isActive, created_at, updated_at)
SELECT id, userId, jellyfinUserId, expirationDate, packageMonths, isActive, created_at, updated_at
FROM user_expiration_backup;

-- Hapus backup
DROP TABLE user_expiration_backup;
