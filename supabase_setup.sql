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

-- 기존 테이블에 블랙리스트 필드 추가 (이미 테이블이 있는 경우)
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
    survey_done BOOLEAN DEFAULT FALSE,
    survey_reminder_sent BOOLEAN DEFAULT FALSE,
    confirmation_sent BOOLEAN DEFAULT FALSE,
    registered_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- ============================================
-- 완료 메시지
-- ============================================
SELECT 'All tables and RLS policies created successfully!' as result;
