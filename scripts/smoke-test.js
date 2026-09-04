/**
 * 헤드리스 스모크 테스트.
 *
 * 최소한의 DOM/Canvas 스텁 위에서 App 을 실제로 부팅하고, 발사 → 적분 →
 * 착탄/궤도 판정까지 돌려 배선이 끊긴 곳이 없는지 확인합니다.
 * 그림의 '모양'은 검증하지 못하지만(그건 브라우저에서 눈으로),
 * import 경로·이벤트 배선·물리 결과는 여기서 잡힙니다.
 *
 *   node scripts/smoke-test.js
 */
const noop = () => {};
const gradient = { addColorStop: noop };
const ctx2d = new Proxy({}, {
  get(_, k) {
    if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'canvas') return { width: 1200, height: 800 };
    return noop;
  },
  set: () => true,
});

const listeners = new Map();
function makeEl(id = '', tag = 'div') {
  const el = {
    id, tagName: tag.toUpperCase(),
    style: new Proxy({ cssText: '' }, { get: (t, k) => t[k] ?? '', set: (t, k, v) => (t[k] = v, true) }),
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); } },
    dataset: {}, textContent: '', value: '0', checked: false,
    offsetHeight: 120, clientWidth: 1200, clientHeight: 800,
    width: 1200, height: 800,
    getContext: () => ctx2d,
    _h: {},
    addEventListener(type, fn) { (this._h[type] ??= []).push(fn); },
    dispatch(type, ev = {}) { (this._h[type] ?? []).forEach((f) => f({ target: this, preventDefault: noop, ...ev })); },
  };
  return el;
}

const registry = new Map();
const speedBtns = [1, 8, 32, 128].map((m) => {
  const b = makeEl('speed-' + m, 'button');
  b.dataset.mult = String(m);
  b.classList.add('speed-btn');
  return b;
});

globalThis.document = {
  getElementById: (id) => registry.get(id) ?? (registry.set(id, makeEl(id, id === 'c' ? 'canvas' : 'div')), registry.get(id)),
  querySelector: (sel) => registry.get(sel) ?? (registry.set(sel, makeEl(sel)), registry.get(sel)),
  querySelectorAll: (sel) => (sel === '.speed-btn' ? speedBtns : []),
  createElement: (tag) => makeEl('', tag),
  addEventListener: (t, fn) => (listeners.set(t, [...(listeners.get(t) ?? []), fn])),
  documentElement: makeEl('html'),
};

let rafQueue = [];
globalThis.window = {
  innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1,
  addEventListener: (t, fn) => (listeners.set(t, [...(listeners.get(t) ?? []), fn])),
};
globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
globalThis.cancelAnimationFrame = noop;
globalThis.performance = { now: () => Date.now() };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '0' });

// ── 부팅 ──
const { App } = await import('../src/app/App.js');
const app = new App(document.getElementById('c'));
app.start();

const fail = [];
const check = (name, cond, extra = '') =>
  (cond ? console.log(`  ✔ ${name}${extra && ' — ' + extra}`) : (fail.push(name), console.log(`  ✘ ${name} ${extra}`)));

console.log('\n[1] 부팅');
check('기본 모드는 orbital', app.router.current.id === 'orbital');
check('지표면 모드 등록됨', !!app.router.get('surface'));
check('레이어 13개 등록', app.router.current.layers.length === 13, String(app.router.current.layers.length));
check('뷰포트 크기 반영', app.vp.width === 1200 && app.vp.height === 800);

/** dt=1/60 로 n 프레임 진행 */
const run = (n) => { for (let i = 0; i < n; i++) app.frame(1 / 60, i * 16.7); };

console.log('\n[2] 저속 발사 (4 km/s, 45°) → 지표면 모드');
app.config.initSpeed = 4000; app.config.angleDeg = 45; app.config.timeScale = 8;
app.launch();
check('지표면 모드로 라우팅', app.router.current.id === 'surface');
check('비행시간에 맞춘 기본 배속', app.config.timeScale === 32,
  `×${app.config.timeScale} (12분 비행 → 화면 23초)`);
