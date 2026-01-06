// ========================================
// 뭘 좀 아는 사람들 - 최적화된 플로우 (Tally 의존도 제거)
// ========================================

const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyrN3E6vMNI-vgX6UP62Vtb7NO6QUHSKL11Vebv_IQU4gcjVMhIiNJi1UhV3HKyhCMm/exec';
const FRIP_URL = 'https://www.frip.co.kr/products/188435';

// 그룹 정의
const QUALIFICATION_GROUPS = {
    career: ['직업', '학력', '연봉자산'],
    appearance: ['외모', '운동'],
    influence: ['SNS', '득표3표', '추천']
};

// 전역 변수
let selectedQualifications = [];
let selectedGroups = new Set();
let selectedFiles = [];
let userContact = '';
let contactType = '';
let authMethod = '';

// ========================================
// 페이지 로드 시 초기화
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded 실행됨');
    // URL 파라미터에서 source 추출
    const source = getSourceParameter();
    if (source) {
        localStorage.setItem('invitation_source', source);
    }
    
    // 전화번호 입력 포맷팅 (팝업용)
    const popupPhoneInput = document.getElementById('popupPhone');
    if (popupPhoneInput) {
        popupPhoneInput.addEventListener('input', formatPhoneNumber);
    }
    
    // 자격 요건 체크박스 변경 이벤트 (그룹 체크 및 인센티브 표시)
    document.querySelectorAll('input[name="qualification"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleQualificationChange);
    });
    
    // 비밀 초대장 신청 버튼
    const invitationBtn = document.getElementById('invitationBtn');
    console.log('invitationBtn 찾음:', !!invitationBtn);
    if (invitationBtn) {
        invitationBtn.addEventListener('click', function(e) {
            console.log('인비테이션 버튼 클릭 이벤트 발생');
            handleInvitationButtonClick();
        });
    }
    
    // 일반 참가 버튼
    const generalParticipantBtn = document.getElementById('generalParticipantBtn');
    console.log('generalParticipantBtn 찾음:', !!generalParticipantBtn);
    if (generalParticipantBtn) {
        generalParticipantBtn.addEventListener('click', function(e) {
            console.log('일반 참가 버튼 클릭 이벤트 발생');
            handleGeneralButtonClick();
        });
    }
    
    /* 기존 연락처 팝업 및 일반 옵션 체크박스 로직 제거 (더 이상 사용 안함)
    if (generalOption) {
        generalOption.addEventListener('change', function() {
            if (this.checked) {
                otherOptions.forEach(opt => {
                    opt.checked = false;
                    opt.disabled = true;
                });
            } else {
                otherOptions.forEach(opt => {
                    opt.disabled = false;
                });
            }
        });
    }
    
    // 다른 옵션 선택 시 일반 참가 옵션 비활성화
    otherOptions.forEach(opt => {
        opt.addEventListener('change', function() {
            if (this.checked && generalOption) {
                generalOption.checked = false;
            }
        });
    });
    */
    
    // 폼 제출 이벤트
    const applicationForm = document.getElementById('applicationForm');
    if (applicationForm) {
        applicationForm.addEventListener('submit', handleFormSubmit);
    }
    
    // 인증 옵션 버튼들
    document.querySelectorAll('.auth-option-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.getAttribute('data-type');
            handleAuthSelection(type);
        });
    });
    
    // 파일 선택 버튼
    const selectFileBtn = document.getElementById('selectFileBtn');
    const fileInput = document.getElementById('fileInput');
    if (selectFileBtn && fileInput) {
        selectFileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelection);
    }
    
    // 파일 업로드 완료 버튼
    const submitFilesBtn = document.getElementById('submitFilesBtn');
    if (submitFilesBtn) {
        submitFilesBtn.addEventListener('click', handleFileUpload);
    }
    
    // 파일 업로드 건너뛰기
    const skipUploadBtn = document.getElementById('skipUploadBtn');
    if (skipUploadBtn) {
        skipUploadBtn.addEventListener('click', () => {
            hideModal('uploadPopup');
            redirectToFrip('invitation');
        });
    }
    
    // 업로드 팝업 닫기
    const uploadCloseBtn = document.getElementById('uploadCloseBtn');
    if (uploadCloseBtn) {
        uploadCloseBtn.addEventListener('click', () => {
            if (confirm('파일 업로드를 취소하시겠습니까?\n나중에 인증할 수 있습니다.')) {
                hideModal('uploadPopup');
                redirectToFrip('invitation');
            }
        });
    }
    
    // 일반 참가 팝업 버튼들
    const generalCancelBtn = document.getElementById('generalCancelBtn');
    const generalConfirmBtn = document.getElementById('generalConfirmBtn');
    
    if (generalCancelBtn) {
        generalCancelBtn.addEventListener('click', () => {
            hideModal('generalPopup');
        });
    }
    
    if (generalConfirmBtn) {
        generalConfirmBtn.addEventListener('click', () => {
            hideModal('generalPopup');
            redirectToFrip('general');
        });
    }
    
    // 부드러운 스크롤
    setupSmoothScroll();
    
    // 스크롤 애니메이션
    setupScrollAnimations();
    
    // 헤더 그림자
    window.addEventListener('scroll', () => {
        const header = document.querySelector('.header');
        if (header) {
            if (window.scrollY > 100) {
                header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
            } else {
                header.style.boxShadow = 'none';
            }
        }
    });
});

