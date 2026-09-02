import { V1, V2 } from '../core/constants.js';

/**
 * 속도 → 색 매핑. 궤적·포탄·꼬리가 모두 이 함수를 씁니다.
 *
 * 색이 곧 물리량이라는 게 핵심입니다:
 *   느림(주황) → 제1 우주속도(청록) → 제2 우주속도 이상(보라)
 * 학생이 궤적 색만 봐도 "여기서 속도가 빨라졌다/느려졌다"를 읽을 수 있습니다.
 */
export function trailColor(spd, alpha) {
  const t1 = Math.min(1, spd / V1);
  const t2 = Math.min(1, Math.max(0, (spd - V1) / (V2 - V1)));
  const r = Math.round(255 * (1 - t1) * 0.8 + 58 * t1 * (1 - t2) + 180 * t2);
  const g = Math.round(160 * (1 - t1) * 0.5 + 200 * t1 * (1 - t2) + 80 * t2);
  const b = Math.round(40 * (1 - t1) + 255 * t1 * (1 - t2) + 255 * t2);
  return `rgba(${r},${g},${b},${alpha})`;
}