check('모드 배지 표시', document.getElementById('mode-badge').style.display === 'flex');
check('발사 직후 active', app.router.current.sim.active);
check('축척이 궤적에 맞춰짐', app.router.current.metersPerPixel > 100,
  `${app.router.current.metersPerPixel.toFixed(0)} m/px`);
check('지표면 화면 반지름 = R/mpp',
  Math.abs(app.vp.rSurfacePx - 6.371e6 / app.router.current.metersPerPixel) < 1,
  `${app.vp.rSurfacePx.toFixed(0)} px`);
check('UI 크기는 별도 축', app.vp.uiScale > 0 && app.vp.uiScale < 1000,
  `${app.vp.uiScale.toFixed(0)} px`);

// 12분짜리 비행이라 테스트에서는 사용자가 배속을 올린 상황으로 빨리 감기
app.config.timeScale = 64;
for (let i = 0; i < 40000 && !app.router.current.sim.done; i++) app.frame(1 / 60, i * 16.7);
const s1 = app.router.current.sim;
check('충돌로 종료', s1.outcome === 'impact', `outcome=${s1.outcome}`);
check('착탄각 산출됨', s1.stats.impactAngle > 0, s1.stats.impactAngle.toFixed(1) + '°');
check('비행거리 산출됨', s1.stats.flightDist > 0, (s1.stats.flightDist / 1000).toFixed(0) + ' km');
check('폭발 이펙트 발동', app.fx.explosion.active, `파편 ${app.fx.particles.items.length}개`);
check('HUD 착탄각 표시', document.getElementById('hud-impang').textContent.includes('°'));
check('궤적 점 수가 화면 해상도 수준', s1.trail.points.length < 3000,
  `${s1.trail.points.length}점`);

console.log('\n[2b] 착지 후 궤도 모드 복귀');
check('아직 지표면 모드 (착지 장면 유지)', app.router.current.id === 'surface');
check('전화 예약됨', app.router.hasPendingSwitch);
run(90);  // 1.5초 — LANDING_HOLD(0.9초) 경과
check('궤도 모드로 복귀', app.router.current.id === 'orbital');
check('배속 복원', app.config.timeScale === 8, `×${app.config.timeScale}`);
check('모드 배지 숨김', document.getElementById('mode-badge').style.display === 'none');
const back = app.router.current.sim;
check('충돌 결과 이월', back.done && back.outcome === 'impact');
check('탄도 궤적도 이월', back.trail.points.length > 10, `${back.trail.points.length}점`);
check('복귀 화면에서 충돌 이펙트 재생', app.fx.explosion.active);

console.log('\n[3] 리셋');
app.reset();
check('시뮬 비활성', !app.router.current.sim.active && !app.router.current.sim.done);
check('궤적 비움', app.router.current.sim.trail.length === 0);
check('파티클 정리', app.fx.particles.items.length === 0);

console.log('\n[4] 원궤도 속도 (8000 m/s, 0°) → 궤도 유지');
app.config.initSpeed = 8000; app.config.angleDeg = 0; app.config.timeScale = 8;
app.launch();
run(600);
const s2 = app.router.current.sim;
check('궤도 모드 유지 (라우팅 안 됨)', app.router.current.id === 'orbital');
check('아직 비행 중', s2.active && !s2.done, `고도 ${(s2.altitude / 1000).toFixed(0)} km`);
check('1회 공전 후 궤적 잠금', s2.trail.locked, `점 ${s2.trail.points.length}개`);

const { createLaunchState } = await import('../src/sim/launchState.js');

console.log('\n[5] 탈출 속도 (11500 m/s) → 탈출 판정');
app.reset();
app.config.initSpeed = 11500; app.config.angleDeg = 45; app.config.timeScale = 128;
app.launch();
for (let i = 0; i < 20000 && !app.router.current.sim.done; i++) app.frame(1 / 60, i);
check('탈출로 종료', app.router.current.sim.outcome === 'escape', app.router.current.sim.outcome);

