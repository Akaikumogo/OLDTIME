-- Migration: Add optional fields to employees table
-- Purpose: Allow creating employees from Hikvision device events without full details

BEGIN TRANSACTION;

-- Add email and phone_number columns if they don't exist
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Make department_id and position_id nullable
ALTER TABLE employees
ALTER COLUMN department_id DROP NOT NULL,
ALTER COLUMN position_id DROP NOT NULL;

-- Create default department for auto-created employees
INSERT INTO departments (name) 
VALUES ('From Device')
ON CONFLICT (name) DO NOTHING;

-- Create default position for auto-created employees
INSERT INTO positions (name)
VALUES ('From Device')
ON CONFLICT (name) DO NOTHING;

COMMIT;
