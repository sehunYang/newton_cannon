import { SURFACE_SCALE } from '../core/constants.js';
import { RadialLinearProjection } from './projections/RadialLinearProjection.js';

/**
 * 월드(미터) ↔ 화면(픽셀) 변환과 줌을 담당합니다.
 *
 * 핵심 구조: **모든 변환은 극좌표 기반**입니다.
 *   (1) 월드 좌표 → 반지름 r 과 단위 방향 (nx, ny)
 *   (2) r → 화면 반지름 px  ← 이 단계만 projection 이 담당
 *   (3) 화면 원점(ox, oy) + 방향 × px
 *
 * 그래서 다른 화면(지표면 클로즈업 등)을 추가할 때
 * `viewport.projection` 만 갈아끼우면 궤적·포탄·격자·마커 렌더 코드는
 * 한 줄도 안 고쳐도 됩니다.
 */
export class Viewport {
  width = 0;
  height = 0;

  /** 화면상 지구 중심의 위치 (Camera 가 매 프레임 써 넣음) */
  ox = 0;
  oy = 0;

  /** 줌 = 1 일 때의 지구 반지름 (px) */
  baseR = 0;

  /** 현재 줌으로 계산된 파생값 (투영이 채웁니다) */
  rSurfacePx = 0;
  rMountPx = 0;

  /**
   * UI 요소(포탄·마커) 크기 기준 픽셀.
   *
   * rSurfacePx 와 분리한 이유: 지표면 모드에서는 지구 반지름이 화면상
   * 수만 px 이 되므로, 그 값으로 포탄 크기를 잡으면 화면을 다 덮습니다.
   * 궤도 모드에서는 rSurfacePx 와 같은 값이라 동작이 그대로입니다.
   */
  uiScale = 0;

  zoom = { current: 1, target: 1 };

  constructor({ projection = RadialLinearProjection, surfaceScale = SURFACE_SCALE } = {}) {
    this.projection = projection;
    this.surfaceScale = surfaceScale;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.ox = width / 2;
    this.oy = height / 2;
    // 줌 1 에서 지구 반지름이 화면 짧은 변의 25%
    this.baseR = Math.min(width, height) * 0.25;
    this.recomputeDerived();
  }

  /**
   * 줌을 목표치로 지수 보간합니다.
   * 축소(멀어짐)는 빠르게, 복귀(가까워짐)는 조금 느리게 — 포탄을 놓치지 않으면서
   * 화면이 덜컥거리지 않게 하는 비대칭 감쇠입니다.
   */
  updateZoom() {
    const z = this.zoom;
    const k = z.current > z.target ? 0.07 : 0.05;
    z.current += (z.target - z.current) * k;
    if (Math.abs(z.current - z.target) < 0.0005) z.current = z.target;
    this.recomputeDerived();
  }

  setZoom(value, { immediate = false } = {}) {
    this.zoom.target = value;
    if (immediate) this.zoom.current = value;
    this.recomputeDerived();
  }

  /** 투영을 갈아끼웁니다 (모드 전환 시). 파생값도 즉시 다시 계산합니다. */
  setProjection(projection) {
    this.projection = projection;
    this.recomputeDerived();
  }

  /**
   * 화면 반지름 파생값 계산을 투영에 위임합니다.
   * 지구를 얼마 크기로 그릴지는 '어떤 화면인가'의 문제이지 뷰포트의 문제가 아닙니다.
   */
  recomputeDerived() {
    this.projection.computeMetrics(this);
  }

  /** 월드 반지름(m) → 화면 반지름(px) */
  rToScreen(rWorld) {
    return this.projection.rToScreen(this, rWorld);
  }

  /** 월드 좌표(m) → 화면 좌표(px). y축은 화면에서 뒤집힙니다. */
  worldToScreen(wx, wy) {
    const r = Math.hypot(wx, wy);
    if (r < 1) return { x: this.ox, y: this.oy };
    const rPx = this.rToScreen(r);
    return { x: this.ox + (wx / r) * rPx, y: this.oy - (wy / r) * rPx };
  }

  /**
   * 임시로 다른 화면 원점을 기준으로 변환할 때 사용합니다.
   * (궤적 오프스크린 캐시 렌더링이 이걸 씁니다)
   */
  withOrigin(ox, oy, fn) {
    const sx = this.ox, sy = this.oy;
    this.ox = ox; this.oy = oy;
    try { return fn(); } finally { this.ox = sx; this.oy = sy; }
  }
}
