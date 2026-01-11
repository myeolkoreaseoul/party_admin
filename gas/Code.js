/**
 * 뭘 좀 아는 사람들 - 문자 발송 GAS (v4 - Supabase 연동)
 */

// ===== 설정 =====
const SOLAPI_API_KEY = 'NCSE7Y7XJIXQAF6L';
const SOLAPI_API_SECRET = 'T3LMVNXFHABOY1PWXIDWMFFQC7MFLMUK';
const SOLAPI_SENDER = '01026706826';
const BLACKLIST = ['010-5748-7458', '01057487458'];

// Supabase 설정
const SUPABASE_URL = 'https://bqpxdxsgxoapguknxwul.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcHhkeHNneG9hcGd1a254d3VsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzUyNTI0MCwiZXhwIjoyMDgzMTAxMjQwfQ.quV8j7WVvmeXO8l4-uo3GGRg-HPWxRacnVdm84GtWVI';

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

    if (action === 'sendSurveyConfirmSms') {
  return jsonResponse(handleSurveyConfirmSms(data));
    }

    if (action === 'uploadFiles') {
  return jsonResponse(handleUploadFiles(data));
    }

    if (action === 'sendSms') {
      const result = sendSmsViaSolapi(data.to, data.message);
      return jsonResponse(result);
    }
    
    if (action === 'backupSurvey') {
      backupSurvey(data.survey);
      return jsonResponse({ success: true });
    }
    
    if (action === 'sendInvitationCompleteSms') {
       return jsonResponse(handleInvitationCompleteSms(data));
    }


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
      version: '4.0 - Supabase',
      features: ['fripNotify', 'fripSale', 'fripCancel', 'sendSms', 'testSms', 'restore']
    });
  }
  
  if (action === 'restore') {
    const results = restoreFromBackup();
    return jsonResponse({
      success: true,
      message: '백업에서 Supabase로 복구 완료',
      restored: results
    });
  }
  
  return jsonResponse({ success: true, message: 'GAS SMS Sender v4.0 - Supabase' });
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
      const parsed = parseFripSaleMessage(message);
      if (!parsed.phone) {
        return jsonResponse({ success: false, error: '전화번호 파싱 실패' });
      }

      // ⚠️ 중복 체크: 같은 전화번호 + 같은 진행일시 예약이 이미 있는지 확인
      const existingReservations = searchReservationsByPhoneFromSupabase(parsed.phone, parsed.eventDate);
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

      const reservationId = 'RES-' + Date.now();
      const reservation = {
        id: reservationId,
        phone: parsed.phone,
        crew_name: parsed.crewName,
        event_date: parsed.eventDate,
        event_part: getEventPart(parsed.eventDate),
        option: parsed.option,
        is_invitation: parsed.option.includes('인비테이션'),
        status: '예약완료'
      };

      // Supabase에 저장
      saveToSupabase('reservations', reservation);

      // 스프레드시트 백업
      backupReservation(reservation);

      // 고객 정보 확인/생성
      ensureCustomerExists(parsed.phone, parsed.crewName);

      // 고객 백업
      backupCustomer(parsed.phone, parsed.crewName);

      // 같은 날 예약 체크
      if (checkSmsSent(parsed.phone, parsed.eventDate, 'survey')) {
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

      // 첫 예약 → 사전조사 문자 발송
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

  // ⚠️ 새로 추가: 전화번호 + 진행일시로 중복 예약 검색
  function searchReservationsByPhoneFromSupabase(phone, eventDate) {
    try {
      const normalizedPhone = normalizePhone(phone);
      const searchUrl = SUPABASE_URL + '/reservations?phone=eq.' + encodeURIComponent(normalizedPhone) + '&status=neq.취소';
      const options = {
        method: 'get',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY
        },
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(searchUrl, options);
      const result = JSON.parse(response.getContentText());

      if (!result || result.length === 0) {
        return [];
      }

      const normalizedEventDate = normalizeEventDate(eventDate);

      return result.filter(res => {
        const resDate = normalizeEventDate(res.event_date);
        return resDate === normalizedEventDate;
      });
    } catch (error) {
      console.error('예약 검색(전화번호) 오류:', error);
      return [];
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
    
    const reservations = searchReservationsFromSupabase(parsed.crewName, parsed.eventDate);
    
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
      const updateResult = updateReservationStatusInSupabase(res.id, '취소');
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

// ===== Supabase API 함수 =====

function saveToSupabase(table, data) {
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'return=representation'
      },
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(SUPABASE_URL + '/' + table, options);
    const status = response.getResponseCode();
    
    if (status >= 200 && status < 300) {
      return JSON.parse(response.getContentText());
    } else {
      console.error('Supabase 저장 오류:', response.getContentText());
      return null;
    }
  } catch (error) {
    console.error('Supabase 저장 오류:', error);
    return null;
  }
}

function ensureCustomerExists(phone, crewName) {
  try {
    // 기존 고객 확인
    const searchUrl = SUPABASE_URL + '/customers?id=eq.' + encodeURIComponent(phone);
    const searchOptions = {
      method: 'get',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(searchUrl, searchOptions);
    const result = JSON.parse(response.getContentText());
    
    if (!result || result.length === 0) {
      // 신규 고객 생성
      saveToSupabase('customers', {
        id: phone,
        name: crewName,
        source: 'organic'
      });
    }
  } catch (error) {
    console.error('고객 확인 오류:', error);
  }
}

function searchReservationsFromSupabase(crewName, eventDate) {
  try {
    const searchUrl = SUPABASE_URL + '/reservations?crew_name=eq.' + encodeURIComponent(crewName);
    const options = {
      method: 'get',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(searchUrl, options);
    const result = JSON.parse(response.getContentText());
    
    if (!result || result.length === 0) {
      return [];
    }
    
    const normalizedEventDate = normalizeEventDate(eventDate);
    
    return result.filter(res => {
      const resDate = normalizeEventDate(res.event_date);
      return resDate === normalizedEventDate;
    });
  } catch (error) {
    console.error('예약 검색 오류:', error);
    return [];
  }
}

function updateReservationStatusInSupabase(reservationId, status) {
  try {
    const url = SUPABASE_URL + '/reservations?id=eq.' + encodeURIComponent(reservationId);
    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'return=representation'
      },
      payload: JSON.stringify({ status: status }),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    return response.getResponseCode() >= 200 && response.getResponseCode() < 300;
  } catch (error) {
    console.error('예약 상태 업데이트 오류:', error);
    return false;
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

function normalizeEventDate(dateStr) {
  const numbers = dateStr.replace(/\D/g, '');
  return numbers.substring(0, 12);
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

    // 블랙리스트 체크
    const isBlacklisted = BLACKLIST.some(num => num.replace(/\D/g, '') === cleanTo);
    if (isBlacklisted) {
      console.log('블랙리스트 번호 - 발송 스킵:', cleanTo);
      return { success: true, message: '블랙리스트 - 발송 스킵', skipped: true };
    }

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
      return { success: true, message: 'SMS 발송 완료', result: result };
    } else {
      return { success: false, message: '문자 발송 실패', error: result.errorCode || 'Unknown' };
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

// ===== 로그 관리 =====

function checkSmsSent(phone, eventDate, type) {
  try {
    const sheet = getOrCreateLogSheet();
    const data = sheet.getDataRange().getValues();
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
  const match = dateStr.match(/(\d+년\s*\d+월\s*\d+일)/);
  if (match) return match[1].replace(/\s/g, '');
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
    sheet.appendRow([new Date().toISOString(), message.substring(0, 1000)]);
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
      reservation.crew_name,
      reservation.event_date,
      reservation.event_part,
      reservation.option,
      reservation.is_invitation,
      reservation.status,
      new Date().toISOString()
    ]);
  } catch (error) {
    console.error('예약 백업 오류:', error);
  }
}

function backupCustomer(phone, crewName) {
  try {
    const sheet = getOrCreateBackupSheet('customers_백업', ['id', 'name', 'source', '백업시간']);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === phone) return;
    }
    sheet.appendRow([phone, crewName, 'organic', new Date().toISOString()]);
  } catch (error) {
    console.error('고객 백업 오류:', error);
  }
}

function backupSurvey(survey) {
  try {
    const sheet = getOrCreateBackupSheet('surveys_백업',
      ['id', 'phone', 'name', 'gender', 'birthYear', 'height', 'jobCategory', 'jobDetail', 'jobCertFile', 'termsAgreed', 'marketingAgreed', '백업시간']);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === survey.phone) {
        sheet.getRange(i + 1, 1, 1, 12).setValues([[
          survey.id, survey.phone, survey.name, survey.gender, survey.birthYear, survey.height,
          survey.jobCategory, survey.jobDetail, survey.jobCertFile, survey.termsAgreed, survey.marketingAgreed,
          new Date().toISOString()
        ]]);
        return;
      }
    }
    sheet.appendRow([
      survey.id, survey.phone, survey.name, survey.gender, survey.birthYear, survey.height,
      survey.jobCategory, survey.jobDetail, survey.jobCertFile, survey.termsAgreed, survey.marketingAgreed,
      new Date().toISOString()
    ]);
  } catch (error) {
    console.error('설문조사 백업 오류:', error);
  }
}

