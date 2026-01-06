/**
 * 뭘 좀 아는 사람들 - 문자 발송 GAS (v3)
 * 
 * 기능:
 * - Tasker → GAS → DB 저장 → 솔라피 문자 발송
 * - 판매 알림: 예약 추가, 사전조사 문자 발송
 * - 같은 날 추가 예약: 추가 예약 안내 문자 발송
 * - 취소 알림: 진행일시 + 크루명으로 검색 후 삭제
 * - 미확인 패턴: 로그 저장
 */

// ===== 설정 =====
const SOLAPI_API_KEY = 'NCSQ5HS2GW70JNEP';
const SOLAPI_API_SECRET = '2FOI1GOGLN0E8JIFIFBQOMCDGQV6D3WK';
const SOLAPI_SENDER = '01046843327';
const PROJECT_API_BASE = 'https://invite.svvys.com/tables';

// ===== 메인 엔트리 포인트 =====

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const message = data.message || '';
    
    if (action === 'fripNotify') {
      return handleFripNotify(message);
    }
    
    if (action === 'fripSale') {
      return handleFripSale(message);
    }
    
    if (action === 'fripCancel') {
      return handleFripCancel(message);
    }
    
    if (action === 'sendSms') {
      const result = sendSmsViaSolapi(data.to, data.message);
      return jsonResponse(result);
    }
    
    // 설문조사 백업
    if (action === 'backupSurvey') {
      backupSurvey(data.survey);
      return jsonResponse({ success: true });
    }
    
    // 초대장 백업
    if (action === 'backupInvitation') {
      backupInvitation(data.invitation);
      return jsonResponse({ success: true });
    }
    
    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'fripNotify') {
    let message = e.parameter.message || '';
    try {
      message = decodeURIComponent(message);
    } catch(err) {}
    return handleFripNotify(message);
  }
  
  if (action === 'testSms') {
    const to = e.parameter.to;
    const message = e.parameter.message || '테스트 문자입니다.';
    const result = sendSmsViaSolapi(to, message);
    return jsonResponse(result);
  }
  
  if (action === 'status') {
    return jsonResponse({ 
      success: true, 
      message: 'GAS SMS Sender is running',
      version: '3.1',
      features: ['fripNotify', 'fripSale', 'fripCancel', 'sendSms', 'testSms', 'restore']
    });
  }
  
  if (action === 'restore') {
    const results = restoreFromBackup();
    return jsonResponse({
      success: true,
      message: '백업에서 복구 완료',
      restored: results
    });
  }
  
  return jsonResponse({ success: true, message: 'GAS SMS Sender v3.1' });
}

// ===== 통합 알림 처리 =====

function handleFripNotify(message) {
  if (message.includes('프립 판매 안내') || message.includes('새로운 프립 판매')) {
    return handleFripSale(message);
  }
  
  if (message.includes('결제 취소') || message.includes('취소 안내') || message.includes('환불')) {
    return handleFripCancel(message);
  }
  
  saveUnknownLog(message);
  return jsonResponse({ 
    success: true, 
    action: 'logged',
    message: '미확인 패턴 - 로그 저장됨'
  });
}

// ===== 판매 알림 처리 =====

