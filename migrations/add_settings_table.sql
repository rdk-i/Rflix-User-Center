-- Migration: Add settings table for subscription and payment configuration
-- Created: 2025-11-24

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  description TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index on category + key
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_category_key ON settings(category, key);

-- Insert default subscription settings
INSERT OR IGNORE INTO settings (category, key, value, description) VALUES
  ('subscriptions', 'enableFreeTrials', 'true', 'Enable free trial periods for new users'),
  ('subscriptions', 'autoRenewSubscriptions', 'true', 'Automatically renew subscriptions at end of period'),
  ('subscriptions', 'gracePeriodDays', '7', 'Number of days before subscription expires to send renewal reminders'),
  ('subscriptions', 'trialPeriodDays', '14', 'Default trial period duration in days'),
  ('subscriptions', 'maxFailedPayments', '3', 'Maximum number of failed payment attempts before suspension');

-- Insert default payment gateway settings
INSERT OR IGNORE INTO settings (category, key, value, description) VALUES
  ('payments', 'stripePublishableKey', '', 'Stripe publishable key for client-side integration'),
  ('payments', 'stripeSecretKey', '', 'Stripe secret key for server-side integration'),
  ('payments', 'paypalClientId', '', 'PayPal client ID for integration'),
  ('payments', 'paypalClientSecret', '', 'PayPal client secret for server-side integration'),
  ('payments', 'defaultCurrency', 'USD', 'Default currency for all transactions'),
  ('payments', 'enableStripe', 'true', 'Enable Stripe payment processing'),
  ('payments', 'enablePayPal', 'true', 'Enable PayPal payment processing');

-- Insert notification settings
INSERT OR IGNORE INTO settings (category, key, value, description) VALUES
  ('notifications', 'enableEmailNotifications', 'true', 'Send email notifications for subscription events'),
  ('notifications', 'enableWebhookNotifications', 'true', 'Send webhook notifications for external integrations'),
  ('notifications', 'notificationBatchSize', '50', 'Number of notifications to process in each batch');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_updatedAt ON settings(updatedAt);