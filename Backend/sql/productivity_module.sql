-- Productivity, shifts, holidays — qo'shimcha biznes logika modullari
-- Mavjud jadvallarga teginmaydi, yangi tablelarni qo'shadi.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Smenalar: oddiy 9-18 dan chiqib, tunda smenani qo'llab-quvvatlash
-- ============================================================
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    -- end_time start_time'dan kichik bo'lsa, smena tunda ekanini bildiradi (masalan 22:00->06:00)
    is_overnight BOOLEAN NOT NULL DEFAULT FALSE,
    lunch_start_time TIME NULL,
    lunch_end_time TIME NULL,
    late_grace_minutes INTEGER NOT NULL DEFAULT 0,
    early_leave_grace_minutes INTEGER NOT NULL DEFAULT 0,
    -- Hafta kunlari: ['mon','tue','wed','thu','fri','sat','sun']
    work_days TEXT[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri'],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_is_active ON shifts(is_active);

-- Xodimni smenaga biriktirish (vaqt davomida o'zgarishi mumkin)
CREATE TABLE IF NOT EXISTS employee_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee_id ON employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_shift_id ON employee_shifts(shift_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_effective ON employee_shifts(effective_from, effective_to);

-- ============================================================
-- Bayramlar va dam olish kunlari
-- ============================================================
CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_date DATE NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    -- 'public' = davlat bayrami, 'company' = kompaniya o'zining ta'tili
    holiday_type VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (holiday_type IN ('public', 'company', 'weekend')),
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_type ON holidays(holiday_type);

-- ============================================================
-- Productivity: dasturlar va saytlarni kategoriyalash
-- ============================================================
-- Kategoriyalar: productive (samarali), unproductive (samarasiz), neutral (neytral)
-- pattern_type: 'exact' (aynan), 'contains' (ichida bor), 'regex' (regex)
-- department_id NULL = global qoida; aks holda faqat shu departmentga taalluqli

CREATE TABLE IF NOT EXISTS app_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(20) NOT NULL DEFAULT 'contains' CHECK (pattern_type IN ('exact', 'contains', 'regex')),
    category VARCHAR(20) NOT NULL CHECK (category IN ('productive', 'unproductive', 'neutral')),
    department_id UUID NULL REFERENCES departments(id) ON DELETE CASCADE,
    label VARCHAR(100) NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_categories_pattern ON app_categories(LOWER(pattern));
CREATE INDEX IF NOT EXISTS idx_app_categories_department ON app_categories(department_id);
CREATE INDEX IF NOT EXISTS idx_app_categories_priority ON app_categories(priority);
CREATE INDEX IF NOT EXISTS idx_app_categories_is_active ON app_categories(is_active);

CREATE TABLE IF NOT EXISTS site_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(20) NOT NULL DEFAULT 'contains' CHECK (pattern_type IN ('exact', 'contains', 'regex')),
    category VARCHAR(20) NOT NULL CHECK (category IN ('productive', 'unproductive', 'neutral')),
    department_id UUID NULL REFERENCES departments(id) ON DELETE CASCADE,
    label VARCHAR(100) NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_categories_pattern ON site_categories(LOWER(pattern));
CREATE INDEX IF NOT EXISTS idx_site_categories_department ON site_categories(department_id);
CREATE INDEX IF NOT EXISTS idx_site_categories_priority ON site_categories(priority);
CREATE INDEX IF NOT EXISTS idx_site_categories_is_active ON site_categories(is_active);

-- Default global kategoriyalar (admin keyin o'zgartira oladi)
INSERT INTO app_categories (pattern, pattern_type, category, label, priority) VALUES
    ('vscode', 'contains', 'productive', 'IDE', 10),
    ('code', 'contains', 'productive', 'IDE', 15),
    ('pycharm', 'contains', 'productive', 'IDE', 10),
    ('intellij', 'contains', 'productive', 'IDE', 10),
    ('webstorm', 'contains', 'productive', 'IDE', 10),
    ('xcode', 'contains', 'productive', 'IDE', 10),
    ('android studio', 'contains', 'productive', 'IDE', 10),
    ('terminal', 'contains', 'productive', 'Terminal', 20),
    ('iterm', 'contains', 'productive', 'Terminal', 20),
    ('powershell', 'contains', 'productive', 'Terminal', 20),
    ('excel', 'contains', 'productive', 'Office', 20),
    ('word', 'contains', 'productive', 'Office', 20),
    ('powerpoint', 'contains', 'productive', 'Office', 20),
    ('outlook', 'contains', 'productive', 'Office', 25),
    ('figma', 'contains', 'productive', 'Design', 20),
    ('photoshop', 'contains', 'productive', 'Design', 20),
    ('illustrator', 'contains', 'productive', 'Design', 20),
    ('postgres', 'contains', 'productive', 'Database', 20),
    ('dbeaver', 'contains', 'productive', 'Database', 20),
    ('postman', 'contains', 'productive', 'API', 20),
    ('slack', 'contains', 'productive', 'Communication', 30),
    ('teams', 'contains', 'productive', 'Communication', 30),
    ('zoom', 'contains', 'productive', 'Communication', 30),
    ('youtube', 'contains', 'unproductive', 'Video', 10),
    ('netflix', 'contains', 'unproductive', 'Video', 10),
    ('instagram', 'contains', 'unproductive', 'Social', 10),
    ('tiktok', 'contains', 'unproductive', 'Social', 10),
    ('facebook', 'contains', 'unproductive', 'Social', 10),
    ('twitter', 'contains', 'unproductive', 'Social', 10),
    ('telegram', 'contains', 'neutral', 'Messaging', 50),
    ('whatsapp', 'contains', 'neutral', 'Messaging', 50),
    ('chrome', 'contains', 'neutral', 'Browser', 80),
    ('safari', 'contains', 'neutral', 'Browser', 80),
    ('firefox', 'contains', 'neutral', 'Browser', 80),
    ('edge', 'contains', 'neutral', 'Browser', 80),
    ('finder', 'contains', 'neutral', 'System', 90),
    ('explorer', 'contains', 'neutral', 'System', 90)
ON CONFLICT DO NOTHING;

INSERT INTO site_categories (pattern, pattern_type, category, label, priority) VALUES
    ('github.com', 'contains', 'productive', 'Code', 10),
    ('gitlab.com', 'contains', 'productive', 'Code', 10),
    ('bitbucket.org', 'contains', 'productive', 'Code', 10),
    ('stackoverflow.com', 'contains', 'productive', 'Reference', 10),
    ('developer.mozilla.org', 'contains', 'productive', 'Reference', 10),
    ('docs.python.org', 'contains', 'productive', 'Reference', 10),
    ('jira.', 'contains', 'productive', 'Project Mgmt', 10),
    ('asana.com', 'contains', 'productive', 'Project Mgmt', 10),
    ('trello.com', 'contains', 'productive', 'Project Mgmt', 10),
    ('notion.so', 'contains', 'productive', 'Docs', 10),
    ('docs.google.com', 'contains', 'productive', 'Docs', 10),
    ('mail.google.com', 'contains', 'productive', 'Email', 20),
    ('youtube.com', 'contains', 'unproductive', 'Video', 10),
    ('netflix.com', 'contains', 'unproductive', 'Video', 10),
    ('instagram.com', 'contains', 'unproductive', 'Social', 10),
    ('tiktok.com', 'contains', 'unproductive', 'Social', 10),
    ('facebook.com', 'contains', 'unproductive', 'Social', 10),
    ('twitter.com', 'contains', 'unproductive', 'Social', 10),
    ('x.com', 'exact', 'unproductive', 'Social', 10),
    ('reddit.com', 'contains', 'unproductive', 'Social', 10),
    ('twitch.tv', 'contains', 'unproductive', 'Streaming', 10)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Application config (key-value): muhim flagslarni DB'da saqlash
-- ============================================================
CREATE TABLE IF NOT EXISTS app_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by UUID NULL REFERENCES admins(id)
);

INSERT INTO app_config (key, value, description) VALUES
    ('AUTO_CREATE_EMPLOYEE_FROM_DEVICE', 'true', 'Hikvision eventidan topilmagan xodimni avtomatik yaratish. card_id employee_code ga yoziladi, keyingi safar avtomatik topiladi.'),
    ('IDLE_THRESHOLD_SECONDS', '300', 'Kompyuter idle deb hisoblanadigan minimal vaqt (sekundlarda)'),
    ('PRODUCTIVITY_DEFAULT_CATEGORY', 'neutral', 'Hech bir qoidaga tushmagan dastur/sayt qaysi kategoriyaga kiritiladi'),
    ('WEEKEND_DAYS', 'sat,sun', 'Hafta oxiri kunlari (vergul bilan)'),
    ('UPLOAD_MAX_SIZE_BYTES', '5242880', 'Yuklanadigan rasmning maksimal hajmi (default 5MB)'),
    ('EMPLOYEE_PHOTO_DIR', 'employee_photos', 'Xodim profil rasmlari katalogi (server filesystem)')
ON CONFLICT (key) DO NOTHING;
