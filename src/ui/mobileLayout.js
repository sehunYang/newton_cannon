import { els } from './dom.js';

/**
 * 모바일 세로 모드 동적 레이아웃.
 *
 * CSS 만으로는 안 되는 이유: 하단 컨트롤 패널의 높이가 내용/폰트/안전영역에
 * 따라 달라지는데, 그 위에 버튼 그룹과 체크박스를 겹치지 않게 쌓아야 합니다.
 * 그래서 실측 offsetHeight 를 읽어 bottom 값을 계산합니다.
 *
 * requestAnimationFrame 을 두 번 겹쳐 쓰는 이유는 레이아웃 확정 순서 때문입니다:
 *   1프레임: 컨트롤 패널 높이 확정 → 버튼 그룹 배치
 *   2프레임: 버튼 그룹 높이 확정 → 체크박스 그룹 배치
 */
const GAP = 8;
const SIDE = '18px';

export function updateMobileLayout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isPortraitMobile = vw <= 767 && vh >= 480;

  const ctrlPanel = els.ctrlPanel();
  const btnGroup = els.btnGroup();
  const checkGroup = els.checkGroup();
  if (!ctrlPanel || !btnGroup || !checkGroup) return;

  if (!isPortraitMobile) {
    // 가로 모드 / 데스크톱: 인라인 스타일을 지워 CSS 기본값으로 되돌립니다
    ctrlPanel.style.cssText = '';
    btnGroup.style.cssText = '';
    checkGroup.style.cssText = '';
    return;
  }

  requestAnimationFrame(() => {
    const ctrlH = ctrlPanel.offsetHeight;
    btnGroup.style.bottom = ctrlH + GAP + 'px';
    btnGroup.style.left = SIDE;
    btnGroup.style.right = SIDE;
    btnGroup.style.top = 'auto';

    requestAnimationFrame(() => {
      checkGroup.style.bottom = ctrlH + GAP + btnGroup.offsetHeight + GAP + 'px';
      checkGroup.style.left = SIDE;
      checkGroup.style.right = 'auto';
      checkGroup.style.transform = 'none';
    });
  });
}

/** 회전 직후에는 innerHeight 가 아직 갱신 전이라 약간의 지연이 필요합니다 */
export function bindOrientationChange(onChange) {
  window.addEventListener('orientationchange', () => setTimeout(onChange, 300));
}
