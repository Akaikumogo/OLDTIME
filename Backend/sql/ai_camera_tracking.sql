-- AI camera tracking module: zones, rooms, camera inventory, detections,
-- live employee location state and productivity support.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(40) NOT NULL DEFAULT 'UNKNOWN'
        CHECK (type IN (
            'WORK_ROOM',
            'CORRIDOR',
            'REST_ZONE',
            'MEETING_ROOM',
            'ENTRANCE',
            'EXIT',
            'UNKNOWN'
        )),
    productivity_weight NUMERIC(8, 3) NOT NULL DEFAULT 0,
    timeout_seconds INTEGER NOT NULL DEFAULT 0 CHECK (timeout_seconds >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zones_type ON zones(type);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    department_id UUID NULL REFERENCES departments(id) ON DELETE SET NULL,
    floor VARCHAR(64),
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_department_id ON rooms(department_id);

CREATE TABLE IF NOT EXISTS cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    ip VARCHAR(64) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password_encrypted BYTEA,
    rtsp_main_url TEXT NOT NULL,
    rtsp_sub_url TEXT,
    isapi_base_url TEXT,
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    room_id UUID NULL REFERENCES rooms(id) ON DELETE SET NULL,
    has_audio BOOLEAN NOT NULL DEFAULT FALSE,
    has_speaker BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'unknown'
        CHECK (status IN ('online', 'offline', 'error', 'testing', 'unknown')),
    last_checked_at TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cameras_ip_rtsp_main
    ON cameras(ip, rtsp_main_url);
CREATE INDEX IF NOT EXISTS idx_cameras_zone_id ON cameras(zone_id);
CREATE INDEX IF NOT EXISTS idx_cameras_room_id ON cameras(room_id);
CREATE INDEX IF NOT EXISTS idx_cameras_status ON cameras(status);

CREATE TABLE IF NOT EXISTS room_camera (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    view_position VARCHAR(80),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, camera_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_camera_primary
    ON room_camera(room_id)
    WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_room_camera_room_id ON room_camera(room_id);
CREATE INDEX IF NOT EXISTS idx_room_camera_camera_id ON room_camera(camera_id);

CREATE TABLE IF NOT EXISTS employee_camera_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assigned_room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    assigned_camera_id UUID NULL REFERENCES cameras(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_camera_assignments_room
    ON employee_camera_assignments(assigned_room_id);

CREATE TABLE IF NOT EXISTS camera_detection_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
    track_id VARCHAR(120) NOT NULL,
    detection_type VARCHAR(20) NOT NULL
        CHECK (detection_type IN ('FACE', 'BODY', 'FACE_BODY')),
    confidence NUMERIC(6, 5) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    bbox JSONB,
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    disappeared_at TIMESTAMP NULL,
    duration_seconds INTEGER NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    snapshot_path TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_camera_detection_events_employee_seen
    ON camera_detection_events(employee_id, seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_camera_detection_events_camera_seen
    ON camera_detection_events(camera_id, seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_camera_detection_events_track
    ON camera_detection_events(track_id);
CREATE INDEX IF NOT EXISTS idx_camera_detection_events_zone
    ON camera_detection_events(zone_id);

CREATE TABLE IF NOT EXISTS employee_location_states (
    employee_id UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    active_camera_id UUID NULL REFERENCES cameras(id) ON DELETE SET NULL,
    active_zone_id UUID NULL REFERENCES zones(id) ON DELETE SET NULL,
    active_room_id UUID NULL REFERENCES rooms(id) ON DELETE SET NULL,
    last_seen_at TIMESTAMP,
    last_detection_type VARCHAR(20)
        CHECK (last_detection_type IS NULL OR last_detection_type IN ('FACE', 'BODY', 'FACE_BODY')),
    confidence NUMERIC(6, 5) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    is_visible BOOLEAN NOT NULL DEFAULT FALSE,
    inferred_zone_id UUID NULL REFERENCES zones(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_location_states_camera
    ON employee_location_states(active_camera_id);
CREATE INDEX IF NOT EXISTS idx_employee_location_states_zone
    ON employee_location_states(active_zone_id);
CREATE INDEX IF NOT EXISTS idx_employee_location_states_visible
    ON employee_location_states(is_visible);
