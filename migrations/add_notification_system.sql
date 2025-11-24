-- Migration: Enhanced Notification System
-- Date: 2025-11-24
-- Description: Add notification logging, templates, and improved notification infrastructure

-- Create notification_log table for tracking all notification attempts
CREATE TABLE IF NOT EXISTS notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  channel TEXT NOT NULL, -- 'email', 'telegram', 'push'
  type TEXT NOT NULL, -- 'welcome', 'expiration_warning', 'subscription_expired', etc.
  success BOOLEAN DEFAULT 0,
  error TEXT,
  response TEXT, -- JSON response from service
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE
);

-- Create notification_templates table for customizable templates
CREATE TABLE IF NOT EXISTS notification_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL, -- 'email', 'telegram', 'sms'
  subject TEXT,
  template_content TEXT NOT NULL,
  variables TEXT, -- JSON array of required variables
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create notification_queue table for persistent queue management
CREATE TABLE IF NOT EXISTS notification_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  type TEXT NOT NULL,
  channel TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON data for notification
  priority INTEGER DEFAULT 1, -- 1=low, 2=normal, 3=high, 4=critical
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_for DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE
);

-- Create notification_stats table for aggregated statistics
CREATE TABLE IF NOT EXISTS notification_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  channel TEXT NOT NULL,
  type TEXT NOT NULL,
  sent INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, channel, type)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_log_userId ON notification_log(userId);
CREATE INDEX IF NOT EXISTS idx_notification_log_timestamp ON notification_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(type);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON notification_queue(scheduled_for, processed_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_priority ON notification_queue(priority DESC, created_at ASC);

-- Insert default notification templates
INSERT OR IGNORE INTO notification_templates (name, type, subject, template_content, variables) VALUES
('welcome_email', 'email', 'Welcome to Rflix!', 
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #6C5CE7;">Welcome to Rflix!</h2>
  <p>Hello {{username}},</p>
  <p>Your registration has been approved! You can now access the Rflix media streaming service.</p>
  <p>Login at: <a href="{{app_url}}/user_login.html">Rflix Login</a></p>
  <p>Thank you for joining us!</p>
  <p style="color: #888; font-size: 12px;">This is an automated message. Please do not reply.</p>
</div>',
'["username", "app_url"]'),

('expiration_warning_email', 'email', 'Subscription Expiring Soon',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #FF7675;">Subscription Expiring Soon</h2>
  <p>Hello {{username}},</p>
  <p>Your Rflix subscription will expire in <strong>{{days_remaining}} days</strong>.</p>
  <p>To continue enjoying our service, please renew your subscription.</p>
  <p>Renew now: <a href="{{app_url}}/user_dashboard.html">Renew Subscription</a></p>
  <p>Thank you!</p>
  <p style="color: #888; font-size: 12px;">This is an automated message. Please do not reply.</p>
</div>',
'["username", "days_remaining", "app_url"]'),

('subscription_expired_email', 'email', 'Subscription Expired',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #D63031;">Subscription Expired</h2>
  <p>Hello {{username}},</p>
  <p>Your Rflix subscription has expired. Your account has been disabled.</p>
  <p>To regain access, please renew your subscription.</p>
  <p>Renew now: <a href="{{app_url}}/user_dashboard.html">Renew Subscription</a></p>
  <p>Thank you!</p>
  <p style="color: #888; font-size: 12px;">This is an automated message. Please do not reply.</p>
</div>',
'["username", "app_url"]'),

('welcome_telegram', 'telegram', NULL,
'🎉 <b>Welcome to Rflix!</b>

Hello {{username}}!

Your registration has been approved. You can now access unlimited streaming on Rflix.

Login here: {{app_url}}/user_login.html

Enjoy! 🍿',
'["username", "app_url"]'),

('expiration_warning_telegram', 'telegram', NULL,
'⚠️ <b>Subscription Expiring Soon</b>

Hello {{username}},

Your Rflix subscription will expire in <b>{{days_remaining}} days</b>.

Please renew to continue enjoying our service.

Renew: {{app_url}}/user_dashboard.html',
'["username", "days_remaining", "app_url"]'),

('subscription_expired_telegram', 'telegram', NULL,
'❌ <b>Subscription Expired</b>

Hello {{username}},

Your Rflix subscription has expired and your account has been disabled.

Renew now: {{app_url}}/user_dashboard.html',
'["username", "app_url"]'),

('new_registration_admin', 'telegram', NULL,
'🔔 <b>New Registration</b>

Email: {{email}}
Package: {{package_months}} month(s)

Please review and approve/reject.',
'["email", "package_months"]');

-- Add notification delivery settings to user_notifications table
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS email_frequency TEXT DEFAULT 'immediate';
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS telegram_frequency TEXT DEFAULT 'immediate';
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS quiet_hours_start TIME;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS quiet_hours_end TIME;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS last_notification_sent DATETIME;

-- Add notification tracking fields to user_expiration table
ALTER TABLE user_expiration ADD COLUMN IF NOT EXISTS last_warning_sent DATETIME;
ALTER TABLE user_expiration ADD COLUMN IF NOT EXISTS warning_sent_days INTEGER DEFAULT 0;

-- Create notification delivery schedule table for advanced scheduling
CREATE TABLE IF NOT EXISTS notification_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  notification_type TEXT NOT NULL,
  scheduled_for DATETIME NOT NULL,
  data TEXT NOT NULL, -- JSON data for notification
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
  sent_at DATETIME,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES api_users(id) ON DELETE CASCADE
);

