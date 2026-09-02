/**
 * 물리 검증: 시뮬레이터의 궤적이 원뿔곡선(타원·포물선·쌍곡선)과 일치하는가?
 *
 *   npm run verify:physics
 *
 * 점질량 중력장에서 궤적은 정확히
 *     r(θ) = p / (1 + e·cos(θ − ω))        (p = h²/μ, e = |e⃗|)
 * 이어야 합니다. 발사 초기 상태로부터 p, e, ω 를 해석적으로 구하고,
 * 실제 앱이 쓰는 ProjectileSim(적분기·dt 포함)이 만든 궤적의 모든 점을
 * 이 식과 비교합니다.
 *
 * 두 단계로 검사합니다.
 *  [1] 물리   — 월드 좌표의 궤적이 원뿔곡선인가 (1회 공전 또는 착탄/탈출까지)
 *  [2] 화면   — 궤도 모드의 두 투영으로 그렸을 때도 원뿔곡선인가.
 *              실제 축척은 통과해야 하고, 로그 압축은 (설계상) 실패합니다.
 *              후자는 실패가 아니라 "왜 실제 축척이 기본인가"의 근거로 출력합니다.
 */
import { ProjectileSim } from '../src/sim/ProjectileSim.js';
import { Trail } from '../src/sim/Trail.js';
import { createLaunchState } from '../src/sim/launchState.js';
import { Viewport } from '../src/render/Viewport.js';
import { RadialLogProjection } from '../src/render/projections/RadialLogProjection.js';
import { RadialLinearProjection } from '../src/render/projections/RadialLinearProjection.js';
import { fitZoomForOrbit, speedToZoom } from '../src/render/zoomPolicy.js';
import { GM, R_EARTH, DT_ORBITAL, DT_SURFACE, ESCAPE_RADIUS } from '../src/core/constants.js';

/** 초기 상태 → 원뿔곡선 파라미터 (p, e, ω) 와 보존량 */
function conicFrom({ pos, vel }) {
  const r = Math.hypot(pos.x, pos.y);
  const h = pos.x * vel.y - pos.y * vel.x;
  const p = (h * h) / GM;
  // 이심률 벡터 e⃗ = (v⃗ × h⃗)/μ − r̂  (2D)
  const ex = (vel.y * h) / GM - pos.x / r;
  const ey = (-vel.x * h) / GM - pos.y / r;
  const e = Math.hypot(ex, ey);
  const omega = Math.atan2(ey, ex);
  const energy = (vel.x ** 2 + vel.y ** 2) / 2 - GM / r;
  return { p, e, omega, h, energy };
}

const rConic = ({ p, e, omega }, theta) => p / (1 + e * Math.cos(theta - omega));
const kindOf = (e) => (e < 1 - 1e-6 ? '타원' : e > 1 + 1e-6 ? '쌍곡선' : '포물선');

/** 실제 앱 설정으로 한 비행을 끝(착탄/탈출) 또는 1회 공전까지 돌립니다 */
function fly({ angleDeg, initSpeed, dt }) {
  const ls = createLaunchState({ angleDeg, initSpeed });
  const conic = conicFrom(ls);
  const sim = new ProjectileSim({ dt, trail: new Trail(), escapeRadius: ESCAPE_RADIUS });
  sim.launch(ls);

  const pts = [{ ...ls.pos }];
  let maxRel = 0, maxAbs = 0, maxDE = 0, maxDH = 0;
  let steps = 0;
  while (!sim.done && !sim.trail.locked && steps < 5e6) {
    sim.advance(1);
    steps++;
    if (sim.done) break;
    const { x, y } = sim.pos;
    pts.push({ x, y });
    const r = Math.hypot(x, y);
    const rA = rConic(conic, Math.atan2(y, x));
    const rel = Math.abs(r - rA) / rA;
    if (rel > maxRel) { maxRel = rel; maxAbs = Math.abs(r - rA); }
    const c = conicFrom({ pos: sim.pos, vel: sim.vel });
    // 포물선(ε≈0)은 상대 에너지 오차가 무의미하므로 발사 운동에너지로 정규화
    maxDE = Math.max(maxDE, Math.abs(c.energy - conic.energy) / (initSpeed ** 2 / 2));
    maxDH = Math.max(maxDH, Math.abs((c.h - conic.h) / conic.h));
  }
  return { ls, conic, pts, steps, maxRel, maxAbs, maxDE, maxDH,
    outcome: sim.outcome || (sim.trail.locked ? 'orbit' : 'running') };
}

/**
 * 화면 좌표 점들이 "지구 중심을 초점으로 하는 원뿔곡선" 위에 있는가.
 * 화면 반지름 rPx(θ) 를 월드와 같은 e, ω 의 원뿔곡선 rPx = p'/(1+e·cos(θ−ω)) 에
 * 최소제곱으로 맞추고(p' 만 자유), 최대 상대 잔차를 돌려줍니다.
 */
function screenConicResidual(pts, vp, conic) {
  let num = 0, den = 0;
  const samples = pts.map((w) => {
    const s = vp.worldToScreen(w.x, w.y);
    const dx = s.x - vp.ox, dy = -(s.y - vp.oy); // 화면 y 뒤집기
    const rPx = Math.hypot(dx, dy);
    const theta = Math.atan2(dy, dx);
    const f = 1 / (1 + conic.e * Math.cos(theta - conic.omega)); // rPx = p'·f
    num += rPx * f; den += f * f;
    return { rPx, f };
  });
  const pFit = num / den;
  let maxRel = 0;
  for (const { rPx, f } of samples) maxRel = Math.max(maxRel, Math.abs(rPx - pFit * f) / (pFit * f));
  return maxRel;
}

