-- Deduplicate active (disappeared_at IS NULL) tracks: keep latest per (camera_id, track_id).
-- Then add a partial unique index so future inserts auto-upsert instead of duplicate.

DELETE FROM camera_detection_events
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY camera_id, track_id
                   ORDER BY seen_at DESC, confidence DESC
               ) AS rn
        FROM camera_detection_events
        WHERE disappeared_at IS NULL
    ) ranked
    WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cde_active_track
    ON camera_detection_events(camera_id, track_id)
    WHERE disappeared_at IS NULL;