-- Create indexes for notification schedule
CREATE INDEX IF NOT EXISTS idx_notification_schedule_scheduled ON notification_schedule(scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_notification_schedule_userId ON notification_schedule(userId);

-- Add system configuration for notifications
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default notification system configuration
INSERT OR IGNORE INTO system_config (key, value, description) VALUES
('notification_enabled', 'true', 'Global notification system enabled/disabled'),
('email_enabled', 'true', 'Email notifications enabled/disabled'),
('telegram_enabled', 'true', 'Telegram notifications enabled/disabled'),
('max_notification_retries', '3', 'Maximum retry attempts for failed notifications'),
('notification_batch_size', '10', 'Number of notifications to process in parallel'),
('expiration_warning_days', '[30,14,7,3,1]', 'Days before expiration to send warnings'),
('admin_notification_chat_id', '', 'Telegram chat ID for admin notifications'),
('notification_rate_limit', '100', 'Maximum notifications per hour per user');

-- Create a view for notification analytics
CREATE VIEW IF NOT EXISTS notification_analytics AS
SELECT 
  DATE(timestamp) as date,
  channel,
  type,
  COUNT(*) as total_sent,
  SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
  ROUND(AVG(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100, 2) as success_rate
FROM notification_log
GROUP BY DATE(timestamp), channel, type;

-- Create a view for user notification preferences summary
CREATE VIEW IF NOT EXISTS user_notification_summary AS
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

-- Add triggers to maintain notification statistics
CREATE TRIGGER IF NOT EXISTS update_notification_stats_after_insert
AFTER INSERT ON notification_log
FOR EACH ROW
BEGIN
  INSERT OR REPLACE INTO notification_stats (date, channel, type, sent, failed)
  SELECT 
    DATE(NEW.timestamp),
    NEW.channel,
    NEW.type,
    (SELECT COUNT(*) FROM notification_log 
     WHERE DATE(timestamp) = DATE(NEW.timestamp) 
     AND channel = NEW.channel 
     AND type = NEW.type),
    (SELECT COUNT(*) FROM notification_log 
     WHERE DATE(timestamp) = DATE(NEW.timestamp) 
     AND channel = NEW.channel 
     AND type = NEW.type 
     AND success = 0);
END;