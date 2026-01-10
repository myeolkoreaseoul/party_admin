-- ============================================
-- SVVYS 뭘좀아는사람들 Supabase 테이블 스키마
-- 실행 방법: Supabase Dashboard > SQL Editor > 이 내용 붙여넣기 > Run
-- ============================================

-- 1. customers (고객 정보)
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,  -- 전화번호 (010-XXXX-XXXX)
    name TEXT,
    gender TEXT,
    birth_year INTEGER,
    height INTEGER,
    job_category TEXT,
    job_detail TEXT,
    job_cert_file TEXT,
    source TEXT,
    marketing_agree BOOLEAN DEFAULT FALSE,
    memo TEXT,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    blacklist_reason TEXT,
    blacklisted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 테이블에 누락된 필드 추가 (이미 테이블이 있는 경우)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS manual_stage TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS blacklist_reason TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ;

-- 2. invitations (초대장 신청)
CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    phone TEXT,
    qualifications TEXT,
    groups TEXT,
    wine_bonus BOOLEAN DEFAULT FALSE,
    auth_type TEXT,
    sns_link TEXT,
    file_links TEXT,  -- JSON string
    coupon_code TEXT,
    host_name TEXT,
    referral_reason TEXT,
    distributor TEXT,
    approval_status TEXT DEFAULT 'pending',
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. reservations (프립 예약)
CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,  -- 예약번호
    phone TEXT,
    crew_name TEXT,
    event_date TEXT,
    event_part TEXT,
    option TEXT,
    is_invitation BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT '예약완료',
    payment_type TEXT,
    payment_note TEXT,
    survey_done BOOLEAN DEFAULT FALSE,
    survey_reminder_sent BOOLEAN DEFAULT FALSE,
    confirmation_sent BOOLEAN DEFAULT FALSE,
    registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 reservations 테이블에 누락된 필드 추가
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_type TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_note TEXT;

-- 4. surveys (사전조사)
CREATE TABLE IF NOT EXISTS surveys (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    phone TEXT,
    name TEXT,
    gender TEXT,
    birth_year INTEGER,
    height INTEGER,
    job_category TEXT,
    job_detail TEXT,
    job_cert_file TEXT,
    terms_agreed BOOLEAN DEFAULT FALSE,
    marketing_agreed BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. coupons (쿠폰)
CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,  -- 쿠폰코드
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT
);

