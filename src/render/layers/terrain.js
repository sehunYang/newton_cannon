import { KARMAN_LINE } from '../../core/constants.js';
import { groundPolyline } from '../surfaceView.js';

/**
 * 지표면 클로즈업의 땅과 대기.
 *
 * 지표면은 '아래쪽을 칠한 직선'이 아니라, 화면 밖 아득히 아래에 중심을 둔
 * 거대한 원의 호입니다. 그래서 좌우 끝으로 갈수록 실제 지구 곡률만큼
 * 정확히 내려갑니다 — 사거리가 길어 축척이 커지면 눈에 띄게 휩니다.
 *
 * 색은 대기·지평선 모두 궤도 모드의 지구와 같은 계열을 씁니다.
 * 같은 행성이라는 인상을 유지하기 위해서입니다.
 *
 * ★ 그라디언트는 반드시 '지구 중심 기준 방사형'이어야 합니다.
 *   대기층도 땅속 깊이도 고도(=중심으로부터의 거리)를 따라 변하는 값인데,
 *   화면 세로 방향 선형 그라디언트를 쓰면 지표면이 휜 만큼 색이 어긋나
 *   화면 한쪽에 색 쐐기가 생깁니다.
 */
export const terrainLayer = {
  name: 'terrain',

  draw({ ctx, W, H, vp, mode }) {
    const ground = groundPolyline(vp);
    const thickness = KARMAN_LINE / mode.metersPerPixel;

    drawAtmosphere(ctx, vp, ground, thickness);
    drawGroundBody(ctx, W, H, vp, ground);
    drawHorizonLine(ctx, ground);
  },
};

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
function drawGroundBody(ctx, W, H, vp, ground) {
  const R = vp.rSurfacePx;
  const depth = Math.max(1, H + 80); // 화면 아래로 충분히
  const inner = Math.max(0, R - depth);

  ctx.save();
  ctx.beginPath();
  traceGround(ctx, ground);
  ctx.lineTo(W + 40, H + 40);
  ctx.lineTo(-40, H + 40);
  ctx.closePath();

  // 안쪽(깊은 곳) → 바깥쪽(지표면) 순서로 색을 놓습니다
  const g = ctx.createRadialGradient(vp.ox, vp.oy, inner, vp.ox, vp.oy, R);
  g.addColorStop(0, 'rgba(9,18,14,0.99)');
  g.addColorStop(Math.max(0, 1 - 240 / depth), 'rgba(26,50,30,0.97)');
  g.addColorStop(Math.max(0, 1 - 60 / depth), 'rgba(40,76,42,0.95)');
  g.addColorStop(1, 'rgba(58,104,56,0.95)');
  ctx.fillStyle = g;
  ctx.fill();

  // 지표 바로 아래 밝은 띠 — 햇빛 받는 지면
  // (궤도 모드 지구의 하이라이트와 같은 역할)
  const lit = ctx.createRadialGradient(vp.ox, vp.oy, R - 14, vp.ox, vp.oy, R);
  lit.addColorStop(0, 'rgba(150,200,130,0)');
  lit.addColorStop(1, 'rgba(160,210,140,0.20)');
  ctx.fillStyle = lit;
  ctx.fill();
  ctx.restore();
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

function traceGround(ctx, ground) {
  ctx.moveTo(ground[0].x, ground[0].y);
  for (let i = 1; i < ground.length; i++) ctx.lineTo(ground[i].x, ground[i].y);
}
