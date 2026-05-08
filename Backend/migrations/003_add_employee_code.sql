-- employees.employee_code: noyob (UNIQUE) tabel raqami yoki kompaniya kodi.
-- Hikvision'dagi cardNo / employeeNoString aynan shu maydonga moslanadi.
-- NULLable: eski xodimlar uchun kerak emas, lekin yangi qo'shilganlarda majburiy bo'lishi tavsiya qilinadi.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'employee_code'
    ) THEN
        ALTER TABLE employees ADD COLUMN employee_code VARCHAR(64);
        CREATE UNIQUE INDEX idx_employees_employee_code
            ON employees(employee_code)
            WHERE employee_code IS NOT NULL;
    END IF;
END $$;

-- Soft-uniqueness: ikki active xodim bir xil to'liq ismga ega bo'lmasligi.
-- (Inactive xodim qaytadan kelishi mumkin.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'employees' AND indexname = 'uq_employees_active_full_name'
    ) THEN
        CREATE UNIQUE INDEX uq_employees_active_full_name
            ON employees(LOWER(TRIM(full_name)))
            WHERE is_active = TRUE;
    END IF;
END $$;
