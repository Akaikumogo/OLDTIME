-- Durable room presence history derived from camera line-crossing events.

CREATE TABLE IF NOT EXISTS camera_room_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
    track_id VARCHAR(120) NOT NULL,
    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    room_id UUID NULL REFERENCES rooms(id) ON DELETE SET NULL,
    entered_at TIMESTAMP NOT NULL,
    pending_exit_at TIMESTAMP NULL,
    exited_at TIMESTAMP NULL,
    duration_seconds INTEGER NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    confidence NUMERIC(6, 5) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    status VARCHAR(20) NOT NULL DEFAULT 'inside'
        CHECK (status IN ('inside', 'pending_exit', 'exited')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (exited_at IS NULL OR exited_at >= entered_at)
);

CREATE INDEX IF NOT EXISTS idx_camera_room_presence_employee_time
    ON camera_room_presence(employee_id, entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_camera_room_presence_track_open
    ON camera_room_presence(camera_id, track_id, room_id)
    WHERE exited_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_camera_room_presence_room_time
    ON camera_room_presence(room_id, entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_camera_room_presence_camera_time
    ON camera_room_presence(camera_id, entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_camera_room_presence_status
    ON camera_room_presence(status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_camera_room_presence_open_track
    ON camera_room_presence(camera_id, track_id, COALESCE(room_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE exited_at IS NULL;
