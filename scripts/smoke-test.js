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
check('레이어 12개 등록', app.router.current.layers.length === 12, String(app.router.current.layers.length));
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

console.log('\n[5] 탈출 속도 (11500 m/s) → 탈출 판정');
app.reset();
app.config.initSpeed = 11500; app.config.angleDeg = 45; app.config.timeScale = 128;
app.launch();
for (let i = 0; i < 20000 && !app.router.current.sim.done; i++) app.frame(1 / 60, i);
check('탈출로 종료', app.router.current.sim.outcome === 'escape', app.router.current.sim.outcome);

console.log('\n[6] 라우팅 판정');
const { createLaunchState } = await import('../src/sim/launchState.js');
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

console.log(fail.length === 0 ? '\n✅ 전체 통과' : `\n❌ 실패 ${fail.length}건: ${fail.join(', ')}`);
process.exit(fail.length ? 1 : 0);