console.log('\n[5b] 탈출 속도 미만 (11150 m/s) → 194 Re 까지 갔다가 반드시 돌아옴');
{
  const { ProjectileSim } = await import('../src/sim/ProjectileSim.js');
  const { Trail } = await import('../src/sim/Trail.js');
  const { R_EARTH } = await import('../src/core/constants.js');
  const sim = new ProjectileSim({ trail: new Trail() });
  sim.launch(createLaunchState({ angleDeg: 0, initSpeed: 11150 }));
  let maxR = 0, steps = 0;
  const t0 = Date.now();
  while (!sim.done && !sim.trail.locked && steps < 4e6) {
    sim.advance(1000); steps += 1000;
    maxR = Math.max(maxR, sim.radius);
  }
  check('탈출로 판정되지 않음', sim.outcome !== 'escape', sim.outcome ?? '비행 중');
  check('원지점이 탈출 확정 거리(30 Re)를 훌쩍 넘음', maxR > R_EARTH * 150, `${(maxR / R_EARTH).toFixed(0)} Re`);
  check('1회 공전을 마치고 돌아옴', sim.trail.locked, `${(sim.elapsed / 86400).toFixed(1)}일, ${Date.now() - t0} ms`);
  check('먼 우주 궤적 점이 과하게 쌓이지 않음', sim.trail.points.length < 20000, `점 ${sim.trail.points.length}개`);
}

console.log('\n[6] 라우팅 판정');
const surface = app.router.get('surface');
check('저속 발사는 지표면 모드가 받음',
  surface.accepts(createLaunchState({ angleDeg: 45, initSpeed: 3000 })));
check('원궤도 속도는 거부', !surface.accepts(createLaunchState({ angleDeg: 0, initSpeed: 7905 })));
check('탈출 속도는 거부', !surface.accepts(createLaunchState({ angleDeg: 45, initSpeed: 11500 })));
check('저속 → surface 로 라우팅',
  app.router.select(createLaunchState({ angleDeg: 45, initSpeed: 3000 })).id === 'surface');
check('원궤도 속도 → orbital',
  app.router.select(createLaunchState({ angleDeg: 0, initSpeed: 8000 })).id === 'orbital');
check('탈출 속도 → orbital',
  app.router.select(createLaunchState({ angleDeg: 45, initSpeed: 11500 })).id === 'orbital');
// 사거리 상한(SURFACE_MAX_ARC) — 너무 멀리 나가는 준궤도는 궤도 화면이 더 잘 보여줍니다
check('사거리 과대 준궤도(7 km/s)는 orbital 유지',
  app.router.select(createLaunchState({ angleDeg: 45, initSpeed: 7000 })).id === 'orbital');
check('중속(3 km/s)은 surface',
  app.router.select(createLaunchState({ angleDeg: 45, initSpeed: 3000 })).id === 'surface');

console.log('\n[6b] 궤적 예측기 (프레이밍 근거)');
const { predictTrajectory } = await import('../src/sim/predict.js');
const pred = predictTrajectory(createLaunchState({ angleDeg: 45, initSpeed: 4000 }));
check('착탄 예측', pred.hitGround);
check('최고고도 예측', pred.apexAlt > 4e5 && pred.apexAlt < 6e5, `${(pred.apexAlt / 1000).toFixed(0)} km`);
check('사거리 예측', pred.arcLength > 1.5e6 && pred.arcLength < 2.2e6,
  `${(pred.arcLength / 1000).toFixed(0)} km`);
check('예측 사거리 ≈ 실제 착탄거리',
  Math.abs(pred.arcLength - s1.stats.flightDist) < 2e4,
  `오차 ${Math.abs(pred.arcLength - s1.stats.flightDist).toFixed(0)} m`);

console.log('\n[6c] 리셋은 기본 화면으로 복귀');
app.reset();
app.config.initSpeed = 2000; app.config.angleDeg = 40;
app.launch();
check('지표면 모드 진입', app.router.current.id === 'surface');
app.reset();
check('리셋 후 궤도 모드', app.router.current.id === 'orbital');
check('전환 예약 취소됨', !app.router.hasPendingSwitch);

