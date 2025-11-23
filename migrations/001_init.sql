-- Rflix-API Database Schema
-- Migration 001: Initial Schema

-- Table: api_users (Dashboard accounts for admin & users)
CREATE TABLE IF NOT EXISTS api_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  jellyfinUserId TEXT,
  role TEXT NOT NULL DEFAULT 'user', -- admin, user, moderator, support
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_expiration (Subscription expiration tracking)
CREATE TABLE IF NOT EXISTS user_expiration (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  jellyfinUserId TEXT NOT NULL,
  expirationDate DATETIME NOT NULL,
  packageMonths INTEGER NOT NULL DEFAULT 1,
  isActive BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE
);

-- Table: audit_log (Admin action tracking)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adminId INTEGER,
  action TEXT NOT NULL,
  targetUserId INTEGER,
  details TEXT, -- JSON
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip TEXT,
  userAgent TEXT,
  before TEXT, -- JSON snapshot before change
  after TEXT -- JSON snapshot after change
);

-- Table: coupons (Discount codes)
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL, -- 'percent' or 'fixed'
  value REAL NOT NULL,
  validFrom DATETIME,
  validTo DATETIME,
  maxUses INTEGER DEFAULT 0,
  usedCount INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_notifications (User notification preferences)
CREATE TABLE IF NOT EXISTS user_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  emailEnabled BOOLEAN DEFAULT 0,
  pushEnabled BOOLEAN DEFAULT 0,
  telegramEnabled BOOLEAN DEFAULT 0,
  telegramChatId TEXT,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE
);

-- Table: roles (RBAC roles)
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  permissions TEXT NOT NULL, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_roles (RBAC user-role mapping)
CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  roleId INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE,
  FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE
);

-- Table: usage_stats (System usage statistics)
CREATE TABLE IF NOT EXISTS usage_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activeUsers INTEGER,
  totalStreaming REAL,
  churnRate REAL,
  avgSessionTime REAL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_media_stats (Per-user media consumption)
CREATE TABLE IF NOT EXISTS user_media_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  jellyfinUserId TEXT NOT NULL,
  itemId TEXT NOT NULL,
  playCount INTEGER DEFAULT 0,
  totalTime REAL DEFAULT 0,
  lastPlayed DATETIME,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE
);

-- Table: token_blacklist (Blacklisted JWT tokens)
CREATE TABLE IF NOT EXISTS token_blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  expiresAt DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: scheduler_log (Scheduler execution logs)
CREATE TABLE IF NOT EXISTS scheduler_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  taskName TEXT NOT NULL,
  startTime DATETIME NOT NULL,
  endTime DATETIME,
  duration INTEGER,
  status TEXT NOT NULL, -- success, error
  errorMessage TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_expiration_userId ON user_expiration(userId);
CREATE INDEX IF NOT EXISTS idx_user_expiration_jellyfinUserId ON user_expiration(jellyfinUserId);
CREATE INDEX IF NOT EXISTS idx_audit_log_adminId ON audit_log(adminId);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);
CREATE INDEX IF NOT EXISTS idx_user_media_stats_userId ON user_media_stats(userId);
CREATE INDEX IF NOT EXISTS idx_user_notifications_userId ON user_notifications(userId);

-- Insert default admin user (password: admin123 - CHANGE THIS!)
-- Password hash for 'admin123' with bcrypt rounds=12
INSERT OR IGNORE INTO api_users (id, email, password_hash, role) 
VALUES (1, 'admin@rflix.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYILCy3jKxe', 'admin');

-- Insert default roles
INSERT OR IGNORE INTO roles (id, name, permissions) VALUES 
(1, 'super-admin', '["CREATE_USER","DISABLE_USER","ENABLE_USER","DELETE_USER","VIEW_STATS","MANAGE_COUPONS","CONFIG_TELEGRAM","EXPORT_LOGS","VIEW_AUDIT"]'),
(2, 'admin', '["CREATE_USER","DISABLE_USER","ENABLE_USER","VIEW_STATS"]'),
(3, 'moderator', '["DISABLE_USER","ENABLE_USER"]'),
(4, 'user', '["VIEW_OWN_DASHBOARD"]');

-- Assign super-admin role to default admin
INSERT OR IGNORE INTO user_roles (userId, roleId) VALUES (1, 1);