-- 6. party_schedules (파티 일정)
CREATE TABLE IF NOT EXISTS party_schedules (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    date TEXT,
    part TEXT,
    time TEXT,
    party_type TEXT DEFAULT 'coffee',
    male_capacity INTEGER DEFAULT 12,
    female_capacity INTEGER DEFAULT 12,
    min_vacancy INTEGER DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    memo TEXT,
    min_birth_year INTEGER,
    max_birth_year INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. session_templates (세션 템플릿)
CREATE TABLE IF NOT EXISTS session_templates (
    id TEXT PRIMARY KEY,  -- 1부, 2부, 3부
    time TEXT,
    type TEXT DEFAULT 'coffee',
    min_birth_year INTEGER,
    max_birth_year INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER
);

-- 8. party_types (파티 유형)
CREATE TABLE IF NOT EXISTS party_types (
    id TEXT PRIMARY KEY,  -- coffee, wine 등
    icon TEXT,
    name TEXT,
    male_capacity INTEGER DEFAULT 12,
    female_capacity INTEGER DEFAULT 12,
    min_vacancy INTEGER DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER
);

-- 9. job_tiers (직업 티어)
CREATE TABLE IF NOT EXISTS job_tiers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    gender TEXT,
    job TEXT,
    tier TEXT,  -- S, A, B
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. virtual_participants (가상참여자 생성 규칙)
CREATE TABLE IF NOT EXISTS virtual_participants (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    gender TEXT,
    job TEXT,
    ratio NUMERIC DEFAULT 0,
    min_birth_year INTEGER,
    max_birth_year INTEGER,
    min_height INTEGER,
    max_height INTEGER
);

-- 11. virtual_pool (가상참여자 풀)
CREATE TABLE IF NOT EXISTS virtual_pool (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name TEXT,
    gender TEXT,
    birth_year INTEGER,
    height INTEGER,
    job TEXT,
    tier TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. party_virtual_assignments (파티별 가상참여자 배정)
CREATE TABLE IF NOT EXISTS party_virtual_assignments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    schedule_date TEXT,
    schedule_part TEXT,
    virtual_id TEXT,
    gender TEXT,
    birth_year INTEGER,
    height INTEGER,
    job TEXT,
    tier TEXT,
    is_revealed BOOLEAN DEFAULT FALSE,
    revealed_at TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    display_order INTEGER
);

-- 13. public_lineup (공개용 라인업 - 민감정보 없음)
CREATE TABLE IF NOT EXISTS public_lineup (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    schedule_date TEXT,
    schedule_part TEXT,
    gender TEXT,
    age_range TEXT,
    height INTEGER,
    job TEXT,
    display_order INTEGER,
    is_revealed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. attendance (참석 관리)
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    reservation_id TEXT,
    phone TEXT,
    attended BOOLEAN DEFAULT FALSE,
    attended_at TIMESTAMPTZ,
    refund_eligible BOOLEAN DEFAULT FALSE,
    refund_completed BOOLEAN DEFAULT FALSE,
    refund_amount INTEGER,
    refund_completed_at TIMESTAMPTZ,
    verification_method TEXT,
    memo TEXT
);

-- 15. change_logs (변경 이력)
CREATE TABLE IF NOT EXISTS change_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,  -- 'CREATE', 'UPDATE', 'DELETE'
    table_name TEXT NOT NULL,
    record_id TEXT,
    changes JSONB,
    old_data JSONB,
    user_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- change_logs 인덱스
CREATE INDEX IF NOT EXISTS idx_change_logs_table ON change_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_change_logs_record ON change_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_created ON change_logs(created_at DESC);

-- ============================================
-- Row Level Security (RLS) 설정
-- ============================================

-- 모든 테이블에 RLS 활성화
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_virtual_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_lineup ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 공개 테이블 정책 (누구나 읽기 가능)
-- ============================================

-- public_lineup: 누구나 읽기 가능 (민감정보 없음)
CREATE POLICY "public_lineup_select" ON public_lineup FOR SELECT USING (true);

-- party_schedules: 누구나 읽기 가능 (일정 정보)
CREATE POLICY "party_schedules_select" ON party_schedules FOR SELECT USING (true);

-- party_types: 누구나 읽기 가능 (파티 유형)
CREATE POLICY "party_types_select" ON party_types FOR SELECT USING (true);

-- coupons: 누구나 읽기 가능 (쿠폰 검증용)
CREATE POLICY "coupons_select" ON coupons FOR SELECT USING (true);

-- ============================================
-- 서비스 역할 정책 (관리자용 - service_role key 필요)
-- anon key로는 위 공개 테이블만 접근 가능
-- ============================================

-- 관리자용 전체 접근 정책 (service_role)
-- customers
CREATE POLICY "customers_all_service" ON customers FOR ALL USING (auth.role() = 'service_role');

-- invitations  
CREATE POLICY "invitations_all_service" ON invitations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "invitations_insert_anon" ON invitations FOR INSERT WITH CHECK (true);  -- 신청은 누구나

-- reservations
CREATE POLICY "reservations_all_service" ON reservations FOR ALL USING (auth.role() = 'service_role');

-- surveys
CREATE POLICY "surveys_all_service" ON surveys FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "surveys_insert_anon" ON surveys FOR INSERT WITH CHECK (true);  -- 제출은 누구나

-- coupons (관리자 수정)
CREATE POLICY "coupons_all_service" ON coupons FOR ALL USING (auth.role() = 'service_role');

-- party_schedules (관리자 수정)
CREATE POLICY "party_schedules_all_service" ON party_schedules FOR ALL USING (auth.role() = 'service_role');

-- session_templates
CREATE POLICY "session_templates_select" ON session_templates FOR SELECT USING (true);
CREATE POLICY "session_templates_all_service" ON session_templates FOR ALL USING (auth.role() = 'service_role');

-- party_types (관리자 수정)
CREATE POLICY "party_types_all_service" ON party_types FOR ALL USING (auth.role() = 'service_role');

-- job_tiers
CREATE POLICY "job_tiers_select" ON job_tiers FOR SELECT USING (true);
CREATE POLICY "job_tiers_all_service" ON job_tiers FOR ALL USING (auth.role() = 'service_role');

-- virtual_participants
CREATE POLICY "virtual_participants_select" ON virtual_participants FOR SELECT USING (true);
CREATE POLICY "virtual_participants_all_service" ON virtual_participants FOR ALL USING (auth.role() = 'service_role');

-- virtual_pool (관리자만)
CREATE POLICY "virtual_pool_all_service" ON virtual_pool FOR ALL USING (auth.role() = 'service_role');

-- party_virtual_assignments (관리자만)
CREATE POLICY "party_virtual_assignments_all_service" ON party_virtual_assignments FOR ALL USING (auth.role() = 'service_role');

-- public_lineup (관리자 수정)
CREATE POLICY "public_lineup_all_service" ON public_lineup FOR ALL USING (auth.role() = 'service_role');

-- attendance (관리자만)
CREATE POLICY "attendance_all_service" ON attendance FOR ALL USING (auth.role() = 'service_role');

-- change_logs (관리자만)
CREATE POLICY "change_logs_all_service" ON change_logs FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 고객 ID 기반 시스템 (2026-01-10 추가)
-- 전화번호 의존 매칭 → customer_id 기반 매칭으로 전환
-- ============================================

-- customers 테이블에 customer_id 추가
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_id TEXT UNIQUE;

-- reservations 테이블에 customer_id 추가
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS customer_id TEXT;

-- invitations 테이블에 customer_id 추가
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS customer_id TEXT;

-- surveys 테이블에 customer_id 추가
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS customer_id TEXT;

-- 기존 customers 데이터에 customer_id 부여 (전화번호 기반으로 생성)
UPDATE customers
SET customer_id = 'CUS-' || EXTRACT(EPOCH FROM created_at)::BIGINT || '-' || SUBSTR(MD5(id), 1, 6)
WHERE customer_id IS NULL;

-- 기존 reservations에 customer_id 연결 (전화번호 매칭)
UPDATE reservations r
SET customer_id = c.customer_id
FROM customers c
WHERE r.customer_id IS NULL
  AND REPLACE(REPLACE(r.phone, '-', ''), ' ', '') = REPLACE(REPLACE(c.id, '-', ''), ' ', '');

-- 기존 invitations에 customer_id 연결
UPDATE invitations i
SET customer_id = c.customer_id
FROM customers c
WHERE i.customer_id IS NULL
  AND REPLACE(REPLACE(i.phone, '-', ''), ' ', '') = REPLACE(REPLACE(c.id, '-', ''), ' ', '');

-- 기존 surveys에 customer_id 연결
UPDATE surveys s
SET customer_id = c.customer_id
FROM customers c
WHERE s.customer_id IS NULL
  AND REPLACE(REPLACE(s.phone, '-', ''), ' ', '') = REPLACE(REPLACE(c.id, '-', ''), ' ', '');

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_invitations_customer_id ON invitations(customer_id);
CREATE INDEX IF NOT EXISTS idx_surveys_customer_id ON surveys(customer_id);

-- ============================================
-- 전화번호 형식 통일 마이그레이션 (2026-01-10 추가)
-- 중복 고객 병합 및 전화번호 형식 010-xxxx-xxxx로 통일
-- ============================================

-- 1. 중복 고객 찾기 (같은 전화번호가 다른 형식으로 저장된 경우)
-- 먼저 중복 확인 쿼리 (실행 전 확인용)
-- SELECT
--     REPLACE(REPLACE(id, '-', ''), ' ', '') as normalized_phone,
--     COUNT(*) as cnt,
--     array_agg(id) as ids
-- FROM customers
-- GROUP BY REPLACE(REPLACE(id, '-', ''), ' ', '')
-- HAVING COUNT(*) > 1;

-- 2. 전화번호 형식 통일 함수 생성
CREATE OR REPLACE FUNCTION format_phone(phone TEXT)
RETURNS TEXT AS $$
DECLARE
    digits TEXT;
BEGIN
    IF phone IS NULL THEN RETURN NULL; END IF;

    -- 숫자만 추출
    digits := REGEXP_REPLACE(phone, '[^0-9]', '', 'g');

    -- 82로 시작하면 제거
    IF digits LIKE '82%' THEN
        digits := SUBSTRING(digits FROM 3);
    END IF;

    -- 10자리이고 0으로 시작하지 않으면 0 추가
    IF LENGTH(digits) = 10 AND digits NOT LIKE '0%' THEN
        digits := '0' || digits;
    END IF;

    -- 11자리면 하이픈 포맷으로 변환
    IF LENGTH(digits) = 11 THEN
        RETURN SUBSTRING(digits, 1, 3) || '-' || SUBSTRING(digits, 4, 4) || '-' || SUBSTRING(digits, 8, 4);
    END IF;

    RETURN digits;
END;
$$ LANGUAGE plpgsql;

-- 3. 중복 고객 병합 (하이픈 형식 유지, 데이터 병합)
-- 중복된 고객 중 데이터가 더 많은 레코드를 유지
DO $$
DECLARE
    dup_record RECORD;
    keep_id TEXT;
    delete_id TEXT;
BEGIN
    -- 중복 고객 찾기
    FOR dup_record IN
        SELECT
            REPLACE(REPLACE(id, '-', ''), ' ', '') as normalized_phone,
            array_agg(id ORDER BY
                CASE WHEN id LIKE '%-%' THEN 0 ELSE 1 END,  -- 하이픈 있는 것 우선
                CASE WHEN name IS NOT NULL THEN 0 ELSE 1 END,  -- 이름 있는 것 우선
                created_at
            ) as ids
        FROM customers
        GROUP BY REPLACE(REPLACE(id, '-', ''), ' ', '')
        HAVING COUNT(*) > 1
    LOOP
        -- 첫 번째(우선순위 높은) 레코드 유지
        keep_id := dup_record.ids[1];

        -- 나머지 레코드들의 데이터를 유지 레코드에 병합 후 삭제
        FOR i IN 2..array_length(dup_record.ids, 1) LOOP
            delete_id := dup_record.ids[i];

            -- 빈 필드만 병합 (기존 데이터 유지)
            UPDATE customers c1
            SET
                name = COALESCE(c1.name, c2.name),
                nickname = COALESCE(c1.nickname, c2.nickname),
                gender = COALESCE(c1.gender, c2.gender),
                birth_year = COALESCE(c1.birth_year, c2.birth_year),
                height = COALESCE(c1.height, c2.height),
                job_category = COALESCE(c1.job_category, c2.job_category),
                job_detail = COALESCE(c1.job_detail, c2.job_detail),
                source = COALESCE(c1.source, c2.source),
                memo = COALESCE(c1.memo, c2.memo),
                customer_id = COALESCE(c1.customer_id, c2.customer_id),
                is_blacklisted = c1.is_blacklisted OR COALESCE(c2.is_blacklisted, false),
                blacklist_reason = COALESCE(c1.blacklist_reason, c2.blacklist_reason),
                blacklisted_at = COALESCE(c1.blacklisted_at, c2.blacklisted_at)
            FROM customers c2
            WHERE c1.id = keep_id AND c2.id = delete_id;

            -- 관련 테이블의 전화번호도 업데이트 (customer_id가 없는 경우)
            UPDATE reservations SET phone = keep_id
            WHERE REPLACE(REPLACE(phone, '-', ''), ' ', '') = dup_record.normalized_phone
              AND customer_id IS NULL;

            UPDATE invitations SET phone = keep_id
            WHERE REPLACE(REPLACE(phone, '-', ''), ' ', '') = dup_record.normalized_phone
              AND customer_id IS NULL;

            UPDATE surveys SET phone = keep_id
            WHERE REPLACE(REPLACE(phone, '-', ''), ' ', '') = dup_record.normalized_phone
              AND customer_id IS NULL;

            -- 중복 레코드 삭제
            DELETE FROM customers WHERE id = delete_id;

            RAISE NOTICE 'Merged customer % into %, deleted duplicate', delete_id, keep_id;
        END LOOP;
    END LOOP;
END $$;

-- 4. 모든 고객 전화번호를 하이픈 형식으로 통일
-- (이미 하이픈 형식인 경우 제외)
UPDATE customers
SET id = format_phone(id)
WHERE id NOT LIKE '___-____-____'
  AND LENGTH(REGEXP_REPLACE(id, '[^0-9]', '', 'g')) = 11;

-- 5. 관련 테이블도 전화번호 형식 통일
UPDATE reservations
SET phone = format_phone(phone)
WHERE phone NOT LIKE '___-____-____'
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) = 11;

UPDATE invitations
SET phone = format_phone(phone)
WHERE phone NOT LIKE '___-____-____'
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) = 11;

UPDATE surveys
SET phone = format_phone(phone)
WHERE phone NOT LIKE '___-____-____'
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) = 11;

-- ============================================
-- 완료 메시지
-- ============================================
SELECT 'All tables and RLS policies created successfully! Phone numbers normalized.' as result;