function backupInvitation(invitation) {
  try {
    const sheet = getOrCreateBackupSheet('invitations_백업',
      ['id', 'phone', 'qualifications', 'groups', 'wineBonus', 'authType', 'snsLink', 'approvalStatus', 'fileLinks', '백업시간']);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === invitation.phone) {
        sheet.getRange(i + 1, 1, 1, 10).setValues([[
          invitation.id, invitation.phone, invitation.qualifications, invitation.groups, invitation.wineBonus,
          invitation.authType, invitation.snsLink, invitation.approvalStatus, invitation.fileLinks,
          new Date().toISOString()
        ]]);
        return;
      }
    }
    sheet.appendRow([
      invitation.id, invitation.phone, invitation.qualifications, invitation.groups, invitation.wineBonus,
      invitation.authType, invitation.snsLink, invitation.approvalStatus, invitation.fileLinks,
      new Date().toISOString()
    ]);
  } catch (error) {
    console.error('초대장 백업 오류:', error);
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

// ===== 복구 기능 (스프레드시트 → Supabase) =====

function restoreFromBackup() {
  const results = { customers: 0, reservations: 0, surveys: 0, invitations: 0, errors: [] };
  
  try {
    const ss = SpreadsheetApp.openById(getOrCreateSpreadsheet());
    
    // 고객 복구
    const customersSheet = ss.getSheetByName('customers_백업');
    if (customersSheet) {
      const customersData = customersSheet.getDataRange().getValues();
      for (let i = 1; i < customersData.length; i++) {
        const row = customersData[i];
        if (row[0]) {
          try {
            saveToSupabase('customers', { id: row[0], name: row[1], source: row[2] || 'organic' });
            results.customers++;
          } catch (e) { results.errors.push('고객 ' + row[0] + ': ' + e.message); }
        }
      }
    }
    
    // 예약 복구
    const reservationsSheet = ss.getSheetByName('reservations_백업');
    if (reservationsSheet) {
      const reservationsData = reservationsSheet.getDataRange().getValues();
      for (let i = 1; i < reservationsData.length; i++) {
        const row = reservationsData[i];
        if (row[0]) {
          try {
            saveToSupabase('reservations', {
              id: row[0], phone: row[1], crew_name: row[2], event_date: row[3], event_part: row[4],
              option: row[5], is_invitation: row[6], status: row[7] || '예약완료'
            });
            results.reservations++;
          } catch (e) { results.errors.push('예약 ' + row[0] + ': ' + e.message); }
        }
      }
    }
    
    // 설문조사 복구
    const surveysSheet = ss.getSheetByName('surveys_백업');
    if (surveysSheet) {
      const surveysData = surveysSheet.getDataRange().getValues();
      for (let i = 1; i < surveysData.length; i++) {
        const row = surveysData[i];
        if (row[0]) {
          try {
            saveToSupabase('surveys', {
              id: row[0], phone: row[1], name: row[2], gender: row[3], birth_year: row[4], height: row[5],
              job_category: row[6], job_detail: row[7], job_cert_file: row[8], terms_agreed: row[9], marketing_agreed: row[10]
            });
            results.surveys++;
          } catch (e) { results.errors.push('설문조사 ' + row[0] + ': ' + e.message); }
        }
      }
    }
    
    // 초대장 복구
    const invitationsSheet = ss.getSheetByName('invitations_백업');
    if (invitationsSheet) {
      const invitationsData = invitationsSheet.getDataRange().getValues();
      for (let i = 1; i < invitationsData.length; i++) {
        const row = invitationsData[i];
        if (row[0]) {
          try {
            saveToSupabase('invitations', {
              id: row[0], phone: row[1], qualifications: row[2], groups: row[3], wine_bonus: row[4],
              auth_type: row[5], sns_link: row[6], approval_status: row[7], file_links: row[8]
            });
            results.invitations++;
          } catch (e) { results.errors.push('초대장 ' + row[0] + ': ' + e.message); }
        }
      }
    }
  } catch (error) {
    results.errors.push('전체 오류: ' + error.message);
  }
  
  return results;
}

// ===== 유틸리티 =====

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ===== 설문 완료 확인 문자 =====

function handleSurveyConfirmSms(data) {
  const to = data.to;
  const eventDate = formatEventDate(data.eventDate);
  const isInvitation = data.isInvitation;
  
  const smsContent = makeSurveyConfirmSms(eventDate, isInvitation);
  const result = sendSmsViaSolapi(to, smsContent);
  
  return { success: result.success, type: 'surveyConfirm' };
}

function formatEventDate(dateStr) {
  if (!dateStr) return '날짜 미정';
  
  // ISO 형식 (2026-01-11T03:00:00.000Z)
  if (dateStr.includes('T')) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    return `${year}년 ${month}월 ${day}일 ${hour}시`;
  }
  
  // 한글 형식에서 날짜/시간만 추출
  const match = dateStr.match(/(\d+년\s*\d+월\s*\d+일[^옵]*)/);
  if (match) return match[1].trim();
  
  return dateStr;
}