function handleFripSale(message) {
  try {
    // 1. 메시지 파싱
    const parsed = parseFripSaleMessage(message);
    if (!parsed.phone) {
      return jsonResponse({ success: false, error: '전화번호 파싱 실패' });
    }

    // 2. ⚠️ 중복 체크: 같은 전화번호 + 같은 진행일시 예약이 이미 있는지 확인
    const existingReservations = searchReservationsByPhoneAndDate(parsed.phone, parsed.eventDate);
    if (existingReservations.length > 0) {
      return jsonResponse({
        success: true,
        action: 'sale',
        type: 'duplicate',
        message: '이미 동일한 예약이 존재합니다',
        existingId: existingReservations[0].id,
        parsed: parsed,
        smsSent: false
      });
    }

    // 3. 예약 생성
    const reservationId = 'RES-' + Date.now();
    const reservation = {
      id: reservationId,
      phone: parsed.phone,
      crewName: parsed.crewName,
      eventDate: parsed.eventDate,
      eventPart: getEventPart(parsed.eventDate),
      option: parsed.option,
      isInvitation: parsed.option.includes('인비테이션'),
      status: '예약완료'
    };

    // 4. DB 저장
    saveToProjectDB('reservations', reservation);
    
    // 3-1. 스프레드시트 백업
    backupReservation(reservation);
    
    // 4. 고객 정보 확인/생성
    ensureCustomerExists(parsed.phone, parsed.crewName);
    
    // 4-1. 고객 백업
    backupCustomer(parsed.phone, parsed.crewName);
    
    // 5. 같은 날 예약 체크
    if (checkSmsSent(parsed.phone, parsed.eventDate, 'survey')) {
      // 같은 날 이미 예약 있음 → "추가 예약" 문자 발송
      const smsContent = makeAdditionalReservationSms();
      const smsResult = sendSmsViaSolapi(parsed.phone, smsContent);
      
      return jsonResponse({ 
        success: true, 
        action: 'sale',
        type: 'additional',
        parsed: parsed,
        reservation: reservation,
        smsSent: smsResult.success
      });
    }
    
    // 6. 첫 예약 → 사전조사 문자 발송
    const smsContent = makeSurveyRequestSms(parsed.eventDate);
    const smsResult = sendSmsViaSolapi(parsed.phone, smsContent);
    
    if (smsResult.success) {
      saveSmsLog(parsed.phone, parsed.eventDate, 'survey');
    }
    
    return jsonResponse({ 
      success: true, 
      action: 'sale',
      type: 'first',
      parsed: parsed,
      reservation: reservation,
      smsSent: smsResult.success,
      smsResult: smsResult
    });
  } catch (error) {
    return jsonResponse({ success: false, action: 'sale', error: error.message });
  }
}

// ===== 취소 알림 처리 =====

function handleFripCancel(message) {
  try {
    const parsed = parseFripCancelMessage(message);
    
    if (!parsed.crewName || !parsed.eventDate) {
      saveCancelLog(message, parsed, '파싱 실패');
      return jsonResponse({ 
        success: true, 
        action: 'cancel',
        parsed: parsed,
        deleted: false,
        reason: '크루명 또는 진행일시 파싱 실패'
      });
    }
    
    const reservations = searchReservations(parsed.crewName, parsed.eventDate);
    
    if (reservations.length === 0) {
      saveCancelLog(message, parsed, '예약 없음');
      return jsonResponse({ 
        success: true, 
        action: 'cancel',
        parsed: parsed,
        deleted: false,
        reason: '해당 예약 없음'
      });
    }
    
    const deletedIds = [];
    for (const res of reservations) {
      const updateResult = updateReservationStatus(res.id, '취소');
      if (updateResult) {
        deletedIds.push(res.id);
      }
    }
    
    saveCancelLog(message, parsed, '삭제 완료', deletedIds);
    
    return jsonResponse({ 
      success: true, 
      action: 'cancel',
      parsed: parsed,
      deleted: true,
      deletedIds: deletedIds,
      count: deletedIds.length
    });
  } catch (error) {
    return jsonResponse({ success: false, action: 'cancel', error: error.message });
  }
}

// ===== 파싱 함수 =====

function parseFripSaleMessage(message) {
  const result = {
    eventDate: '',
    option: '',
    crewName: '',
    phone: ''
  };
  
  const dateMatch = message.match(/진행일시[:\s]*([^\n-]+)/);
  if (dateMatch) {
    result.eventDate = dateMatch[1].trim();
  }
  
  const optionMatch = message.match(/옵션[:\s]*([^\n-]+)/);
  if (optionMatch) {
    result.option = optionMatch[1].trim();
  }
  
  const crewMatch = message.match(/크루[:\s]*([^\n-]+)/);
  if (crewMatch) {
    result.crewName = crewMatch[1].trim();
  }
  
  const phoneMatch = message.match(/연락처[:\s]*([\d\-]+)/);
  if (phoneMatch) {
    result.phone = normalizePhone(phoneMatch[1]);
  }
  
  return result;
}

function parseFripCancelMessage(message) {
  const result = {
    eventDate: '',
    option: '',
    crewName: '',
    quantity: ''
  };
  
  const dateMatch = message.match(/진행일시[:\s]*([^\n]+)/);
  if (dateMatch) {
    result.eventDate = dateMatch[1].trim();
  }
  
  const optionMatch = message.match(/옵션[:\s]*([^\n]+)/);
  if (optionMatch) {
    result.option = optionMatch[1].trim();
  }
  
  const crewMatch = message.match(/크루[:\s]*([^\n]+)/);
  if (crewMatch) {
    result.crewName = crewMatch[1].trim();
  }
  
  const qtyMatch = message.match(/취소\s*수량[:\s]*(\d+)/);
  if (qtyMatch) {
    result.quantity = qtyMatch[1];
  }
  
  return result;
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 11 && digits.startsWith('010')) {
    return digits.substring(0, 3) + '-' + digits.substring(3, 7) + '-' + digits.substring(7);
  }
  
  return phone;
}

