CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS doors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('entry', 'exit')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_policies (
    id SERIAL PRIMARY KEY,
    work_start_time TIME NOT NULL,
    work_end_time TIME NOT NULL,
    lunch_start_time TIME NULL,
    lunch_end_time TIME NULL,
    late_grace_minutes INTEGER NOT NULL DEFAULT 0,
    early_leave_grace_minutes INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    door_id UUID NOT NULL REFERENCES doors(id) ON DELETE CASCADE,
    employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(255) NOT NULL,
    card_id VARCHAR(255) NULL,
    serial_no VARCHAR(255) NULL,
    event_timestamp TIMESTAMP NOT NULL,
    door_event_type VARCHAR(10) NOT NULL CHECK (door_event_type IN ('entry', 'exit')),
    status VARCHAR(50) NOT NULL,
    match_status VARCHAR(20) NOT NULL DEFAULT 'matched',
    picture_path TEXT NULL,
    event_key TEXT NOT NULL UNIQUE,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    permission_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason TEXT NOT NULL,
    permission_type VARCHAR(50) NOT NULL DEFAULT 'task',
    status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_event_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES attendance_events(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
    changed_by UUID NOT NULL REFERENCES admins(id),
    old_values JSONB,
    new_values JSONB,
    changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doors_event_type ON doors(event_type);
CREATE INDEX IF NOT EXISTS idx_doors_is_active ON doors(is_active);
CREATE INDEX IF NOT EXISTS idx_attendance_events_employee_id ON attendance_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_events_door_id ON attendance_events(door_id);
CREATE INDEX IF NOT EXISTS idx_attendance_events_event_timestamp ON attendance_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_events_status ON attendance_events(status);
CREATE INDEX IF NOT EXISTS idx_attendance_events_match_status ON attendance_events(match_status);
CREATE INDEX IF NOT EXISTS idx_work_permissions_employee_id ON work_permissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_work_permissions_permission_date ON work_permissions(permission_date);
CREATE INDEX IF NOT EXISTS idx_work_permissions_status ON work_permissions(status);
CREATE INDEX IF NOT EXISTS idx_attendance_event_audit_logs_event_id ON attendance_event_audit_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_event_audit_logs_changed_by ON attendance_event_audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_attendance_event_audit_logs_action ON attendance_event_audit_logs(action);