// ========================================
// URL 파라미터 추출
// ========================================
function getSourceParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('source') || '';
}

// ========================================
// 전화번호 포맷팅
// ========================================
function formatPhoneNumber(e) {
    let value = e.target.value.replace(/[^0-9]/g, '');
    
    if (value.length <= 3) {
        e.target.value = value;
    } else if (value.length <= 7) {
        e.target.value = value.slice(0, 3) + '-' + value.slice(3);
    } else if (value.length <= 11) {
        e.target.value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7);
    } else {
        e.target.value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
    }
}

// ========================================
// 자격 요건 체크박스 변경 핸들러
// ========================================
function handleQualificationChange() {
    // 선택된 자격 수집
    const qualificationInputs = document.querySelectorAll('input[name="qualification"]:checked');
    selectedQualifications = Array.from(qualificationInputs).map(input => input.value);
    
    // 선택된 그룹 계산
    selectedGroups = new Set();
    selectedQualifications.forEach(qual => {
        for (const [group, items] of Object.entries(QUALIFICATION_GROUPS)) {
            if (items.includes(qual)) {
                selectedGroups.add(group);
                break;
            }
        }
    });
    
    // 그룹 체크 표시 업데이트
    updateGroupChecks();
    
    // 인센티브 배너 표시/숨김
    updateIncentiveBanner();
}

// ========================================
// 그룹 체크 표시 업데이트
// ========================================
function updateGroupChecks() {
    // Career & Wealth 그룹
    const group1Check = document.getElementById('group1Check');
    if (group1Check) {
        const hasCareer = selectedQualifications.some(q => QUALIFICATION_GROUPS.career.includes(q));
        group1Check.classList.toggle('active', hasCareer);
    }
    
    // Appearance & Fitness 그룹
    const group2Check = document.getElementById('group2Check');
    if (group2Check) {
        const hasAppearance = selectedQualifications.some(q => QUALIFICATION_GROUPS.appearance.includes(q));
        group2Check.classList.toggle('active', hasAppearance);
    }
    
    // Influence & Network 그룹
    const group3Check = document.getElementById('group3Check');
    if (group3Check) {
        const hasInfluence = selectedQualifications.some(q => QUALIFICATION_GROUPS.influence.includes(q));
        group3Check.classList.toggle('active', hasInfluence);
    }
}

// ========================================
// 인센티브 배너 업데이트
// ========================================
function updateIncentiveBanner() {
    const banner = document.getElementById('incentiveBanner');
    if (banner) {
        // 2개 이상 그룹 선택 시 배너 표시
        if (selectedGroups.size >= 2) {
            banner.style.display = 'block';
            banner.innerHTML = `
                <div class="incentive-content">
                    <i class="fas fa-wine-bottle"></i>
                    <span>🎉 <strong>${selectedGroups.size}개 영역 선택!</strong> 와인 1병이 선물로 제공됩니다 🍷</span>
                </div>
            `;
        } else if (selectedGroups.size === 1) {
            banner.style.display = 'block';
            banner.innerHTML = `
                <div class="incentive-content">
                    <i class="fas fa-gift"></i>
                    <span>💡 <strong>1개 영역 더 선택하면</strong> 와인 1병 선물! 🍷</span>
                </div>
            `;
        } else {
            banner.style.display = 'none';
        }
    }
}

