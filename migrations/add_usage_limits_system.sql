-- Migration: Add Usage Limits System
-- Date: 2025-11-24
-- Description: Add comprehensive usage tracking and limits enforcement tables

-- Create usage_tracking table for real-time usage monitoring
CREATE TABLE IF NOT EXISTS usage_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  storage_used INTEGER DEFAULT 0, -- in bytes
  streams_active INTEGER DEFAULT 0,
  concurrent_users INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  stream_duration INTEGER DEFAULT 0, -- in milliseconds
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE
);

-- Create usage_history table for historical usage analytics
CREATE TABLE IF NOT EXISTS usage_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  metric_type TEXT NOT NULL, -- 'storage', 'stream', 'concurrent_users', 'api_call', 'api_reset'
  metric_value INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  details TEXT, -- JSON data for additional context
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE
);

-- Create usage_limits table for custom limits per user
CREATE TABLE IF NOT EXISTS usage_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  storage_limit INTEGER, -- in bytes
  streams_limit INTEGER,
  concurrent_users_limit INTEGER,
  api_calls_limit INTEGER,
  stream_duration_limit INTEGER, -- in milliseconds
  grace_period INTEGER DEFAULT 86400000, -- 24 hours in milliseconds
  throttle_delay INTEGER DEFAULT 1000, -- 1 second in milliseconds
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE,
  UNIQUE(userId)
);

-- Create usage_violations table for tracking limit violations
CREATE TABLE IF NOT EXISTS usage_violations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  violation_type TEXT NOT NULL, -- 'storage', 'streams', 'concurrent_users', 'api_calls'
  violation_value INTEGER NOT NULL,
  limit_value INTEGER NOT NULL,
  violation_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  grace_period_end DATETIME,
  is_resolved BOOLEAN DEFAULT 0,
  resolution_timestamp DATETIME,
  resolution_notes TEXT,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE
);

-- Create usage_notifications table for usage alerts and warnings
CREATE TABLE IF NOT EXISTS usage_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  notification_type TEXT NOT NULL, -- 'warning', 'alert', 'over_limit', 'upgrade_suggestion'
  metric_type TEXT, -- 'storage', 'streams', 'concurrent_users', 'api_calls'
  current_value INTEGER,
  limit_value INTEGER,
  percentage REAL,
  message TEXT NOT NULL,
  is_sent BOOLEAN DEFAULT 0,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE
);

-- Create usage_analytics table for aggregated usage statistics
CREATE TABLE IF NOT EXISTS usage_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  date DATE NOT NULL,
  total_storage INTEGER DEFAULT 0,
  total_streams INTEGER DEFAULT 0,
  total_api_calls INTEGER DEFAULT 0,
  total_stream_duration INTEGER DEFAULT 0,
  peak_concurrent_users INTEGER DEFAULT 0,
  violations_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE,
  UNIQUE(userId, date)
);

-- Create subscription_tiers table for different subscription levels
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier_name TEXT UNIQUE NOT NULL,
  storage_limit INTEGER NOT NULL,
  streams_limit INTEGER NOT NULL,
  concurrent_users_limit INTEGER NOT NULL,
  api_calls_limit INTEGER NOT NULL,
  stream_duration_limit INTEGER NOT NULL,
  grace_period INTEGER NOT NULL,
  throttle_delay INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default subscription tiers
