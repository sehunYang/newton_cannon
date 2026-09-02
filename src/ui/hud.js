import { fmtAlt, fmtDist, fmtSpeed, fmtTime } from '../core/format.js';
import { classifyPreview, classifyLive } from '../physics/orbit.js';
import { createLaunchState } from '../sim/launchState.js';
import { els } from './dom.js';

/**
 * 우상단 텔레메트리 패널 + 좌상단 줌 배지.
 *
 * HUD 는 **읽기 전용**입니다. 시뮬레이션 상태를 받아 화면에 옮길 뿐,
 * 물리를 바꾸거나 버튼을 조작하지 않습니다(그건 App 의 몫).
 */
export class Hud {
  #lastZoomText = '';

  /** 발사 전/리셋 상태 — 슬라이더 속도로 결과를 미리 알려줍니다 */
  showIdle(config) {
    els.hudSpeed().textContent = '— m/s';
    els.hudAlt().textContent = '—';
    els.hudTime().textContent = '0.0 s';

    const preview = classifyPreview(createLaunchState(config));
    const badge = els.hudOrbit();
    badge.textContent = preview.txt;
    badge.className = 'orbit-badge ' + preview.cls;

    els.hudStats().style.display = 'none';
    this.setBorder(null);
  }

  /**
   * 비행 중 / 비행 종료 상태
   * @param {string} [modeId] 현재 화면. 지표면 모드에서는 사거리를 실시간으로 보여줍니다.
   */
  showFlight(sim, modeId = 'orbital') {
    els.hudSpeed().textContent = fmtSpeed(sim.speed);
    // 지표면 아래 고도는 표시상 의미가 없습니다 (착탄 시 부동소수 오차로 -0 m 방지)
    els.hudAlt().textContent = fmtAlt(Math.max(0, sim.altitude));
    els.hudTime().textContent = fmtTime(sim.elapsed);

    const { txt, cls, border } = this.#classify(sim);
    const badge = els.hudOrbit();
    badge.textContent = txt;
    badge.className = 'orbit-badge ' + cls;
    this.setBorder(border);

    this.#showStats(sim, modeId);
  }

  #classify(sim) {
    if (sim.done && sim.outcome === 'impact') {
      return { txt: '💥 충돌', cls: 'impact2', border: 'impact' };
    }
    if (sim.done && sim.outcome === 'escape') {
      return { txt: '🚀 탈출', cls: 'escape2', border: 'escape' };
    }
    return classifyLive(sim.pos, sim.vel);
  }

  #showStats(sim, modeId) {
    els.hudStats().style.display = 'block';
    els.hudMaxAlt().textContent = fmtAlt(sim.stats.maxAlt);

    const impactRow = els.hudImpactRow();
    const distRow = els.hudDistRow();

    // 지표면 모드에서는 '지금까지 날아온 거리'가 가장 중요한 값이라
    // 착탄을 기다리지 않고 실시간으로 보여줍니다.
    if (modeId === 'surface' && sim.active) {
      impactRow.style.display = 'none';
      distRow.style.display = 'flex';
      els.hudDist().textContent = fmtDist(sim.groundDistance);
      return;
    }

    if (sim.done && sim.outcome === 'impact') {
      impactRow.style.display = 'flex';
      distRow.style.display = 'flex';
      els.hudImpactAngle().textContent = sim.stats.impactAngle.toFixed(1) + '°';
      els.hudDist().textContent = fmtDist(sim.stats.flightDist);
      return;
    }

    impactRow.style.display = 'none';
    if (sim.done && sim.outcome === 'escape') {
      distRow.style.display = 'flex';
      const t = sim.elapsed;
      els.hudDist().textContent = t < 86400
        ? (t / 3600).toFixed(1) + ' hr 비행'
        : (t / 86400).toFixed(1) + ' day 비행';
    } else {
      distRow.style.display = 'none';
    }
  }

  /** 패널 테두리 색으로 궤도 종류를 한눈에 (null 이면 기본색) */
  setBorder(state) {
    const panel = els.hudPanel();
    panel.classList.remove('impact', 'orbit', 'escape');
    if (state) panel.classList.add(state);
  }

  /** 줌 배지 — 매 프레임 호출되므로 값이 바뀔 때만 DOM 을 건드립니다 */
  setZoom(value) {
    const text = value.toFixed(2) + '×';
    if (text === this.#lastZoomText) return;
    this.#lastZoomText = text;
    els.zoomVal().textContent = text;
  }
}
