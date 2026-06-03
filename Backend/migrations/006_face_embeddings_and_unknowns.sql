-- Face embeddings cache va unknown persons management
-- HumanRecognition integration uchun

-- Employee yuzlarining embedding'larini saqlash
CREATE TABLE IF NOT EXISTS employee_face_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    embedding_vector FLOAT8[] NOT NULL,  -- FaceNet512: 512-dimensional vector
    snapshot_path TEXT,  -- Embedding qaysi rasmdan olinganligini bilish uchun
    confidence NUMERIC(6, 5) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_face_embeddings_employee_id
    ON employee_face_embeddings(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_face_embeddings_created_at
    ON employee_face_embeddings(created_at DESC);

-- Noma'lum shaxslarni identifikatsiya qilish uchun
-- Bu unknown detections'ning meta'i: employee_id = NULL bo'lgan detections
CREATE TABLE IF NOT EXISTS unknown_persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id VARCHAR(120) NOT NULL,  -- Face clustering ID (similar faces topish uchun)
    primary_embedding FLOAT8[],  -- Eng yaxshi embedding
    sample_snapshot_path TEXT,  -- Admin o'rnatish uchun namuna rasm
    detection_count INTEGER NOT NULL DEFAULT 1,  -- Nechta marotaba ko'rilgani
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    linked_employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
    linked_at TIMESTAMP NULL,  -- Qachon link qilinganligini saqlash
    linked_by_user_id UUID NULL REFERENCES admins(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,  -- Erkak inactive qilish imkoni
    notes TEXT,  -- Admin notes
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Older installs may already have unknown_persons with a narrower schema.
-- Keep startup migrations idempotent by backfilling the columns this module needs.
ALTER TABLE unknown_persons
    ADD COLUMN IF NOT EXISTS cluster_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS primary_embedding FLOAT8[],
    ADD COLUMN IF NOT EXISTS sample_snapshot_path TEXT,
    ADD COLUMN IF NOT EXISTS detection_count INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS linked_employee_id UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS linked_by_user_id UUID NULL REFERENCES admins(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

UPDATE unknown_persons
SET cluster_id = COALESCE(cluster_id, id::text)
WHERE cluster_id IS NULL;

ALTER TABLE unknown_persons
    ALTER COLUMN cluster_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_unknown_persons_cluster_id
    ON unknown_persons(cluster_id);
CREATE INDEX IF NOT EXISTS idx_unknown_persons_linked_employee_id
    ON unknown_persons(linked_employee_id);
CREATE INDEX IF NOT EXISTS idx_unknown_persons_last_seen_at
    ON unknown_persons(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_unknown_persons_is_active
    ON unknown_persons(is_active);

-- Unknown person'larni employee'ga bog'lash uchun audit trail
CREATE TABLE IF NOT EXISTS unknown_person_links_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unknown_person_id UUID NOT NULL REFERENCES unknown_persons(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    linked_by_user_id UUID REFERENCES admins(id) ON DELETE SET NULL,
    action VARCHAR(30) NOT NULL CHECK (action IN ('LINKED', 'UNLINKED', 'RELINKED')),
    reason TEXT,  -- Nima uchun o'zgargan?
    retroactive_count INTEGER DEFAULT 0,  -- Nechta qadimiy detection qayta linklanganligini
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unknown_person_links_audit_unknown
    ON unknown_person_links_audit(unknown_person_id);
CREATE INDEX IF NOT EXISTS idx_unknown_person_links_audit_employee
    ON unknown_person_links_audit(employee_id);
CREATE INDEX IF NOT EXISTS idx_unknown_person_links_audit_created_at
    ON unknown_person_links_audit(created_at DESC);

-- Faqat query'ni tezlashtirish uchun: unknown detections'ning o'zlari
-- camera_detection_events jadvali'da saqlanadi, lekin
-- qidiruv tezligi uchun separate materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_unknown_detections_summary AS
SELECT
    cde.id,
    cde.camera_id,
    cde.track_id,
    cde.detection_type,
    cde.confidence,
    cde.seen_at,
    cde.snapshot_path,
    c.name as camera_name,
    z.name as zone_name,
    COUNT(*) OVER (PARTITION BY DATE(cde.seen_at)) as daily_count
FROM camera_detection_events cde
JOIN cameras c ON c.id = cde.camera_id
JOIN zones z ON z.id = cde.zone_id
WHERE cde.employee_id IS NULL
ORDER BY cde.seen_at DESC;

CREATE INDEX IF NOT EXISTS idx_mv_unknown_detections_camera
    ON mv_unknown_detections_summary(camera_id);
