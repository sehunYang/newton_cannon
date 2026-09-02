import { R_EARTH } from '../../core/constants.js';
import { drawEarthBody } from './earth.js';

/**
 * 지구 위치 표시창.
 *
 * 추적 카메라가 포탄을 따라가다 지구가 화면 밖으로 완전히 나가면, 화면 가장자리의
 * **지구가 있는 방향**에 둥근 창을 띄우고 그 가운데 미니 지구를 그립니다.
 * "지구는 저쪽에 있고, 우리는 이만큼 떠나왔다"는 감각을 잃지 않게 하는 장치입니다.
 * 지구가 조금이라도 보이는 동안에는 나타나지 않고, 밖으로 나간 거리에 따라 서서히 떠오릅니다.
 *
 * 창은 타이틀·HUD·컨트롤 패널 같은 DOM 오버레이 위에 얹히면 안 되므로, 겹치면
 * 같은 가장자리를 따라 옆으로 비켜섭니다(방향 화살촉은 그대로 지구를 가리킵니다).
 */
const RADIUS = 44;   // 창 반지름 (px)
const MARGIN = 14;   // 화면 가장자리에서 창까지의 여백 (px)
const FADE_PX = 90;  // 지구가 화면 밖으로 이만큼 더 나갈 때까지 페이드 인
const LABEL_H = 28;  // 창 아래(또는 위) 거리 라벨이 차지하는 높이

/** 화면을 덮고 있는 UI 오버레이들의 사각형 (보이는 것만) — 캔버스는 (0,0) 원점이라 좌표계가 같습니다 */
function overlayRects() {
  if (typeof document === 'undefined') return [];
  const out = [];
  for (const el of document.querySelectorAll('.ui > *')) {
    const b = el.getBoundingClientRect();
    if (b.width > 0 && b.height > 0) out.push({ x0: b.left, y0: b.top, x1: b.right, y1: b.bottom });
  }
  return out;
}

/** 창(라벨·화살촉 포함)의 경계 상자가 오버레이와 겹치는가 */
function collides(px, py, r, rects) {
  const pad = r + 13; // 화살촉 끝까지
  const x0 = px - pad, x1 = px + pad, y0 = py - pad - LABEL_H, y1 = py + pad + LABEL_H;
  return rects.some((b) => x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0);
}

/**
 * 여백 사각형의 가장자리를 따라 겹치지 않는 가장 가까운 자리로 밀어냅니다.
 * @param {boolean} alongX 가로 가장자리(위/아래)에 붙었으면 x 방향으로, 아니면 y 방향으로 이동
 */
function slideClear(px, py, r, alongX, limit, rects) {
  if (!collides(px, py, r, rects)) return [px, py];
  const step = 12;
  for (let d = step; d <= limit.half * 2; d += step) {
    for (const sign of [1, -1]) {
      const x = alongX ? px + sign * d : px;
      const y = alongX ? py : py + sign * d;
      // 여백 사각형 밖으로는 나가지 않습니다
      if (alongX ? Math.abs(x - limit.cx) > limit.half : Math.abs(y - limit.cy) > limit.half) continue;
      if (!collides(x, y, r, rects)) return [x, y];
    }
  }
  return [px, py]; // 빈자리가 없으면 원래 자리 (겹치더라도 표시는 합니다)
}

export const earthLocatorLayer = {
  name: 'earthLocator',
  visible: ({ sim }) => sim.active || sim.done,
  /** 마지막으로 그린 창의 위치·반지름 (안 그렸으면 null) — 테스트·디버깅용 */
  last: null,

  draw({ ctx, vp, W, H }) {
    this.last = null;
    // 지구 원판(대기 글로우 포함)이 화면 사각형 밖으로 얼마나 나갔는가
    const earthR = vp.rSurfacePx * 1.15;
    const nx = Math.max(0, Math.min(W, vp.ox));
    const ny = Math.max(0, Math.min(H, vp.oy));
    const outside = Math.hypot(vp.ox - nx, vp.oy - ny) - earthR;
    if (outside <= 0) return;
    const alpha = Math.min(1, outside / FADE_PX);

    // 화면 중앙(= 추적 중인 포탄)에서 지구를 향한 방향으로, 여백 사각형과 만나는 점에 창을 둡니다
    const mx = W / 2, my = H / 2;
    const ang = Math.atan2(vp.oy - my, vp.ox - mx);
    const c = Math.cos(ang), s = Math.sin(ang);
    const r = Math.min(RADIUS, Math.min(W, H) * 0.09);
    const halfW = W / 2 - (r + MARGIN), halfH = H / 2 - (r + MARGIN);
    const tX = halfW / Math.max(Math.abs(c), 1e-9), tY = halfH / Math.max(Math.abs(s), 1e-9);
    const t = Math.min(tX, tY);
    const onTopBottom = tY <= tX; // 위/아래 가장자리에 닿았는가
    const [px, py] = slideClear(mx + c * t, my + s * t, r, onTopBottom,
      onTopBottom ? { cx: mx, cy: my, half: halfW } : { cx: mx, cy: my, half: halfH },
      overlayRects());
    this.last = { x: px, y: py, r };

    ctx.save();
    ctx.globalAlpha = alpha;

    // 창: 어두운 원판 + 두 겹 테두리
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5,10,20,0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,160,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(80,160,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 방향 화살촉: 테두리 위, 지구 쪽을 가리킴
    const tipR = r + 13, baseR = r + 4, half = 0.16;
    ctx.beginPath();
    ctx.moveTo(px + c * tipR, py + s * tipR);
    ctx.lineTo(px + Math.cos(ang + half) * baseR, py + Math.sin(ang + half) * baseR);
    ctx.lineTo(px + Math.cos(ang - half) * baseR, py + Math.sin(ang - half) * baseR);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120,190,255,0.9)';
    ctx.fill();

    // 미니 지구
    drawEarthBody(ctx, px, py, r * 0.42);

    // 거리 라벨 — 창이 화면 아래쪽 가장자리에 붙으면 위에, 아니면 아래에
    const dist = Math.hypot(vp.ox - mx, vp.oy - my);
    const distRe = vp.projection.screenToR(vp, dist) / R_EARTH;
    const label = `지구 ${distRe < 10 ? distRe.toFixed(1) : Math.round(distRe)} Re`;
    const below = py + r + 26 < H - 4;
    ctx.font = 'bold 12px "Space Mono",monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = below ? 'top' : 'bottom';
    ctx.fillStyle = 'rgba(150,200,255,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(label, px, below ? py + r + 10 : py - r - 10);
    ctx.restore();
  },
};
