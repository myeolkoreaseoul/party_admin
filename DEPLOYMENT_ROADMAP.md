# 🚀 배포 및 실행 로드맵

## 📋 현재 상태 (2026-01-02)

### ✅ 완료된 작업

1. **테이블 스키마 재정비**
   - customers (고객마스터) - 13 필드
   - invitations (초대장신청) - 14 필드
   - reservations (프립예약) - 12 필드
   - surveys (사전조사) - 12 필드
   - attendance (참석관리) - 11 필드
   - coupons (쿠폰관리) - 3 필드

2. **기존 데이터 마이그레이션**
   - 이유진 (010-9026-8668) - 1부 예약
   - 조세목 (010-9473-9509) - 1부 예약
   - 쿠폰 4개 (SVVYS2026, WELCOME26, HOST001, VIP2026)

3. **API 연동 완료**
   - svvys-mwol-crew.html: RESTful Table API
   - verification.html: RESTful Table API + GAS 파일업로드
   - survey.html: RESTful Table API + GAS 파일업로드

4. **파일 업로드 GAS 준비**
   - GAS_FILE_UPLOAD_ONLY.js 작성 완료
   - 스프레드시트 연동 없이 Google Drive만 사용

---

## 📝 배포 체크리스트

### Step 1: 이 프로젝트 배포

1. **Publish 탭으로 이동**
2. **배포 버튼 클릭**
3. **배포된 URL 확인 및 저장**

```
예: https://your-project-id.cabi.ooo/
```

### Step 2: GAS 파일업로드 전용 코드 배포

1. **Google Apps Script 새 프로젝트 생성**
   - script.google.com 접속
   - 새 프로젝트 생성

2. **코드 복사/붙여넣기**
   - `GAS_FILE_UPLOAD_ONLY.js` 내용 전체 복사
   - 새 프로젝트에 붙여넣기

3. **웹앱 배포**
   - 배포 → 새 배포
   - 유형: 웹 앱
   - 실행 주체: 본인
   - 액세스: 모든 사용자
   - 배포 클릭
   - **URL 복사해서 저장**

4. **verification.html, survey.html에 GAS URL 업데이트**
   ```javascript
   const GAS_FILE_URL = '배포된_GAS_URL';
   ```

### Step 3: Tasker 설정 변경

**기존 설정:**
```
URL: https://script.google.com/.../exec
Action: POST
Body: { "action": "fripReservation", "message": "..." }
```

**새 설정:**
```
URL: https://your-project-id.cabi.ooo/tables/reservations
Method: POST
Headers: Content-Type: application/json
Body:
{
  "id": "%frip_reservation_number",
  "phone": "%phone",
  "crewName": "%name",
  "eventDate": "%event_date",
  "eventPart": "1부",
  "option": "%option",
  "isInvitation": true,
  "status": "예약완료",
  "registeredAt": "%timestamp"
}
```

**Tasker 변수 매핑:**
- `%frip_reservation_number`: SMS에서 추출한 예약번호
- `%phone`: SMS에서 추출한 전화번호
- `%name`: SMS에서 추출한 이름
- `%event_date`: SMS에서 추출한 진행일시
- `%option`: SMS에서 추출한 옵션명

---

## 🧪 테스트 시나리오

### Test 1: 초대장 신청 플로우

1. index.html 접속
2. 자격 2개 이상 선택 (와인보너스 확인)
3. verification.html에서 인증
4. 파일 업로드 테스트
5. 쿠폰 검증 테스트 (SVVYS2026)
6. success.html 도달 확인

**확인 포인트:**
- [ ] invitations 테이블에 데이터 저장
- [ ] customers 테이블에 데이터 저장
- [ ] Google Drive에 파일 저장 (파일 업로드 시)
- [ ] 와인보너스 정상 계산

### Test 2: 프립 예약 플로우 (Tasker)

1. Tasker에서 테스트 SMS 발송
2. reservations API 호출 확인
3. 관리자 페이지 → 고객 관리 탭 확인

**확인 포인트:**
- [ ] reservations 테이블에 데이터 저장
- [ ] eventPart 자동 계산 (12시→1부)
- [ ] 통합 뷰에 표시

### Test 3: 사전조사 플로우

1. survey.html 접속
2. 전화번호 입력 (기존 예약자)
3. 프로필 입력 및 제출

**확인 포인트:**
- [ ] surveys 테이블에 데이터 저장
- [ ] customers 테이블 업데이트 (PATCH)
- [ ] 통합 뷰에서 "사전조사완료" 표시

### Test 4: 관리자 페이지

1. svvys-mwol-crew.html 접속
2. 비밀번호 입력 (svvys2025)
3. 각 탭 기능 테스트

**확인 포인트:**
- [ ] 대시보드 통계 정확
- [ ] 고객 관리 필터링 동작
- [ ] 진행일시/프로그램 정상 표시
- [ ] 연락처 전체 형식 표시 (010-XXXX-XXXX)

---

## 🐛 알려진 이슈 및 해결

### Issue 1: 연락처 표시 형식
- **증상:** 연락처가 `90268668`로 표시
- **원인:** shortPhone 로직이 010 제거
- **해결:** displayPhone으로 전체 형식 유지 ✅

### Issue 2: 프로그램 표시
- **증상:** `2부 초대`로 잘못 표시
- **원인:** 옵션명 기반 판단 오류
- **해결:** 시간 기반 판단으로 변경 ✅
  - 12시 → 1부
  - 15시 → 2부
  - 19시 → 3부

### Issue 3: 유입경로 표시
- **증상:** 초대장 유입인데 `-` 표시
- **원인:** invitationMap 매칭 실패
- **해결:** inv.phone 존재 여부로 판단 ✅

---

## 📊 성공 지표 체크

| 항목 | 목표 | 현재 |
|------|------|------|
| 테이블 스키마 | 6개 | ✅ 6개 |
| 데이터 마이그레이션 | 2명 + 4쿠폰 | ✅ 완료 |
| API 연동 페이지 | 3개 | ✅ 3개 |
| GAS 파일업로드 | 준비 | ✅ 완료 |
| End-to-End 테스트 | - | ⏳ 대기 |
| Tasker 연동 | - | ⏳ 대기 |

---

## 🔄 롤백 계획

만약 문제 발생 시:

1. **GAS_CODE_COPY_THIS.txt** 사용
   - 기존 GAS 전체 코드 포함
   - 스프레드시트 연동 버전

2. **스프레드시트 ID**
   ```
   1dZGU-x2xNgFSGyv_esL95AZ5A20EtWbwgHCpLjFYtiU
   ```

3. **기존 GAS 웹앱 URL**
   ```
   https://script.google.com/macros/s/AKfycbywCJUjEovNaeU8vH3nIzamDg1Ijbchh4sLsK7JYnL0qBhaPgF0V3m7gfJCYvW4zY0h/exec
   ```

---

## 📞 긴급 연락

- 배포 문제: Publish 탭 → 재배포
- API 문제: 브라우저 개발자 도구 → Network 탭
- GAS 문제: script.google.com → 로그 확인

---

**작성일:** 2026-01-02  
**버전:** v1.0