function getEventPart(eventDate) {
  if (eventDate.includes('12시') || eventDate.includes('12:00')) return '1부';
  if (eventDate.includes('15시') || eventDate.includes('15:00')) return '2부';
  if (eventDate.includes('19시') || eventDate.includes('19:00')) return '3부';
  return '';
}

// ===== 문자 내용 생성 =====

function makeSurveyRequestSms(eventDate) {
  return `안녕하세요! 뭘 좀 아는 사람들입니다 ☕🍷
모임 참가 전, 간단한 사전 확인을 진행하고 있어요!
📝 아래 순서대로 진행 부탁드려요

1️⃣ 신청서 작성
👉 https://svvys.com/survey
※ 재참여의 경우에도 작성 필요

2️⃣ 작성 완료 후 이 번호로 문자 주세요!
→ 상세 장소 및 안내사항 전달드릴게요

⚠️ 꼭 확인해주세요!
- 검증된 분들만 참여 가능한 모임이라, 모임 전날 상세 주소를 별도 안내드려요 (프립 주소 X)
- 신청서 미작성 시 참가가 제한될 수 있어요
좋은 분들과 즐거운 시간 보내실 수 있도록 준비하겠습니다! 😊

※ 이 번호는 발신전용입니다.
문의: 프립정책상 문의는 질문/답변 게시판 이용바랍니다.`;
}

function makeAdditionalReservationSms() {
  return `안녕하세요! 뭘 좀 아는 사람들입니다 ☕🍷
추가 예약이 확인되었습니다!

당일 이미 제출하신 사전조사로 인정되니,
추가 작성은 필요 없어요 😊

※ 이 번호는 발신전용입니다.
문의: 프립정책상 문의는 질문/답변 게시판 이용바랍니다.`;
}

// ===== 솔라피 문자 발송 =====

