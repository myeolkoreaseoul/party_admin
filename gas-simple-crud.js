// ========================================
// 뭘 좀 아는 사람들 - GAS v6 (단순 CRUD)
// 비즈니스 로직은 admin.html에서 처리
// ========================================

const SPREADSHEET_ID = '1dZGU-x2xNgFSGyv_esL95AZ5A20EtWbwgHCpLjFYtiU';
const DRIVE_FOLDER_NAME = '뭘좀아는사람들_인증자료';

// ========================================
// doGet - 읽기 전용 요청
// ========================================
function doGet(e) {
  var action = e.parameter.action || 'read';
  
  try {
    // === 시트 데이터 읽기 ===
    if (action === 'read') {
      var sheetName = e.parameter.sheet;
      if (!sheetName) {
        return jsonResponse(false, 'sheet 파라미터가 필요합니다');
      }
      return readSheet(sheetName);
    }
    
    // === 쿠폰 검증 ===
    if (action === 'verifyCoupon') {
      var code = (e.parameter.code || '').toUpperCase().trim();
      return verifyCoupon(code);
    }
    
    // === Tasker용: 프립 예약/취소 ===
    if (action === 'fripReservation') {
      var message = decodeURIComponent(e.parameter.message || '');
      return handleFripReservation(message);
    }
    
    // === Tasker용: 사전조사 미작성자 ===
    if (action === 'getUnsurveyed') {
      return getUnsurveyed();
    }
    
    // === Tasker용: 설문 완료자 ===
    if (action === 'getNewSurveyCompleted') {
      return getNewSurveyCompleted();
    }
    
    // === Tasker용: 프립 미예약자 ===
    if (action === 'getUnreserved') {
      return getUnreserved();
    }
    
    // === 웹사이트용: 라인업 JSON ===
    if (action === 'getLineup') {
      return getLineupForWebsite();
    }
    
    // === 기본: 모든 시트 목록 ===
    return getSheetList();
    
  } catch (error) {
    return jsonResponse(false, '오류: ' + error.toString());
  }
}

// ========================================
// doPost - 쓰기/수정/삭제 요청
// ========================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    // === 행 추가 ===
    if (action === 'write') {
      return writeRow(data.sheet, data.row);
    }
    
    // === 행 수정 ===
    if (action === 'update') {
      return updateRow(data.sheet, data.rowIndex, data.row);
    }
    
    // === 행 삭제 ===
    if (action === 'delete') {
      return deleteRow(data.sheet, data.rowIndex);
    }
    
    // === 다중 행 추가 ===
    if (action === 'writeMultiple') {
      return writeMultipleRows(data.sheet, data.rows);
    }
    
    // === 다중 행 수정 ===
    if (action === 'updateMultiple') {
      return updateMultipleRows(data.sheet, data.updates);
    }
    
    // === 초대장 신청 (웹사이트용, 기존 유지) ===
    if (action === 'verification') {
      return handleVerification(data);
    }
    
    // === 프립 예약/취소 (Tasker용) ===
    if (action === 'fripReservation') {
      return handleFripReservation(data.message || '');
    }
    
    // === 쿠폰 검증 ===
    if (action === 'verifyCoupon') {
      var code = (data.code || '').toUpperCase().trim();
      return verifyCoupon(code);
    }
    
    return jsonResponse(false, '알 수 없는 action: ' + action);
    
  } catch (error) {
    return jsonResponse(false, '오류: ' + error.toString());
  }
}


// ========================================
// CRUD 함수들
// ========================================

// 시트 목록 반환
function getSheetList() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheets = ss.getSheets();
  var names = sheets.map(function(s) { return s.getName(); });
  return jsonResponse(true, '시트 목록', { sheets: names });
}

// 시트 데이터 읽기
function readSheet(sheetName) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return jsonResponse(false, '시트를 찾을 수 없습니다: ' + sheetName);
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = { _rowIndex: i + 1 }; // 실제 시트 행 번호 (1-based)
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  
  return jsonResponse(true, '데이터 조회 완료', {
    sheet: sheetName,
    headers: headers,
    rows: rows,
    totalRows: rows.length
  });
}

// 행 추가
function writeRow(sheetName, rowData) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return jsonResponse(false, '시트를 찾을 수 없습니다: ' + sheetName);
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newRow = headers.map(function(h) { return rowData[h] || ''; });
  
  sheet.appendRow(newRow);
  var newRowIndex = sheet.getLastRow();
  
  return jsonResponse(true, '행 추가 완료', { rowIndex: newRowIndex });
}

