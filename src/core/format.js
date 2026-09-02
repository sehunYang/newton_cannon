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
export const fmtSpeedKms = (v) => (v / 1000).toFixed(1) + ' km/s';
