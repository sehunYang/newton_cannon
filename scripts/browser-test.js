/**
 * 실제 브라우저(Playwright + 설치된 Chrome) E2E 테스트.
 *
 *   npm run test:browser
 *
 * 헤드리스 스모크 테스트가 못 잡는 것을 확인합니다:
 *   - ES 모듈이 실제로 로드되는가 (import 경로, MIME 타입)
 *   - 콘솔 에러 / 미처리 예외가 없는가
 *   - CSS 가 적용되는가, 캔버스에 실제로 그림이 그려지는가
 *   - 사용자 조작(클릭·키보드·슬라이더)이 화면을 바꾸는가
 *   - 모바일/가로 레이아웃에서 UI 가 겹치지 않는가
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = ROOT + '.test-output';
const PORT = 5199;
const BASE = `http://localhost:${PORT}/`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const fails = [];
const check = (name, cond, extra = '') => {
  if (cond) console.log(`  ✔ ${name}${extra ? ' — ' + extra : ''}`);
  else { fails.push(name); console.log(`  ✘ ${name} ${extra}`); }
};

// ── 정적 서버 기동 ──
const server = spawn(process.execPath, ['scripts/serve.js'], {
  cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 600));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

/** 콘솔 에러 · 미처리 예외 · 실패한 네트워크 요청 수집 */
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('requestfailed', (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });

/** 앱 내부 상태 조회 (main.js 가 window.__cannon 으로 노출) */
const state = () => page.evaluate(() => {
  const a = window.__cannon;
  const s = a.router.current.sim;
  return {
    mode: a.router.current.id,
    mpp: a.router.current.metersPerPixel ?? null,
    rSurfacePx: a.vp.rSurfacePx, uiScale: a.vp.uiScale,
    pendingSwitch: a.router.hasPendingSwitch,
    active: s.active, done: s.done, outcome: s.outcome,
    altitude: s.altitude, altitudeAtEnd: s.altitude, speed: s.speed, elapsed: s.elapsed,
    trailPoints: s.trail.points.length, trailLocked: s.trail.locked,
    zoom: a.vp.zoom.current, timeScale: a.config.timeScale,
    initSpeed: a.config.initSpeed, angleDeg: a.config.angleDeg,
    display: { ...a.display },
    particles: a.fx.particles.items.length,
    explosionActive: a.fx.explosion.active,
    stats: {
      impactAngle: s.stats.impactAngle,
      flightDist: s.stats.flightDist,
      maxAlt: s.stats.maxAlt,
    },
  };
});

const text = (sel) => page.locator(sel).innerText();

/** 캔버스가 실제로 그려졌는지: 배경색이 아닌 픽셀 비율 */
const canvasInkRatio = () => page.evaluate(() => {
  const c = document.getElementById('c');
  const g = c.getContext('2d');
  const { data } = g.getImageData(0, 0, c.width, c.height);
  let ink = 0, total = 0;
  for (let i = 0; i < data.length; i += 4 * 37) { // 성글게 표본 추출
    total++;
    const r = data[i], gg = data[i + 1], b = data[i + 2];
    if (r > 30 || gg > 40 || b > 60) ink++;
  }
  return ink / total;
});

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

/** 두 요소의 화면 사각형이 겹치는가 */
const overlaps = (selA, selB) => page.evaluate(([a, b]) => {
  const r1 = document.querySelector(a).getBoundingClientRect();
  const r2 = document.querySelector(b).getBoundingClientRect();
  return !(r1.right <= r2.left || r2.right <= r1.left
        || r1.bottom <= r2.top || r2.bottom <= r1.top);
}, [selA, selB]);

