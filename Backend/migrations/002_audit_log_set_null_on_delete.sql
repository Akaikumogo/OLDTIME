-- Audit log event'i o'chirilganda yo'qolmasin: CASCADE -> SET NULL
DO $$
BEGIN
    -- event_id ustunini nullable qilish (agar NOT NULL bo'lsa)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_event_audit_logs'
          AND column_name = 'event_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE attendance_event_audit_logs
            ALTER COLUMN event_id DROP NOT NULL;
    END IF;

    -- Constraintni qayta yaratish: ON DELETE SET NULL
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.table_name = 'attendance_event_audit_logs'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND rc.delete_rule = 'CASCADE'
          AND tc.constraint_name LIKE '%event%'
    ) THEN
        ALTER TABLE attendance_event_audit_logs
            DROP CONSTRAINT IF EXISTS attendance_event_audit_logs_event_id_fkey;
        ALTER TABLE attendance_event_audit_logs
            ADD CONSTRAINT attendance_event_audit_logs_event_id_fkey
            FOREIGN KEY (event_id)
            REFERENCES attendance_events(id)
            ON DELETE SET NULL;
    END IF;

    -- changed_by ham SET NULL bo'lishi kerak (admin o'chirilganda log saqlanishi uchun)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'attendance_event_audit_logs'
          AND column_name = 'changed_by'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE attendance_event_audit_logs
            ALTER COLUMN changed_by DROP NOT NULL;
    END IF;
END $$;