function makeSurveyConfirmSms(eventDate, isInvitation) {
  const onsiteNotice = isInvitation 
    ? '\n- 인비테이션 패스 현장인증의 경우 관련 서류(사진 가능)'
    : '';

  return `안녕하세요! '뭘 좀 아는 사람들' 입니다 ☕🍷
신청서 확인 완료! 아래 내용 꼭 확인해주세요 😊

━━━━━━━━━━━━━━━
📅 일시
${eventDate}
※ 상황에 따라 30분 정도 연장될 수 있어요

📍 장소
사당역 인근 프라이빗 라운지
(행사 1일전 문자로 상세주소 안내드립니다)
━━━━━━━━━━━━━━━
🎒 당일 준비물
- 신분증 (사진 불가)${onsiteNotice}

🍽 참고사항
- 음료와 간단한 핑거푸드가 준비되어 있지만, 식사하고 오시는 걸 추천드려요
- 주차 공간이 없어서 대중교통 이용 부탁드립니다

⚠️ 주의사항
- 신분증 없으면 입장이 안 돼요!
- 성비 균형 모임이라 중간 이탈 시 다음 참여가 제한돼요
- 과음으로 다른 분께 불편 드리면 퇴장될 수 있어요
━━━━━━━━━━━━━━━
입장하시면 호수를 안내드릴게요.
호수로 서로를 소개하는 방식이에요!

좋은 분들 만나실 수 있도록 열심히 준비했습니다.
편하게 오셔서 즐거운 시간 보내세요! ⭐`;
}

