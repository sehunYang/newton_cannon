import { els } from './dom.js';

/**
 * 모바일 세로 모드 동적 레이아웃.
 *
 * CSS 만으로는 안 되는 이유: 하단 컨트롤 패널의 높이가 내용/폰트/안전영역에
 * 따라 달라지는데, 그 위에 버튼 그룹과 체크박스를 겹치지 않게 쌓아야 합니다.
 * 그래서 실측 offsetHeight 를 읽어 bottom 값을 계산합니다.
 *
 * requestAnimationFrame 을 세 번 겹쳐 쓰는 이유는 레이아웃 확정 순서 때문입니다:
 *   1프레임: 컨트롤 패널 높이 확정 → 버튼 그룹 배치
 *   2프레임: 버튼 그룹 높이 확정 → 체크박스 그룹 배치
 *   3프레임: 체크박스 위치 확정 → 그 위와 HUD 아래 사이에 에너지 그래프 배치
 *
 * @param {() => void} [onDone] 배치가 끝난 뒤 호출 (에너지 그래프가 캔버스 백버퍼를 다시 잡습니다)
 */
const GAP = 8;
const SIDE = '18px';

export function updateMobileLayout(onDone) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isPortraitMobile = vw <= 767 && vh >= 480;

  const ctrlPanel = els.ctrlPanel();
  const btnGroup = els.btnGroup();
  const checkGroup = els.checkGroup();
  const energyPanel = els.energyPanel();
  if (!ctrlPanel || !btnGroup || !checkGroup) return;

  if (!isPortraitMobile) {
    // 가로 모드 / 데스크톱: 인라인 스타일을 지워 CSS 기본값으로 되돌립니다
    ctrlPanel.style.cssText = '';
    btnGroup.style.cssText = '';
    checkGroup.style.cssText = '';
    if (energyPanel) {
      energyPanel.style.cssText = '';
      energyPanel.classList.remove('no-room');
    }
    onDone?.();
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

      requestAnimationFrame(() => {
        placeEnergyPanel(energyPanel, checkGroup, vh);
        onDone?.();
      });
    });
  });
}

/**
 * 에너지 그래프를 HUD 아래 · 체크박스 위의 빈 띠에 가로로 펼칩니다.
 * 남는 높이가 모자라면(작은 폰) 숨깁니다 — 시뮬레이션 화면을 덮는 것보다 낫습니다.
 */
function placeEnergyPanel(panel, checkGroup, vh) {
  if (!panel) return;
  const hud = els.hudPanel();
  const top = (hud ? hud.getBoundingClientRect().bottom : 60) + GAP;
  const room = checkGroup.getBoundingClientRect().top - GAP - top;

  panel.style.top = top + 'px';
  panel.style.left = SIDE;
  panel.style.right = SIDE;
  panel.style.bottom = 'auto';
  panel.style.width = 'auto';

  // 실제 높이를 재서 판단합니다 (CSS 로 정해지는 값이라 추정하면 어긋납니다).
  // 숨긴 상태에서는 높이가 0 이므로 일단 보이게 한 뒤 잽니다.
  panel.classList.remove('no-room');
  panel.classList.toggle('no-room', room < panel.offsetHeight);
}

/** 회전 직후에는 innerHeight 가 아직 갱신 전이라 약간의 지연이 필요합니다 */
export function bindOrientationChange(onChange) {
  window.addEventListener('orientationchange', () => setTimeout(onChange, 300));
}
