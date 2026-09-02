import { R_EARTH, GM, ESCAPE_RADIUS } from '../core/constants.js';
import { pointMassGravity } from '../physics/gravity.js';
import { velocityVerlet } from '../physics/integrators.js';

/**
 * 발사 전에 궤적을 미리 훑어 '화면에 어떻게 담을지'에 필요한 값만 뽑습니다.
 *
 * 왜 필요한가: 지표면 모드는 궤적 전체가 한 화면에 들어오도록 축척을
 * 정해야 하는데, 그러려면 최고 고도와 사거리를 **쏘기 전에** 알아야 합니다.
 *
 * 왜 해석적으로 풀지 않고 적분하는가: 케플러 궤도 요소로 원지점은 바로
 * 나오지만 '지표면과 만나는 지점까지의 호 길이'는 케플러 방정식을 풀어야
 * 합니다. 어차피 실제 시뮬과 같은 물리를 써야 프레이밍이 어긋나지 않으므로,
 * 굵은 간격(1초)으로 한 번 훑는 편이 단순하고 정확합니다.
 * 12분짜리 비행도 700스텝 남짓이라 비용은 무시할 수준입니다.
 *
 * @returns {{
 *   apexAlt:number, arcLength:number, angularSpan:number,
 *   duration:number, impactPos:{x,y}|null, hitGround:boolean
 * }}
 */
export function predictTrajectory({ pos, vel }, {
  dt = 1,
  maxSteps = 200000,
  surfaceRadius = R_EARTH,
  escapeRadius = ESCAPE_RADIUS,
} = {}) {
  let state = { pos: { ...pos }, vel: { ...vel }, acc: pointMassGravity(pos, vel) };

  let apexAlt = Math.hypot(pos.x, pos.y) - surfaceRadius;
  let angularSpan = 0;
  let prevAngle = Math.atan2(pos.y, pos.x);
  let elapsed = 0;
  let hitGround = false;
  let impactPos = null;

  for (let i = 0; i < maxSteps; i++) {
    const prev = state.pos;
    state = velocityVerlet(state, dt, pointMassGravity);
    elapsed += dt;

    const r = Math.hypot(state.pos.x, state.pos.y);
    apexAlt = Math.max(apexAlt, r - surfaceRadius);

    // 누적 회전각 (−π~π 정규화로 부호 뒤집힘 방지)
    const angle = Math.atan2(state.pos.y, state.pos.x);
    let d = angle - prevAngle;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    angularSpan += Math.abs(d);
    prevAngle = angle;

    if (r <= surfaceRadius) {
      hitGround = true;
      // 실제 시뮬과 같은 방식으로 착탄점 근사 (선형 보간 → 구면 투영)
      const prevR = Math.hypot(prev.x, prev.y);
      const t = (prevR - surfaceRadius) / (prevR - r);
      const px = prev.x + (state.pos.x - prev.x) * t;
      const py = prev.y + (state.pos.y - prev.y) * t;
      const k = surfaceRadius / Math.hypot(px, py);
      impactPos = { x: px * k, y: py * k };
      break;
    }
    // 시뮬레이터와 같은 기준: 멀리 갔고 + 속박되지 않았을 때만 탈출
    if (r >= escapeRadius
        && (state.vel.x ** 2 + state.vel.y ** 2) / 2 - GM / r >= 0) break;
  }

  return {
    apexAlt,
    angularSpan,
    arcLength: angularSpan * surfaceRadius,
    duration: elapsed,
    impactPos,
    hitGround,
  };
}
