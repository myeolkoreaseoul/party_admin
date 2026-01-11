// ========================================
// 뭘 좀 아는 사람들 - 최적화된 플로우 Apps Script
// Tally 의존도 제거 + Google Drive 저장
// ========================================

const SHEET_NAMES = {
  INVITATION: '초대장신청',
  FRIP: '프립예약',
  MASTER: '통합고객관리'
};

const FRIP_URL = 'https://www.frip.co.kr/products/188435';
const DRIVE_FOLDER_NAME = '초대장 인증 자료';

// ========================================
// 웹 앱 엔드포인트
// ========================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    Logger.log('=== doPost 시작 ===');
    Logger.log('Action: ' + action);
    
    if (action === 'recordInvitation') {
      return handleRecordInvitation(data);
    } else if (action === 'uploadFiles') {
      return handleUploadFiles(data);
    } else if (action === 'updateAuthMethod') {
      return handleUpdateAuthMethod(data);
    } else {
      throw new Error('알 수 없는 action: ' + action);
    }
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: '오류가 발생했습니다: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput('Apps Script가 정상 작동 중입니다!')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ========================================
// 1. 초대장 신청 기록
// ========================================
function handleRecordInvitation(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.INVITATION);
  
  // 시트가 없으면 생성
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.INVITATION);
    sheet.appendRow([
      '타임스탬프', '유입경로', '이메일', '전화번호', '연락처타입',
      '선택자격', '배포처', '승인상태', '인증방법', '인증상태',
      '파일링크', '프립이동일시', '메모'
    ]);
  }
  
  const timestamp = new Date();
  const qualifications = data.qualifications.join(', ');
  const userType = data.userType; // 'invitation' or 'general'
  
  // '추천' 포함 시 수동심사
  const needsManualReview = data.qualifications.includes('추천');
  const approvalStatus = userType === 'general' ? '일반참가' : (needsManualReview ? '수동심사' : '1차승인');
  const authStatus = data.authStatus; // 'pending', 'none'
  
  sheet.appendRow([
    timestamp,                     // A: 타임스탬프
    userType,                      // B: 유입경로
    data.email || '',              // C: 이메일
    data.phone || '',              // D: 전화번호
    data.contactType || '',        // E: 연락처타입
    qualifications,                // F: 선택자격
    data.source || 'direct',       // G: 배포처
    approvalStatus,                // H: 승인상태
    '',                            // I: 인증방법 (나중에 업데이트)
    authStatus,                    // J: 인증상태
    '',                            // K: 파일링크
    timestamp,                     // L: 프립이동일시
    ''                             // M: 메모
  ]);
  
  Logger.log('초대장신청 시트에 기록 완료');
  
  // 통합고객관리 업데이트
  통합고객관리업데이트();
  
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: '신청이 완료되었습니다'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// 2. 파일 업로드 (Google Drive)
// ========================================
function handleUploadFiles(data) {
  const contact = data.contact;
  const files = data.files;
  
  Logger.log('파일 업로드 시작: ' + contact);
  Logger.log('파일 개수: ' + files.length);
  
  // Google Drive 폴더 생성 또는 가져오기
  const folder = getOrCreateFolder(DRIVE_FOLDER_NAME);
  
  // 날짜별 하위 폴더
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const dateFolder = getOrCreateSubFolder(folder, today);
  
  // 파일 업로드
  const fileUrls = [];
  
  files.forEach((fileData, index) => {
    try {
      const fileName = contact + '_' + fileData.name;
      const blob = Utilities.newBlob(
        Utilities.base64Decode(fileData.data),
        fileData.type,
        fileName
      );
      
      const file = dateFolder.createFile(blob);
      const fileUrl = file.getUrl();
      fileUrls.push(fileUrl);
      
      Logger.log('파일 업로드 완료: ' + fileName);
    } catch (error) {
      Logger.log('파일 업로드 실패: ' + error.toString());
    }
  });
  
  // Google Sheets 업데이트
  updateFileLinks(contact, fileUrls);
  
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: '파일이 업로드되었습니다',
      fileUrls: fileUrls
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// 3. 인증 방법 업데이트
// ========================================
function handleUpdateAuthMethod(data) {
  const contact = data.contact;
  const authMethod = data.authMethod;
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.INVITATION);
  
  if (!sheet) {
    throw new Error('초대장신청 시트를 찾을 수 없습니다');
  }
  
  // 연락처로 행 찾기
  const data_range = sheet.getDataRange();
  const values = data_range.getValues();
  
  for (let i = 1; i < values.length; i++) {
    const email = values[i][2]; // C열
    const phone = values[i][3]; // D열
    
    if (email === contact || phone === contact) {
      // I열: 인증방법 업데이트
      sheet.getRange(i + 1, 9).setValue(authMethod);
      
      // J열: 인증상태 업데이트
      if (authMethod === 'later') {
        sheet.getRange(i + 1, 10).setValue('대기');
      } else if (authMethod === 'onsite') {
        sheet.getRange(i + 1, 10).setValue('현장');
      }
      
      Logger.log('인증 방법 업데이트 완료: ' + contact + ' → ' + authMethod);
      break;
    }
  }
  
  // 통합고객관리 업데이트
  통합고객관리업데이트();
  
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: '인증 방법이 저장되었습니다'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// Google Drive 폴더 생성/가져오기
// ========================================
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

function getOrCreateSubFolder(parentFolder, subFolderName) {
  const subFolders = parentFolder.getFoldersByName(subFolderName);
  
  if (subFolders.hasNext()) {
    return subFolders.next();
  } else {
    return parentFolder.createFolder(subFolderName);
  }
}

// ========================================
// 파일 링크 업데이트
// ========================================
function updateFileLinks(contact, fileUrls) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.INVITATION);
  
  if (!sheet) return;
  
  const data_range = sheet.getDataRange();
  const values = data_range.getValues();
  
  for (let i = 1; i < values.length; i++) {
    const email = values[i][2];
    const phone = values[i][3];
    
    if (email === contact || phone === contact) {
      // K열: 파일링크
      const fileLinksText = fileUrls.join('\n');
      sheet.getRange(i + 1, 11).setValue(fileLinksText);
      
      // J열: 인증상태 → 완료
      sheet.getRange(i + 1, 10).setValue('완료');
      
      // I열: 인증방법 → now
      sheet.getRange(i + 1, 9).setValue('now');
      
      Logger.log('파일 링크 업데이트 완료: ' + contact);
      break;
    }
  }
  
  // 통합고객관리 업데이트
  통합고객관리업데이트();
}

