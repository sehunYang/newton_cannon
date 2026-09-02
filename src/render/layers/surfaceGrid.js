import { KARMAN_LINE } from '../../core/constants.js';
import { groundWorldAt, skyWorldAt, groundYAt, niceStep, tickLabel } from '../surfaceView.js';

/**
 * 지표면 모드의 눈금과 주석.
 *
 * 세 가지를 그립니다.
 *  ① 거리 눈금 — 발사 지점에서 지표면을 따라 잰 거리. 이 화면의 기본 자(尺)라
 *     격자 체크박스와 무관하게 항상 보입니다.
 *  ② 고도선   — 격자 표시를 켰을 때. 카르만 선(100 km)은 따로 강조합니다.
 *  ③ '평평한 지구' 비교선 — 발사 지점 접선. 실제 지표면이 이 선에서 얼마나
 *     내려갔는지를 보여주는, 이 모드의 핵심 교육 장치입니다.
 *     축척이 작을 땐 거의 겹치고(=가까이선 평평해 보임), 사거리가 길어지면
 *     확연히 벌어집니다.
 */
export const surfaceGridLayer = {
  name: 'surface-grid',

  draw(frame) {
    drawFlatEarthReference(frame);
    drawDistanceTicks(frame);
    if (frame.display.showGrid) drawAltitudeLines(frame);
  },
};

// ── ① 지표면 거리 눈금 ─────────────────────────────────────────
function drawDistanceTicks({ ctx, W, vp, mode }) {
  const mpp = mode.metersPerPixel;
  const step = niceStep((W * mpp) / 8);

  // 화면에 보이는 거리 범위 (발사 지점은 화면 x = vp.ox 근처)
  const from = Math.floor(((-60 - vp.ox) * mpp) / step) * step;
  const to = Math.ceil(((W + 60 - vp.ox) * mpp) / step) * step;

  ctx.save();
  ctx.font = '10px "Space Mono",monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let d = from; d <= to; d += step) {
    const base = vp.worldToScreen(...xy(groundWorldAt(d)));
    if (base.x < -40 || base.x > W + 40) continue;

    const isOrigin = Math.abs(d) < step * 0.01;
    const tip = vp.worldToScreen(...xy(skyWorldAt(d, (isOrigin ? 11 : 7) * mpp)));

    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.strokeStyle = isOrigin ? 'rgba(126,240,200,0.7)' : 'rgba(126,240,200,0.35)';
    ctx.lineWidth = isOrigin ? 1.6 : 1;
    ctx.stroke();

    // 짙은 지면 위에서 읽히도록 옅은 그림자를 깝니다
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 3;
    ctx.fillStyle = isOrigin ? 'rgba(126,240,200,0.95)' : 'rgba(126,240,200,0.62)';
    ctx.fillText(isOrigin ? '발사' : tickLabel(Math.abs(d)), base.x, base.y + 5);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

/** 좌상단 배지(줌·배속·시점)가 차지하는 영역 — 고도선 라벨이 피해야 합니다 */
const BADGE_ZONE = { right: 152, bottom: 170 };

// ── ② 고도선 ──────────────────────────────────────────────────
function drawAltitudeLines({ ctx, W, vp, mode }) {
  const mpp = mode.metersPerPixel;
  // 화면 위쪽 끝이 몇 m 고도인지
  const topAlt = Math.max(0, groundYAt(vp, W / 2)) * mpp;
  if (topAlt <= 0) return;

  const step = niceStep(topAlt / 5);
  const lines = [];
  for (let alt = step; alt <= topAlt; alt += step) lines.push({ alt, karman: false });
  if (KARMAN_LINE <= topAlt) lines.push({ alt: KARMAN_LINE, karman: true });

  ctx.save();
  ctx.font = '10px "Space Mono",monospace';
  ctx.textBaseline = 'bottom';

  for (const { alt, karman } of lines) {
    ctx.beginPath();
    for (let x = -20; x <= W + 20; x += 16) {
      // 고도선도 지표면과 같은 곡률을 갖습니다 (동심원)
      const y = groundYAt(vp, x) - alt / mpp;
      x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = karman ? 'rgba(126,240,200,0.32)' : 'rgba(58,142,255,0.14)';
    ctx.lineWidth = karman ? 1.2 : 0.8;
    if (karman) ctx.setLineDash([7, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 화면 좌상단에는 줌/배속/시점 배지가 떠 있으므로, 그 높이대의 라벨은
    // 오른쪽으로 밀어 겹치지 않게 합니다.
    const ly = groundYAt(vp, 74) - alt / mpp - 4;
    const lx = ly < BADGE_ZONE.bottom ? BADGE_ZONE.right : 16;
    ctx.fillStyle = karman ? 'rgba(126,240,200,0.75)' : 'rgba(58,142,255,0.45)';
    ctx.textAlign = 'left';
    ctx.fillText(karman ? '카르만 선 100 km — 우주의 경계' : tickLabel(alt), lx, ly);
  }
  ctx.restore();
}

// ── ③ '평평한 지구' 비교선 ────────────────────────────────────
function drawFlatEarthReference({ ctx, W, vp, mode, display }) {
  // 발사 지점의 접선 = 지표면 원의 꼭대기를 지나는 수평선
  const tangentY = vp.oy - vp.rSurfacePx;
  const edgeX = Math.abs(W - vp.ox) > Math.abs(vp.ox) ? W : 0;
  const dropPx = groundYAt(vp, edgeX) - tangentY;
  if (dropPx < 3) return; // 이 축척에선 곡률이 픽셀 이하 — 그리면 오히려 거짓말

  ctx.save();
  ctx.setLineDash([6, 7]);
  ctx.beginPath();
  ctx.moveTo(0, tangentY);
  ctx.lineTo(W, tangentY);
  ctx.strokeStyle = 'rgba(255,160,64,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  if (dropPx > 14) {
    // 벌어진 간격을 세로 화살표와 수치로 표시
    ctx.beginPath();
    ctx.moveTo(edgeX === 0 ? 26 : W - 26, tangentY);
    ctx.lineTo(edgeX === 0 ? 26 : W - 26, groundYAt(vp, edgeX === 0 ? 26 : W - 26));
    ctx.strokeStyle = 'rgba(255,160,64,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '10px "Space Mono",monospace';
    ctx.fillStyle = 'rgba(255,160,64,0.72)';
    ctx.textAlign = edgeX === 0 ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    const drop = dropPx * mode.metersPerPixel;
    ctx.fillText('평평한 지구라면', edgeX === 0 ? 34 : W - 34, tangentY - 9);
    if (display.showGrid) {
      ctx.fillText(`↓ ${tickLabel(drop)} 낮아짐`, edgeX === 0 ? 34 : W - 34,
        (tangentY + groundYAt(vp, edgeX === 0 ? 26 : W - 26)) / 2);
    }
  }
  ctx.restore();
}

const xy = (p) => [p.x, p.y];