// 행 수정
function updateRow(sheetName, rowIndex, rowData) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return jsonResponse(false, '시트를 찾을 수 없습니다: ' + sheetName);
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var updatedRow = headers.map(function(h) { return rowData[h] !== undefined ? rowData[h] : ''; });
  
  sheet.getRange(rowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);
  
  return jsonResponse(true, '행 수정 완료', { rowIndex: rowIndex });
}

// 행 삭제
function deleteRow(sheetName, rowIndex) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return jsonResponse(false, '시트를 찾을 수 없습니다: ' + sheetName);
  }
  
  sheet.deleteRow(rowIndex);
  
  return jsonResponse(true, '행 삭제 완료', { rowIndex: rowIndex });
}

// 다중 행 추가
function writeMultipleRows(sheetName, rows) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return jsonResponse(false, '시트를 찾을 수 없습니다: ' + sheetName);
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newRows = rows.map(function(rowData) {
    return headers.map(function(h) { return rowData[h] || ''; });
  });
  
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
  
  return jsonResponse(true, newRows.length + '개 행 추가 완료', { startRow: startRow });
}

// 다중 행 수정
function updateMultipleRows(sheetName, updates) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return jsonResponse(false, '시트를 찾을 수 없습니다: ' + sheetName);
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  updates.forEach(function(update) {
    var rowIndex = update.rowIndex;
    var rowData = update.row;
    var updatedRow = headers.map(function(h) { return rowData[h] !== undefined ? rowData[h] : ''; });
    sheet.getRange(rowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);
  });
  
  return jsonResponse(true, updates.length + '개 행 수정 완료');
}


// ========================================
// 쿠폰 검증
// ========================================
function verifyCoupon(code) {
  if (!code) {
    return jsonResponse(false, '쿠폰 코드를 입력해주세요');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('쿠폰관리');
  
  if (!sheet) {
    return jsonResponse(false, '쿠폰관리 시트가 없습니다');
  }
  
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    var couponCode = String(data[i][0]).toUpperCase().trim();
    var isActive = String(data[i][1]).toUpperCase() === 'TRUE';
    
    if (couponCode === code) {
      if (isActive) {
        return jsonResponse(true, '유효한 쿠폰입니다');
      } else {
        return jsonResponse(false, '만료된 쿠폰입니다');
      }
    }
  }
  
  return jsonResponse(false, '유효하지 않은 쿠폰 코드입니다');
}


// ========================================
// Tasker용: 프립 예약/취소 처리
// ========================================
function handleFripReservation(message) {
  if (!message) {
    return jsonResponse(false, '메시지가 없습니다');
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  if (message.indexOf('프립 판매 안내') > -1) {
    return handleNewReservation(ss, message);
  } else if (message.indexOf('프립 결제 취소 안내') > -1) {
    return handleCancelReservation(ss, message);
  } else if (message.indexOf('프립 판매 중지 안내') > -1) {
    return jsonResponse(true, '판매 중지 안내는 처리하지 않습니다');
  } else if (message.indexOf('1:1문의 등록') > -1) {
    return jsonResponse(true, '1:1 문의는 처리하지 않습니다');
  }
  
  return jsonResponse(false, '알 수 없는 메시지 유형');
}

// 신규 예약 처리
function handleNewReservation(ss, message) {
  var sheet = ss.getSheetByName('프립예약');
  
  if (!sheet) {
    sheet = ss.insertSheet('프립예약');
    sheet.appendRow(['진행일시', '옵션', '크루명', '크루연락처', '예약번호', '등록일시', '상태']);
  }
  
  var eventDate = extractBetween(message, '- 진행일시:', '- 옵션:');
  var option = extractBetween(message, '- 옵션:', '- 수량:');
  var crewName = extractBetween(message, '- 크루:', '- 크루 연락처:');
  var crewPhone = extractBetween(message, '- 크루 연락처:', '- 신청 마감');
  crewPhone = formatPhone(crewPhone);
  var reservationId = extractValue(message, 'detail/(\\d+)');
  
  sheet.appendRow([
    eventDate.trim(),
    option.trim(),
    crewName.trim(),
    crewPhone.trim(),
    reservationId,
    new Date(),
    '예약완료'
  ]);
  
  return jsonResponse(true, '신규 예약 기록 완료', {
    crewName: crewName.trim(),
    crewPhone: crewPhone.trim()
  });
}

// 예약 취소 처리
function handleCancelReservation(ss, message) {
  var sheet = ss.getSheetByName('프립예약');
  
  if (!sheet) {
    return jsonResponse(false, '프립예약 시트가 없습니다');
  }
  
  var reservationId = extractValue(message, 'detail/(\\d+)');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][4]) === reservationId) {
      sheet.getRange(i + 1, 7).setValue('취소됨');
      return jsonResponse(true, '예약 취소 처리 완료', { reservationId: reservationId });
    }
  }
  
  return jsonResponse(false, '해당 예약을 찾지 못했습니다');
}


