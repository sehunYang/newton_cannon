import { KARMAN_LINE, R_EARTH } from '../../core/constants.js';
import { groundPolyline, groundYAt, groundDistanceAt, skyWorldAt } from '../surfaceView.js';
import { elevationAt, terrainColor, cloudsIn } from '../surfaceTerrain.js';

/**
 * 지표면 클로즈업의 땅과 대기.
 *
 * 지표면은 '아래쪽을 칠한 직선'이 아니라, 화면 밖 아득히 아래에 중심을 둔
 * 거대한 원의 호입니다. 그래서 좌우 끝으로 갈수록 실제 지구 곡률만큼
 * 정확히 내려갑니다 — 사거리가 길어 축척이 커지면 눈에 띄게 휩니다.
 *
 * 땅은 세 겹으로 칠합니다.
 *   ① 땅속   — 깊어질수록 어두워지는 바탕 (별을 가리는 불투명 덩어리)
 *   ② 지표층 — 발사 지점에서 잰 거리에 따라 바다·해안·평야·산악이 바뀌는 띠.
 *              색은 `surfaceTerrain.js` 가 정합니다 (지형은 무늬일 뿐, 물리가 아닙니다)
 *   ③ 햇빛   — 지표 바로 아래 밝은 띠
 * 그 위로 대기층과 구름이 얹힙니다.
 *
 * 색은 대기·지평선 모두 궤도 모드의 지구와 같은 계열을 씁니다.
 * 같은 행성이라는 인상을 유지하기 위해서입니다.
 *
 * ★ 그라디언트는 반드시 '지구 중심 기준 방사형'이어야 합니다.
 *   대기층도 땅속 깊이도 고도(=중심으로부터의 거리)를 따라 변하는 값인데,
 *   화면 세로 방향 선형 그라디언트를 쓰면 지표면이 휜 만큼 색이 어긋나
 *   화면 한쪽에 색 쐐기가 생깁니다. 지표층 띠도 같은 이유로 각 열마다
 *   '지구 중심을 향하는' 방향으로 내려긋습니다.
 *
 * ★ 지표층(②)은 오프스크린 캔버스에 캐시합니다. 4 px 간격 열마다 채우기·긋기를
 *   두 번씩 하므로(화면폭 1,100 이면 ≈ 300 번), 매 프레임 다시 그리면 트래픽이
 *   꽤 됩니다. 그런데 축척(mpp)과 지구 중심 화면 위치(vp.ox, vp.oy, rSurfacePx)는
 *   지표면 모드에서 리사이즈 전까지 **비행 내내 고정**입니다(SurfaceMode 의
 *   `applyFraming` 이 발사 시점에 한 번 정합니다). 그래서 이 값들이 그대로인
 *   프레임에는 다시 그리지 않고 그냥 붙여넣습니다. 궤적 캐시(`trail.js`)와
 *   같은 이유·같은 방식입니다.
 */
export function createTerrainLayer() {
  const bodyCache = document.createElement('canvas');
  const bodyCtx = bodyCache.getContext('2d');
  let cacheKey = null;

  function ensureGroundBody(W, H, vp, mpp) {
    const key = `${W}|${H}|${vp.ox.toFixed(1)}|${vp.oy.toFixed(1)}|${vp.rSurfacePx.toFixed(2)}|${mpp}`;
    if (key === cacheKey) return;

    if (bodyCache.width !== W || bodyCache.height !== H) {
      bodyCache.width = W;
      bodyCache.height = H;
    } else {
      bodyCtx.clearRect(0, 0, W, H);
    }
    drawGroundBody(bodyCtx, W, H, vp, groundPolyline(vp), mpp);
    cacheKey = key;
  }

  return {
    name: 'terrain',
    draw({ ctx, W, H, vp, mode }) {
      const ground = groundPolyline(vp);
      const mpp = mode.metersPerPixel;
      const thickness = KARMAN_LINE / mpp;

      drawAtmosphere(ctx, vp, ground, thickness);
      ensureGroundBody(W, H, vp, mpp);
      ctx.drawImage(bodyCache, 0, 0);
      drawHorizonLine(ctx, ground);
      drawClouds(ctx, W, H, vp, mpp);
    },
  };
}

/** 땅속 바탕색 — 지표층이 이 색으로 잦아들며 아래로 이어집니다 */
const UNDERGROUND = '16,26,32';

