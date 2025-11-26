-- Migration: Add Tracking Columns
-- Date: 2025-11-26
-- Description: Add usage tracking and notification preference columns to existing tables
-- This migration uses SQLite-compatible syntax (no IF NOT EXISTS in ALTER TABLE)

-- Add usage tracking columns to user_expiration table
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we'll handle errors gracefully
-- These will fail silently if columns already exist

-- Usage tracking columns
ALTER TABLE user_expiration ADD COLUMN usage_violations INTEGER DEFAULT 0;
ALTER TABLE user_expiration ADD COLUMN last_violation DATETIME;
ALTER TABLE user_expiration ADD COLUMN is_throttled BOOLEAN DEFAULT 0;

-- Notification tracking columns
ALTER TABLE user_expiration ADD COLUMN last_warning_sent DATETIME;
ALTER TABLE user_expiration ADD COLUMN warning_sent_days INTEGER DEFAULT 0;

-- Add notification delivery settings to user_notifications table
ALTER TABLE user_notifications ADD COLUMN email_frequency TEXT DEFAULT 'immediate';
ALTER TABLE user_notifications ADD COLUMN telegram_frequency TEXT DEFAULT 'immediate';
ALTER TABLE user_notifications ADD COLUMN quiet_hours_start TIME;
ALTER TABLE user_notifications ADD COLUMN quiet_hours_end TIME;
ALTER TABLE user_notifications ADD COLUMN last_notification_sent DATETIME;