// ========================================
// Tasker용: 사전조사 미작성자
// ========================================
function getUnsurveyed() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var fripSheet = ss.getSheetByName('프립예약');
  var surveySheet = ss.getSheetByName('사전조사');
  
  if (!fripSheet || !surveySheet) {
    return jsonResponse(true, '', { count: 0 });
  }
  
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  
  var fripData = fripSheet.getDataRange().getValues();
  var surveyData = surveySheet.getDataRange().getValues();
  
  // 사전조사 완료한 전화번호 목록
  var surveyedPhones = [];
  for (var j = 1; j < surveyData.length; j++) {
    surveyedPhones.push(normalizePhone(surveyData[j][7]));
  }
  
  // 미작성자 찾기
  for (var i = 1; i < fripData.length; i++) {
    var status = fripData[i][6];
    if (status !== '예약완료') continue;
    
    var eventDate = parseEventDate(fripData[i][0]);
    if (!eventDate || eventDate < today) continue;
    
    var phone = normalizePhone(fripData[i][3]);
    if (surveyedPhones.indexOf(phone) === -1) {
      return jsonResponse(true, '', {
        name: fripData[i][2],
        phone: '0' + phone,
        count: 1
      });
    }
  }
  
  return jsonResponse(true, '', { count: 0 });
}


// ========================================
// Tasker용: 설문 완료자
// ========================================
function getNewSurveyCompleted() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var surveySheet = ss.getSheetByName('사전조사');
  var fripSheet = ss.getSheetByName('프립예약');
  
  if (!surveySheet || !fripSheet) {
    return jsonResponse(true, '', { count: 0 });
  }
  
  var surveyData = surveySheet.getDataRange().getValues();
  var headers = surveyData[0];
  
  var sentColIndex = headers.indexOf('완료문자발송');
  if (sentColIndex === -1) {
    sentColIndex = headers.length;
    surveySheet.getRange(1, sentColIndex + 1).setValue('완료문자발송');
  }
  
  // 프립예약 데이터
  var fripData = fripSheet.getDataRange().getValues();
  var phoneToEvent = {};
  for (var f = 1; f < fripData.length; f++) {
    var phone = normalizePhone(fripData[f][3]);
    if (phone && !phoneToEvent[phone]) {
      phoneToEvent[phone] = {
        eventDate: fripData[f][0],
        option: fripData[f][1]
      };
    }
  }
  
  // 문자 안 보낸 사람 찾기
  for (var i = 1; i < surveyData.length; i++) {
    var sent = surveyData[i][sentColIndex];
    if (sent !== 'Y') {
      var phone = normalizePhone(surveyData[i][7]);
      var eventInfo = phoneToEvent[phone] || {};
      
      surveySheet.getRange(i + 1, sentColIndex + 1).setValue('Y');
      
      return jsonResponse(true, '', {
        phone: '0' + phone,
        eventDate: eventInfo.eventDate || '',
        option: eventInfo.option || '',
        count: 1
      });
    }
  }
  
  return jsonResponse(true, '', { count: 0 });
}


// ========================================
// Tasker용: 프립 미예약자
// ========================================
function getUnreserved() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var invSheet = ss.getSheetByName('초대장 신청');
  var fripSheet = ss.getSheetByName('프립예약');
  
  if (!invSheet || !fripSheet) {
    return jsonResponse(true, '', { count: 0 });
  }
  
  var invData = invSheet.getDataRange().getValues();
  var headers = invData[0];
  
  var sentColIndex = headers.indexOf('예약독촉발송');
  if (sentColIndex === -1) {
    sentColIndex = headers.length;
    invSheet.getRange(1, sentColIndex + 1).setValue('예약독촉발송');
  }
  
  // 프립예약 전화번호 목록
  var fripData = fripSheet.getDataRange().getValues();
  var reservedPhones = [];
  for (var f = 1; f < fripData.length; f++) {
    reservedPhones.push(normalizePhone(fripData[f][3]));
  }
  
  var now = new Date();
  var tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  
  for (var i = 1; i < invData.length; i++) {
    if (invData[i][sentColIndex] === 'Y') continue;
    
    var timestamp = invData[i][0];
    var phone = normalizePhone(invData[i][0]); // 첫 번째 컬럼이 전화번호
    
    if (!phone) continue;
    
    var applyTime = new Date(timestamp);
    if (applyTime > tenMinutesAgo) continue;
    
    if (reservedPhones.indexOf(phone) === -1) {
      invSheet.getRange(i + 1, sentColIndex + 1).setValue('Y');
      
      return jsonResponse(true, '', {
        phone: '0' + phone,
        count: 1
      });
    }
  }
  
  return jsonResponse(true, '', { count: 0 });
}