console.log('\n[7] 모드 간 결과 이월 (지표면 → 궤도 복귀 경로)');
app.reset();
const orbital = app.router.get('orbital');
const carried = {
  outcome: 'impact', mode: 'surface', elapsed: 42,
  config: { angleDeg: 45, initSpeed: 3000 },
  stats: { maxAlt: 120000, maxAltPos: { x: 0, y: 6.5e6 }, impactAngle: 33.3,
           impactPos: { x: 1.2e6, y: 6.25e6 }, flightDist: 1.4e6, escapeDir: 0 },
};
app.router.switchTo('orbital', { config: app.config, carry: carried, reason: 'test' });
check('결과가 궤도 모드에 복원', orbital.sim.done && orbital.sim.outcome === 'impact');
check('충돌 이펙트 재생', app.fx.explosion.active);
app.frame(1 / 60, 0);
check('HUD 가 이월 결과 표시', document.getElementById('hud-impang').textContent === '33.3°',
  document.getElementById('hud-impang').textContent);

// ═══ [8] 에너지 — 물리량과 그래프 표본 ═══
console.log('');
console.log('[8] 에너지 (운동·퍼텐셜·역학적)');
const { specificEnergy, U_LAUNCH_REF } = await import('../src/physics/energy.js');
const { GM: GM8, R_EARTH: RE8, V1: V18, V2: V28 } = await import('../src/core/constants.js');

// 지표면에서 정지: K = 0, U = −GM/R
const rest = specificEnergy({ x: 0, y: RE8 }, { x: 0, y: 0 });
check('정지 상태 K = 0', rest.k === 0);
check('퍼텐셜 U = −GM/R', Math.abs(rest.u + GM8 / RE8) < 1, `${(rest.u / 1e6).toFixed(1)} MJ/kg`);

// 제1 우주속도(원궤도): K = −U/2, E = U/2  (비리얼 정리)
const circ = specificEnergy({ x: 0, y: RE8 }, { x: V18, y: 0 });
check('원궤도에서 K = −U/2 (비리얼 정리)', Math.abs(circ.k + circ.u / 2) / circ.k < 2e-3);
check('원궤도는 E < 0 (속박)', circ.e < 0, `${(circ.e / 1e6).toFixed(1)} MJ/kg`);

// 제2 우주속도: E = 0 이 그 정의
const esc = specificEnergy({ x: 0, y: RE8 }, { x: V28, y: 0 });
check('탈출 속도에서 E = 0', Math.abs(esc.e) / esc.k < 2e-3, `${(esc.e / 1e6).toFixed(3)} MJ/kg`);
check('탈출 속도 초과면 E > 0', specificEnergy({ x: 0, y: RE8 }, { x: V28 * 1.05, y: 0 }).e > 0);

// 발사 지점 기준 퍼텐셜: 그래프가 쓰는 기준 (U' = U + U_LAUNCH_REF)
check('기준 상수 = 탈출에 필요한 에너지', Math.abs(U_LAUNCH_REF - V28 ** 2 / 2) / U_LAUNCH_REF < 2e-3,
  `${(U_LAUNCH_REF / 1e6).toFixed(1)} MJ/kg`);
check('발사 지점에서 U 는 0', Math.abs(specificEnergy({ x: 0, y: 6.371e6 + 8848 }, { x: 0, y: 0 }).u + U_LAUNCH_REF) < 1);
check('E 부호 판정은 기준을 옮겨도 같음', (circ.e + U_LAUNCH_REF) < U_LAUNCH_REF && (esc.e + U_LAUNCH_REF) <= U_LAUNCH_REF * 1.001);