// ========================================
// 인비테이션 패스 신청 버튼 클릭
// ========================================
function handleInvitationButtonClick() {
    console.log('인비테이션 버튼 클릭됨');
    // 자격 요건 수집
    const qualificationInputs = document.querySelectorAll('input[name="qualification"]:checked');
    console.log('선택된 항목 수:', qualificationInputs.length);
    selectedQualifications = Array.from(qualificationInputs).map(input => input.value);
    
    // 아무것도 선택 안함
    if (selectedQualifications.length === 0) {
        showMessage('참가비 지원대상 항목 중 하나 이상을 선택해주세요', 'error');
        return;
    }
    
    // 선택된 그룹 계산
    selectedGroups = new Set();
    selectedQualifications.forEach(qual => {
        for (const [group, items] of Object.entries(QUALIFICATION_GROUPS)) {
            if (items.includes(qual)) {
                selectedGroups.add(group);
                break;
            }
        }
    });
    
    // 와인 인센티브 여부
    const wineBonus = selectedGroups.size >= 2;
    
    // verification.html로 이동 (여러 자격과 와인 보너스 정보 전달)
    const params = new URLSearchParams({
        qualifications: selectedQualifications.join(','),
        groups: Array.from(selectedGroups).join(','),
        wineBonus: wineBonus ? 'true' : 'false'
    });
    window.location.href = `verification.html?${params.toString()}`;
}

// ========================================
// 일반 참가 버튼 클릭 (바로 프립으로 이동)
// ========================================
function handleGeneralButtonClick() {
    console.log('일반 참가 버튼 클릭됨');
    // 바로 프립 상세페이지로 이동
    window.open(FRIP_URL, '_blank');
}

// ========================================
// 폼 제출 처리
// ========================================
function handleFormSubmit(e) {
    e.preventDefault();
    
    // 자격 요건 수집
    const qualificationInputs = document.querySelectorAll('input[name="qualification"]:checked');
    selectedQualifications = Array.from(qualificationInputs).map(input => input.value);
    
    // 아무것도 선택 안함
    if (selectedQualifications.length === 0) {
        showMessage('자격 요건을 최소 1개 선택해주세요', 'error');
        return;
    }
    
    // 이메일 또는 전화번호 확인
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    
    if (!email && !phone) {
        showMessage('이메일 주소 또는 전화번호 중 하나를 입력해주세요', 'error');
        return;
    }
    
    // 이메일 검증
    if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showMessage('올바른 이메일 주소 형식이 아닙니다', 'error');
            return;
        }
    }
    
    // 전화번호 검증
    if (phone) {
        const phoneDigits = phone.replace(/[^0-9]/g, '');
        if (phoneDigits.length !== 11 || !phoneDigits.startsWith('010')) {
            showMessage('올바른 전화번호 형식이 아닙니다 (11자리 숫자)', 'error');
            return;
        }
    }
    
    // 개인정보 동의 확인
    const privacy = document.getElementById('privacy');
    if (!privacy || !privacy.checked) {
        showMessage('개인정보 수집 및 이용에 동의해주세요', 'error');
        return;
    }
    
    // 연락처 저장
    userContact = email || phone;
    contactType = email ? 'email' : 'phone';
    
    // 일반 참가자 체크박스 제거로 인한 수정
    // 일반 참가는 별도 버튼으로 처리
    if (selectedQualifications.includes('해당없음')) {
        // 일반 참가자 플로우 (버튼으로만 접근 가능)
        handleGeneralParticipant();
    } else if (selectedQualifications.length > 0) {
        // 자격자 플로우
        // '추천' 선택 시 수동심사 플래그 설정
        if (selectedQualifications.includes('추천')) {
            localStorage.setItem('needs_manual_review', 'true');
        }
        handleQualifiedParticipant();
    } else {
        // 아무것도 선택 안함
        showMessage('자격 요건을 최소 1개 선택해주세요', 'error');
    }
}

