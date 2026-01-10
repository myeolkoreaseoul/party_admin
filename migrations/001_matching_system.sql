-- ============================================
-- 매칭 시스템 마이그레이션
-- 실행: Supabase Dashboard > SQL Editor > 이 내용 붙여넣기 > Run
-- ============================================

-- 1. reservations에 라인업 번호 및 참석 정보 추가
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS lineup_number INTEGER;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS attended BOOLEAN DEFAULT FALSE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;

-- 2. party_virtual_assignments에 라인업 번호 추가
ALTER TABLE party_virtual_assignments ADD COLUMN IF NOT EXISTS lineup_number INTEGER;
ALTER TABLE party_virtual_assignments ADD COLUMN IF NOT EXISTS name TEXT;

-- 3. party_schedules에 선택 한도 및 라인업 확정 상태 추가
ALTER TABLE party_schedules ADD COLUMN IF NOT EXISTS male_selection_limit INTEGER DEFAULT 3;
ALTER TABLE party_schedules ADD COLUMN IF NOT EXISTS female_selection_limit INTEGER DEFAULT 3;
ALTER TABLE party_schedules ADD COLUMN IF NOT EXISTS lineup_finalized BOOLEAN DEFAULT FALSE;
ALTER TABLE party_schedules ADD COLUMN IF NOT EXISTS lineup_finalized_at TIMESTAMPTZ;

-- 4. match_submissions 테이블 생성 (참가자 매칭 제출)
CREATE TABLE IF NOT EXISTS match_submissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    event_date TEXT NOT NULL,
    event_part TEXT NOT NULL,
    party_type TEXT NOT NULL,              -- coffee/wine
    gender TEXT NOT NULL,                   -- 남자/여자
    lineup_number INTEGER NOT NULL,         -- 내 번호
    name TEXT NOT NULL,                     -- 이름
    contact_type TEXT NOT NULL,             -- phone/kakao/instagram
    contact_value TEXT NOT NULL,            -- 연락처 값
    selected_numbers INTEGER[] NOT NULL,    -- 선택한 상대 번호들
    reservation_id TEXT,                    -- 예약번호 (연동용)
    is_latest BOOLEAN DEFAULT TRUE,         -- 최신 유효 데이터 (중복 제출 시 이전 건은 false)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. match_results 테이블 생성 (관리자용 매칭 결과)
CREATE TABLE IF NOT EXISTS match_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    event_date TEXT NOT NULL,
    event_part TEXT NOT NULL,
    party_type TEXT NOT NULL,
    male_number INTEGER NOT NULL,
    female_number INTEGER NOT NULL,
    male_name TEXT,
    female_name TEXT,
    male_contact_type TEXT,
    male_contact_value TEXT,
    female_contact_type TEXT,
    female_contact_value TEXT,
    is_mutual BOOLEAN DEFAULT FALSE,        -- 쌍방 선택 여부 (와인용)
    status TEXT DEFAULT 'pending',          -- pending/approved/sent
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RLS 정책
ALTER TABLE match_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;

-- match_submissions: 누구나 제출 가능
DO $$ BEGIN
    CREATE POLICY "match_submissions_insert_anon" ON match_submissions FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- match_submissions: 관리자 전체 접근
DO $$ BEGIN
    CREATE POLICY "match_submissions_all_service" ON match_submissions FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- match_submissions: anon도 읽기 가능 (본인 것만 - 추후 필요 시)
DO $$ BEGIN
    CREATE POLICY "match_submissions_select_anon" ON match_submissions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- match_results: 관리자만
DO $$ BEGIN
    CREATE POLICY "match_results_all_service" ON match_results FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. 인덱스
CREATE INDEX IF NOT EXISTS idx_match_submissions_event ON match_submissions(event_date, event_part);
CREATE INDEX IF NOT EXISTS idx_match_submissions_latest ON match_submissions(is_latest) WHERE is_latest = TRUE;
CREATE INDEX IF NOT EXISTS idx_match_results_event ON match_results(event_date, event_part);
CREATE INDEX IF NOT EXISTS idx_reservations_lineup ON reservations(event_date, event_part, lineup_number);
CREATE INDEX IF NOT EXISTS idx_virtual_assign_lineup ON party_virtual_assignments(schedule_date, schedule_part, lineup_number);

-- 완료
SELECT '매칭 시스템 마이그레이션 완료!' as result;
