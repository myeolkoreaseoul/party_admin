// ========================================
// 뭘 좀 아는 사람들 - 고객관리 시스템 v3 (A안: 사전조사 인증)
// ========================================

const SHEET_NAMES = {
  TALLY: '사전조사',
  INVITATION: '초대장신청',
  FRIP: '프립예약',
  MASTER: '통합고객관리'
};

const FRIP_URL = 'https://www.frip.co.kr/products/188435';

// ========================================
// 1. 초대장 신청 데이터 받기 (웹사이트 → Sheets)
// ========================================
function doPost(e) {
  try {
    Logger.log('=== doPost 시작 ===');
    Logger.log('받은 데이터: ' + e.postData.contents);
    
    const data = JSON.parse(e.postData.contents);
    Logger.log('파싱된 데이터: ' + JSON.stringify(data));
    
    // 초대장신청 시트에 기록
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.INVITATION);
    
    if (!sheet) {
      throw new Error('초대장신청 시트를 찾을 수 없습니다.');
    }
    
    // "기타 내부평가단 추천인"이 포함되어 있는지 확인
    const qualifications = data.qualifications || [];
    const needsManualApproval = qualifications.includes('추천');
    const approvalStatus = needsManualApproval ? '대기' : '1차승인';
    
    Logger.log('자격 요건: ' + qualifications.join(', '));
    Logger.log('승인 상태: ' + approvalStatus);
    
    // 데이터 행 추가
    const timestamp = new Date();
    sheet.appendRow([
      timestamp,                     // A: 타임스탬프
      'invitation',                  // B: 유입경로
      data.email || '',              // C: 이메일
      data.phone || '',              // D: 전화번호
      data.contactType || '',        // E: 연락처타입
      qualifications.join(', '),     // F: 선택자격
      data.source || 'direct',       // G: 배포처
      approvalStatus,                // H: 승인상태
      '',                            // I: 프립링크발송일시
      ''                             // J: 메모
    ]);
    
    Logger.log('초대장신청 시트에 기록 완료');
    
    // 1차 승인인 경우 즉시 메시지 발송
    if (!needsManualApproval) {
      Logger.log('1차 승인 → 메시지 발송 시작');
      const contact = data.email || data.phone;
      const contactType = data.contactType;
      
      발송메시지처리(contact, contactType, qualifications, timestamp);
      
      // 발송 일시 기록
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 9).setValue(new Date()); // I열: 프립링크발송일시
    }
    
    // 통합고객관리 자동 업데이트
    통합고객관리업데이트();
    Logger.log('통합고객관리 업데이트 완료');
    
    // CORS 헤더 포함하여 응답
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: '초대장 신청이 완료되었습니다!'
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: '오류가 발생했습니다: ' + error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ========================================
// 2. 메시지 발송 처리
// ========================================
function 발송메시지처리(contact, contactType, qualifications, timestamp) {
  Logger.log('메시지 발송 대상: ' + contact + ' (' + contactType + ')');
  
  if (contactType === 'email') {
    // 이메일 발송
    이메일발송(contact, qualifications);
  } else if (contactType === 'phone') {
    // 문자 발송 (Tasker용 시트에 기록)
    문자발송대기열추가(contact, qualifications);
  }
}

