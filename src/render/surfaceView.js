import { R_EARTH } from '../core/constants.js';

/**
 * 지표면 모드 레이어들이 공유하는 기하 헬퍼.
 *
 * 이 화면에서 '지표면'은 화면 좌표계에서 정확히 하나의 원입니다:
 *   중심 (vp.ox, vp.oy), 반지름 vp.rSurfacePx
 * 지구 중심이 화면 아래 수천~수만 px 에 있으므로, 화면에 보이는 건
 * 그 거대한 원의 아주 짧은 꼭대기 호 — 즉 '완만하게 휜 지평선'입니다.
 */

/** 발사 지점의 세계 좌표계 방향각. 대포는 +y(12시)에 있습니다. */
export const LAUNCH_ANGLE = Math.PI / 2;

/**
 * 발사 지점에서 지표면을 따라 distance(m) 떨어진 지점의 월드 좌표.
 * 포탄이 +x 방향으로 날아가므로 각도는 감소합니다.
 */
export function groundWorldAt(distance, radius = R_EARTH) {
  const a = LAUNCH_ANGLE - distance / R_EARTH;
  return { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
}

/** 발사 지점 기준 distance(m), 고도 alt(m) 인 지점의 월드 좌표 */
export function skyWorldAt(distance, alt) {
  return groundWorldAt(distance, R_EARTH + alt);
}

/**
 * 화면 x 픽셀에서의 지표면 y 픽셀.
 * 지표면 원 위의 점이므로 y = oy − √(R² − dx²).
 */
export function groundYAt(vp, x) {
  const dx = x - vp.ox;
  const R = vp.rSurfacePx;
  if (Math.abs(dx) >= R) return vp.oy; // 지평선 밖 (실사용에선 발생하지 않음)
  return vp.oy - Math.sqrt(R * R - dx * dx);
}

/**
 * 화면 x 픽셀 아래 지표면 지점의 '발사 지점에서 잰 거리'(m).
 * `groundYAt` 의 역방향 짝 — 지형 무늬가 지표면에 붙어 있으려면 필요합니다.
 *
 * 발사 지점은 월드 (0, R_EARTH) 이고 화면에서는 언제나 x = vp.ox 입니다
 * (worldToScreen 이 방향 벡터를 그대로 쓰므로). 지표면 원 위에서 화면 x 가
 * dx 만큼 떨어진 점의 중심각은 asin(dx / R_px) 이고, 거리는 그 각 × R_EARTH 입니다.
 */
export function groundDistanceAt(vp, x) {
  const t = (x - vp.ox) / vp.rSurfacePx;
  return Math.asin(Math.max(-1, Math.min(1, t))) * R_EARTH;
}

/**
 * 화면을 가로지르는 지표면 폴리라인. 지형·격자·비교선이 모두 이걸 씁니다.
 * @returns {{x:number,y:number}[]}
 */
export function groundPolyline(vp, { step = 8, margin = 40 } = {}) {
  const pts = [];
  for (let x = -margin; x <= vp.width + margin; x += step) {
    pts.push({ x, y: groundYAt(vp, x) });
  }
  pts.push({ x: vp.width + margin, y: groundYAt(vp, vp.width + margin) });
  return pts;
}

/**
 * 사람이 읽기 좋은 눈금 간격을 고릅니다 (1·2·5 × 10ⁿ).
 * @param {number} rough 원하는 대략적 간격
 */
export function niceStep(rough) {
  const exp = Math.floor(Math.log10(rough));
  const base = 10 ** exp;
  const n = rough / base;
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return mult * base;
}

/** 거리(m) 짧은 라벨 — 눈금용이라 소수점을 아낍니다 */
export function tickLabel(m) {
  if (m === 0) return '0';
  if (m < 1000) return Math.round(m) + ' m';
  const km = m / 1000;
  return (km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString()) + ' km';
}
