-- Migration: Update Views with Tracking Columns
-- Date: 2025-11-26
-- Description: Recreate views to include the newly added tracking columns

-- Drop and recreate usage_dashboard view with tracking columns
DROP VIEW IF EXISTS usage_dashboard;
CREATE VIEW usage_dashboard AS
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
  uv.violations_count,
  ue.last_violation,
  ue.is_throttled
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

-- Drop and recreate user_notification_summary view with tracking columns
DROP VIEW IF EXISTS user_notification_summary;
CREATE VIEW user_notification_summary AS
SELECT 
  u.id as userId,
  u.email,
  n.emailEnabled,
  n.telegramEnabled,
  n.telegramChatId,
  n.email_frequency,
  n.telegram_frequency,
  n.quiet_hours_start,
  n.quiet_hours_end,
  COUNT(nl.id) as total_notifications_received,
  SUM(CASE WHEN nl.success = 1 THEN 1 ELSE 0 END) as successful_notifications,
  MAX(nl.timestamp) as last_notification_timestamp
FROM api_users u
LEFT JOIN user_notifications n ON u.id = n.userId
LEFT JOIN notification_log nl ON u.id = nl.userId
GROUP BY u.id;