// ========================================
// 3. 이메일 자동 발송 (Gmail - hello@svvys.com)
// ========================================
function 이메일발송(email, qualifications) {
  const subject = '[뭘 좀 아는 사람들] 1차 승인 완료! 다음 단계를 진행해주세요 🎉';
  
  // 선택한 자격에 따른 인증 안내
  let authGuide = '';
  const qualArray = qualifications || [];
  
  if (qualArray.includes('직업')) {
    authGuide += '✅ 전문직/대기업/공기업/공무원 → 명함 또는 재직증명서\n';
  }
  if (qualArray.includes('학력')) {
    authGuide += '✅ 학력 → 졸업증명서 또는 학생증\n';
  }
  if (qualArray.includes('연봉자산')) {
    authGuide += '✅ 연봉/자산 → 소득증명원 (선택)\n';
  }
  if (qualArray.includes('SNS')) {
    authGuide += '✅ SNS 인플루언서 → 인스타그램 아이디\n';
  }
  if (qualArray.includes('운동')) {
    authGuide += '✅ 운동 완주 → 완주 인증서 (선택)\n';
  }
  if (qualArray.includes('외모')) {
    authGuide += '✅ 외모 우수 → 전신 사진 3장 필수\n';
  }
  if (qualArray.includes('득표')) {
    authGuide += '✅ 기존 파티 득표 → 이전 파티명 기재\n';
  }
  
  const body = `
안녕하세요!

뭘 좀 아는 사람들 초대장 신청이 1차 승인되었습니다! 🎉

━━━━━━━━━━━━━━━━━━━━
📋 다음 단계를 진행해주세요
━━━━━━━━━━━━━━━━━━━━

1️⃣ 프립 예약하기
👉 ${FRIP_URL}

• 원하시는 일정 선택
• "초대장" 옵션 선택 (필수)
  - 1부/2부 커피 로테이션: 5,000원
  - 3부 와인 파티: 10,000원
• 결제 완료

2️⃣ 예약 완료 후 사전조사 작성
• 예약 완료 시 사전조사 링크를 별도 발송
• 사전조사에서 자격 인증 자료 제출

3️⃣ 최종 승인
• 인증 확인 후 최종 승인
• 현장에서 참가비 전액 환급

━━━━━━━━━━━━━━━━━━━━
🔥 인증 자료 안내 (중요!)
━━━━━━━━━━━━━━━━━━━━

선택하신 자격에 따라 사전조사에서
아래 자료를 제출해주세요:

${authGuide || '✅ 선택하신 자격 확인이 필요합니다'}

※ 사진은 JPG, PNG 형식
※ 서류는 PDF 또는 사진으로 제출

━━━━━━━━━━━━━━━━━━━━
⚠️ 유의사항
━━━━━━━━━━━━━━━━━━━━

• 반드시 "초대장" 옵션으로 예약
• 인증 자료 미제출 시 환급 불가
• 인증 미흡 시 환급 불가
• 허위 신청 시 티켓 정가 부과

━━━━━━━━━━━━━━━━━━━━
📱 문의
━━━━━━━━━━━━━━━━━━━━

Instagram: @svvy.s
Email: hello@svvys.com
Website: svvys.com

감사합니다!
뭘 좀 아는 사람들 (호스트: 은비까비) 드림
`;
  
  try {
    MailApp.sendEmail({
      to: email,
      replyTo: 'hello@svvys.com',
      name: '뭘 좀 아는 사람들',
      subject: subject,
      body: body
    });
    Logger.log('이메일 발송 완료: ' + email);
  } catch (error) {
    Logger.log('이메일 발송 실패: ' + error.toString());
  }
}

// ========================================
// 4. 문자 발송 대기열 추가 (Tasker용)
// ========================================
function 문자발송대기열추가(phone, qualifications) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let smsSheet = ss.getSheetByName('문자발송대기');
  
  // 시트가 없으면 생성
  if (!smsSheet) {
    smsSheet = ss.insertSheet('문자발송대기');
    smsSheet.appendRow(['타임스탬프', '전화번호', '메시지', '발송상태', '발송일시']);
  }
  
  const message = `[뭘 좀 아는 사람들]
1차 승인 완료! 🎉

다음 단계를 진행해주세요:

1️⃣ 프립 예약
${FRIP_URL}

• "초대장" 옵션 선택 필수
• 커피 5천원 / 와인 1만원

2️⃣ 사전조사 작성
• 예약 후 링크 별도 발송
• 자격 인증 자료 제출 필수

3️⃣ 최종 승인 후 현장 환급

⚠️ 인증 미흡 시 환급 불가
⚠️ 허위 신청 시 정가 부과

문의
Instagram: @svvy.s
Email: hello@svvys.com`;
  
  smsSheet.appendRow([
    new Date(),
    phone,
    message,
    '대기',
    ''
  ]);
  
  Logger.log('문자 발송 대기열 추가: ' + phone);
}

// ========================================
// 5. 수동 승인 함수 (추천인용)
// ========================================
function 수동승인처리() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.INVITATION);
  const ui = SpreadsheetApp.getUi();
  
  // 현재 선택된 행 가져오기
  const activeRange = sheet.getActiveRange();
  const row = activeRange.getRow();
  
  if (row < 2) {
    ui.alert('데이터 행을 선택해주세요.');
    return;
  }
  
  // 데이터 읽기
  const data = sheet.getRange(row, 1, 1, 10).getValues()[0];
  const approvalStatus = data[7]; // H열: 승인상태
  
  if (approvalStatus === '1차승인' || approvalStatus === '최종승인') {
    ui.alert('이미 승인된 신청입니다.');
    return;
  }
  
  // 승인 확인
  const response = ui.alert(
    '승인 확인',
    '이 신청을 승인하시겠습니까?\n\n승인 시 프립 링크가 자동으로 발송됩니다.',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    const email = data[2]; // C열
    const phone = data[3]; // D열
    const contactType = data[4]; // E열
    const qualifications = data[5] ? data[5].split(', ') : []; // F열
    
    // 메시지 발송
    const contact = email || phone;
    발송메시지처리(contact, contactType, qualifications, new Date());
    
    // 승인 상태 업데이트
    sheet.getRange(row, 8).setValue('1차승인'); // H열
    sheet.getRange(row, 9).setValue(new Date()); // I열: 발송일시
    
    // 통합고객관리 업데이트
    통합고객관리업데이트();
    
    ui.alert('승인 완료', '메시지가 발송되었습니다.', ui.ButtonSet.OK);
  }
}

