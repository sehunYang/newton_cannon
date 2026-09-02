/**
 * README 용 스크린샷 촬영.
 *
 *   npm run docs:shots
 *
 * 테스트가 남기는 임시 스크린샷(.test-output/)과 달리, 여기서 찍은 것은
 * docs/images/ 에 커밋되어 README 에 실립니다. 그래서 상태를 의도적으로
 * 만들어 놓고 찍습니다(궤적이 충분히 그려진 시점, 격자 켠 화면 등).
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = ROOT + 'docs/images';
const PORT = 5201;

mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['scripts/serve.js'], {
  cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 600));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: 1100, height: 690 },
  deviceScaleFactor: 1,
});

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('  ✔', name);
};
const wait = (ms) => page.waitForTimeout(ms);
const setSlider = (sel, v) => page.locator(sel).evaluate((el, val) => {
  el.value = String(val);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, v);
const reset = async () => { await page.click('#btn-reset'); await wait(500); };
const done = (timeout) =>
  page.waitForFunction(() => window.__cannon.router.current.sim.done, null, { timeout });

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__cannon, null, { timeout: 5000 });
  await wait(900);

  console.log('궤도 시점');
  // ① 발사 전 — 조준 UI 와 대포가 보이는 첫 화면
  await setSlider('#s-ang', 30);
  await wait(600);
  await shot('01-orbital-aim');

  // ② 타원 궤도 — 1회 공전 완료 후 (격자 켜서 거리 눈금까지).
  //    실제 축척(기본)이라 원지점 4 Re 의 타원이 지구를 초점에 두고 그대로 보입니다
  await reset();
  await setSlider('#s-ang', 0);
  await setSlider('#s-spd', 10000);
  await wait(700);
  await page.keyboard.press('g');
  await page.click('#btn-fire');
  // 비행 중에는 카메라가 포탄을 따라갑니다 — 원지점 근처에서 한 장
  await page.waitForFunction(() => window.__cannon.router.current.sim.radius > 3.6 * 6.371e6,
    null, { timeout: 60000 });
  await shot('02a-orbit-follow');
  // 한 바퀴를 다 돌면 F(추적 해제)로 지구 중앙 + 타원 전체
  await page.waitForFunction(() => window.__cannon.router.current.sim.trail.locked,
    null, { timeout: 60000 });
  await page.keyboard.press('f');
  await wait(3000);
  await shot('02-orbit-ellipse');
  await page.keyboard.press('f');
  await page.keyboard.press('g');

  // ②c 에너지 그래프 — 타원 궤도에서 K·U 가 교환되고 E 는 수평선
  await reset();
  await setSlider('#s-spd', 10000);
  await wait(600);
  await page.keyboard.press('3');
  await page.click('#btn-fire');
  await page.waitForFunction(() => window.__cannon.router.current.sim.trail.locked,
    null, { timeout: 60000 });
  await wait(300);
  await shot('02c-energy-graph');

  // ②b 지구 위치 표시창 — 11 km/s 로 20 Re 까지 나가면 지구가 화면 밖
  await reset();
  await setSlider('#s-spd', 11000);
  await wait(500);
  await page.keyboard.press('4');
  await page.click('#btn-fire');
  await page.waitForFunction(() => window.__cannon.router.current.sim.radius > 20 * 6.371e6,
    null, { timeout: 60000 });
  await wait(300);
  await shot('02b-earth-locator');

  // ③ 탈출 궤도 — 지구와 포탄이 함께 들어오도록 물러난 결과 화면
  await reset();
  await setSlider('#s-ang', 45);
  await setSlider('#s-spd', 11600);
  await wait(600);
  await page.keyboard.press('4');
  await page.click('#btn-fire');
  await done(90000);
  await wait(2500); // 결과 시점(지구~포탄 전체)으로 물러나는 줌이 안정될 때까지
  await shot('03-escape');

  console.log('지표면 시점');
  // ④ 지표면 비행 중 — 궤적이 충분히 그려진 뒤 배속을 ×1 로 되돌려 촬영
  await reset();
  await page.keyboard.press('2');
  await setSlider('#s-ang', 45);
  await setSlider('#s-spd', 3200);
  await wait(600);
  await page.click('#btn-fire');            // 배속은 비행시간에 맞춰 자동 선택됩니다
  await page.waitForFunction(() => window.__cannon.router.current.sim.groundDistance > 4.5e5,
    null, { timeout: 60000 });
  await wait(200);
  await shot('04-surface-flight');

  // ⑤ 착지 순간 (곡면 위 충돌)
  await done(90000);
  await wait(280);
  await shot('05-surface-impact');

  // ⑥ 궤도 시점 자동 복귀 — 충돌 결과가 그대로 표시됨
  await page.waitForFunction(() => window.__cannon.router.current.id === 'orbital',
    null, { timeout: 8000 });
  await wait(500);
  await shot('06-return-to-orbital');

  // ⑦ 지표면 + 격자 — 고도선·카르만 선·평평한 지구 비교선
  await reset();
  await page.keyboard.press('2');
  await setSlider('#s-ang', 42);
  await setSlider('#s-spd', 1800);
  await wait(600);
  await page.click('#btn-fire');
  await page.waitForFunction(() => window.__cannon.router.current.sim.altitude > 6e4,
    null, { timeout: 60000 });
  await page.keyboard.press('g');
  await wait(600);
  await shot('07-surface-grid');
  await page.keyboard.press('g');

  console.log('모바일');
  // ⑧ 모바일 세로
  await reset();
  await page.setViewportSize({ width: 390, height: 780 });
  await wait(900);
  await setSlider('#s-ang', 35);
  await setSlider('#s-spd', 7900);
  await wait(700);
  await page.click('#btn-fire');
  await wait(2500);
  await shot('08-mobile');
} finally {
  await browser.close();
  server.kill();
}

console.log('\n📸 docs/images/ 에 저장되었습니다');
