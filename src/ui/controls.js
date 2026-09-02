import { V1, V2, SPEED_SLIDER_MAX } from '../core/constants.js';
import { EV } from '../core/events.js';
import { fmtSpeedKms } from '../core/format.js';
import { els } from './dom.js';

/**
 * 입력 위젯 ↔ 이벤트 버스 배선.
 *
 * 여기 있는 코드는 **상태를 소유하지 않습니다.** 사용자가 무언가를 조작하면
 * 버스에 사실만 알리고, 실제 상태 변경은 App 이 합니다.
 * 덕분에 나중에 프리셋 버튼("달까지 쏘기")이나 URL 공유 기능을 붙일 때
 * 슬라이더를 흉내 낼 필요 없이 같은 이벤트만 쏘면 됩니다.
 */
export function bindControls(bus, initial) {
  const sAng = els.sliderAngle();
  const sSpd = els.sliderSpeed();

  sAng.value = initial.angleDeg;
  sSpd.value = initial.initSpeed;
  syncAngleLabel(initial.angleDeg);
  syncSpeedLabel(initial.initSpeed);

  sAng.addEventListener('input', () => {
    const angleDeg = parseInt(sAng.value, 10);
    syncAngleLabel(angleDeg);
    bus.emit(EV.CONFIG_CHANGED, { angleDeg });
  });

  sSpd.addEventListener('input', () => {
    const initSpeed = parseInt(sSpd.value, 10);
    syncSpeedLabel(initSpeed);
    bus.emit(EV.CONFIG_CHANGED, { initSpeed });
  });

  els.chkTrail().addEventListener('change', (e) => {
    bus.emit(EV.DISPLAY_CHANGED, { showTrail: e.target.checked });
  });
  els.chkGrid().addEventListener('change', (e) => {
    bus.emit(EV.DISPLAY_CHANGED, { showGrid: e.target.checked });
  });

  els.btnFire().addEventListener('click', () => bus.emit(EV.LAUNCH_REQUESTED));
  els.btnReset().addEventListener('click', () => bus.emit(EV.RESET_REQUESTED));

  for (const btn of els.speedButtons()) {
    btn.addEventListener('click', () =>
      bus.emit(EV.TIME_SCALE_CHANGED, { mult: parseInt(btn.dataset.mult, 10) }));
  }

  setTimeScale(initial.timeScale);
  return { setTimeScale, positionSpeedMarkers, setFireButtonLaunched, syncDisplayToggles, setModeBadge };
}

function syncAngleLabel(angleDeg) {
  els.valAngle().textContent = angleDeg + '°';
}

function syncSpeedLabel(initSpeed) {
  els.valSpeed().textContent = fmtSpeedKms(initSpeed);
  updateSpeedSliderBg(initSpeed);
}

/**
 * 속도 슬라이더 트랙 색을 결과에 맞춰 칠합니다.
 * 슬라이더를 잡고 움직이는 동안 색이 바뀌는 순간이 곧
 * "여기가 제1/제2 우주속도"라는 시각적 신호가 됩니다.
 */
export function updateSpeedSliderBg(v) {
  const pct = (v / SPEED_SLIDER_MAX) * 100;
  const col = v < V1 * 0.94 ? '#cc6020'   // 낙하
    : v < V2 * 0.98 ? '#3a8eff'           // 궤도
    : '#7ef0c8';                          // 탈출

  els.sliderSpeed().style.background =
    `linear-gradient(to right, ${col} 0%, ${col} ${pct}%, ` +
    `rgba(60,100,180,0.30) ${pct}%, rgba(60,100,180,0.30) 100%)`;
}

/** V1 / V2 눈금을 슬라이더 위 정확한 비율 위치에 놓습니다 */
export function positionSpeedMarkers() {
  els.markerV1().style.left = (V1 / SPEED_SLIDER_MAX) * 100 + '%';
  els.markerV2().style.left = (V2 / SPEED_SLIDER_MAX) * 100 + '%';
}

export function setTimeScale(mult) {
  for (const b of els.speedButtons()) {
    b.classList.toggle('active', parseInt(b.dataset.mult, 10) === mult);
  }
  els.simSpeedVal().textContent = '×' + mult;
  els.simSpeedBadge().style.display = 'flex';
}

/**
 * 현재 화면(모드)을 좌상단에 알립니다.
 * 기본 화면인 궤도 모드에서는 배지를 숨겨 화면을 비워 둡니다.
 */
const MODE_LABELS = { surface: '지표면' };

export function setModeBadge(modeId) {
  const label = MODE_LABELS[modeId];
  els.modeBadge().style.display = label ? 'flex' : 'none';
  if (label) els.modeVal().textContent = label;
}

export function setFireButtonLaunched(launched) {
  const btn = els.btnFire();
  btn.classList.toggle('launched', launched);
  btn.textContent = launched ? '⏳ 비행 중' : '🚀 발사';
}

/** 체크박스 상태를 화면 옵션과 맞춥니다(단축키로 바꿨을 때) */
export function syncDisplayToggles({ showTrail, showGrid }) {
  els.chkTrail().checked = showTrail;
  els.chkGrid().checked = showGrid;
}
