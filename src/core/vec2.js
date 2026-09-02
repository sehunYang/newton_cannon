/** 2D 벡터 헬퍼 — 전부 순수 함수. {x, y} 평범한 객체를 그대로 씁니다. */

export const vec = (x = 0, y = 0) => ({ x, y });
export const clone = (a) => ({ x: a.x, y: a.y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a, k) => ({ x: a.x * k, y: a.y * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const len = (a) => Math.hypot(a.x, a.y);
export const len2 = (a) => a.x * a.x + a.y * a.y;

export function normalize(a) {
  const l = len(a);
  return l < 1e-12 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** a → b 선형 보간 (t: 0~1) */
export const lerp = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
