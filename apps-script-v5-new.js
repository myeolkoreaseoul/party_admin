// ========================================
// 뭘 좀 아는 사람들 - GAS v5
// 새로운 초대장 플로우 + 쿠폰 관리 + Google Drive
// ========================================

// 스프레드시트 ID (실제 ID로 교체 필요)
const SPREADSHEET_ID = '1dZGU-x2xNgFSGyv_esL95AZ5A20EtWbwgHCpLjFYtiU';

const SHEET_NAMES = {
  INVITATION: '초대장 신청',
  FRIP: '프립예약',
  MASTER: '통합고객관리',
  SURVEY: '사전조사',
  COUPON: '쿠폰관리'  // 새로 추가
};

const DRIVE_FOLDER_NAME = '뭘좀아는사람들_인증자료';
const FRIP_URL = 'https://www.frip.co.kr/products/188435';

// ========================================
// 웹 앱 엔드포인트
// ========================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    Logger.log('=== doPost 시작 ===');
    Logger.log('Action: ' + action);
    Logger.log('Data: ' + JSON.stringify(data));
    
    switch(action) {
      case 'verification':
        return handleVerification(data);
      case 'verifyCoupon':
        return handleVerifyCoupon(data);
      default:
        throw new Error('알 수 없는 action: ' + action);
    }
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return createResponse(false, '오류: ' + error.toString());
  }
}

function doGet(e) {
  const action = e.parameter.action;
  
  // 쿠폰 검증 GET 요청 지원
  if (action === 'verifyCoupon') {
    const code = e.parameter.code;
    return handleVerifyCouponGet(code);
  }
  
  return ContentService
    .createTextOutput('뭘 좀 아는 사람들 GAS v5 - 정상 작동 중')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ========================================
// 응답 헬퍼
// ========================================
function createResponse(success, message, data = {}) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: success,
      message: message,
      ...data
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// 1. 인증 신청 처리 (메인 핸들러)
// ========================================
function handleVerification(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAMES.INVITATION);
  
  // 시트가 없으면 생성
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.INVITATION);
    sheet.appendRow([
      '타임스탬프', '전화번호', '선택자격', '선택그룹', '와인보너스',
      '인증방법', 'SNS링크', '파일링크', '쿠폰코드', '호스트명',
      '추천경위', '승인상태', '프립이동일시', '배포처', '메모'
    ]);
  }
  
  const timestamp = new Date();
  const phone = data.phone || '';
  const qualifications = data.qualifications || '';  // 쉼표로 구분된 문자열
  const qualificationLabels = data.qualificationLabels || qualifications;
  const groups = data.groups || '';
  const wineBonus = data.wineBonus === 'true' || data.wineBonus === true;
  const authType = data.authType || '';  // upload, onsite, coupon, host_referral
  const snsLink = data.snsLink || '';
  const couponCode = data.additionalData?.couponCode || '';
  const hostName = data.additionalData?.hostName || '';
  const referralReason = data.additionalData?.referralReason || '';
  const source = data.source || 'direct';
  
  // 파일 처리 (있으면)
  let fileLinks = '';
  if (data.files && data.files.length > 0) {
    const uploadedLinks = saveFilesToDrive(phone, data.files);
    fileLinks = uploadedLinks.join('\n');
  }
  
  // 승인 상태 결정
  let approvalStatus = '인증대기';
  if (authType === 'coupon') {
    approvalStatus = '쿠폰승인';
  } else if (authType === 'host_referral') {
    approvalStatus = '심사중';
  } else if (authType === 'upload' && fileLinks) {
    approvalStatus = '서류제출완료';
  } else if (authType === 'onsite') {
    approvalStatus = '현장인증예정';
  }
  
  // 데이터 기록
  sheet.appendRow([
    timestamp,           // A: 타임스탬프
    phone,               // B: 전화번호
    qualificationLabels, // C: 선택자격
    groups,              // D: 선택그룹
    wineBonus ? 'Y' : 'N', // E: 와인보너스
    authType,            // F: 인증방법
    snsLink,             // G: SNS링크
    fileLinks,           // H: 파일링크
    couponCode,          // I: 쿠폰코드
    hostName,            // J: 호스트명
    referralReason,      // K: 추천경위
    approvalStatus,      // L: 승인상태
    timestamp,           // M: 프립이동일시
    source,              // N: 배포처
    ''                   // O: 메모
  ]);
  
  Logger.log('초대장 신청 기록 완료: ' + phone);
  
  // 통합고객관리 업데이트
  updateMasterSheet();
  
  return createResponse(true, '신청이 완료되었습니다', {
    approvalStatus: approvalStatus,
    wineBonus: wineBonus
  });
}

// ========================================
// 2. 쿠폰 검증 (POST)
// ========================================
function handleVerifyCoupon(data) {
  const code = (data.code || '').toUpperCase().trim();
  const result = verifyCouponCode(code);
  return createResponse(result.valid, result.message);
}

