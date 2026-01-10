-- ============================================
-- 매칭 추가 필드 마이그레이션
-- 실행: Supabase Dashboard > SQL Editor > 이 내용 붙여넣기 > Run
-- ============================================

-- match_submissions에 새 컬럼 추가
ALTER TABLE match_submissions ADD COLUMN IF NOT EXISTS no_selection BOOLEAN DEFAULT FALSE;
ALTER TABLE match_submissions ADD COLUMN IF NOT EXISTS manner_persons INTEGER[];
ALTER TABLE match_submissions ADD COLUMN IF NOT EXISTS no_manner_person BOOLEAN DEFAULT FALSE;
ALTER TABLE match_submissions ADD COLUMN IF NOT EXISTS comment TEXT;

-- 완료
SELECT '매칭 추가 필드 마이그레이션 완료!' as result;
