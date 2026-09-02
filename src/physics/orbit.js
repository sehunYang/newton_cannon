import { GM, R_EARTH, V1 } from '../core/constants.js';

/**
 * 케플러 궤도 요소 — 상태 벡터(위치·속도)로부터 궤도의 '모양'을 뽑아냅니다.
 *
 * 교육적으로 중요한 이유: 학생이 슬라이더를 움직였을 때
 * "왜 이 속도에서는 떨어지고 저 속도에서는 도는가"를 수치로 보여줄 수 있고,
 * 시뮬레이션을 끝까지 돌려보지 않아도 **근지점이 지표면 아래인지** 만으로
 * 충돌 여부를 즉시 판정할 수 있습니다. (지표면 모드 라우팅의 근거)
 *
 * @returns {{
 *   energy:number, a:number, e:number, h:number,
 *   periapsis:number, apoapsis:number, period:number|null, bound:boolean
 * }}
 */
export function orbitalElements(pos, vel, gm = GM) {
  const r = Math.hypot(pos.x, pos.y);
  const v2 = pos && vel ? vel.x * vel.x + vel.y * vel.y : 0;

  // 비에너지 ε = v²/2 − μ/r  (음수면 속박 궤도)
  const energy = v2 / 2 - gm / r;
  // 2D 비각운동량 (스칼라)
  const h = pos.x * vel.y - pos.y * vel.x;

  const bound = energy < 0;
  const a = Math.abs(energy) < 1e-12 ? Infinity : -gm / (2 * energy);
  // e = √(1 + 2εh²/μ²) — 수치 오차로 음수가 되는 걸 방지
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (gm * gm)));

  const periapsis = Number.isFinite(a) ? a * (1 - e) : (h * h) / gm / (1 + e);
  const apoapsis = bound && Number.isFinite(a) ? a * (1 + e) : Infinity;
  const period = bound && Number.isFinite(a) ? 2 * Math.PI * Math.sqrt(a ** 3 / gm) : null;

  return { energy, a, e, h, periapsis, apoapsis, period, bound };
}

/**
 * 이 발사가 '준궤도(지표면에 떨어지는)' 인가?
 *
 * 근지점이 지표면 아래면 궤도를 완주하지 못하고 반드시 착탄합니다.
 * 속도만 비교(spd < V1)하는 것보다 발사각까지 반영돼 정확합니다.
 *
 * 단, 근지점 조건만으로는 부족합니다. 탈출 궤도(쌍곡선)도 근지점은
 * 지표면 아래일 수 있는데, 이미 근지점을 지나 **바깥으로 멀어지는 중**이라면
 * 영원히 돌아오지 않습니다. 그래서 반경방향 속도를 함께 봅니다.
 */
export function isSuborbital(pos, vel, surfaceRadius = R_EARTH) {
  const { periapsis, bound } = orbitalElements(pos, vel);
  if (periapsis > surfaceRadius) return false;

  // 속박 궤도라면 언젠가 반드시 근지점으로 되돌아옵니다
  if (bound) return true;

  // 비속박 궤도: 밖으로 나가는 중이면 다시 떨어지지 않음
  const r = Math.hypot(pos.x, pos.y);
  const radialVel = (pos.x * vel.x + pos.y * vel.y) / r;
  return radialVel < 0;
}

/** 단순 기준: 제1 우주속도 미만인가. (설명용/폴백용) */
export const isBelowFirstCosmicSpeed = (speed) => speed < V1;

/**
 * 상태 벡터로 궤도의 종류를 분류합니다 — HUD 배지의 단일 출처.
 *
 * 속력만 보고 어림하지 않고 궤도 요소로 판정합니다. 그래서
 *  - 발사각이 있으면 같은 속력이라도 근지점이 지표 아래로 내려가 '낙하'가 되고,
 *  - 타원 궤도의 원지점에서 속력이 느려져도 여전히 '궤도'입니다.
 *    (국소 원궤도 속도와 비교하던 예전 방식은 원지점 근처에서 '낙하'로 오판했습니다)
 *
 * 이름에 대해: 제1 우주속도 미만의 '낙하'도 물리적으로는 포물선이 아니라
 * 지구 중심을 초점으로 하는 **타원의 일부(호)** 입니다. 포물선은 지표면 근처에서
 * 중력이 평행하다고 볼 때의 근사입니다. 지표면 모드가 보여주는 것이 바로 그 차이입니다.
 */
export function classifyState(pos, vel, surfaceRadius = R_EARTH) {
  const { bound, periapsis } = orbitalElements(pos, vel);
  if (!bound) return { txt: '탈출 궤도', cls: 'escape2', border: 'escape' };
  if (periapsis > surfaceRadius) return { txt: '타원/원 궤도', cls: 'orbit2', border: 'orbit' };
  return { txt: '타원 호 낙하', cls: 'fall', border: null };
}

/** 발사 전 미리보기 배지 — 슬라이더의 각도·속도로 만든 초기 상태를 분류합니다. */
export function classifyPreview({ pos, vel }) {
  if (Math.hypot(vel.x, vel.y) <= 200) return { txt: '미발사', cls: 'idle' };
  return classifyState(pos, vel);
}

/** 비행 중 실시간 분류 — 현재 상태 벡터로 판정합니다 (항력이 있어도 그 순간의 궤도) */
export const classifyLive = classifyState;

/** 주어진 반지름에서의 원궤도 속도 */
export const circularSpeedAt = (r) => Math.sqrt(GM / r);
/** 주어진 반지름에서의 탈출 속도 */
export const escapeSpeedAt = (r) => Math.sqrt((2 * GM) / r);
