/* ==========================================================================
   뭘 좀 아는 사람들 - JavaScript
   Google Apps Script 연동, 초대장 신청, 자격 요건 선택
   ========================================================================== */

// Google Apps Script 웹앱 URL
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx_KTDHuC6AEK1VvgMeAvUD70kJfAr-BI0030RttEBhlElcoYOufyQ4Fr2G97xgCOxp/exec';

// DOM 요소
const applicationForm = document.getElementById('applicationForm');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const privacyCheckbox = document.getElementById('privacy');
const formMessage = document.getElementById('formMessage');

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 배포처 파라미터 확인
    const source = getSourceParameter();
    if (source) {
        console.log(`배포처: ${source}`);
        localStorage.setItem('invitation_source', source);
    }
    
    // 전화번호 자동 포맷팅
    if (phoneInput) {
        phoneInput.addEventListener('input', formatPhoneNumber);
    }
    
    // 폼 제출 이벤트
    if (applicationForm) {
        applicationForm.addEventListener('submit', handleFormSubmit);
    }
    
    // 부드러운 스크롤 네비게이션
    setupSmoothScroll();
    
    // 스크롤 애니메이션
    setupScrollAnimations();
});

/**
 * URL에서 source 파라미터 추출
 */
function getSourceParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('source');
}

/**
 * 전화번호 자동 포맷팅 (010-0000-0000)
 */
function formatPhoneNumber(e) {
    let value = e.target.value.replace(/[^0-9]/g, '');
    
    if (value.length <= 3) {
        e.target.value = value;
    } else if (value.length <= 7) {
        e.target.value = value.slice(0, 3) + '-' + value.slice(3);
    } else {
        e.target.value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
    }
}

/**
 * 전화번호 유효성 검사
 */
function validatePhoneNumber(phone) {
    const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
    return phoneRegex.test(phone.replace(/[^0-9]/g, ''));
}

/**
 * 이메일 유효성 검사
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 폼 제출 처리
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // 입력값 가져오기
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const privacyAccepted = privacyCheckbox.checked;
    
    // 선택된 자격 요건 가져오기
    const selectedQualifications = [];
    const checkboxes = document.querySelectorAll('input[name="qualification"]:checked');
    checkboxes.forEach(cb => {
        selectedQualifications.push(cb.value);
    });
    
    // 유효성 검사
    if (selectedQualifications.length === 0) {
        showMessage('자격 요건을 최소 1개 이상 선택해주세요.', 'error');
        return;
    }
    
    if (!email && !phone) {
        showMessage('이메일 또는 전화번호 중 하나를 입력해주세요.', 'error');
        return;
    }
    
    if (email && !validateEmail(email)) {
        showMessage('올바른 이메일 형식이 아닙니다.', 'error');
        return;
    }
    
    if (phone && !validatePhoneNumber(phone)) {
        showMessage('올바른 전화번호 형식이 아닙니다. (예: 010-0000-0000)', 'error');
        return;
    }
    
    if (!privacyAccepted) {
        showMessage('개인정보 수집 및 이용에 동의해주세요.', 'error');
        return;
    }
    
    // 배포처 정보
    const source = localStorage.getItem('invitation_source') || 'direct';
    
    // 제출 버튼 비활성화
    const submitButton = applicationForm.querySelector('.btn-submit');
    const originalButtonHTML = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="btn-text">처리 중...</span>';
    
    try {
        // Google Apps Script로 데이터 전송
        const response = await sendInvitationRequest({
            email: email,
            phone: phone,
            contactType: email ? 'email' : 'phone',
            qualifications: selectedQualifications,
            source: source
        });
        
        if (response.success) {
            showMessage(
                `초대장 신청이 완료되었습니다!<br>
                승인 후 프립 예약 링크를 보내드립니다.<br>
                ${email ? '이메일' : '문자'}로 연락드리겠습니다.`,
                'success'
            );
            
            // 폼 초기화
            applicationForm.reset();
            
            // 체크박스 선택 해제 (시각적 효과)
            document.querySelectorAll('.criteria-item-selectable').forEach(item => {
                item.classList.remove('selected');
            });
            
        } else {
            showMessage(response.message || '초대장 신청 중 오류가 발생했습니다.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
        // 제출 버튼 활성화
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonHTML;
    }
}

/**
 * Google Apps Script로 초대장 신청 데이터 전송
 */
async function sendInvitationRequest(data) {
    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Fetch error:', error);
        
        // Fallback: no-cors 모드로 재시도
        try {
            await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            // no-cors는 응답을 읽을 수 없으므로 성공으로 간주
            return {
                success: true,
                message: '신청이 완료되었습니다.'
            };
        } catch (noCorsError) {
            throw noCorsError;
        }
    }
}

/**
 * 메시지 표시
 */
function showMessage(message, type) {
    formMessage.innerHTML = message;
    formMessage.className = `form-message ${type}`;
    formMessage.style.display = 'block';
    
    // 메시지 위치로 스크롤
    formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // 성공 메시지는 10초 후 자동 숨김
    if (type === 'success') {
        setTimeout(() => {
            formMessage.style.display = 'none';
        }, 10000);
    }
}

/**
 * 부드러운 스크롤 네비게이션 설정
 */
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetElement.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * 스크롤 애니메이션 설정
 */
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // 애니메이션 적용할 요소들
    const animateElements = document.querySelectorAll(
        '.program-card, .diff-card'
    );
    
    animateElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
}

/**
 * 헤더 스크롤 효과
 */
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    
    if (window.scrollY > 100) {
        header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.5)';
    } else {
        header.style.boxShadow = 'none';
    }
});