INSERT OR IGNORE INTO subscription_tiers 
(tier_name, storage_limit, streams_limit, concurrent_users_limit, api_calls_limit, stream_duration_limit, grace_period, throttle_delay, display_order) 
VALUES
('basic', 10737418240, 2, 1, 1000, 86400000, 86400000, 1000, 1),        -- 10GB, 2 streams, 1 user, 1k API calls, 24h stream duration
('premium', 53687091200, 5, 3, 5000, 604800000, 172800000, 500, 2),       -- 50GB, 5 streams, 3 users, 5k API calls, 7 days stream duration
('enterprise', 214748364800, 10, 10, 20000, 2592000000, 259200000, 100, 3); -- 200GB, 10 streams, 10 users, 20k API calls, 30 days stream duration

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_tracking_userId ON usage_tracking(userId);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_last_updated ON usage_tracking(last_updated);
CREATE INDEX IF NOT EXISTS idx_usage_history_userId ON usage_history(userId);
CREATE INDEX IF NOT EXISTS idx_usage_history_timestamp ON usage_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_history_metric_type ON usage_history(metric_type);
CREATE INDEX IF NOT EXISTS idx_usage_violations_userId ON usage_violations(userId);
CREATE INDEX IF NOT EXISTS idx_usage_violations_timestamp ON usage_violations(violation_timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_notifications_userId ON usage_notifications(userId);
CREATE INDEX IF NOT EXISTS idx_usage_notifications_sent ON usage_notifications(is_sent);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_userId_date ON usage_analytics(userId, date);

-- Note: Additional columns for user_expiration (usage_violations, last_violation, is_throttled)
-- will be added by subsequent migrations if needed

-- Create triggers to maintain usage analytics
CREATE TRIGGER IF NOT EXISTS update_usage_analytics_daily
AFTER INSERT ON usage_history
FOR EACH ROW
WHEN NEW.metric_type IN ('storage', 'stream', 'api_call', 'concurrent_users')
BEGIN
  INSERT OR REPLACE INTO usage_analytics 
  (userId, date, total_storage, total_streams, total_api_calls, total_stream_duration, peak_concurrent_users, violations_count, updated_at)
  SELECT 
    NEW.userId,
    DATE(NEW.timestamp),
    COALESCE((SELECT SUM(metric_value) FROM usage_history 
              WHERE userId = NEW.userId AND metric_type = 'storage' AND DATE(timestamp) = DATE(NEW.timestamp)), 0),
    COALESCE((SELECT SUM(metric_value) FROM usage_history 
              WHERE userId = NEW.userId AND metric_type = 'stream' AND DATE(timestamp) = DATE(NEW.timestamp)), 0),
    COALESCE((SELECT COUNT(*) FROM usage_history 
              WHERE userId = NEW.userId AND metric_type = 'api_call' AND DATE(timestamp) = DATE(NEW.timestamp)), 0),
    COALESCE((SELECT SUM(metric_value) FROM usage_history 
              WHERE userId = NEW.userId AND metric_type = 'stream' AND DATE(timestamp) = DATE(NEW.timestamp)), 0),
    COALESCE((SELECT MAX(metric_value) FROM usage_history 
              WHERE userId = NEW.userId AND metric_type = 'concurrent_users' AND DATE(timestamp) = DATE(NEW.timestamp)), 0),
    COALESCE((SELECT COUNT(*) FROM usage_violations 
              WHERE userId = NEW.userId AND DATE(violation_timestamp) = DATE(NEW.timestamp)), 0),
    datetime('now')
  WHERE NEW.metric_type IN ('storage', 'stream', 'api_call', 'concurrent_users');
END;

-- Create trigger to update user_expiration when violations occur
CREATE TRIGGER IF NOT EXISTS update_user_violations
AFTER INSERT ON usage_violations
FOR EACH ROW
BEGIN
  UPDATE user_expiration 
  SET usage_violations = usage_violations + 1,
      last_violation = NEW.violation_timestamp,
      updated_at = datetime('now')
  WHERE userId = NEW.userId;
END;

-- Create view for usage dashboard
CREATE VIEW IF NOT EXISTS usage_dashboard AS
SELECT 
  u.id as userId,
  u.email,
  ue.packageId,
  p.name as packageName,
  ut.storage_used,
  ut.streams_active,
  ut.concurrent_users,
  ut.api_calls,
  ut.stream_duration,
  st.storage_limit,
  st.streams_limit,
  st.concurrent_users_limit,
  st.api_calls_limit,
  st.stream_duration_limit,
  CAST(ut.storage_used AS REAL) / st.storage_limit * 100 as storage_percentage,
  CAST(ut.streams_active AS REAL) / st.streams_limit * 100 as streams_percentage,
  CAST(ut.concurrent_users AS REAL) / st.concurrent_users_limit * 100 as concurrent_users_percentage,
  CAST(ut.api_calls AS REAL) / st.api_calls_limit * 100 as api_calls_percentage,
  CAST(ut.stream_duration AS REAL) / st.stream_duration_limit * 100 as stream_duration_percentage,
  uv.violations_count
FROM api_users u
LEFT JOIN user_expiration ue ON u.id = ue.userId
LEFT JOIN packages p ON ue.packageId = p.id
LEFT JOIN usage_tracking ut ON u.id = ut.userId
LEFT JOIN subscription_tiers st ON 
  CASE 
    WHEN p.name IN ('1 Bulan') THEN st.tier_name = 'basic'
    WHEN p.name IN ('3 Bulan', '6 Bulan') THEN st.tier_name = 'premium'
    WHEN p.name IN ('12 Bulan') THEN st.tier_name = 'enterprise'
    ELSE st.tier_name = 'basic'
  END
LEFT JOIN (
  SELECT userId, COUNT(*) as violations_count
  FROM usage_violations
  WHERE is_resolved = 0
  GROUP BY userId
) uv ON u.id = uv.userId
WHERE ue.isActive = 1;

-- Create view for usage violations summary
CREATE VIEW IF NOT EXISTS usage_violations_summary AS
SELECT 
  userId,
  violation_type,
  COUNT(*) as violation_count,
  MAX(violation_timestamp) as last_violation,
  SUM(CASE WHEN is_resolved = 0 THEN 1 ELSE 0 END) as active_violations,
  SUM(CASE WHEN is_resolved = 1 THEN 1 ELSE 0 END) as resolved_violations
FROM usage_violations
GROUP BY userId, violation_type;

-- Create view for usage trends
CREATE VIEW IF NOT EXISTS usage_trends AS
SELECT 
  userId,
  DATE(timestamp) as date,
  SUM(CASE WHEN metric_type = 'storage' THEN metric_value ELSE 0 END) as daily_storage,
  SUM(CASE WHEN metric_type = 'stream' THEN metric_value ELSE 0 END) as daily_streams,
  COUNT(CASE WHEN metric_type = 'api_call' THEN 1 END) as daily_api_calls,
  MAX(CASE WHEN metric_type = 'concurrent_users' THEN metric_value ELSE 0 END) as peak_concurrent_users
FROM usage_history
WHERE timestamp > datetime('now', '-30 days')
GROUP BY userId, DATE(timestamp)
ORDER BY date DESC;

-- Insert sample data for testing (optional, remove in production)
-- INSERT OR IGNORE INTO usage_tracking (userId, storage_used, streams_active, concurrent_users, api_calls, stream_duration)
-- SELECT id, 0, 0, 0, 0, 0 FROM api_users LIMIT 5;