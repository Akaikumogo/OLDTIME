-- Xodim profil rasmi uchun ustun.
-- /static/employee_photos/<filename> ko'rinishida saqlanadi.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'photo_url'
    ) THEN
        ALTER TABLE employees ADD COLUMN photo_url TEXT;
    END IF;
END $$;
