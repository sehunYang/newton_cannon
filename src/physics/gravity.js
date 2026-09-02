import { GM, R_EARTH } from '../core/constants.js';

/**
 * 점질량 중력장.
 *
 * 확장 지점: 이 모듈은 "가속도 제공자(acceleration provider)" 인터페이스
 *   (pos, vel) => {x, y}
 * 를 따릅니다. 대기 항력·달 중력·비구형 중력(J2) 을 추가하려면
 * 같은 시그니처의 함수를 만들고 combine() 으로 합치면 됩니다.
 * 적분기는 어떤 힘이 들어있는지 전혀 몰라도 됩니다.
 */
export function pointMassGravity(pos, _vel, gm = GM) {
  const r2 = pos.x * pos.x + pos.y * pos.y;
  const r = Math.sqrt(r2);
  if (r < 1) return { x: 0, y: 0 };
  const a = -gm / r2;
  return { x: a * (pos.x / r), y: a * (pos.y / r) };
}

/**
 * 지수 대기 모형 항력 — 아직 쓰지 않지만 준궤도(지표면) 모드에서
 * "왜 낮은 궤도는 오래 못 버티나"를 보여줄 때 켤 수 있게 미리 둡니다.
 * @param {number} ballisticCoeff 탄도계수 m/(Cd·A), 클수록 항력에 둔감
 */
export function atmosphericDrag(pos, vel, { scaleHeight = 8500, rho0 = 1.225, ballisticCoeff = 2000 } = {}) {
  const alt = Math.hypot(pos.x, pos.y) - R_EARTH;
  if (alt > 1.5e5 || alt < 0) return { x: 0, y: 0 };
  const rho = rho0 * Math.exp(-alt / scaleHeight);
  const v = Math.hypot(vel.x, vel.y);
  if (v < 1e-6) return { x: 0, y: 0 };
  const k = -0.5 * rho * v / ballisticCoeff;
  return { x: k * vel.x, y: k * vel.y };
}

/** 여러 가속도 제공자를 하나로 합칩니다. */
export function combine(...providers) {
  return (pos, vel) => {
    let ax = 0, ay = 0;
    for (const p of providers) {
      const a = p(pos, vel);
      ax += a.x; ay += a.y;
    }
    return { x: ax, y: ay };
  };
}
