CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS computers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    device_id VARCHAR(64) UNIQUE,
    hostname VARCHAR(255) NOT NULL,
    mac_address VARCHAR(64) NOT NULL UNIQUE,
    ip_address VARCHAR(64),
    os_name VARCHAR(255),
    agent_version VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_computers_employee_id ON computers(employee_id);
CREATE INDEX IF NOT EXISTS idx_computers_device_id ON computers(device_id);
CREATE INDEX IF NOT EXISTS idx_computers_mac_address ON computers(mac_address);
CREATE INDEX IF NOT EXISTS idx_computers_last_seen_at ON computers(last_seen_at);

CREATE TABLE IF NOT EXISTS computer_activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    computer_id UUID NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    app_name VARCHAR(255) NOT NULL,
    window_title TEXT,
    url TEXT,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    source VARCHAR(50) NOT NULL DEFAULT 'desktop_agent',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_computer_activity_computer_id ON computer_activity_events(computer_id);
CREATE INDEX IF NOT EXISTS idx_computer_activity_employee_id ON computer_activity_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_computer_activity_started_at ON computer_activity_events(started_at);
CREATE INDEX IF NOT EXISTS idx_computer_activity_app_name ON computer_activity_events(app_name);
CREATE INDEX IF NOT EXISTS idx_computer_activity_segment_lookup
ON computer_activity_events (
    computer_id,
    app_name,
    started_at,
    ended_at,
    COALESCE(window_title, ''),
    COALESCE(url, '')
);