// ========================================
// 2-1. 쿠폰 검증 (GET - CORS 우회용)
// ========================================
function handleVerifyCouponGet(code) {
  code = (code || '').toUpperCase().trim();
  const result = verifyCouponCode(code);
  return createResponse(result.valid, result.message);
}

// ========================================
// 2-2. 쿠폰 코드 검증 로직
// ========================================
function verifyCouponCode(code) {
  if (!code) {
    return { valid: false, message: '쿠폰 코드를 입력해주세요' };
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAMES.COUPON);
  
  // 쿠폰관리 시트가 없으면 기본값으로 생성
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.COUPON);
    sheet.appendRow(['쿠폰코드', '사용가능', '메모', '생성일']);
    // 기본 쿠폰 추가
    sheet.appendRow(['WELCOME23', 'TRUE', '공통 추천코드', new Date()]);
    sheet.appendRow(['VIP2024', 'TRUE', 'VIP용', new Date()]);
    sheet.appendRow(['HOST001', 'TRUE', '호스트 추천', new Date()]);
    Logger.log('쿠폰관리 시트 생성 완료');
  }
  
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const couponCode = String(data[i][0]).toUpperCase().trim();
    const isActive = String(data[i][1]).toUpperCase() === 'TRUE';
    
    if (couponCode === code) {
      if (isActive) {
        Logger.log('쿠폰 검증 성공: ' + code);
        return { valid: true, message: '유효한 쿠폰입니다' };
      } else {
        Logger.log('쿠폰 비활성: ' + code);
        return { valid: false, message: '만료된 쿠폰입니다' };
      }
    }
  }
  
  Logger.log('쿠폰 없음: ' + code);
  return { valid: false, message: '유효하지 않은 쿠폰 코드입니다' };
}

// ========================================
// 3. Google Drive 파일 저장
// ========================================
function saveFilesToDrive(phone, files) {
  const fileUrls = [];
  
  if (!files || files.length === 0) {
    return fileUrls;
  }
  
  // 메인 폴더 생성/가져오기
  const mainFolder = getOrCreateFolder(DRIVE_FOLDER_NAME);
  
  // 날짜별 서브폴더
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const dateFolder = getOrCreateSubFolder(mainFolder, today);
  
  // 전화번호별 서브폴더
  const phoneFolder = getOrCreateSubFolder(dateFolder, phone);
  
  files.forEach((fileData, index) => {
    try {
      // 파일명 생성
      const timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'HHmmss');
      const fileName = `${phone}_${timestamp}_${index + 1}_${fileData.name}`;
      
      // Base64 → Blob
      const blob = Utilities.newBlob(
        Utilities.base64Decode(fileData.data),
        fileData.type,
        fileName
      );
      
      // 파일 저장
      const file = phoneFolder.createFile(blob);
      fileUrls.push(file.getUrl());
      
      Logger.log('파일 저장 완료: ' + fileName);
    } catch (error) {
      Logger.log('파일 저장 실패: ' + error.toString());
    }
  });
  
  return fileUrls;
}

// ========================================
// 폴더 헬퍼 함수
// ========================================
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function getOrCreateSubFolder(parentFolder, subFolderName) {
  const subFolders = parentFolder.getFoldersByName(subFolderName);
  if (subFolders.hasNext()) {
    return subFolders.next();
  }
  return parentFolder.createFolder(subFolderName);
}

