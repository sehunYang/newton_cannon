import { GM } from '../core/constants.js';

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
