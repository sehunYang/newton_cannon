import { GM, R_LAUNCH, R_EARTH, ESCAPE_RADIUS } from '../core/constants.js';
import { orbitalElements } from './orbit.js';

/**
 * 비에너지(단위 질량당 에너지) — 포탄 1 kg 이 가진 에너지. 단위 J/kg.
 *
 *   운동   K = v²/2
 *   퍼텐셜 U = −GM/r     (무한히 먼 곳을 0 으로 잡은 기준 — 그래서 항상 음수)
 *   역학적 E = K + U     (보존량)
 *
 * 질량을 가정하지 않는 이유: 중력 가속도가 질량과 무관하므로 궤도도 질량과
 * 무관합니다. m 을 곱하면 세 값이 모두 같은 배율로 커질 뿐 그래프 모양은 같습니다.
 *
 * E 의 **부호가 곧 궤도의 운명**입니다. E < 0 이면 속박(타원), E = 0 이면 포물선,
 * E > 0 이면 탈출(쌍곡선). `orbitalElements` 의 energy 와 같은 값이며,
 * `ProjectileSim.unbound` 도 이 부호로 탈출을 판정합니다.
 */

export function specificEnergy(pos, vel, gm = GM) {
  const r = Math.hypot(pos.x, pos.y);
  const k = (vel.x * vel.x + vel.y * vel.y) / 2;
  const u = -gm / r;
  return { k, u, e: k + u };
}

/**
 * 퍼텐셜의 기준점을 무한대에서 **발사 지점**으로 옮길 때 더하는 상수 (J/kg).
 *
 *   U' = U + U_LAUNCH_REF = GM/R_발사 − GM/r  ≥ 0   (발사 지점에서 0, 높이 올라갈수록 증가)
 *
 * 그래프가 이 기준을 쓰는 이유는 **눈금이 그 비행의 에너지 규모에 맞춰지기** 때문입니다.
 * 무한대 기준으로 그리면 축의 대부분을 정보가 없는 상수(−62.5 MJ/kg)가 차지해서,
 * 2 km/s 발사에서는 실제 변화가 축의 1.6% 밖에 안 돼 눈에 보이지 않습니다.
 *
 * 물리적으로는 상수를 더한 것뿐이라 곡선의 모양·에너지 보존·교환 관계가 모두 그대로이고,
 * 지표 근처에서는 U' ≈ gh 라 교과서의 mgh 와 곧바로 이어집니다(고도 100 km 에서 0.96 MJ/kg).
 *
 * 이 값은 곧 **탈출에 필요한 에너지**이기도 합니다 — E' = U_LAUNCH_REF 가 무한대 기준의 E = 0.
 */
export const U_LAUNCH_REF = GM / R_LAUNCH;

/**
 * 이 발사에서 세 곡선이 **훑게 될 값의 범위** (J/kg, 발사 지점 기준).
 *
 * 역학적 에너지가 보존된다는 사실을 그래프의 눈금에 그대로 써먹습니다.
 * 발사 순간에 궤도가 정해지면 포탄이 오갈 수 있는 거리 구간 [근지점, 원지점] 도
 * 함께 정해지고, 그러면
 *
 *   U' 는 U'(r_min) ~ U'(r_max) 사이를 오가고,  K 는 E' − U' 라 정확히 그 반대로
 *
 * 움직인다는 것까지 **쏘기 전에** 알 수 있습니다. 데이터가 쌓이기를 기다릴 필요가 없으니
 * 첫 프레임부터 최종 눈금으로 그릴 수 있고, 비행 도중 축이 늘어나며 곡선 모양이
 * 바뀌는 일도 없습니다.
 *
 * 결과는 대개 정확히 [0, E'] 입니다 — 발사 지점에서 U' = 0, K = E' 이고 원지점에서
 * 그 둘이 자리를 바꾸기 때문입니다. 즉 **축 하나가 통째로 그 발사의 에너지**입니다.
 * (지표면까지 내려오는 발사는 U' 가 발사 고도 아래에서 살짝 음수라 아래로 조금 넓어지고,
 *  탈출 궤도는 시뮬레이션이 끝나는 거리까지만 U' 가 올라가 K 의 바닥이 0 보다 높습니다)
 *
 * @param {{x:number,y:number}} pos 발사 지점
 * @param {{x:number,y:number}} vel 발사 속도
 * @param {{surfaceRadius?:number, escapeRadius?:number}} bounds 시뮬레이션이 비행을 끝내는 거리
 * @returns {{e:number, lo:number, hi:number}} e 는 보존되는 역학적 에너지(발사 지점 기준)
 */
export function energySpan(pos, vel, {
  surfaceRadius = R_EARTH,
  escapeRadius = ESCAPE_RADIUS,
} = {}) {
  const e = specificEnergy(pos, vel).e + U_LAUNCH_REF;
  const { periapsis, apoapsis, bound } = orbitalElements(pos, vel);

  // 포탄이 실제로 오갈 수 있는 거리 구간. 근지점이 지표면 아래면 거기서 착탄으로
  // 비행이 끝나고, 속박되지 않은 궤도(원지점 = ∞)는 escapeRadius 에서 끝납니다.
  // 속박 궤도는 원지점이 escapeRadius 밖이어도 끝까지 따라가므로 자르지 않습니다.
  const rMin = Math.max(periapsis, surfaceRadius);
  const rMax = bound ? apoapsis : Math.min(apoapsis, escapeRadius);
  const uAt = (r) => U_LAUNCH_REF - GM / r; // r → ∞ 이면 U_LAUNCH_REF (= 탈출선)

  const uLo = uAt(rMin);
  const uHi = uAt(rMax);
  return {
    e,
    lo: Math.min(uLo, e - uHi, e),  // e − uHi = 가장 느린 곳(원지점)의 K
    hi: Math.max(uHi, e - uLo, e),  // e − uLo = 가장 빠른 곳(근지점)의 K
  };
}
