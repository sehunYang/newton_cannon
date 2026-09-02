import { GM, R_LAUNCH } from '../core/constants.js';

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