// ─────────────────────────────────────────────────────────────────
const cases = [
  // 궤도 모드 (dt = 2 s)
  { angleDeg: 0, initSpeed: 7950, dt: DT_ORBITAL },
  { angleDeg: 0, initSpeed: 8500, dt: DT_ORBITAL },
  { angleDeg: 0, initSpeed: 10000, dt: DT_ORBITAL },   // 사용자가 지적한 경우
  { angleDeg: 0, initSpeed: 11000, dt: DT_ORBITAL },
  { angleDeg: 0, initSpeed: 11178, dt: DT_ORBITAL },   // 탈출 속도 부근 (포물선)
  { angleDeg: 0, initSpeed: 12000, dt: DT_ORBITAL },   // 쌍곡선
  { angleDeg: 30, initSpeed: 9000, dt: DT_ORBITAL },
  { angleDeg: 45, initSpeed: 8000, dt: DT_ORBITAL },   // 근지점이 지표 아래 → 착탄
  { angleDeg: 45, initSpeed: 10000, dt: DT_ORBITAL },
  { angleDeg: 60, initSpeed: 10500, dt: DT_ORBITAL },
  { angleDeg: 90, initSpeed: 9000, dt: DT_ORBITAL },   // 수직 발사 (e = 1 퇴화 타원)
  { angleDeg: 20, initSpeed: 6000, dt: DT_ORBITAL },   // 궤도 화면의 준궤도 비행
  { angleDeg: 20, initSpeed: 11800, dt: DT_ORBITAL },  // 비스듬한 쌍곡선
  // 지표면 모드 (dt = 1/120 s)
  { angleDeg: 45, initSpeed: 1000, dt: DT_SURFACE },
  { angleDeg: 45, initSpeed: 3000, dt: DT_SURFACE },
  { angleDeg: 80, initSpeed: 2000, dt: DT_SURFACE },
  { angleDeg: 10, initSpeed: 5000, dt: DT_SURFACE },
];

const TOL_PHYS = 1e-4;   // 월드 궤적: 반지름 상대오차 0.01%
const TOL_SCREEN = 2e-3; // 화면 궤적: 0.2% (1000 px 에서 2 px)
let bad = 0;

console.log('[1] 물리 — 월드 궤적 vs 해석적 원뿔곡선');
console.log('  각도   속도      dt  종류    e      결과      스텝   max|Δr|/r   max|Δr|    ΔE     Δh/h');
const flights = [];
for (const c of cases) {
  const f = fly(c);
  flights.push({ ...c, ...f });
  const ok = f.maxRel <= TOL_PHYS;
  if (!ok) bad++;
  console.log(
    `  ${String(c.angleDeg).padStart(3)}° ${String(c.initSpeed).padStart(6)} ${c.dt.toFixed(4).padStart(7)}  ` +
    `${kindOf(f.conic.e).padEnd(3)} ${f.conic.e.toFixed(3)}  ${f.outcome.padEnd(7)} ${String(f.steps).padStart(7)}  ` +
    `${f.maxRel.toExponential(1).padStart(8)}  ${f.maxAbs.toFixed(1).padStart(8)} m  ` +
    `${f.maxDE.toExponential(1)}  ${f.maxDH.toExponential(1)}  ${ok ? '✔' : '✘'}`);
}

console.log('\n[2] 화면 — 궤도 모드 투영을 거친 뒤에도 원뿔곡선인가 (1100×690)');
console.log('  각도   속도   종류     실제 축척      로그 압축');
for (const f of flights) {
  if (f.dt !== DT_ORBITAL) continue;
  if (Math.abs(f.conic.h) < 1e-6 * f.initSpeed * R_EARTH) {
    // 수직 발사: 각운동량 0 → 궤적이 반지름 방향 직선(퇴화 원뿔곡선). 극좌표 식이 정의되지 않음
    console.log(`  ${String(f.angleDeg).padStart(3)}° ${String(f.initSpeed).padStart(6)}  직선   (수직 발사 — 두 투영 모두 직선)`);
    continue;
  }
  const lin = new Viewport({ projection: RadialLinearProjection });
  lin.resize(1100, 690);
  lin.setZoom(fitZoomForOrbit(f.ls, lin), { immediate: true });
  const log = new Viewport({ projection: RadialLogProjection });
  log.resize(1100, 690);
  log.setZoom(speedToZoom(f.initSpeed), { immediate: true });

  const eLin = screenConicResidual(f.pts, lin, f.conic);
  const eLog = screenConicResidual(f.pts, log, f.conic);
  const ok = eLin <= TOL_SCREEN;
  if (!ok) bad++;
  console.log(
    `  ${String(f.angleDeg).padStart(3)}° ${String(f.initSpeed).padStart(6)}  ${kindOf(f.conic.e).padEnd(3)}  ` +
    `${eLin.toExponential(1).padStart(9)} ${ok ? '✔' : '✘'}   ${eLog.toExponential(1).padStart(9)} ${eLog <= TOL_SCREEN ? '✔' : '(왜곡)'}`);
}

console.log(bad
  ? `\n✘ ${bad} 건이 허용오차(물리 ${TOL_PHYS}, 화면 ${TOL_SCREEN}) 초과`
  : `\n✔ 물리 궤적은 원뿔곡선과 ${TOL_PHYS} 이내로 일치하고, 실제 축척 화면도 ${TOL_SCREEN} 이내로 일치`);
process.exit(bad ? 1 : 0);