// 그래프: 발사하면 표본이 쌓이고 역학적 에너지가 보존되어야 합니다
app.reset();
app.config.initSpeed = 9000; app.config.angleDeg = 0; app.config.timeScale = 32;
app.launch();
run(2);
const axisEarly = { ...app.energy.axis };
run(298);
const ep = app.energy.points;
check('그래프 표본 수집', ep.length > 20, `${ep.length}점`);
check('표본 수 상한 유지', ep.length <= 240, `${ep.length}점`);
const eArr = ep.map((q) => q.e);
const drift = (Math.max(...eArr) - Math.min(...eArr)) / Math.abs(eArr[0]);
check('역학적 에너지 보존 (드리프트 < 0.1%)', drift < 1e-3, `${(drift * 100).toExponential(1)}%`);
check('K + U = E', ep.every((q) => Math.abs(q.k + q.u - q.e) < 1));

// 눈금: 쌓인 표본이 아니라 발사 순간의 궤도가 정합니다 (energySpan)
const { energySpan } = await import('../src/physics/energy.js');
const span9 = energySpan({ x: 0, y: 6.371e6 + 8848 }, { x: 9000, y: 0 });
check('축 = [0, E′] — 발사 에너지가 곧 눈금 전체',
  Math.abs(span9.lo) < 2e5 && Math.abs(span9.hi - span9.e) / span9.e < 1e-3,
  `${(span9.lo / 1e6).toFixed(2)} ~ ${(span9.hi / 1e6).toFixed(1)} MJ/kg`);

const axisLate = app.energy.axis;
check('눈금이 비행 내내 고정 (첫 프레임 = 마지막 프레임)',
  Math.abs(axisEarly.hi - axisLate.hi) / axisLate.hi < 1e-6
  && Math.abs(axisEarly.lo - axisLate.lo) < 1,
  `${(axisEarly.hi / 1e6).toFixed(2)} → ${(axisLate.hi / 1e6).toFixed(2)} MJ/kg`);

// 곡선이 실제로 축을 얼마나 쓰는가 — 탈출선 때문에 눌리지 않아야 합니다
const vals = ep.flatMap((q) => [q.k, q.u + U_LAUNCH_REF, q.e + U_LAUNCH_REF]);
const used = (Math.max(...vals) - Math.min(...vals)) / (axisLate.hi - axisLate.lo);
check('곡선이 축의 85% 이상 사용', used > 0.85, `${(used * 100).toFixed(0)}%`);
check('9 km/s 는 탈출과 멀어 탈출선 없음', !axisLate.showEscape);

// 탈출에 가까운 발사에서는 탈출선이 다시 등장합니다
app.reset();
app.config.initSpeed = 11000; app.launch();
run(30);
check('11 km/s 에서는 탈출선 표시', app.energy.axis.showEscape);
check('탈출선을 넣어도 축은 탈출 에너지 + 여백뿐',
  app.energy.axis.hi < U_LAUNCH_REF * 1.12, `${(app.energy.axis.hi / 1e6).toFixed(1)} MJ/kg`);
check('축을 넉넉히 쓰는 발사는 끊지 않음', !app.energy.axis.split);

// ── 수평 발사: 발사 지점이 곧 원지점이라 오르내리는 높이가 에베레스트뿐 ──
// 단일 축으로는 변화가 축의 0.3% 라 세 곡선이 전부 수평선으로 보입니다.
app.reset();
app.config.initSpeed = 7000; app.config.angleDeg = 0; app.config.timeScale = 128;
app.launch();
run(200);
const flat = app.energy;
// 축은 비행 전체를 담도록 발사 순간에 확정되므로, 밴드는 표본이 아니라
// 궤도가 예고한 변화폭(= 에베레스트 높이만큼의 퍼텐셜)에 맞춰져 있어야 합니다
const flatSpan = energySpan({ x: 0, y: 6.371e6 + 8848 }, { x: 7000, y: 0 });
const swing = flatSpan.u.hi - flatSpan.u.lo;
check('수평 발사도 K·U 는 실제로 변한다 (에베레스트 높이만큼)',
  swing > 0.05e6 && swing < 0.12e6, `${(swing / 1e6).toFixed(3)} MJ/kg`);
