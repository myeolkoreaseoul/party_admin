// ========================================
// 뭘 좀 아는 사람들 - 파일 업로드 전용 GAS
// Google Drive에 파일 저장 후 URL 리턴
// (스프레드시트 사용 안 함)
// ========================================

const DRIVE_FOLDER_NAME = '뭘좀아는사람들_인증자료';

// ========================================
// doPost - 파일 업로드 처리
// ========================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    // 파일 업로드
    if (action === 'uploadFiles') {
      return uploadFiles(data.phone, data.files, data.folder);
    }
    
    return jsonResponse(false, '알 수 없는 action: ' + action);
    
  } catch (error) {
    return jsonResponse(false, '오류: ' + error.toString());
  }
}

// ========================================
// doGet - 테스트용
// ========================================
function doGet(e) {
  return jsonResponse(true, '파일 업로드 전용 GAS 서버입니다', {
    actions: ['uploadFiles'],
    usage: 'POST로 {action: "uploadFiles", phone: "010-...", files: [...], folder: "폴더명"} 전송'
  });
}

// ========================================
// 파일 업로드 함수
// ========================================
function uploadFiles(phone, files, folderName) {
  if (!files || files.length === 0) {
    return jsonResponse(false, '업로드할 파일이 없습니다');
  }
  
  var fileUrls = [];
  
  try {
    // 메인 폴더 > 날짜 폴더 > 전화번호 폴더
    var mainFolder = getOrCreateFolder(DRIVE_FOLDER_NAME);
    var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    var dateFolder = getOrCreateSubFolder(mainFolder, today);
    
    // folderName이 있으면 추가 하위 폴더 (예: 'verification', 'survey')
    var targetFolder = dateFolder;
    if (folderName) {
      targetFolder = getOrCreateSubFolder(dateFolder, folderName);
    }
    
    // 전화번호 폴더
    var phoneFolder = getOrCreateSubFolder(targetFolder, phone || 'unknown');
    
    // 파일들 저장
    for (var i = 0; i < files.length; i++) {
      var fileData = files[i];
      var timestamp = Utilities.formatDate(new Date(), 'Asia/Seoul', 'HHmmss');
      var fileName = (phone || 'file') + '_' + timestamp + '_' + (i + 1) + '_' + fileData.name;
      
      var decoded = Utilities.base64Decode(fileData.data);
      var blob = Utilities.newBlob(decoded, fileData.type, fileName);
      var file = phoneFolder.createFile(blob);
      
      // 파일을 누구나 볼 수 있게 설정 (링크 공유)
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      fileUrls.push({
        name: fileName,
        url: file.getUrl(),
        id: file.getId()
      });
    }
    
    return jsonResponse(true, files.length + '개 파일 업로드 완료', {
      files: fileUrls,
      folder: phoneFolder.getUrl()
    });
    
  } catch (error) {
    return jsonResponse(false, '파일 업로드 오류: ' + error.toString());
  }
}

// ========================================
// 폴더 유틸리티
// ========================================
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

function getOrCreateSubFolder(parent, name) {
  var folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

// ========================================
// JSON 응답
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
