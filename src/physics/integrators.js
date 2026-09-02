/**
 * 수치 적분기.
 *
 * 전부 같은 계약을 지킵니다:
 *   step(state, dt, accelFn) -> { pos, vel, acc }
 *   state   : { pos:{x,y}, vel:{x,y}, acc:{x,y} }
 *   accelFn : (pos, vel) => {x, y}
 *
 * 새 적분기를 추가하고 싶으면 이 시그니처만 지키면 시뮬레이션 쪽은
 * 한 줄도 안 고쳐도 됩니다.
 */

/**
 * 속도 벌레(Velocity Verlet) — 심플렉틱 적분기.
 * 에너지 드리프트가 거의 없어서 궤도가 서서히 나선형으로 무너지지 않습니다.
 * (오일러법을 쓰면 학생들이 "왜 궤도가 점점 커지죠?" 라고 묻게 됩니다.)
 */
export function velocityVerlet(state, dt, accelFn) {
  const { pos, vel, acc } = state;
  const newPos = {
    x: pos.x + vel.x * dt + 0.5 * acc.x * dt * dt,
    y: pos.y + vel.y * dt + 0.5 * acc.y * dt * dt,
  };
  // 항력처럼 속도 의존 힘이 있으면 여기서 예측 속도를 써야 정확도가 유지됩니다.
  const predVel = { x: vel.x + acc.x * dt, y: vel.y + acc.y * dt };
  const newAcc = accelFn(newPos, predVel);
  const newVel = {
    x: vel.x + 0.5 * (acc.x + newAcc.x) * dt,
    y: vel.y + 0.5 * (acc.y + newAcc.y) * dt,
  };
  return { pos: newPos, vel: newVel, acc: newAcc };
}

/** 4차 룽게-쿠타 — 정확도가 필요할 때(짧은 준궤도 구간 등). */
export function rk4(state, dt, accelFn) {
  const { pos, vel } = state;
  const deriv = (p, v) => ({ dp: v, dv: accelFn(p, v) });

  const k1 = deriv(pos, vel);
  const k2 = deriv(
    { x: pos.x + k1.dp.x * dt / 2, y: pos.y + k1.dp.y * dt / 2 },
    { x: vel.x + k1.dv.x * dt / 2, y: vel.y + k1.dv.y * dt / 2 },
  );
  const k3 = deriv(
    { x: pos.x + k2.dp.x * dt / 2, y: pos.y + k2.dp.y * dt / 2 },
    { x: vel.x + k2.dv.x * dt / 2, y: vel.y + k2.dv.y * dt / 2 },
  );
  const k4 = deriv(
    { x: pos.x + k3.dp.x * dt, y: pos.y + k3.dp.y * dt },
    { x: vel.x + k3.dv.x * dt, y: vel.y + k3.dv.y * dt },
  );

  const newPos = {
    x: pos.x + (dt / 6) * (k1.dp.x + 2 * k2.dp.x + 2 * k3.dp.x + k4.dp.x),
    y: pos.y + (dt / 6) * (k1.dp.y + 2 * k2.dp.y + 2 * k3.dp.y + k4.dp.y),
  };
  const newVel = {
    x: vel.x + (dt / 6) * (k1.dv.x + 2 * k2.dv.x + 2 * k3.dv.x + k4.dv.x),
    y: vel.y + (dt / 6) * (k1.dv.y + 2 * k2.dv.y + 2 * k3.dv.y + k4.dv.y),
  };
  return { pos: newPos, vel: newVel, acc: accelFn(newPos, newVel) };
}