// ===== 파일 업로드 (구글 드라이브) =====

function handleUploadFiles(data) {
  if (!data) data = {};
  const phone = data.phone || 'unknown';  const files = data.files || [];
  const folderName = data.folder || 'uploads';
  
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const blob = Utilities.newBlob(
        Utilities.base64Decode(file.data.split(',')[1] || file.data),
        file.type,
        file.name
      );
      
      // 폴더 찾기 또는 생성
      const folders = DriveApp.getFoldersByName(folderName);
      const folder = folders.hasNext() 
        ? folders.next() 
        : DriveApp.createFolder(folderName);
      
      // 파일명에 전화번호 추가
      const fileName = phone + '_' + file.name;
      const driveFile = folder.createFile(blob).setName(fileName);
      
      // 누구나 볼 수 있게 설정
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      results.push({
        name: fileName,
        url: driveFile.getUrl(),
        id: driveFile.getId()
      });
    } catch (e) {
      console.error('파일 업로드 오류:', e);
    }
  }
  
  return { success: true, files: results };
}

// ===== D-1 장소 안내 자동 발송 =====

function sendD1LocationSms() {
  try {
    // 내일 날짜 계산
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // 2026-01-11
    
    // Supabase에서 내일 예약 + 설문완료 + 취소 아닌 사람 조회
    const url = SUPABASE_URL + '/reservations?status=eq.예약완료&select=*';
    const options = {
      method: 'get',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const reservations = JSON.parse(response.getContentText());
    
    let sentCount = 0;
    
    for (const res of reservations) {
      // 날짜 확인 (내일인지)
      if (!isDateTomorrow(res.event_date, tomorrow)) continue;
      
      // 이미 발송했는지 확인
      if (checkSmsSent(res.phone, res.event_date, 'd1_location')) continue;
      
      // 설문 완료 여부 확인
      const surveyUrl = SUPABASE_URL + '/surveys?phone=eq.' + encodeURIComponent(res.phone);
      const surveyRes = UrlFetchApp.fetch(surveyUrl, options);
      const surveys = JSON.parse(surveyRes.getContentText());
      
      if (!surveys || surveys.length === 0) continue; // 설문 미완료면 스킵
      
      // 장소 안내 문자 발송
      const smsContent = makeD1LocationSms(res.event_date, res.event_part, res.is_invitation);
      const result = sendSmsViaSolapi(res.phone, smsContent);
      
      if (result.success) {
        saveSmsLog(res.phone, res.event_date, 'd1_location');
        sentCount++;
      }
    }
    
    return { success: true, sentCount: sentCount };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function isDateTomorrow(eventDateStr, tomorrow) {
  if (!eventDateStr) return false;
  
  const tomorrowDate = tomorrow.toISOString().split('T')[0];
  
  // ISO 형식
  if (eventDateStr.includes('T')) {
    return eventDateStr.split('T')[0] === tomorrowDate;
  }
  
  // 한글 형식 (2026년 1월 11일)
  const match = eventDateStr.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}` === tomorrowDate;
  }
  
  return false;
}

function makeD1LocationSms(eventDate, eventPart, isInvitation) {
  const partTime = {
    '1부': '12:00',
    '2부': '15:00', 
    '3부': '19:00'
  };
  const time = partTime[eventPart] || '';
  
  const onsiteNotice = isInvitation 
    ? '\n- 인비테이션 패스 현장인증의 경우 관련 서류(사진 가능)'
    : '';

  return `안녕하세요! '뭘 좀 아는 사람들' 입니다 ☕🍷
내일 모임 상세 안내드려요!

━━━━━━━━━━━━━━━
📅 일시
내일 ${eventPart} ${time}

📍 장소
서울 관악구 남부순환로 2050 지하1층

🚇 오시는 길
사당역 6번 출구에서 나와 371m직진하면 건물 1층 살롱드키코 미용실 지하 1층
━━━━━━━━━━━━━━━
🎒 당일 준비물
- 신분증 (사진 불가)${onsiteNotice}

⏰ 도착 안내
- 정시 도착 부탁드려요
- 10분 이상 지각 시 참여가 어려울 수 있어요
━━━━━━━━━━━━━━━
내일 뵙겠습니다! 😊`;
}

// ===== 초대장 신청 완료 문자 =====

function handleInvitationCompleteSms(data) {
  const to = data.to;
  const smsContent = makeInvitationCompleteSms();
  const result = sendSmsViaSolapi(to, smsContent);
  return { success: result.success, type: 'invitationComplete' };
}

function makeInvitationCompleteSms() {
  return `안녕하세요! 뭘 좀 아는 사람들입니다 ☕🍷
인비테이션 패스 신청이 완료되었습니다!

📌 다음 단계
프립에서 원하시는 날짜, 옵션 선택 후 '인비테이션 패스' 옵션으로 예약해주세요.
👉 https://www.frip.co.kr/products/188435

예약 완료 후 참석하시면 참가비 전액 환급됩니다!`;
}