// ========================================
// 웹사이트용: 라인업 JSON (단순화)
// ========================================
function getLineupForWebsite() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var lineupSheet = ss.getSheetByName('파티별라인업');
  
  if (!lineupSheet) {
    return jsonResponse(true, '라인업 데이터', { parties: [] });
  }
  
  var data = lineupSheet.getDataRange().getValues();
  var headers = data[0];
  
  // 열 인덱스
  var cols = {};
  headers.forEach(function(h, idx) { cols[h] = idx; });
  
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  
  var parties = {};
  
  for (var i = 1; i < data.length; i++) {
    var dateVal = data[i][cols['날짜']];
    var partyName = data[i][cols['파티']];
    var time = data[i][cols['시간']];
    var gender = data[i][cols['성별']];
    var birthYear = data[i][cols['출생연도']];
    var height = data[i][cols['키']];
    var job = data[i][cols['직업']];
    var status = data[i][cols['상태']];
    
    // 날짜 파싱
    var partyDate;
    if (dateVal instanceof Date) {
      partyDate = new Date(dateVal);
    } else {
      continue;
    }
    
    if (partyDate < today) continue;
    
    var m = partyDate.getMonth() + 1;
    var d = partyDate.getDate();
    var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    var dayName = dayNames[partyDate.getDay()];
    var dateStr = m + '/' + d + ' ' + dayName;
    
    var key = dateStr + '|' + partyName;
    
    if (!parties[key]) {
      parties[key] = {
        date: dateStr,
        party: partyName,
        time: time,
        male: { total: 0, filled: 0, members: [] },
        female: { total: 0, filled: 0, members: [] }
      };
    }
    
    var genderKey = gender === '남자' ? 'male' : 'female';
    parties[key][genderKey].total++;
    
    if (status === '예약완료') {
      parties[key][genderKey].filled++;
      parties[key][genderKey].members.push({
        ageGroup: getAgeGroup(birthYear),
        height: height,
        job: job
      });
    }
  }
  
  // 배열로 변환
  var result = Object.values(parties);
  
  // 날짜순 정렬
  result.sort(function(a, b) {
    var matchA = a.date.match(/(\d+)\/(\d+)/);
    var matchB = b.date.match(/(\d+)\/(\d+)/);
    if (matchA && matchB) {
      if (parseInt(matchA[1]) !== parseInt(matchB[1])) {
        return parseInt(matchA[1]) - parseInt(matchB[1]);
      }
      return parseInt(matchA[2]) - parseInt(matchB[2]);
    }
    return 0;
  });
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}


// ========================================
// 초대장 신청 처리 (웹사이트용, 기존 유지)
// ========================================
function handleVerification(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('초대장 신청');
  
  if (!sheet) {
    sheet = ss.insertSheet('초대장 신청');
    sheet.appendRow([
      '전화번호', '선택자격', '선택그룹', '와인보너스',
      '인증방법', 'SNS링크', '파일링크', '쿠폰코드', '호스트명',
      '추천경위', '승인상태', '프립이동일시', '배포처', '메모', '예약독촉발송'
    ]);
  }
  
  var phone = data.phone || '';
  var qualifications = Array.isArray(data.qualifications) ? data.qualifications.join(', ') : String(data.qualifications || '');
  var groups = Array.isArray(data.groups) ? data.groups.join(', ') : String(data.groups || '');
  var wineBonus = data.wineBonus === 'true' || data.wineBonus === true;
  var authType = data.authType || '';
  var snsLink = (data.additionalData && data.additionalData.snsLink) || '';
  var couponCode = (data.additionalData && data.additionalData.couponCode) || '';
  var hostName = (data.additionalData && data.additionalData.hostName) || '';
  var referralReason = (data.additionalData && data.additionalData.referralReason) || '';
  var source = data.source || 'direct';
  
  // 파일 업로드
  var fileLinks = '';
  if (data.files && data.files.length > 0) {
    try {
      var uploadedLinks = saveFilesToDrive(phone, data.files);
      fileLinks = uploadedLinks.join('\n');
    } catch (e) {
      Logger.log('파일 업로드 오류: ' + e.toString());
    }
  }
  
  // 승인 상태
  var approvalStatus = '인증대기';
  if (authType === 'coupon') approvalStatus = '쿠폰승인';
  else if (authType === 'host_referral') approvalStatus = '승인완료';
  else if (authType === 'upload' && fileLinks) approvalStatus = '서류제출완료';
  else if (authType === 'onsite') approvalStatus = '현장인증예정';
  
  sheet.appendRow([
    phone,
    qualifications,
    groups,
    wineBonus ? 'Y' : 'N',
    authType,
    snsLink,
    fileLinks,
    couponCode,
    hostName,
    referralReason,
    approvalStatus,
    new Date(),
    source,
    '',
    ''
  ]);
  
  return jsonResponse(true, '신청이 완료되었습니다', {
    approvalStatus: approvalStatus,
    wineBonus: wineBonus
  });
}