// ========================================
// 6. 통합고객관리 자동 업데이트
// ========================================
function 통합고객관리업데이트() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 각 시트 가져오기
  const tallySheet = ss.getSheetByName(SHEET_NAMES.TALLY);
  const invitationSheet = ss.getSheetByName(SHEET_NAMES.INVITATION);
  const fripSheet = ss.getSheetByName(SHEET_NAMES.FRIP);
  const masterSheet = ss.getSheetByName(SHEET_NAMES.MASTER);
  
  if (!masterSheet) {
    throw new Error('통합고객관리 시트를 찾을 수 없습니다.');
  }
  
  // 통합 데이터 맵 (연락처 기준)
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
        source: 'invitation',
        name: '',
        contact: contact,
        email: email,
        qualifications: row[5] || '',
        eventDate: '',
        program: '',
        gender: '',
        options: '',
        fripNumber: '',
        surveyDone: false,
        approvalStatus: row[7] || '대기',
        fripLinkSent: row[8] || '',
        attendance: false,
        refund: false,
        memo: row[9] || ''
      };
    }
  }
  
  // 2) 사전조사 데이터 수집 (Tally)
  if (tallySheet) {
    const tallyData = tallySheet.getDataRange().getValues();
    if (tallyData.length > 1) {
      const headers = tallyData[0];
      let phoneCol = -1;
      let emailCol = -1;
      let nameCol = -1;
      
      for (let j = 0; j < headers.length; j++) {
        const header = String(headers[j]).toLowerCase();
        if (header.includes('전화') || header.includes('phone') || header.includes('연락처')) {
          phoneCol = j;
        }
        if (header.includes('이메일') || header.includes('email')) {
          emailCol = j;
        }
        if (header.includes('이름') || header.includes('name')) {
          nameCol = j;
        }
      }
      
      for (let i = 1; i < tallyData.length; i++) {
        const row = tallyData[i];
        const phone = phoneCol >= 0 ? String(row[phoneCol]).trim() : '';
        const email = emailCol >= 0 ? String(row[emailCol]).trim() : '';
        const name = nameCol >= 0 ? String(row[nameCol]).trim() : '';
        const contact = phone || email;
        
        if (!contact) continue;
        
        if (customerMap[contact]) {
          customerMap[contact].surveyDone = true;
          if (name) customerMap[contact].name = name;
        } else {
          customerMap[contact] = {
            source: 'organic',
            name: name,
            contact: contact,
            email: email,
            qualifications: '',
            eventDate: '',
            program: '',
            gender: '',
            options: '',
            fripNumber: '',
            surveyDone: true,
            approvalStatus: '1차승인',
            fripLinkSent: '',
            attendance: false,
            refund: false,
            memo: ''
          };
        }
      }
    }
  }
  
  // 3) 프립 예약 데이터 수집
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
          surveyDone: false,
          approvalStatus: '대기',
          fripLinkSent: '',
          attendance: false,
          refund: false,
          memo: '사전조사 미완료'
        };
      }
    }
  }
  
  // 4) 통합고객관리 시트 업데이트
  masterSheet.clear();
  masterSheet.appendRow([
    'ID', '유입경로', '크루명', '연락처', '이메일', '선택자격',
    '진행일시', '프로그램', '성별', '옵션상세', '프립예약번호',
    '사전조사완료', '승인상태', '프립링크발송', '참석여부', '환급여부', '메모'
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
      customer.surveyDone ? '완료' : '대기',
      customer.approvalStatus,
      customer.fripLinkSent,
      customer.attendance ? '참석' : '',
      customer.refund ? '완료' : '',
      customer.memo
    ]);
  });
  
  Logger.log('통합고객관리 업데이트 완료: ' + (id - 1) + '명');
}

// ========================================
// 테스트용 함수
// ========================================
function doGet(e) {
  return ContentService
    .createTextOutput('Apps Script가 정상 작동 중입니다!')
    .setMimeType(ContentService.MimeType.TEXT);
}

function 테스트_통합업데이트() {
  통합고객관리업데이트();
  SpreadsheetApp.getUi().alert('통합고객관리가 업데이트되었습니다!');
}

function 간단테스트_이메일발송() {
  const testEmail = 'geneva29849@gmail.com'; // 본인 이메일로 변경
  const testQualifications = ['직업', '학력', '외모']; // 테스트용 자격
  이메일발송(testEmail, testQualifications);
  Logger.log('테스트 이메일 발송 완료: ' + testEmail);
}
