ALTER TABLE computers
ADD COLUMN IF NOT EXISTS device_id VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_computers_device_id_unique
ON computers(device_id)
WHERE device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_computers_device_id ON computers(device_id);