check('K 의 변화폭 = U′ 의 변화폭', Math.abs((flatSpan.k.hi - flatSpan.k.lo) - swing) < 1);
check('변화가 안 보이면 축을 끊는다', flat.axis.split);
check('끊은 축의 두 밴드 높이가 같다 (K = E′ − U′)',
  Math.abs((flat.axis.bands.k.hi - flat.axis.bands.k.lo)
    - (flat.axis.bands.u.hi - flat.axis.bands.u.lo)) < 1,
  `${((flat.axis.bands.k.hi - flat.axis.bands.k.lo) / 1e6).toFixed(3)} MJ/kg`);
check('밴드가 변화폭을 꽉 물고 있다 (70% 이상)',
  swing / (flat.axis.bands.u.hi - flat.axis.bands.u.lo) > 0.7,
  `${((swing / (flat.axis.bands.u.hi - flat.axis.bands.u.lo)) * 100).toFixed(0)}%`);
const plainFrac = swing / (flat.axis.hi - flat.axis.lo);
check('끊기 전이라면 축의 1% 도 못 썼을 변화', plainFrac < 0.01,
  `${(plainFrac * 100).toFixed(2)}%`);
check('빈 구간은 두 밴드 사이 — 곡선이 지나지 않음',
  flat.axis.bands.k.lo > flat.axis.bands.u.hi);

// 원궤도(제1 우주속도 정확히)는 K·U 가 **정말로** 일정합니다.
// 그때까지 확대하면 적분 오차를 물리인 양 크게 그리게 됩니다.
app.reset();
app.config.initSpeed = V18; app.config.angleDeg = 0;
app.launch();
run(200);
check('원궤도는 확대하지 않음 (적분 오차 확대 방지)', !app.energy.axis.split);
const circ2 = app.energy.points.map((q) => q.k);
check('원궤도에서 K 는 사실상 일정', (Math.max(...circ2) - Math.min(...circ2)) < 1e4,
  `${((Math.max(...circ2) - Math.min(...circ2)) / 1e6).toFixed(5)} MJ/kg`);

// ── 축선과 눈금 ──
app.reset();
app.config.initSpeed = 3200; app.config.angleDeg = 45; app.config.timeScale = 32;
app.launch();
run(300);
const ax = app.energy.axis;
check('y 눈금이 만들어짐', ax.yTicks.length >= 2, `${ax.yTicks.length}개`);
check('x(시간) 눈금이 만들어짐', ax.xTicks.length >= 2, `${ax.xTicks.length}개`);
check('눈금이 축 범위 안에', ax.yTicks.every((v) => v >= ax.lo - 1 && v <= ax.hi + 1));
check('눈금 간격이 일정 (1·2·5 × 10ⁿ)',
  ax.yTicks.length < 3 || Math.abs((ax.yTicks[1] - ax.yTicks[0]) - (ax.yTicks[2] - ax.yTicks[1])) < 1);
check('축 라벨 자리를 왼쪽·아래에 비워 둠',
  ax.plot.x0 > 0 && ax.plot.y1 < app.energy.canvas.clientHeight,
  `좌 ${ax.plot.x0.toFixed(0)}px`);
check('시간 단위를 축 하나에 통일', typeof ax.timeUnit === 'string' && ax.timeUnit.length > 0,
  ax.timeUnit);

// 끊은 축에서는 두 밴드 각각에 눈금이 있어야 읽을 수 있습니다
app.reset();
app.config.initSpeed = 7000; app.config.angleDeg = 0; app.config.timeScale = 128;
app.launch();
run(200);
const sax = app.energy.axis;
check('끊은 축은 두 밴드 모두에 눈금',
  sax.yTicks.some((v) => v <= sax.bands.u.hi) && sax.yTicks.some((v) => v >= sax.bands.k.lo),
  `${sax.yTicks.length}개`);
check('빈 구간에는 눈금을 두지 않음',
  !sax.yTicks.some((v) => v > sax.bands.u.hi && v < sax.bands.k.lo));

app.reset();
check('리셋하면 그래프도 비워짐', app.energy.points.length === 0);

console.log(fail.length === 0 ? '\n✅ 전체 통과' : `\n❌ 실패 ${fail.length}건: ${fail.join(', ')}`);
process.exit(fail.length ? 1 : 0);
