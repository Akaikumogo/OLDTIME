-- Camera line crossing rules and daily entry/exit events.

CREATE TABLE IF NOT EXISTS camera_crossing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camera_id UUID NOT NULL UNIQUE REFERENCES cameras(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL DEFAULT 'Main crossing line',
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    line_x1 NUMERIC(8, 6) NOT NULL DEFAULT 0.500000 CHECK (line_x1 >= 0 AND line_x1 <= 1),
    line_y1 NUMERIC(8, 6) NOT NULL DEFAULT 0.100000 CHECK (line_y1 >= 0 AND line_y1 <= 1),
    line_x2 NUMERIC(8, 6) NOT NULL DEFAULT 0.500000 CHECK (line_x2 >= 0 AND line_x2 <= 1),
    line_y2 NUMERIC(8, 6) NOT NULL DEFAULT 0.900000 CHECK (line_y2 >= 0 AND line_y2 <= 1),
    entry_direction VARCHAR(30) NOT NULL DEFAULT 'negative_to_positive'
        CHECK (entry_direction IN ('negative_to_positive', 'positive_to_negative')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (line_x1 <> line_x2 OR line_y1 <> line_y2)
);

CREATE INDEX IF NOT EXISTS idx_camera_crossing_rules_camera
    ON camera_crossing_rules(camera_id);
CREATE INDEX IF NOT EXISTS idx_camera_crossing_rules_enabled
    ON camera_crossing_rules(enabled);

CREATE TABLE IF NOT EXISTS camera_crossing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    rule_id UUID NULL REFERENCES camera_crossing_rules(id) ON DELETE SET NULL,
    employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
    track_id VARCHAR(120) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('entry', 'exit')),
    crossing_direction VARCHAR(30) NOT NULL
        CHECK (crossing_direction IN ('negative_to_positive', 'positive_to_negative')),
    confidence NUMERIC(6, 5) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    bbox JSONB,
    crossed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    snapshot_path TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_camera_crossing_events_camera_time
    ON camera_crossing_events(camera_id, crossed_at DESC);
CREATE INDEX IF NOT EXISTS idx_camera_crossing_events_employee_time
    ON camera_crossing_events(employee_id, crossed_at DESC);
CREATE INDEX IF NOT EXISTS idx_camera_crossing_events_direction_time
    ON camera_crossing_events(direction, crossed_at DESC);