function sendSmsViaSolapi(to, text) {
  try {
    const cleanTo = to.replace(/\D/g, '');
    const auth = generateSolapiAuth();
    
    const payload = {
      message: {
        to: cleanTo,
        from: SOLAPI_SENDER.replace(/\D/g, ''),
        text: text
      }
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': auth
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send', options);
    const result = JSON.parse(response.getContentText());
    
    if (result.groupInfo || result.messageId) {
      return { 
        success: true, 
        message: 'SMS 발송 완료',
        result: result
      };
    } else {
      return { 
        success: false, 
        message: '문자 발송 실패',
        error: result.errorCode || 'Unknown',
        errorMessage: result.errorMessage || JSON.stringify(result)
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function generateSolapiAuth() {
  const date = new Date().toISOString();
  const salt = generateRandomString(32);
  const signature = computeHmacSignature(date + salt, SOLAPI_API_SECRET);
  
  return `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function computeHmacSignature(message, secret) {
  const signature = Utilities.computeHmacSha256Signature(message, secret);
  return byteArrayToHex(signature);
}

function byteArrayToHex(byteArray) {
  return byteArray.map(function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

// ===== 프로젝트 DB API =====

function saveToProjectDB(table, data) {
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(`${PROJECT_API_BASE}/${table}`, options);
    return JSON.parse(response.getContentText());
  } catch (error) {
    console.error('DB 저장 오류:', error);
    return null;
  }
}

function ensureCustomerExists(phone, crewName) {
  try {
    const response = UrlFetchApp.fetch(`${PROJECT_API_BASE}/customers?search=${encodeURIComponent(phone)}`, {
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText());
    
    if (!result.data || result.data.length === 0) {
      saveToProjectDB('customers', {
        id: phone,
        name: crewName,
        source: 'organic'
      });
    }
  } catch (error) {
    console.error('고객 확인 오류:', error);
  }
}

function searchReservations(crewName, eventDate) {
  try {
    const response = UrlFetchApp.fetch(`${PROJECT_API_BASE}/reservations?search=${encodeURIComponent(crewName)}&limit=100`, {
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText());

    if (!result.data || result.data.length === 0) {
      return [];
    }

    const normalizedEventDate = normalizeEventDate(eventDate);

    return result.data.filter(res => {
      const resDate = normalizeEventDate(res.eventDate);
      return res.crewName === crewName && resDate === normalizedEventDate;
    });
  } catch (error) {
    console.error('예약 검색 오류:', error);
    return [];
  }
}

// ⚠️ 중복 체크용: 전화번호 + 진행일시로 예약 검색
function searchReservationsByPhoneAndDate(phone, eventDate) {
  try {
    const normalizedPhone = normalizePhone(phone);
    const response = UrlFetchApp.fetch(`${PROJECT_API_BASE}/reservations?limit=200`, {
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText());

    if (!result.data || result.data.length === 0) {
      return [];
    }

    const normalizedEventDate = normalizeEventDate(eventDate);

    return result.data.filter(res => {
      const resPhone = normalizePhone(res.phone);
      const resDate = normalizeEventDate(res.eventDate);
      return resPhone === normalizedPhone && resDate === normalizedEventDate && res.status !== '취소';
    });
  } catch (error) {
    console.error('예약 검색(전화번호) 오류:', error);
    return [];
  }
}

function normalizeEventDate(dateStr) {
  const numbers = dateStr.replace(/\D/g, '');
  return numbers.substring(0, 12);
}

function updateReservationStatus(reservationId, status) {
  try {
    const options = {
      method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify({
        id: reservationId,
        status: status
      }),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(`${PROJECT_API_BASE}/reservations/${reservationId}`, options);
    const result = JSON.parse(response.getContentText());
    return result.id === reservationId;
  } catch (error) {
    console.error('예약 상태 업데이트 오류:', error);
    return false;
  }
}

// ===== 로그 관리 =====

function checkSmsSent(phone, eventDate, type) {
  try {
    const sheet = getOrCreateLogSheet();
    const data = sheet.getDataRange().getValues();
    
    // 같은 날짜인지 확인 (날짜 부분만 비교)
    const eventDateOnly = extractDateOnly(eventDate);
    
    for (let i = 1; i < data.length; i++) {
      const logDateOnly = extractDateOnly(data[i][1]);
      if (data[i][0] === phone && logDateOnly === eventDateOnly && data[i][2] === type) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

function extractDateOnly(dateStr) {
  // "2026년 1월 15일 오후 12시 00분" → "2026년 1월 15일"
  const match = dateStr.match(/(\d+년\s*\d+월\s*\d+일)/);
  if (match) {
    return match[1].replace(/\s/g, '');
  }
  // 숫자만 추출해서 날짜 부분만 (YYYYMMDD)
  const numbers = dateStr.replace(/\D/g, '');
  return numbers.substring(0, 8);
}

function saveSmsLog(phone, eventDate, type) {
  try {
    const sheet = getOrCreateLogSheet();
    sheet.appendRow([phone, eventDate, type, new Date().toISOString()]);
  } catch (error) {
    console.error('로그 저장 오류:', error);
  }
}

function saveCancelLog(originalMessage, parsed, result, deletedIds) {
  try {
    const sheet = getOrCreateCancelLogSheet();
    sheet.appendRow([
      new Date().toISOString(),
      parsed.crewName || '',
      parsed.eventDate || '',
      result,
      deletedIds ? deletedIds.join(',') : '',
      originalMessage.substring(0, 500)
    ]);
  } catch (error) {
    console.error('취소 로그 저장 오류:', error);
  }
}

function saveUnknownLog(message) {
  try {
    const sheet = getOrCreateUnknownLogSheet();
    sheet.appendRow([
      new Date().toISOString(),
      message.substring(0, 1000)
    ]);
  } catch (error) {
    console.error('미확인 로그 저장 오류:', error);
  }
}

function getOrCreateLogSheet() {
  const ss = SpreadsheetApp.openById(getOrCreateSpreadsheet());
  let sheet = ss.getSheetByName('발송로그');
  if (!sheet) {
    sheet = ss.insertSheet('발송로그');
    sheet.appendRow(['전화번호', '진행일시', '타입', '발송시간']);
  }
  return sheet;
}

function getOrCreateCancelLogSheet() {
  const ss = SpreadsheetApp.openById(getOrCreateSpreadsheet());
  let sheet = ss.getSheetByName('취소로그');
  if (!sheet) {
    sheet = ss.insertSheet('취소로그');
    sheet.appendRow(['시간', '크루명', '진행일시', '결과', '삭제ID', '원본메시지']);
  }
  return sheet;
}

function getOrCreateUnknownLogSheet() {
  const ss = SpreadsheetApp.openById(getOrCreateSpreadsheet());
  let sheet = ss.getSheetByName('미확인로그');
  if (!sheet) {
    sheet = ss.insertSheet('미확인로그');
    sheet.appendRow(['시간', '메시지']);
  }
  return sheet;
}

function getOrCreateSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('LOG_SPREADSHEET_ID');
  
  if (!ssId) {
    const ss = SpreadsheetApp.create('뭘좀_문자발송로그');
    ssId = ss.getId();
    props.setProperty('LOG_SPREADSHEET_ID', ssId);
  }
  
  return ssId;
}

// ===== 백업 기능 =====

function backupReservation(reservation) {
  try {
    const sheet = getOrCreateBackupSheet('reservations_백업', 
      ['id', 'phone', 'crewName', 'eventDate', 'eventPart', 'option', 'isInvitation', 'status', '백업시간']);
    
    sheet.appendRow([
      reservation.id,
      reservation.phone,
      reservation.crewName,
      reservation.eventDate,
      reservation.eventPart,
      reservation.option,
      reservation.isInvitation,
      reservation.status,
      new Date().toISOString()
    ]);
  } catch (error) {
    console.error('예약 백업 오류:', error);
  }
}

function backupCustomer(phone, crewName) {
  try {
    const sheet = getOrCreateBackupSheet('customers_백업',
      ['id', 'name', 'source', '백업시간']);
    
    // 중복 체크
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === phone) {
        return; // 이미 있으면 스킵
      }
    }
    
    sheet.appendRow([
      phone,
      crewName,
      'organic',
      new Date().toISOString()
    ]);
  } catch (error) {
    console.error('고객 백업 오류:', error);
  }
}

function getOrCreateBackupSheet(sheetName, headers) {
  const ss = SpreadsheetApp.openById(getOrCreateSpreadsheet());
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  }
  return sheet;
}

// 설문조사 백업
function backupSurvey(survey) {
  try {
    const sheet = getOrCreateBackupSheet('surveys_백업',
      ['id', 'phone', 'name', 'gender', 'birthYear', 'height', 'jobCategory', 'jobDetail', 'jobCertFile', 'termsAgreed', 'marketingAgreed', '백업시간']);
    
    // 중복 체크 (같은 phone이면 업데이트)
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === survey.phone) {
        // 기존 행 업데이트
        sheet.getRange(i + 1, 1, 1, 12).setValues([[
          survey.id,
          survey.phone,
          survey.name,
          survey.gender,
          survey.birthYear,
          survey.height,
          survey.jobCategory,
          survey.jobDetail,
          survey.jobCertFile,
          survey.termsAgreed,
          survey.marketingAgreed,
          new Date().toISOString()
        ]]);
        return;
      }
    }
    
    // 신규 추가
    sheet.appendRow([
      survey.id,
      survey.phone,
      survey.name,
      survey.gender,
      survey.birthYear,
      survey.height,
      survey.jobCategory,
      survey.jobDetail,
      survey.jobCertFile,
      survey.termsAgreed,
      survey.marketingAgreed,
      new Date().toISOString()
    ]);
  } catch (error) {
    console.error('설문조사 백업 오류:', error);
  }
}

// 초대장 백업
function backupInvitation(invitation) {
  try {
    const sheet = getOrCreateBackupSheet('invitations_백업',
      ['id', 'phone', 'qualifications', 'groups', 'wineBonus', 'authType', 'snsLink', 'approvalStatus', 'fileLinks', '백업시간']);
    
    // 중복 체크 (같은 phone이면 업데이트)
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === invitation.phone) {
        // 기존 행 업데이트
        sheet.getRange(i + 1, 1, 1, 10).setValues([[
          invitation.id,
          invitation.phone,
          invitation.qualifications,
          invitation.groups,
          invitation.wineBonus,
          invitation.authType,
          invitation.snsLink,
          invitation.approvalStatus,
          invitation.fileLinks,
          new Date().toISOString()
        ]]);
        return;
      }
    }
    
    // 신규 추가
    sheet.appendRow([
      invitation.id,
      invitation.phone,
      invitation.qualifications,
      invitation.groups,
      invitation.wineBonus,
      invitation.authType,
      invitation.snsLink,
      invitation.approvalStatus,
      invitation.fileLinks,
      new Date().toISOString()
    ]);
  } catch (error) {
    console.error('초대장 백업 오류:', error);
  }
}

// ===== 복구 기능 =====

function restoreFromBackup() {
  const results = {
    customers: 0,
    reservations: 0,
    surveys: 0,
    invitations: 0,
    errors: []
  };
  
  try {
    const ss = SpreadsheetApp.openById(getOrCreateSpreadsheet());
    
    // 고객 복구
    const customersSheet = ss.getSheetByName('customers_백업');
    if (customersSheet) {
      const customersData = customersSheet.getDataRange().getValues();
      for (let i = 1; i < customersData.length; i++) {
        const row = customersData[i];
        if (row[0]) { // id가 있으면
          try {
            saveToProjectDB('customers', {
              id: row[0],
              name: row[1],
              source: row[2] || 'organic'
            });
            results.customers++;
          } catch (e) {
            results.errors.push('고객 ' + row[0] + ': ' + e.message);
          }
        }
      }
    }
    
    // 예약 복구
    const reservationsSheet = ss.getSheetByName('reservations_백업');
    if (reservationsSheet) {
      const reservationsData = reservationsSheet.getDataRange().getValues();
      for (let i = 1; i < reservationsData.length; i++) {
        const row = reservationsData[i];
        if (row[0]) { // id가 있으면
          try {
            saveToProjectDB('reservations', {
              id: row[0],
              phone: row[1],
              crewName: row[2],
              eventDate: row[3],
              eventPart: row[4],
              option: row[5],
              isInvitation: row[6],
              status: row[7] || '예약완료'
            });
            results.reservations++;
          } catch (e) {
            results.errors.push('예약 ' + row[0] + ': ' + e.message);
          }
        }
      }
    }
    
    // 설문조사 복구
    const surveysSheet = ss.getSheetByName('surveys_백업');
    if (surveysSheet) {
      const surveysData = surveysSheet.getDataRange().getValues();
      for (let i = 1; i < surveysData.length; i++) {
        const row = surveysData[i];
        if (row[0]) { // id가 있으면
          try {
            saveToProjectDB('surveys', {
              id: row[0],
              phone: row[1],
              name: row[2],
              gender: row[3],
              birthYear: row[4],
              height: row[5],
              jobCategory: row[6],
              jobDetail: row[7],
              jobCertFile: row[8],
              termsAgreed: row[9],
              marketingAgreed: row[10]
            });
            results.surveys++;
          } catch (e) {
            results.errors.push('설문조사 ' + row[0] + ': ' + e.message);
          }
        }
      }
    }
    
    // 초대장 복구
    const invitationsSheet = ss.getSheetByName('invitations_백업');
    if (invitationsSheet) {
      const invitationsData = invitationsSheet.getDataRange().getValues();
      for (let i = 1; i < invitationsData.length; i++) {
        const row = invitationsData[i];
        if (row[0]) { // id가 있으면
          try {
            saveToProjectDB('invitations', {
              id: row[0],
              phone: row[1],
              qualifications: row[2],
              groups: row[3],
              wineBonus: row[4],
              authType: row[5],
              snsLink: row[6],
              approvalStatus: row[7],
              fileLinks: row[8]
            });
            results.invitations++;
          } catch (e) {
            results.errors.push('초대장 ' + row[0] + ': ' + e.message);
          }
        }
      }
    }
  } catch (error) {
    results.errors.push('전체 오류: ' + error.message);
  }
  
  return results;
}

// doGet에서 restore 호출 가능하게
// ?action=restore 로 호출

// ===== 유틸리티 =====

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== 테스트 함수 =====

function testParseSale() {
  const message = `[프립 판매 안내]
은비까비 호스트님, 새로운 프립 판매 건이 있어요!
[사당] 프라이빗 라운지에서 커피 소개팅+와인파티
진행일시: 2026년 1월 11일 오후 19시 00분
옵션: [3부 와인] 인비테이션 패스 소지자
수량: 1개
크루: 조세목
크루 연락처: 01094739509`;
  
  const result = parseFripSaleMessage(message);
  console.log('파싱 결과:', result);
  return result;
}

function testParseCancel() {
  const message = `[프립 결제 취소 안내]
은비까비 호스트님의 크루가 아래 프립을 취소하여 환불 처리되었어요.
[사당] 분위기 끝판왕🌿 프라이빗 라운지에서 커피+와인파티
진행일시: 2026년 1월 10일 오후 19시 00분
옵션: [3부 와인] (87년생 이하, 여자) 리뷰약속, 얼리버드
크루: 캐리온
구매 수량: 1개
취소 수량: 1개`;
  
  const result = parseFripCancelMessage(message);
  console.log('취소 파싱 결과:', result);
  return result;
}