// ========================================
// 통합고객관리 자동 업데이트
// ========================================
function 통합고객관리업데이트() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const invitationSheet = ss.getSheetByName(SHEET_NAMES.INVITATION);
  const fripSheet = ss.getSheetByName(SHEET_NAMES.FRIP);
  let masterSheet = ss.getSheetByName(SHEET_NAMES.MASTER);
  
  // MASTER 시트가 없으면 생성
  if (!masterSheet) {
    masterSheet = ss.insertSheet(SHEET_NAMES.MASTER);
  }
  
  // 통합 데이터 맵
  const customerMap = {};
  
  // 1) 초대장 신청자 데이터 수집
  if (invitationSheet) {
    const invitationData = invitationSheet.getDataRange().getValues();
    for (let i = 1; i < invitationData.length; i++) {
      const row = invitationData[i];
      const phone = row[3] ? String(row[3]).trim() : '';
      const email = row[2] ? String(row[2]).trim() : '';
      const contact = phone || email;
      
      if (!contact) continue;
      
      customerMap[contact] = {
        source: row[1] || 'invitation',
        name: '',
        contact: contact,
        email: email,
        qualifications: row[5] || '',
        eventDate: '',
        program: '',
        gender: '',
        options: '',
        fripNumber: '',
        approvalStatus: row[7] || '대기',
        authMethod: row[8] || '',
        authStatus: row[9] || '',
        fileLinks: row[10] || '',
        memo: row[12] || ''
      };
    }
  }
  
  // 2) 프립 예약 데이터 수집
  if (fripSheet) {
    const fripData = fripSheet.getDataRange().getValues();
    for (let i = 1; i < fripData.length; i++) {
      const row = fripData[i];
      const phone = row[5] ? String(row[5]).trim() : '';
      
      if (!phone) continue;
      
      if (customerMap[phone]) {
        customerMap[phone].eventDate = row[0] || '';
        customerMap[phone].program = row[1] || '';
        customerMap[phone].gender = row[2] || '';
        customerMap[phone].options = row[3] || '';
        customerMap[phone].name = customerMap[phone].name || row[4] || '';
        customerMap[phone].fripNumber = row[6] || '';
      } else {
        customerMap[phone] = {
          source: 'organic',
          name: row[4] || '',
          contact: phone,
          email: '',
          qualifications: '',
          eventDate: row[0] || '',
          program: row[1] || '',
          gender: row[2] || '',
          options: row[3] || '',
          fripNumber: row[6] || '',
          approvalStatus: '일반참가',
          authMethod: '',
          authStatus: '',
          fileLinks: '',
          memo: '사전조사 미완료'
        };
      }
    }
  }
  
  // 3) 통합고객관리 시트 업데이트
  masterSheet.clear();
  masterSheet.appendRow([
    'ID', '유입경로', '크루명', '연락처', '이메일', '선택자격',
    '진행일시', '프로그램', '성별', '옵션상세', '프립예약번호',
    '승인상태', '인증방법', '인증상태', '파일링크', '메모'
  ]);
  
  let id = 1;
  Object.values(customerMap).forEach(customer => {
    masterSheet.appendRow([
      id++,
      customer.source,
      customer.name,
      customer.contact,
      customer.email,
      customer.qualifications,
      customer.eventDate,
      customer.program,
      customer.gender,
      customer.options,
      customer.fripNumber,
      customer.approvalStatus,
      customer.authMethod,
      customer.authStatus,
      customer.fileLinks,
      customer.memo
    ]);
  });
  
  Logger.log('통합고객관리 업데이트 완료: ' + (id - 1) + '명');
}

// ========================================
// 테스트용 함수
// ========================================
function 테스트_통합업데이트() {
  통합고객관리업데이트();
  SpreadsheetApp.getUi().alert('통합고객관리가 업데이트되었습니다!');
}