// ========================================
// 일반 참가자 처리
// ========================================
function handleGeneralParticipant() {
    // Google Sheets에 기록
    recordToSheets('general', 'none').then(() => {
        // 일반 참가 안내 팝업 표시
        showModal('generalPopup');
    }).catch(error => {
        console.error('Google Sheets 기록 실패:', error);
        // 실패해도 프립으로 이동
        redirectToFrip('general');
    });
}

// ========================================
// 자격자 처리
// ========================================
function handleQualifiedParticipant() {
    // Google Sheets에 기록 (인증 방법은 나중에 업데이트)
    recordToSheets('invitation', 'pending').then(() => {
        // 인증 방법 선택 팝업 표시
        showModal('authPopup');
    }).catch(error => {
        console.error('Google Sheets 기록 실패:', error);
        showMessage('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요', 'error');
    });
}

// ========================================
// 인증 방법 선택 처리
// ========================================
function handleAuthSelection(type) {
    authMethod = type;
    
    hideModal('authPopup');
    
    if (type === 'now') {
        // 지금 바로 인증 → 파일 업로드 팝업
        showUploadPopup();
    } else if (type === 'later') {
        // 나중에 인증 → Google Sheets 업데이트 후 프립 이동
        updateAuthMethod('later').then(() => {
            redirectToFrip('invitation_later');
        });
    } else if (type === 'onsite') {
        // 현장 인증 → Google Sheets 업데이트 후 프립 이동
        updateAuthMethod('onsite').then(() => {
            redirectToFrip('invitation_onsite');
        });
    }
}

// ========================================
// 파일 업로드 팝업 표시
// ========================================
function showUploadPopup() {
    // 선택한 자격에 따른 안내 생성
    const uploadGuide = document.getElementById('uploadGuide');
    if (uploadGuide) {
        let guideHTML = '<p><strong>📎 필요한 인증 자료:</strong></p>';
        
        if (selectedQualifications.includes('직업')) {
            guideHTML += '<p>✅ 전문직/대기업/공기업/공무원 → 명함 또는 재직증명서</p>';
        }
        if (selectedQualifications.includes('학력')) {
            guideHTML += '<p>✅ 학력 → 졸업증명서 또는 학생증</p>';
        }
        if (selectedQualifications.includes('연봉자산')) {
            guideHTML += '<p>✅ 연봉/자산 → 소득증명원 (선택)</p>';
        }
        if (selectedQualifications.includes('SNS')) {
            guideHTML += '<p>✅ SNS 인플루언서 → 인스타그램 프로필 스크린샷</p>';
        }
        if (selectedQualifications.includes('운동')) {
            guideHTML += '<p>✅ 운동 완주 → 완주 인증서 (선택)</p>';
        }
        if (selectedQualifications.includes('외모')) {
            guideHTML += '<p>✅ 외모 우수 → 전신 사진 3장 필수</p>';
        }
        if (selectedQualifications.includes('득표')) {
            guideHTML += '<p>✅ 기존 파티 득표 → 이전 파티명 기재</p>';
        }
        
        uploadGuide.innerHTML = guideHTML;
    }
    
    showModal('uploadPopup');
}

// ========================================
// 파일 선택 처리
// ========================================
function handleFileSelection(e) {
    const files = Array.from(e.target.files);
    
    // 파일 크기 제한 (10MB)
    const maxSize = 10 * 1024 * 1024;
    const validFiles = files.filter(file => {
        if (file.size > maxSize) {
            alert(`${file.name}은(는) 10MB를 초과합니다`);
            return false;
        }
        return true;
    });
    
    selectedFiles = [...selectedFiles, ...validFiles];
    updateFileList();
    
    // 파일이 있으면 업로드 버튼 활성화
    const submitFilesBtn = document.getElementById('submitFilesBtn');
    if (submitFilesBtn) {
        submitFilesBtn.disabled = selectedFiles.length === 0;
    }
}

