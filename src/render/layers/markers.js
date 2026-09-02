import { H_MOUNT } from '../../core/constants.js';
import { fmtAlt } from '../../core/format.js';

/**
 * 궤적 위에 얹히는 주석 마커: 최고고도 · 착탄점 · 탈출 방향.
 *
 * 표시 조건이 궤적과 묶여 있습니다(궤적 끄면 마커도 사라짐).
 * 마커를 항상 보이게 하고 싶다면 visible 의 display.showTrail 조건만 빼면 됩니다.
 */
export const markersLayer = {
  name: 'markers',
  visible: ({ display, sim }) => display.showTrail && sim.trail.length >= 2,

  draw(frame) {
    const { sim } = frame;
    drawMaxAltMarker(frame);
    if (sim.done && sim.outcome === 'impact' && sim.stats.impactPos) {
      drawImpactMarker(frame, sim.stats.impactPos);
    }
    if (sim.done && sim.outcome === 'escape') drawEscapeArrow(frame);
  },
};

/** 원지점(최고 고도) 다이아몬드 마커 */
function drawMaxAltMarker({ ctx, vp, sim }) {
  const { maxAltPos, maxAlt } = sim.stats;
  if (!maxAltPos || maxAlt < H_MOUNT * 2) return;

  const sp = vp.worldToScreen(maxAltPos.x, maxAltPos.y);
  const r = Math.max(5, vp.uiScale * 0.025);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sp.x, sp.y - r * 1.6);
  ctx.lineTo(sp.x + r, sp.y);
  ctx.lineTo(sp.x, sp.y + r * 1.6);
  ctx.lineTo(sp.x - r, sp.y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(126,240,200,0.25)';
  ctx.strokeStyle = 'rgba(126,240,200,0.80)';
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 13px "Space Mono",monospace';
  ctx.fillStyle = 'rgba(126,240,200,0.85)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('▲ ' + fmtAlt(maxAlt), sp.x, sp.y - r * 2);
  ctx.restore();
}

/** 착탄 지점 X 마커 + 착탄각 라벨 */
function drawImpactMarker({ ctx, vp, sim }, pos) {
  const sp = vp.worldToScreen(pos.x, pos.y);
  const r = Math.max(6, vp.uiScale * 0.035);

  ctx.save();
  for (let i = 3; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r * i * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,${80 + i * 30},40,${0.5 / i})`;
    ctx.lineWidth = 2 / i;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(sp.x, sp.y, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,100,40,0.85)';
  ctx.fill();

  const x2 = r * 0.35;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(sp.x - x2, sp.y - x2); ctx.lineTo(sp.x + x2, sp.y + x2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sp.x + x2, sp.y - x2); ctx.lineTo(sp.x - x2, sp.y + x2); ctx.stroke();

  ctx.font = 'bold 13px "Space Mono",monospace';
  ctx.fillStyle = 'rgba(255,140,80,0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('💥 ' + sim.stats.impactAngle.toFixed(1) + '°', sp.x, sp.y + r * 1.2);
  ctx.restore();
}

/** 화면 가장자리에 탈출 방향 화살표 */
function drawEscapeArrow({ ctx, W, H, vp, sim }) {
  const dir = sim.stats.escapeDir;
  const edgeR = Math.min(W, H) * 0.42;
  const ax = vp.ox + Math.cos(dir) * edgeR;
  const ay = vp.oy - Math.sin(dir) * edgeR; // 물리 y → 화면 y 반전

  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(-dir - Math.PI / 2);
  const sz = 18;
  ctx.beginPath();
  ctx.moveTo(0, -sz);
  ctx.lineTo(-sz * 0.5, sz * 0.4);
  ctx.lineTo(0, 0);
  ctx.lineTo(sz * 0.5, sz * 0.4);
  ctx.closePath();
  ctx.fillStyle = 'rgba(126,240,200,0.85)';
  ctx.strokeStyle = 'rgba(126,240,200,0.4)';
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.font = 'bold 13px "Space Mono",monospace';
  ctx.fillStyle = 'rgba(126,240,200,0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🚀 탈출', ax, ay + 28);
  ctx.restore();
}
