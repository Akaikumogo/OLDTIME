-- Backup Management for Superadmin
-- Export/Import, MERGE/HARD_SET modes

CREATE TABLE IF NOT EXISTS backup_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    superadmin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,

    backup_name VARCHAR(255) NOT NULL,
    backup_type VARCHAR(30) NOT NULL DEFAULT 'FULL'
        CHECK (backup_type IN ('FULL', 'EMPLOYEES', 'ATTENDANCE', 'IMPORTED')),

    file_path TEXT,
    file_size BIGINT,
    file_hash VARCHAR(64),

    total_records INTEGER,
    employees_count INTEGER,
    attendance_events INTEGER,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    restored_at TIMESTAMP NULL,
    restore_type VARCHAR(30) NULL CHECK (restore_type IN ('MERGE', 'HARD_SET')),
    restored_by_user_id UUID NULL REFERENCES admins(id) ON DELETE SET NULL,

    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_backup_metadata_superadmin
    ON backup_metadata(superadmin_id);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_created_at
    ON backup_metadata(created_at DESC);

-- Restore history (audit trail)
CREATE TABLE IF NOT EXISTS backup_restore_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id UUID NOT NULL REFERENCES backup_metadata(id) ON DELETE CASCADE,
    restored_by_user_id UUID NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,

    restore_type VARCHAR(30) NOT NULL
        CHECK (restore_type IN ('MERGE', 'HARD_SET')),

    rows_merged INTEGER DEFAULT 0,
    rows_deleted INTEGER DEFAULT 0,
    rows_created INTEGER DEFAULT 0,

    status VARCHAR(30) NOT NULL DEFAULT 'STARTED'
        CHECK (status IN ('STARTED', 'SUCCESS', 'FAILED')),
    error_message TEXT,

    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP NULL,

    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_backup_restore_log_backup_id
    ON backup_restore_log(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_restore_log_restored_by
    ON backup_restore_log(restored_by_user_id);
CREATE INDEX IF NOT EXISTS idx_backup_restore_log_created_at
    ON backup_restore_log(completed_at DESC);