/**
 * 대기층 — 지표면 위 카르만 선(100 km) 두께의 푸른 구각.
 * 축척이 커지면 얇아지고 가까이서 보면 화면을 채웁니다. 이것도 실제 비율입니다.
 */
function drawAtmosphere(ctx, vp, ground, thickness) {
  const R = vp.rSurfacePx;

  const g = ctx.createRadialGradient(vp.ox, vp.oy, R, vp.ox, vp.oy, R + thickness);
  g.addColorStop(0, 'rgba(60,140,255,0.30)');
  g.addColorStop(0.35, 'rgba(45,110,215,0.13)');
  g.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.save();
  ctx.beginPath();
  traceGround(ctx, ground);
  // 지표면 위로 대기 두께만큼 올라간 영역 (윗변도 같은 곡률을 따릅니다)
  for (let i = ground.length - 1; i >= 0; i--) {
    ctx.lineTo(ground[i].x, ground[i].y - thickness);
  }
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/** 땅 — 지평선 아래 전체를 채우고, 깊어질수록 어두워집니다 */
function drawGroundBody(ctx, W, H, vp, ground, mpp) {
  const R = vp.rSurfacePx;
  const depth = Math.max(1, H + 80); // 화면 아래로 충분히
  const inner = Math.max(0, R - depth);
  // 지표층 띠의 두께(px). 화면에 보이는 땅의 3분의 1쯤 — 남은 아래쪽은 어둠입니다
  const band = Math.max(26, Math.min(120, depth * 0.32));

  ctx.save();
  ctx.beginPath();
  traceGround(ctx, ground);
  ctx.lineTo(W + 40, H + 40);
  ctx.lineTo(-40, H + 40);
  ctx.closePath();
  ctx.clip();

  // ① 땅속: 안쪽(깊은 곳) → 바깥쪽(지표면) 순서로 색을 놓습니다.
  //    띠가 시작되는 깊이부터는 색을 고정해, 지표층이 이 색으로 정확히 이어지게 합니다.
  const g = ctx.createRadialGradient(vp.ox, vp.oy, inner, vp.ox, vp.oy, R);
  g.addColorStop(0, 'rgba(5,8,12,1)');
  g.addColorStop(Math.max(0, 1 - band / depth), `rgba(${UNDERGROUND},1)`);
  g.addColorStop(1, `rgba(${UNDERGROUND},1)`);
  ctx.fillStyle = g;
  ctx.fillRect(-40, 0, W + 80, H + 40);

  drawSurfaceBand(ctx, W, vp, band, mpp);

  // ③ 지표 바로 아래 밝은 띠 — 햇빛 받는 지면
  // (궤도 모드 지구의 하이라이트와 같은 역할)
  const lit = ctx.createRadialGradient(vp.ox, vp.oy, R - 14, vp.ox, vp.oy, R);
  lit.addColorStop(0, 'rgba(220,240,255,0)');
  lit.addColorStop(1, 'rgba(220,240,255,0.13)');
  ctx.fillStyle = lit;
  ctx.fillRect(-40, 0, W + 80, H + 40);
  ctx.restore();
}

/**
 * ② 지표층 — 화면 가로를 열(column)로 잘라, 각 열의 '발사 지점에서 잰 거리'에
 * 해당하는 지형 색으로 칠합니다. 열마다 지구 중심 방향으로 band 만큼 내려긋기
 * 때문에 지표면이 휜 그대로 따라갑니다.
 *
 * 열 간격이 4 px 인 것은 지형 색이 그 정도 폭에서는 거의 변하지 않아서입니다.
 * 유일한 예외가 해안선인데, 거기서는 **경계가 선명한 편이 오히려 좋습니다**.
 *
 * `minFeature = mpp × step × 2` 를 `elevationAt` 에 넘겨, 이 열 간격으로는 애초에
 * 구분할 수 없는 파장의 옥타브를 미리 죽입니다. 안 그러면 사거리가 길어 축척이
 * 커졌을 때 인접한 열이 서로 무관한 고주파 값을 찍어 지지직거리는 세로줄이 생깁니다
 * (표본 간격보다 짧은 파장은 살릴 수 없다는 나이퀴스트 조건과 같은 이야기입니다).
 */
function drawSurfaceBand(ctx, W, vp, band, mpp) {
  const R = vp.rSurfacePx;
  const step = 4;
  const minFeature = mpp * step * 2;
  const column = (x) => {
    const y = groundYAt(vp, x);
    return {
      x,
      y,
      // 지구 중심을 향하는 단위 벡터 (지표면 점이므로 중심까지 거리는 정확히 R)
      nx: (vp.ox - x) / R,
      ny: (vp.oy - y) / R,
      color: terrainColor(elevationAt(groundDistanceAt(vp, x), minFeature)),
    };
  };

  let prev = column(-40);
  for (let x = -40 + step; x <= W + 44; x += step) {
    const cur = column(x);
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(cur.x, cur.y);
    ctx.lineTo(cur.x + cur.nx * band, cur.y + cur.ny * band);
    ctx.lineTo(prev.x + prev.nx * band, prev.y + prev.ny * band);
    ctx.closePath();
    ctx.fillStyle = prev.color;
    ctx.fill();
    // 인접한 두 사각형이 공유하는 변에 안티에일리어싱 실선이 생기지 않도록
    // 같은 색으로 한 번 더 그어 줍니다
    ctx.strokeStyle = prev.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    prev = cur;
  }

  // 아래쪽 절반은 땅속 색으로 잦아들게 — 띠와 바탕의 경계가 보이지 않도록
  ctx.beginPath();
  traceBandStrip(ctx, vp, W, band, step);
  const fade = ctx.createRadialGradient(vp.ox, vp.oy, R - band, vp.ox, vp.oy, R);
  fade.addColorStop(0, `rgba(${UNDERGROUND},1)`);
  fade.addColorStop(0.5, `rgba(${UNDERGROUND},0.45)`);
  fade.addColorStop(1, `rgba(${UNDERGROUND},0)`);
  ctx.fillStyle = fade;
  ctx.fill();
}

/** 지표층 띠의 외곽선 (위: 지표면, 아래: 지구 중심 쪽으로 band 만큼) */
function traceBandStrip(ctx, vp, W, band, step) {
  const R = vp.rSurfacePx;
  const pt = (x, inward) => {
    const y = groundYAt(vp, x);
    return inward
      ? { x: x + ((vp.ox - x) / R) * band, y: y + ((vp.oy - y) / R) * band }
      : { x, y };
  };
  let p = pt(-40, false);
  ctx.moveTo(p.x, p.y);
  for (let x = -40 + step; x <= W + 44; x += step) {
    p = pt(x, false);
    ctx.lineTo(p.x, p.y);
  }
  for (let x = W + 44; x >= -40; x -= step) {
    p = pt(x, true);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

/** 지평선 — 궤도 모드 지구 테두리와 같은 파란 실선 */
function drawHorizonLine(ctx, ground) {
  ctx.save();
  ctx.beginPath();
  traceGround(ctx, ground);
  ctx.strokeStyle = 'rgba(80,160,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * 구름 — 고도 2~11 km 의 실제 대류권 높이에 뜹니다.
 *
 * 그래서 축척에 따라 알아서 처신합니다. 사거리가 길어 축척이 커지면 지평선에
 * 얇게 깔린 흰 얼룩이 되고, 아주 가까이 다가가면 화면 위로 밀려나 사라집니다
 * (100 m/px 에서 5 km 상공의 구름은 화면 50 px 위 — 아직 보이지만,
 *  1 m/px 이면 5,000 px 위라 하늘 밖입니다).
 */
function drawClouds(ctx, W, H, vp, mpp) {
  const sMin = groundDistanceAt(vp, -60);
  const sMax = groundDistanceAt(vp, W + 60);

  ctx.save();
  for (const c of cloudsIn(sMin, sMax)) {
    const halfW = c.halfWidth / mpp;
    if (halfW < 1.5) continue; // 점 하나보다 작으면 그리지 않습니다
    const p = vp.worldToScreen(...xy(skyWorldAt(c.s, c.alt)));
    if (p.y < -60 || p.y > H + 60 || p.x < -halfW - 40 || p.x > W + halfW + 40) continue;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(c.s / R_EARTH); // 그 자리의 지표면 기울기 — 곡률을 따라 눕습니다
    ctx.scale(1, 0.24);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, halfW);
    g.addColorStop(0, `rgba(236,244,255,${c.alpha})`);
    g.addColorStop(0.55, `rgba(214,230,250,${c.alpha * 0.5})`);
    g.addColorStop(1, 'rgba(200,220,245,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, halfW, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

const xy = (p) => [p.x, p.y];

function traceGround(ctx, ground) {
  ctx.moveTo(ground[0].x, ground[0].y);
  for (let i = 1; i < ground.length; i++) ctx.lineTo(ground[i].x, ground[i].y);
}
