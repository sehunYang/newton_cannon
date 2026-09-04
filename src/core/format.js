/** 숫자 → 사람이 읽는 문자열. 학생이 보는 단위 표기는 전부 여기서 결정됩니다. */

export function fmtAlt(m) {
  if (m < 1000) return m.toFixed(0) + ' m';
  if (m < 1e6) return (m / 1000).toFixed(1) + ' km';
  return (m / 1000).toFixed(0) + ' km';
}

export function fmtDist(m) {
  if (m < 1000) return m.toFixed(0) + ' m';
  if (m < 1e6) return (m / 1000).toFixed(0) + ' km';
  return (m / 1e6).toFixed(2) + ' Mm';
}

export function fmtTime(s) {
  if (s < 3600) return s.toFixed(0) + ' s';
  if (s < 86400) return (s / 3600).toFixed(2) + ' hr';
  return (s / 86400).toFixed(2) + ' day';
}

export const fmtSpeed = (v) => v.toFixed(0) + ' m/s';
/** 슬라이더 눈금이 50 m/s 라 소수 둘째 자리까지 보여줍니다 */
export const fmtSpeedKms = (v) => (v / 1000).toFixed(2) + ' km/s';

/**
 * 사람이 읽기 좋은 눈금 간격을 고릅니다 (1·2·5 × 10ⁿ).
 * 지표면 거리 눈금과 에너지 그래프 축이 함께 씁니다.
 * @param {number} rough 원하는 대략적 간격
 */
export function niceStep(rough) {
  const exp = Math.floor(Math.log10(rough));
  const base = 10 ** exp;
  const n = rough / base;
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return mult * base;
}

/**
 * [lo, hi] 안에 들어가는 nice 간격의 눈금 값들.
 *
 * 값을 더해 가지 않고 **정수 인덱스 × 간격**으로 만드는 이유: 0.1 을 스무 번 더하면
 * 2.0000000000000004 가 되어 눈금이 '2.0' 이 아니라 축 밖으로 밀려납니다.
 *
 * @returns {{step:number, values:number[]}}
 */
export function niceTicks(lo, hi, maxCount) {
  const step = niceStep((hi - lo) / Math.max(1, maxCount));
  const values = [];
  for (let i = Math.ceil(lo / step); i * step <= hi; i++) values.push(i * step);
  return { step, values };
}