// ========================================
// 4. 통합고객관리 업데이트
// ========================================
function updateMasterSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const invitationSheet = ss.getSheetByName(SHEET_NAMES.INVITATION);
  const fripSheet = ss.getSheetByName(SHEET_NAMES.FRIP);
  const surveySheet = ss.getSheetByName(SHEET_NAMES.SURVEY);
  let masterSheet = ss.getSheetByName(SHEET_NAMES.MASTER);
  
  // 통합고객관리 시트가 없으면 생성
  if (!masterSheet) {
    masterSheet = ss.insertSheet(SHEET_NAMES.MASTER);
  }
  
  const customerMap = {};
  
  // 1) 초대장 신청 데이터
  if (invitationSheet) {
    const data = invitationSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const phone = String(row[1] || '').trim();
      if (!phone) continue;
      
      customerMap[phone] = {
        유입경로: 'invitation',
        크루명: '',
        연락처: phone,
        이메일: '',
        선택자격: row[2] || '',
        진행일시: '',
        프로그램: '',
        성별: '',
        옵션상세: '',
        프립예약번호: '',
        사전조사완료: 'N',
        승인상태: row[11] || '대기',
        프립링크발송: '',
        참석여부: '',
        환급여부: '',
        메모: row[14] || ''
      };
    }
  }
  
  // 2) 프립예약 데이터
  if (fripSheet) {
    const data = fripSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const phone = String(row[5] || '').trim(); // 크루연락처
      if (!phone) continue;
      
      if (customerMap[phone]) {
        // 기존 고객 정보 업데이트
        customerMap[phone].크루명 = row[4] || customerMap[phone].크루명;
        customerMap[phone].진행일시 = row[0] || '';
        customerMap[phone].프로그램 = row[1] || '';
        customerMap[phone].성별 = row[2] || '';
        customerMap[phone].옵션상세 = row[3] || '';
        customerMap[phone].프립예약번호 = row[6] || '';
      } else {
        // 새 고객 (일반 프립)
        customerMap[phone] = {
          유입경로: 'organic',
          크루명: row[4] || '',
          연락처: phone,
          이메일: '',
          선택자격: '',
          진행일시: row[0] || '',
          프로그램: row[1] || '',
          성별: row[2] || '',
          옵션상세: row[3] || '',
          프립예약번호: row[6] || '',
          사전조사완료: 'N',
          승인상태: '일반참가',
          프립링크발송: '',
          참석여부: '',
          환급여부: '',
          메모: ''
        };
      }
    }
  }
  
  // 3) 사전조사 데이터 (Tally)
  if (surveySheet) {
    const data = surveySheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const phone = String(row[7] || '').trim(); // 연락처 컬럼
      if (!phone) continue;
      
      if (customerMap[phone]) {
        customerMap[phone].사전조사완료 = 'Y';
        customerMap[phone].크루명 = row[4] || customerMap[phone].크루명; // 이름
        customerMap[phone].성별 = row[3] || customerMap[phone].성별;
      }
    }
  }
  
  // 4) 통합고객관리 시트 갱신
  masterSheet.clear();
  masterSheet.appendRow([
    'ID', '유입경로', '크루명', '연락처', '이메일', '선택자격',
    '진행일시', '프로그램', '성별', '옵션상세', '프립예약번호',
    '사전조사완료', '승인상태', '프립링크발송', '참석여부', '환급여부', '메모'
  ]);
  
  let id = 1;
  Object.values(customerMap).forEach(c => {
    masterSheet.appendRow([
      id++,
      c.유입경로,
      c.크루명,
      c.연락처,
      c.이메일,
      c.선택자격,
      c.진행일시,
      c.프로그램,
      c.성별,
      c.옵션상세,
      c.프립예약번호,
      c.사전조사완료,
      c.승인상태,
      c.프립링크발송,
      c.참석여부,
      c.환급여부,
      c.메모
    ]);
  });
  
  Logger.log('통합고객관리 업데이트 완료: ' + (id - 1) + '명');
}

// ========================================
// 수동 실행용 함수들
// ========================================

// 쿠폰 추가
function addCoupon(code, memo) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAMES.COUPON);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.COUPON);
    sheet.appendRow(['쿠폰코드', '사용가능', '메모', '생성일']);
  }
  
  sheet.appendRow([code.toUpperCase(), 'TRUE', memo || '', new Date()]);
  Logger.log('쿠폰 추가: ' + code);
}

// 쿠폰 비활성화
function deactivateCoupon(code) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.COUPON);
  
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase() === code.toUpperCase()) {
      sheet.getRange(i + 1, 2).setValue('FALSE');
      Logger.log('쿠폰 비활성화: ' + code);
      break;
    }
  }
}

// 테스트: 통합고객관리 수동 업데이트
function test_updateMaster() {
  updateMasterSheet();
  SpreadsheetApp.getUi().alert('통합고객관리가 업데이트되었습니다!');
}

// 테스트: 쿠폰 검증
function test_verifyCoupon() {
  const result = verifyCouponCode('WELCOME23');
  Logger.log(result);
}

// ========================================
// 초기 설정 (최초 1회 실행)
// ========================================
function initialSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 쿠폰관리 시트 생성
  let couponSheet = ss.getSheetByName(SHEET_NAMES.COUPON);
  if (!couponSheet) {
    couponSheet = ss.insertSheet(SHEET_NAMES.COUPON);
    couponSheet.appendRow(['쿠폰코드', '사용가능', '메모', '생성일']);
    couponSheet.appendRow(['WELCOME23', 'TRUE', '공통 추천코드', new Date()]);
    couponSheet.appendRow(['VIP2024', 'TRUE', 'VIP용', new Date()]);
    couponSheet.appendRow(['HOST001', 'TRUE', '호스트 추천', new Date()]);
    couponSheet.appendRow(['SVVY2024', 'TRUE', '특별 초대', new Date()]);
    Logger.log('쿠폰관리 시트 생성 완료');
  }
  
  // 초대장 신청 시트 헤더 확인/수정
  let invSheet = ss.getSheetByName(SHEET_NAMES.INVITATION);
  if (!invSheet) {
    invSheet = ss.insertSheet(SHEET_NAMES.INVITATION);
    invSheet.appendRow([
      '타임스탬프', '전화번호', '선택자격', '선택그룹', '와인보너스',
      '인증방법', 'SNS링크', '파일링크', '쿠폰코드', '호스트명',
      '추천경위', '승인상태', '프립이동일시', '배포처', '메모'
    ]);
    Logger.log('초대장 신청 시트 생성 완료');
  }
  
  SpreadsheetApp.getUi().alert('초기 설정 완료!\n\n- 쿠폰관리 시트 생성\n- 초대장 신청 시트 확인');
}