// ========================================
// 파일 목록 업데이트
// ========================================
function updateFileList() {
    const fileList = document.getElementById('fileList');
    if (!fileList) return;
    
    if (selectedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }
    
    fileList.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item">
            <div class="file-item-info">
                <i class="fas fa-file"></i>
                <span class="file-item-name">${file.name}</span>
                <span class="file-item-size">(${formatFileSize(file.size)})</span>
            </div>
            <button class="file-item-remove" onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// ========================================
// 파일 제거
// ========================================
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
    
    const submitFilesBtn = document.getElementById('submitFilesBtn');
    if (submitFilesBtn) {
        submitFilesBtn.disabled = selectedFiles.length === 0;
    }
}

// ========================================
// 파일 크기 포맷팅
// ========================================
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ========================================
// 파일 업로드 처리 (Google Drive)
// ========================================
async function handleFileUpload() {
    if (selectedFiles.length === 0) {
        alert('업로드할 파일을 선택해주세요');
        return;
    }
    
    const submitFilesBtn = document.getElementById('submitFilesBtn');
    const originalText = submitFilesBtn.textContent;
    submitFilesBtn.textContent = '업로드 중...';
    submitFilesBtn.disabled = true;
    
    try {
        // 파일을 Base64로 변환하여 전송
        const filePromises = selectedFiles.map(file => convertFileToBase64(file));
        const base64Files = await Promise.all(filePromises);
        
        // Apps Script로 전송
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'uploadFiles',
                contact: userContact,
                contactType: contactType,
                qualifications: selectedQualifications,
                files: base64Files.map((base64, index) => ({
                    name: selectedFiles[index].name,
                    data: base64,
                    type: selectedFiles[index].type
                }))
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('인증 자료가 제출되었습니다!\n환급이 확정되었습니다.');
            hideModal('uploadPopup');
            redirectToFrip('invitation_verified');
        } else {
            throw new Error(result.message || '업로드 실패');
        }
    } catch (error) {
        console.error('파일 업로드 실패:', error);
        alert('파일 업로드에 실패했습니다.\n나중에 다시 시도해주세요.');
        hideModal('uploadPopup');
        redirectToFrip('invitation');
    }
}

// ========================================
// 파일을 Base64로 변환
// ========================================
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ========================================
// Google Sheets에 기록
// ========================================
async function recordToSheets(source, authStatus) {
    const data = {
        action: 'recordInvitation',
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        contactType: contactType,
        qualifications: selectedQualifications,
        source: localStorage.getItem('invitation_source') || 'direct',
        userType: source,
        authStatus: authStatus,
        timestamp: new Date().toISOString()
    };
    
    const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    
    return await response.json();
}

// ========================================
// 인증 방법 업데이트
// ========================================
async function updateAuthMethod(method) {
    const data = {
        action: 'updateAuthMethod',
        contact: userContact,
        authMethod: method
    };
    
    const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    
    return await response.json();
}

// ========================================
// 프립으로 리다이렉트
// ========================================
function redirectToFrip(type) {
    const url = `${FRIP_URL}?source=${type}`;
    window.location.href = url;
}

// ========================================
// 모달 표시/숨김
// ========================================
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// ========================================
// 메시지 표시
// ========================================
function showMessage(message, type) {
    const formMessage = document.getElementById('formMessage');
    if (!formMessage) return;
    
    formMessage.textContent = message;
    formMessage.className = 'form-message';
    
    if (type === 'success') {
        formMessage.style.color = '#39FF14';
    } else if (type === 'error') {
        formMessage.style.color = '#ff4444';
    }
    
    formMessage.style.display = 'block';
    
    // 성공 메시지는 10초 후 자동 숨김
    if (type === 'success') {
        setTimeout(() => {
            formMessage.style.display = 'none';
        }, 10000);
    }
}

// ========================================
// 부드러운 스크롤
// ========================================
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerHeight = 80;
                const targetPosition = target.offsetTop - headerHeight;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// ========================================
// 스크롤 애니메이션
// ========================================
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.program-card, .host-card, .diff-card, .gallery-item').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}
