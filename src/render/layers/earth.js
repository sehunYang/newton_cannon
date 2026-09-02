import { CONTINENTS, lonLatToXY } from '../../data/continents.js';

/** 대륙 폴리곤 — 지구 원판 안쪽으로 클리핑해서 채웁니다. */
function drawContinents(ctx, cx, cy, R) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  for (const cont of CONTINENTS) {
    ctx.beginPath();
    const p0 = lonLatToXY(cont[0][0], cont[0][1], cx, cy, R);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < cont.length; i++) {
      const p = lonLatToXY(cont[i][0], cont[i][1], cx, cy, R);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(50,100,45,0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,140,70,0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 지구 본체를 임의의 위치·반지름으로 그립니다: 대기 글로우 → 바다 → 대륙 → 테두리 → 하이라이트.
 * 본 화면의 지구와 earthLocator 의 미니 지구가 같은 그림을 씁니다.
 */
export function drawEarthBody(ctx, cx, cy, R) {
    const atm = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.22);
    atm.addColorStop(0, 'rgba(60,140,255,0.28)');
    atm.addColorStop(0.5, 'rgba(40,100,200,0.09)');
    atm.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2);
    ctx.fillStyle = atm;
    ctx.fill();

    const eg = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.25, R * 0.04, cx, cy, R);
    eg.addColorStop(0, '#4484d8');
    eg.addColorStop(0.45, '#2456aa');
    eg.addColorStop(0.85, '#1a3a6e');
    eg.addColorStop(1, '#0f2244');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = eg;
    ctx.fill();

    drawContinents(ctx, cx, cy, R);

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(80,160,255,0.38)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const hl = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, 0, cx - R * 0.1, cy - R * 0.1, R * 0.85);
    hl.addColorStop(0, 'rgba(180,220,255,0.14)');
    hl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = hl;
    ctx.fill();
}

export const earthLayer = {
  name: 'earth',
  draw({ ctx, vp }) {
    drawEarthBody(ctx, vp.ox, vp.oy, vp.rSurfacePx);
  },
};
