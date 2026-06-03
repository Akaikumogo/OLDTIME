-- Refactor cameras table to match new AI-camera service schema.
-- Renames columns, adds new ones, drops stale ones.

-- Rename ip_address -> ip
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cameras' AND column_name = 'ip_address'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cameras' AND column_name = 'ip'
    ) THEN
        ALTER TABLE cameras RENAME COLUMN ip_address TO ip;
    END IF;
END $$;

-- Rename password -> password_encrypted (already bytea, compatible with pgcrypto)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cameras' AND column_name = 'password'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cameras' AND column_name = 'password_encrypted'
    ) THEN
        ALTER TABLE cameras RENAME COLUMN password TO password_encrypted;
    END IF;
END $$;

-- Add new URL / config columns
ALTER TABLE cameras
    ADD COLUMN IF NOT EXISTS rtsp_main_url  TEXT         NULL,
    ADD COLUMN IF NOT EXISTS rtsp_sub_url   TEXT         NULL,
    ADD COLUMN IF NOT EXISTS isapi_base_url TEXT         NULL,
    ADD COLUMN IF NOT EXISTS room_id        UUID         NULL REFERENCES rooms(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS has_audio      BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS has_speaker    BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS status         VARCHAR(20)  NOT NULL DEFAULT 'unknown'
        CHECK (status IN ('online', 'offline', 'error', 'testing', 'unknown')),
    ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP   NULL,
    ADD COLUMN IF NOT EXISTS last_error     TEXT         NULL,
    ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMP    NOT NULL DEFAULT NOW();

-- Backfill updated_at for existing rows
UPDATE cameras SET updated_at = created_at WHERE updated_at = NOW() AND created_at IS NOT NULL;

-- Drop stale columns no longer used by the application
ALTER TABLE cameras
    DROP COLUMN IF EXISTS port,
    DROP COLUMN IF EXISTS rtsp_port,
    DROP COLUMN IF EXISTS channel,
    DROP COLUMN IF EXISTS protocol,
    DROP COLUMN IF EXISTS is_active,
    DROP COLUMN IF EXISTS description;