// ========================================
// Google Drive 파일 저장
// ========================================
function saveFilesToDrive(phone, files) {
  var fileUrls = [];
  if (!files || files.length === 0) return fileUrls;
  
  var mainFolder = getOrCreateFolder(DRIVE_FOLDER_NAME);
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var dateFolder = getOrCreateSubFolder(mainFolder, today);
  var phoneFolder = getOrCreateSubFolder(dateFolder, phone);
  
  for (var i = 0; i < files.length; i++) {
    try {
      var fileData = files[i];
      var timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'HHmmss');
      var fileName = phone + '_' + timestamp + '_' + (i + 1) + '_' + fileData.name;
      
      var decoded = Utilities.base64Decode(fileData.data);
      var blob = Utilities.newBlob(decoded, fileData.type, fileName);
      var file = phoneFolder.createFile(blob);
      fileUrls.push(file.getUrl());
    } catch (e) {
      Logger.log('파일 저장 오류: ' + e.toString());
    }
  }
  
  return fileUrls;
}

function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

function getOrCreateSubFolder(parent, name) {
  var folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}


// ========================================
// 유틸리티 함수들
// ========================================

function jsonResponse(success, message, data) {
  var response = { success: success, message: message };
  if (data) {
    for (var key in data) {
      response[key] = data[key];
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatPhone(phone) {
  var numbers = String(phone).replace(/[^0-9]/g, '');
  if (numbers.length === 10 && numbers.charAt(0) !== '0') {
    numbers = '0' + numbers;
  }
  if (numbers.length === 11) {
    return numbers.substring(0, 3) + '-' + numbers.substring(3, 7) + '-' + numbers.substring(7);
  }
  return numbers;
}

function normalizePhone(phone) {
  var numbers = String(phone).replace(/[^0-9]/g, '');
  if (numbers.indexOf('82') === 0) {
    numbers = numbers.substring(2);
  }
  return numbers.length >= 10 ? numbers.slice(-10) : numbers;
}

function extractBetween(text, start, end) {
  var startIdx = text.indexOf(start);
  if (startIdx === -1) return '';
  startIdx += start.length;
  
  var endIdx = text.indexOf(end, startIdx);
  if (endIdx === -1) {
    endIdx = text.indexOf('\n', startIdx);
    if (endIdx === -1) endIdx = text.length;
  }
  
  return text.substring(startIdx, endIdx).trim();
}

function extractValue(text, pattern) {
  var regex = new RegExp(pattern);
  var match = text.match(regex);
  return match && match[1] ? match[1].trim() : '';
}

function parseEventDate(dateStr) {
  if (!dateStr) return null;
  var match = String(dateStr).match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }
  return null;
}

function getAgeGroup(birthYear) {
  if (!birthYear) return '';
  var age = new Date().getFullYear() - birthYear + 1;
  
  if (age >= 20 && age <= 24) return '20대 초반';
  if (age >= 25 && age <= 27) return '20대 중반';
  if (age >= 28 && age <= 29) return '20대 후반';
  if (age >= 30 && age <= 34) return '30대 초반';
  if (age >= 35 && age <= 37) return '30대 중반';
  if (age >= 38 && age <= 39) return '30대 후반';
  if (age >= 40 && age <= 44) return '40대 초반';
  if (age >= 45 && age <= 47) return '40대 중반';
  if (age >= 48 && age <= 49) return '40대 후반';
  if (age >= 50) return '50대';
  
  return '';
}
