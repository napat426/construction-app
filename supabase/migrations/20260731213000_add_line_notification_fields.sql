-- Migration: Add line_token and last_red_flag_alert_date to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS line_token TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_red_flag_alert_date TEXT DEFAULT NULL;