const setSlider = (sel, value) => page.locator(sel).evaluate((el, v) => {
  el.value = String(v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, value);

try {
  // ═══ [1] 초기 로드 ═══
  console.log('\n[1] 초기 로드');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__cannon, null, { timeout: 5000 });
  await page.waitForTimeout(700);

  check('미처리 예외 없음', pageErrors.length === 0, pageErrors.join(' | '));
  check('콘솔 에러 없음', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('실패한 요청 없음', failedRequests.length === 0, failedRequests.join(' | '));

  const s0 = await state();
  check('궤도 모드로 부팅', s0.mode === 'orbital');
  check('발사 전 상태', !s0.active && !s0.done);

  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('CSS 적용됨 (배경색)', bodyBg === 'rgb(5, 10, 20)', bodyBg);
  check('웹폰트 로드됨', await page.evaluate(() => document.fonts.check('12px "Space Mono"')));

  const ink0 = await canvasInkRatio();
  check('캔버스에 그림이 그려짐', ink0 > 0.05, `잉크 비율 ${(ink0 * 100).toFixed(1)}%`);

  check('HUD 초기값', (await text('#hud-spd')) === '— m/s');
  check('궤도 배지 = 타원 호 낙하', (await text('#hud-orbit')) === '타원 호 낙하', await text('#hud-orbit'));
  check('줌 배지 표시', /^\d\.\d\d×$/.test(await text('#zoom-val')), await text('#zoom-val'));
  const m1 = await page.locator('#marker-v1').evaluate((e) => e.style.left);
  check('V1 마커가 슬라이더 위 65.9% 지점', m1.startsWith('65.8'), m1);
  await shot('01-초기화면');

  // ═══ [2] 슬라이더 조작 ═══
  console.log('\n[2] 슬라이더 조작');
  const steps = await page.evaluate(() => ({
    ang: document.getElementById('s-ang').step,
    spd: document.getElementById('s-spd').step,
  }));
  check('발사각 눈금 0.5°', steps.ang === '0.5', steps.ang);
  check('초기속도 눈금 50 m/s', steps.spd === '50', steps.spd);

  // 반 눈금 값이 실제로 반영되는지 (parseInt 로 잘리면 여기서 걸립니다)
  await setSlider('#s-ang', 32.5);
  await setSlider('#s-spd', 4050);
  await page.waitForTimeout(200);
  check('0.5° 단위가 반영됨', (await state()).angleDeg === 32.5, await text('#v-ang'));
  check('50 m/s 단위가 반영됨', (await state()).initSpeed === 4050, await text('#v-spd'));

  // README 가 안내하는 "슬라이더 클릭 후 방향키로 한 눈금씩" 이 실제로 되는지
  await page.locator('#s-ang').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  check('방향키로 0.5° 한 눈금 이동', (await state()).angleDeg === 33, await text('#v-ang'));
  await page.locator('#s-spd').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  check('방향키로 50 m/s 한 눈금 이동', (await state()).initSpeed === 4100, await text('#v-spd'));

  await setSlider('#s-ang', 45);
  await page.waitForTimeout(150);
  check('발사각 라벨 (0.5° 눈금)', (await text('#v-ang')) === '45.0°', await text('#v-ang'));
  check('앱 상태에 반영', (await state()).angleDeg === 45);
  await shot('02-발사각45도');

  await setSlider('#s-spd', 8000);
  await page.waitForTimeout(1200);
  check('속도 라벨 (0.05 km/s 눈금)', (await text('#v-spd')) === '8.00 km/s', await text('#v-spd'));
  // 배지는 속력이 아니라 궤도 요소로 판정합니다: 45° 로 8 km/s 는 근지점이 지표 아래(착탄),
  // 같은 속력이라도 0° 면 근지점이 발사점이라 궤도가 됩니다.
  check('45°·8 km/s 는 낙하 (근지점 < 지표)', (await text('#hud-orbit')) === '타원 호 낙하', await text('#hud-orbit'));
  await setSlider('#s-ang', 0);
  await page.waitForTimeout(200);
  check('0°·8 km/s 는 궤도', (await text('#hud-orbit')) === '타원/원 궤도', await text('#hud-orbit'));
  await setSlider('#s-ang', 45);
  await page.waitForTimeout(200);
  const bg8k = await page.locator('#s-spd').evaluate((e) => e.style.background);
  check('슬라이더 트랙 = 궤도색(파랑)', bg8k.includes('rgb(58, 142, 255)'));
  // 실제 축척은 발사 전에 미리 물러나지 않습니다 — 카메라가 발사 후 포탄을 따라갑니다.
  check('실제 축척이 기본', (await state()).display.trueScale === true);
  await setSlider('#s-spd', 10000);
  await page.waitForTimeout(800);
  const zoom10k = (await state()).zoom;
  check('발사 전에는 줌 1 유지', zoom10k > 0.99, `zoom ${zoom10k.toFixed(2)}`);

  await setSlider('#s-spd', 11500);
  await page.waitForTimeout(250);
  check('탈출 속도 배지', (await text('#hud-orbit')) === '탈출 궤도');
  const bgEsc = await page.locator('#s-spd').evaluate((e) => e.style.background);
  check('슬라이더 트랙 = 탈출색(청록)', bgEsc.includes('rgb(126, 240, 200)'));

  // ═══ [3] 저속 발사 → 착탄 ═══
  console.log('\n[3] 저속 발사 (4 km/s, 45°) → 지표면 모드');
  await setSlider('#s-spd', 4000);
  await page.waitForTimeout(700);
  await page.click('#btn-fire');
  await page.waitForTimeout(500);

  const s1 = await state();
  check('지표면 모드로 라우팅', s1.mode === 'surface', s1.mode);
  check('비행시간에 맞춘 기본 배속', s1.timeScale === 32, `×${s1.timeScale}`);
  check('시뮬속도 버튼 동기화', (await text('#simspd-val')) === '×32', await text('#simspd-val'));
  check('모드 배지 노출', await page.locator('#mode-badge').isVisible());
  check('모드 배지 문구', (await text('#mode-val')) === '지표면');
  check('축척이 궤적에 맞춰짐', s1.mpp > 100, `${s1.mpp.toFixed(0)} m/px`);
  check('지표면 화면 반지름 = R/mpp',
    Math.abs(s1.rSurfacePx - 6.371e6 / s1.mpp) < 1, `${s1.rSurfacePx.toFixed(0)} px`);
  check('UI 크기 축은 분리됨', s1.uiScale > 0 && s1.uiScale < 1000, `${s1.uiScale.toFixed(0)} px`);
  check('HUD 사거리 실시간 표시', await page.locator('#hud-dist-row').isVisible());
  await shot('11-지표면-비행중');

  // 곡률 검증: 화면 좌우 끝의 지표면 높이 차이가 실제 지구 곡률과 일치하는가
  const curve = await page.evaluate(() => {
    const a = window.__cannon;
    const vp = a.vp, R = vp.rSurfacePx;
    const yAt = (x) => vp.oy - Math.sqrt(R * R - (x - vp.ox) ** 2);
    const mid = yAt(vp.ox);                       // 지표면 원의 꼭대기 = 발사 지점
    const edge = Math.max(yAt(0), yAt(vp.width)); // 더 멀리 떨어진 쪽 끝
    const dxPx = Math.max(Math.abs(vp.ox), Math.abs(vp.width - vp.ox));
    const mpp = a.router.current.metersPerPixel;
    return {
      dropPx: edge - mid,
      dropM: (edge - mid) * mpp,
      // 정확한 구면 관계: 현의 반길이 d 에 대한 새그 = R − √(R²−d²)
      // (소각 근사 d²/2R 은 이 각도(≈0.34 rad)에서 3% 어긋나므로 쓰지 않습니다)
      expectedM: 6.371e6 - Math.sqrt(6.371e6 ** 2 - (dxPx * mpp) ** 2),
    };
  });
  check('지표면이 아래로 휨 (평면 아님)', curve.dropPx > 5, `${curve.dropPx.toFixed(1)} px`);
  check('곡률이 실제 지구 곡률과 일치 (오차 0.1% 미만)',
    Math.abs(curve.dropM - curve.expectedM) / curve.expectedM < 0.001,
    `${(curve.dropM / 1000).toFixed(1)} km vs 이론 ${(curve.expectedM / 1000).toFixed(1)} km`);

  // 나머지 비행은 배속을 올려 빨리 감기 (사용자가 실제로 할 수 있는 조작)
  await page.keyboard.press('4');
  await page.waitForTimeout(100);
  check('지표면 모드에서도 배속 변경 가능', (await state()).timeScale === 128);
  check('비행 중', s1.active, `고도 ${(s1.altitude / 1000).toFixed(0)} km`);
  await page.waitForTimeout(500);
  const s1b = await state();
  check('궤적이 쌓이는 중', s1b.trailPoints > 5, `${s1b.trailPoints}점`);

  // ── 리얼타임 정확도 ──
  // ×1 에서 시뮬 시간이 실제 시간과 1:1 로 흘러야 합니다.
  // 프레임 간격을 반올림해 처리하면 주사율에 따라 최대 25% 어긋납니다.
  await page.keyboard.press('1');
  await page.waitForTimeout(300);
  const t0 = await page.evaluate(() => ({
    sim: window.__cannon.router.current.sim.elapsed, real: performance.now() }));
  await page.waitForTimeout(4000);
  const t1 = await page.evaluate(() => ({
    sim: window.__cannon.router.current.sim.elapsed, real: performance.now() }));
  const ratio = (t1.sim - t0.sim) / ((t1.real - t0.real) / 1000);
  check('×1 에서 시뮬 시간 = 실제 시간', Math.abs(ratio - 1) < 0.02,
    `비율 ${ratio.toFixed(3)}`);
  await page.keyboard.press('4');  // 측정 끝 — 다시 빨리감기
  await page.waitForTimeout(150);
  check('사거리 실시간 갱신', (await text('#hud-dist')) !== '—', await text('#hud-dist'));
  check('발사 버튼 상태 변경', (await text('#btn-fire')).includes('비행 중'));
  check('발사 이펙트 파티클', s1.particles > 0, `${s1.particles}개`);

  await page.waitForFunction(() => window.__cannon.router.current.sim.done, null, { timeout: 60000 });
  const s2 = await state();
  check('착지 직후에도 지표면 화면 유지', s2.mode === 'surface', s2.mode);
  check('궤도 모드 복귀 예약됨', s2.pendingSwitch);
  check('궤적 점 수가 화면 해상도 수준', s2.trailPoints < 3000, `${s2.trailPoints}점`);

  // 착탄점이 우하단 발사 설정 패널 뒤로 숨지 않아야 합니다
  const impactBox = await page.evaluate(() => {
    const a = window.__cannon;
    const p = a.router.current.sim.stats.impactPos;
    const sp = a.vp.worldToScreen(p.x, p.y);
    const panel = document.querySelector('.ctrl-panel').getBoundingClientRect();
    const hud = document.querySelector('.hud').getBoundingClientRect();
    const inside = (r) => sp.x >= r.left && sp.x <= r.right && sp.y >= r.top && sp.y <= r.bottom;
    return { x: sp.x, y: sp.y, W: a.vp.width, H: a.vp.height,
             hiddenByPanel: inside(panel), hiddenByHud: inside(hud) };
  });
  check('착탄점이 화면 안', impactBox.x > 0 && impactBox.x < impactBox.W
    && impactBox.y > 0 && impactBox.y < impactBox.H,
    `(${impactBox.x.toFixed(0)}, ${impactBox.y.toFixed(0)})`);
  check('착탄점이 컨트롤 패널에 안 가림', !impactBox.hiddenByPanel);
  check('착탄점이 HUD 에 안 가림', !impactBox.hiddenByHud);
  await shot('12-지표면-착지');
  check('충돌로 종료', s2.outcome === 'impact', s2.outcome);
  check('착탄각 산출', s2.stats.impactAngle > 0, s2.stats.impactAngle.toFixed(1) + '°');
  check('비행거리 산출', s2.stats.flightDist > 0, (s2.stats.flightDist / 1000).toFixed(0) + ' km');
  check('폭발 이펙트 재생', s2.explosionActive);
  check('HUD 충돌 배지', (await text('#hud-orbit')).includes('충돌'));
  check('HUD 착탄각 행 표시', await page.locator('#hud-impact-row').isVisible());
  check('HUD 착탄각 값', /\d+\.\d°/.test(await text('#hud-impang')), await text('#hud-impang'));
  check('HUD 비행거리 값', (await text('#hud-dist')).length > 0, await text('#hud-dist'));
  const hasImpactBorder = await page.locator('#hud-panel').evaluate((e) => e.classList.contains('impact'));
  check('HUD 패널 충돌 테두리', hasImpactBorder);
  check('발사 버튼 복구', (await text('#btn-fire')).includes('발사'));

  // ── 착지 후 궤도 모드로 자동 복귀 ──
  await page.waitForFunction(() => window.__cannon.router.current.id === 'orbital',
    null, { timeout: 6000 });
  await page.waitForTimeout(250);
  const s2b = await state();
  check('궤도 모드로 자동 복귀', s2b.mode === 'orbital');
  // 지표면 모드가 강제한 ×1 이 아니라, 사용자가 마지막으로 고른 배속(위에서 누른 ×128)이
  // 복원되는 것이 설계입니다 — 학생이 일부러 올린 속도를 되돌리지 않습니다.
  check('배속이 사용자 선택으로 복원 (×1 강제 해제)',
    s2b.timeScale === 128, `×${s2b.timeScale}`);
  check('모드 배지 숨김', !(await page.locator('#mode-badge').isVisible()));
  check('충돌 결과 이월', s2b.done && s2b.outcome === 'impact');
  check('탄도 궤적 이월', s2b.trailPoints > 10, `${s2b.trailPoints}점`);
  check('복귀 화면에서 충돌 이펙트 재생', s2b.explosionActive);
  check('HUD 충돌 배지 유지', (await text('#hud-orbit')).includes('충돌'));
  // 회귀 방지: 종단 상태를 안 넘기면 복귀 화면 HUD 가 '0 m/s' 를 보여줬습니다
  check('착탄 속력이 이월됨', s2b.speed > 3000, `${s2b.speed.toFixed(0)} m/s`);
  check('HUD 속력 표시', (await text('#hud-spd')) !== '0 m/s', await text('#hud-spd'));
  await shot('13-복귀-충돌이펙트');

  // 회귀 방지: 마지막 적분 스텝이 지표면을 지나쳐 고도가 음수로 표시되던 문제
  const altText = await text('#hud-alt');
  check('착탄 후 고도가 음수가 아님', !altText.includes('-'), altText);
  check('착탄 후 물리 고도가 정확히 지표면', Math.abs(s2.altitudeAtEnd) < 0.01,
    `${s2.altitudeAtEnd.toFixed(4)} m`);
  await shot('04-충돌이펙트');

  // ═══ [4] 리셋 ═══
  console.log('\n[4] 리셋');
  await page.click('#btn-reset');
  await page.waitForTimeout(400);
  const s3 = await state();
  check('시뮬 초기화', !s3.active && !s3.done);
  check('궤적 비움', s3.trailPoints === 0);
  check('파티클 정리', s3.particles === 0);
  check('HUD 초기화', (await text('#hud-spd')) === '— m/s');
  const cleared = await page.locator('#hud-panel').evaluate((e) =>
    !['impact', 'orbit', 'escape'].some((c) => e.classList.contains(c)));
  check('HUD 테두리 제거', cleared);
  check('통계 패널 숨김', !(await page.locator('#hud-stats').isVisible()));
  await shot('05-리셋후');

  console.log('\n[4b] 지표면 모드 비행 중 리셋 → 기본 화면 복귀');
  await setSlider('#s-spd', 1500);
  await page.waitForTimeout(400);
  await page.click('#btn-fire');
  await page.waitForTimeout(500);
  check('지표면 모드 진입', (await state()).mode === 'surface');
  await shot('14-지표면-저속');

  // 격자를 켜면 고도선과 카르만 선이 나타납니다 (지표면 모드 전용 경로)
  await page.keyboard.press('g');
  await page.waitForTimeout(400);
  check('지표면 모드 격자 켜짐', (await state()).display.showGrid);
  // 회귀 방지: 카르만 선 라벨이 좌상단 배지 뒤에 그려지던 문제.
  // 캔버스 텍스트라 DOM 으로 못 잡으므로 배지 영역의 픽셀을 직접 검사합니다.
  const badgeArea = await page.evaluate(() => {
    const b = document.querySelector('.info-badge').getBoundingClientRect();
    const c = document.getElementById('c');
    const g = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    // 배지 바로 오른쪽 여백에 청록 텍스트가 침범했는지 (배지 자체는 DOM 이라 캔버스엔 없음)
    const d = g.getImageData(b.left * dpr, b.top * dpr, b.width * dpr, b.height * dpr).data;
    let teal = 0;
    for (let i = 0; i < d.length; i += 4) {
      // 카르만 선 라벨 색 rgba(126,240,200,·) 계열
      if (d[i + 1] > 180 && d[i + 2] > 150 && d[i] < 170) teal++;
    }
    return { tealPixels: teal, area: (b.width * b.height * dpr * dpr) };
  });
  check('고도선 라벨이 좌상단 배지 영역을 침범하지 않음',
    badgeArea.tealPixels / badgeArea.area < 0.002,
    `${badgeArea.tealPixels}px`);
  await shot('15-지표면-격자');
  await page.keyboard.press('g');
  await page.waitForTimeout(200);
  await page.click('#btn-reset');
  await page.waitForTimeout(400);
  const s3b = await state();
  check('리셋 후 궤도 모드', s3b.mode === 'orbital');
  check('전환 예약 없음', !s3b.pendingSwitch);
  check('시뮬 초기화됨', !s3b.active && !s3b.done);

  // ═══ [5] 원궤도 발사 ═══
  console.log('\n[5] 원궤도 발사 (8000 m/s, 0°)');
  await setSlider('#s-ang', 0);
  await setSlider('#s-spd', 8000);
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await page.waitForTimeout(2500);
  const s4 = await state();
  check('여전히 비행 중', s4.active && !s4.done, `경과 ${(s4.elapsed / 60).toFixed(0)}분`);
  check('궤도 배지', (await text('#hud-orbit')) === '타원/원 궤도');
  check('고도가 궤도권 유지', s4.altitude > 0 && s4.altitude < 2e6,
    `${(s4.altitude / 1000).toFixed(0)} km`);
  await page.waitForFunction(() => window.__cannon.router.current.sim.trail.locked,
    null, { timeout: 40000 });
  const s4b = await state();
  check('1회 공전 후 궤적 잠금', s4b.trailLocked, `${s4b.trailPoints}점`);
  await shot('06-원궤도');

  // ═══ [5b] 실제 축척 — 타원이 정말 타원인가 ═══
  console.log('\n[5b] 실제 축척 타원 검증 (10000 m/s, 0°)');
  await page.keyboard.press('r');
  await page.waitForTimeout(400);
  await setSlider('#s-spd', 10000);
  await page.waitForTimeout(600);
  // ×128 이면 이 궤도(주기 5.5 h)가 1.3 초 만에 끝나 카메라 보간이 못 따라갑니다.
  // 추적 검사는 ×32 로 하고, 측정 뒤 ×128 로 마저 돌립니다.
  await page.keyboard.press('3');
  await page.keyboard.press('Space');

  /** 포탄의 화면 위치·줌·지구 가시성 */
  const camState = () => page.evaluate(() => {
    const a = window.__cannon, vp = a.vp, s = a.router.current.sim;
    const b = vp.worldToScreen(s.pos.x, s.pos.y);
    const R = vp.rSurfacePx * 1.15;
    const nx = Math.max(0, Math.min(vp.width, vp.ox)), ny = Math.max(0, Math.min(vp.height, vp.oy));
    return {
      offX: b.x - vp.width / 2, offY: b.y - vp.height / 2,
      zoom: vp.zoom.current, rRe: s.radius / 6.371e6,
      earthOffscreen: Math.hypot(vp.ox - nx, vp.oy - ny) > R,
      camAtEarth: Math.abs(vp.ox - vp.width / 2) < 4 && Math.abs(vp.oy - vp.height / 2) < 4,
    };
  });

  // 비행 중: 카메라는 포탄을 따라가고, 줌은 √ 법칙으로 조금만 물러납니다
  await page.waitForFunction(() => window.__cannon.router.current.sim.radius > 3.5 * 6.371e6,
    null, { timeout: 30000 });
  const mid = await camState();
  check('비행 중 카메라가 포탄을 추적 (화면 중앙 ±40 px)',
    Math.hypot(mid.offX, mid.offY) < 40, `오프셋 ${Math.hypot(mid.offX, mid.offY).toFixed(0)} px`);
  const zExp = Math.sqrt(1.5 / mid.rRe);
  check('추적 줌 = √(1.5 Re / r) 근방', Math.abs(mid.zoom - zExp) < 0.06,
    `zoom ${mid.zoom.toFixed(2)} (기대 ${zExp.toFixed(2)}, r ${mid.rRe.toFixed(1)} Re)`);
  await shot('06a-추적카메라');
  await page.keyboard.press('4');

  // 한 바퀴를 다 돌아도 추적은 계속됩니다. F(포탄 추적 해제)로 지구 중앙 + 타원 전체 보기
  await page.waitForFunction(() => window.__cannon.router.current.sim.trail.locked,
    null, { timeout: 40000 });
  await page.waitForTimeout(300);
  const locked = await camState();
  check('1회 공전 후에도 포탄 추적 유지', Math.hypot(locked.offX, locked.offY) < 40,
    `오프셋 ${Math.hypot(locked.offX, locked.offY).toFixed(0)} px`);
  await page.keyboard.press('f');
  await page.waitForTimeout(2500);
  check('F → 추적 해제, 지구 중앙 복귀', (await camState()).camAtEarth);
  check('체크박스 동기화 (포탄 추적 해제)', !(await page.$eval('#chk-follow', (el) => el.checked)));

  /**
   * 화면에 찍힌 궤적 점이 "지구 중심을 초점으로 하는 원뿔곡선" 위에 있는지 잽니다.
   * 월드 궤도 요소(e, ω)는 발사 상태로부터 해석적으로 구하고, 화면 반지름이
   * rPx = p'/(1+e·cos(θ−ω)) 를 만족하는지 p' 만 맞춰 잔차를 봅니다.
   */
  const shapeCheck = () => page.evaluate(() => {
    const a = window.__cannon;
    const vp = a.vp, pts = a.router.current.sim.trail.points;
    const GM = 6.674e-11 * 5.972e24;
    const spd = a.config.initSpeed, ang = a.config.angleDeg * Math.PI / 180;
    const pos = { x: 0, y: 6.371e6 + 8848 }, vel = { x: spd * Math.cos(ang), y: spd * Math.sin(ang) };
    const r0 = Math.hypot(pos.x, pos.y);
    const h = pos.x * vel.y - pos.y * vel.x;
    const ex = (vel.y * h) / GM - pos.x / r0, ey = (-vel.x * h) / GM - pos.y / r0;
    const e = Math.hypot(ex, ey), omega = Math.atan2(ey, ex);
    let num = 0, den = 0, inView = 0;
    const smp = pts.map((w) => {
      const s = vp.worldToScreen(w.x, w.y);
      if (s.x >= 0 && s.x <= vp.width && s.y >= 0 && s.y <= vp.height) inView++;
      const dx = s.x - vp.ox, dy = -(s.y - vp.oy);
      const rPx = Math.hypot(dx, dy);
      const f = 1 / (1 + e * Math.cos(Math.atan2(dy, dx) - omega));
      num += rPx * f; den += f * f;
      return { rPx, f };
    });
    const pFit = num / den;
    let maxRel = 0;
    for (const { rPx, f } of smp) maxRel = Math.max(maxRel, Math.abs(rPx - pFit * f) / (pFit * f));
    const rs = pts.map((w) => Math.hypot(w.x, w.y));
    const px = smp.map((q) => q.rPx);
    return {
      e, maxRel, n: pts.length, inViewFrac: inView / pts.length,
      worldRatio: Math.max(...rs) / Math.min(...rs),
      screenRatio: Math.max(...px) / Math.min(...px),
      projection: vp.projection.id, zoom: vp.zoom.current,
    };
  });

  const sh = await shapeCheck();
  check('선형 투영 적용', sh.projection === 'radial-linear', sh.projection);
  check('이심률 0.60 타원', Math.abs(sh.e - 0.601) < 0.005, sh.e.toFixed(3));
  check('화면 궤적이 지구를 초점으로 한 타원 (잔차 0.2% 미만)', sh.maxRel < 2e-3,
    `max 잔차 ${(sh.maxRel * 100).toFixed(3)}%`);
  check('원지점/근지점 거리비가 화면에서도 같음', Math.abs(sh.screenRatio - sh.worldRatio) < 0.02,
    `화면 ${sh.screenRatio.toFixed(3)} vs 실제 ${sh.worldRatio.toFixed(3)}`);
  check('타원 전체가 화면 안에', sh.inViewFrac === 1, `${(sh.inViewFrac * 100).toFixed(0)}%`);
  await shot('06b-실제축척-타원');

  // 압축 보기로 바꾸면 (설계상) 같은 궤적이 타원이 아니게 됩니다
  await page.keyboard.press('l');
  await page.waitForTimeout(400);
  const shLog = await shapeCheck();
  check('L → 압축 보기(로그 투영)', shLog.projection === 'radial-log', shLog.projection);
  check('체크박스 동기화 (해제)', !(await page.locator('#chk-scale').isChecked()));
  check('압축 보기 경고 배지 표시', await page.$eval('#scale-badge', (el) => el.style.display === 'flex'));
  check('로그 투영에서는 초점이 어긋남 (검증 지표가 왜곡을 잡아냄)', shLog.maxRel > 0.05,
    `max 잔차 ${(shLog.maxRel * 100).toFixed(1)}%, 거리비 ${shLog.screenRatio.toFixed(2)}`);
  await shot('06c-압축보기-타원');
  await page.keyboard.press('l');
  await page.waitForTimeout(400);
  check('L → 실제 축척 복귀', (await shapeCheck()).projection === 'radial-linear');
  await page.keyboard.press('f');
  check('F → 포탄 추적 복귀', await page.$eval('#chk-follow', (el) => el.checked));

  // ═══ [5c] 탈출 속도 미만의 먼 타원 — 지구 위치 표시창 + 에너지 기준 탈출 판정 ═══
  console.log('\n[5c] 11000 m/s, 0° — 원지점 30.6 Re 타원');
  await page.keyboard.press('r');
  await page.waitForTimeout(400);
  await setSlider('#s-spd', 11000);
  await page.waitForTimeout(500);
  await page.keyboard.press('4');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__cannon.router.current.sim.radius > 20 * 6.371e6,
    null, { timeout: 60000 });
  await page.waitForTimeout(300);
  const far = await camState();
  check('20 Re 에서 지구는 화면 밖', far.earthOffscreen, `r ${far.rRe.toFixed(1)} Re, zoom ${far.zoom.toFixed(2)}`);
  check('포탄은 여전히 화면 중앙', Math.hypot(far.offX, far.offY) < 40,
    `오프셋 ${Math.hypot(far.offX, far.offY).toFixed(0)} px`);
  // 지구 위치 표시창: 지구 방향(여기서는 위쪽) 가장자리에, 미니 지구가 그려져야 함
  const locator = await page.evaluate(() => {
    const a = window.__cannon, vp = a.vp;
    const L = a.router.current.layers.find((l) => l.name === 'earthLocator').last;
    if (!L) return null;
    const px = Math.round(L.x), py = Math.round(L.y);
    const dpr = window.devicePixelRatio || 1;
    const d = document.getElementById('c').getContext('2d').getImageData(px * dpr, py * dpr, 1, 1).data;
    // 창(라벨 포함)이 UI 오버레이와 겹치는가
    const pad = L.r + 13;
    const overlaps = [...document.querySelectorAll('.ui > *')].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && px - pad < b.right && px + pad > b.left && py - pad - 28 < b.bottom && py + pad + 28 > b.top;
    }).map((el) => el.className);
    return { px, py, rgb: [d[0], d[1], d[2]], top: py < vp.height / 2, overlaps };
  });
  check('지구 위치 표시창이 그려짐', !!locator);
  if (locator) {
    check('창은 지구가 있는 위쪽 가장자리에', locator.top, `(${locator.px},${locator.py})`);
    check('창 가운데에 미니 지구 (푸른 픽셀)', locator.rgb[2] > 120 && locator.rgb[2] > locator.rgb[0],
      `rgb ${locator.rgb.join(',')}`);
    check('창이 타이틀·HUD 등 UI 와 겹치지 않음', locator.overlaps.length === 0, locator.overlaps.join(', '));
  }
  await shot('06d-지구위치표시');

  // 30 Re(탈출 확정 거리)를 넘어도 에너지가 음수면 탈출이 아닙니다
  await page.waitForFunction(() => window.__cannon.router.current.sim.radius > 30.2 * 6.371e6,
    null, { timeout: 60000 });
  const beyond = await state();
  check('30 Re 를 넘어도 속박 궤도라 비행 계속', beyond.active && !beyond.done, `outcome=${beyond.outcome}`);
  check('배지는 여전히 타원 궤도', (await text('#hud-orbit')) === '타원/원 궤도', await text('#hud-orbit'));

  // ═══ [6] 키보드 단축키 ═══
  console.log('\n[6] 키보드 단축키');
  await page.keyboard.press('g');
  await page.waitForTimeout(200);
  check('G → 격자 켜짐', (await state()).display.showGrid);
  check('체크박스 동기화', await page.locator('#chk-grid').isChecked());
  await shot('07-격자표시');

  await page.keyboard.press('t');
  await page.waitForTimeout(200);
  check('T → 궤적 꺼짐', !(await state()).display.showTrail);
  await page.keyboard.press('t');
  await page.waitForTimeout(200);
  check('T → 궤적 다시 켜짐', (await state()).display.showTrail);

  for (const [key, mult] of [['1', 1], ['3', 32], ['4', 128], ['2', 8]]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(120);
    check(`${key} → 배속 ×${mult}`, (await state()).timeScale === mult, await text('#simspd-val'));
  }

  await page.keyboard.press('r');
  await page.waitForTimeout(400);
  check('R → 리셋', !(await state()).active);

  // ═══ [7] 탈출 궤도 ═══
  console.log('\n[7] 탈출 발사 (11500 m/s, 45°)');
  await setSlider('#s-ang', 45);
  await setSlider('#s-spd', 11500);
  await page.waitForTimeout(500);
  await page.keyboard.press('4');
  await page.click('#btn-fire');
  await page.waitForFunction(() => window.__cannon.router.current.sim.done, null, { timeout: 60000 });
  const s5 = await state();
  check('탈출로 종료', s5.outcome === 'escape', s5.outcome);
  check('HUD 탈출 배지', (await text('#hud-orbit')).includes('탈출'));
  check('최고고도 표시', (await text('#hud-maxalt')).length > 0, await text('#hud-maxalt'));
  await shot('08-탈출궤도');

  // ═══ [8] 모바일 세로 레이아웃 ═══
  console.log('\n[8] 모바일 세로 (390×844)');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(900);
  const boxes = await page.evaluate(() => {
    const r = (s) => {
      const b = document.querySelector(s).getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height };
    };
    return {
      ctrl: r('.ctrl-panel'), btn: r('.btn-group'), chk: r('.check-group'), hud: r('.hud'),
      vh: window.innerHeight, vw: window.innerWidth,
    };
  });
  check('컨트롤 패널이 화면 안', boxes.ctrl.bottom <= boxes.vh + 1,
    `bottom ${boxes.ctrl.bottom.toFixed(0)} / ${boxes.vh}`);
  check('버튼 그룹이 컨트롤 패널 위', boxes.btn.bottom <= boxes.ctrl.top + 1,
    `btn ${boxes.btn.bottom.toFixed(0)} ≤ ctrl ${boxes.ctrl.top.toFixed(0)}`);
  check('체크박스가 버튼 위', boxes.chk.bottom <= boxes.btn.top + 1,
    `chk ${boxes.chk.bottom.toFixed(0)} ≤ btn ${boxes.btn.top.toFixed(0)}`);
  check('HUD 가 화면 안', boxes.hud.right <= boxes.vw + 1);
  check('통계 패널 숨김(세로 모바일)', !(await page.locator('#hud-stats').isVisible()));
  const vpW = await page.evaluate(() => window.__cannon.vp.width);
  check('캔버스 리사이즈 반영', Math.abs(vpW - 390) < 2, String(vpW));

  // 회귀 방지: 좁은 화면에서 타이틀이 HUD/배지 뒤로 잘리던 문제
  check('타이틀 ↔ HUD 겹침 없음', !(await overlaps('.title-bar', '.hud')));
  check('타이틀 ↔ 좌상단 배지 겹침 없음', !(await overlaps('.title-bar', '.info-badge')));
  const title = await page.evaluate(() => {
    const b = document.querySelector('.title-bar h1').getBoundingClientRect();
    return { left: b.left, right: b.right, vw: window.innerWidth };
  });
  check('타이틀이 화면 안에 온전히 들어감',
    title.left >= 0 && title.right <= title.vw + 1,
    `${title.left.toFixed(0)}~${title.right.toFixed(0)} / ${title.vw}`);
  await shot('09-모바일세로');

  // ═══ [9] 모바일 가로 ═══
  console.log('\n[9] 모바일 가로 (844×390)');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(900);
  const land = await page.evaluate(() => {
    const b = document.querySelector('.ctrl-panel').getBoundingClientRect();
    return { right: b.right, bottom: b.bottom, vw: window.innerWidth, vh: window.innerHeight };
  });
  check('가로모드 컨트롤 패널 우하단 고정',
    Math.abs(land.right - land.vw) < 2 && Math.abs(land.bottom - land.vh) < 2,
    `right ${land.right.toFixed(0)}/${land.vw}, bottom ${land.bottom.toFixed(0)}/${land.vh}`);
  check('단축키 힌트 숨김', !(await page.locator('.shortcut-hint').isVisible()));
  await shot('10-모바일가로');

  // ═══ [10] 세션 전체 로그 재확인 ═══
  console.log('\n[10] 세션 전체 로그');
  check('세션 전체 미처리 예외 0', pageErrors.length === 0, pageErrors.join(' | '));
  check('세션 전체 콘솔 에러 0', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('세션 전체 요청 실패 0', failedRequests.length === 0, failedRequests.join(' | '));
} finally {
  await browser.close();
  server.kill();
}

console.log(fails.length === 0
  ? `\n✅ 전체 통과 — 스크린샷: ${OUT}`
  : `\n❌ 실패 ${fails.length}건: ${fails.join(', ')}`);
process.exit(fails.length ? 1 : 0);
