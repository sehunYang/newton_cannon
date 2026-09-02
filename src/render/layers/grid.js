import { R_EARTH, R_LAUNCH } from '../../core/constants.js';

/**
 * 거리 격자 오버레이 (체크박스로 토글).
 *
 * 학습 목적: 로그 압축된 화면에서 "지금 보이는 저 높이가 지구 반지름 몇 배인지"를
 * 눈으로 확인시켜 주는 레이어입니다. 링 목록만 고치면 눈금을 바꿀 수 있습니다.
 */
const RINGS = [
  { r: R_EARTH, label: '지표면', dim: true },
  { r: R_LAUNCH, label: '8,848m', dim: true },
  { r: R_EARTH * 1.1, label: '0.1 Re', dim: false },
  { r: R_EARTH * 1.5, label: '0.5 Re', dim: false },
  { r: R_EARTH * 2, label: '1 Re', dim: false },
  { r: R_EARTH * 3, label: '2 Re', dim: false },
  { r: R_EARTH * 5, label: '4 Re', dim: false },
  { r: R_EARTH * 10, label: '9 Re', dim: false },
  { r: R_EARTH * 20, label: '19 Re', dim: false },
  { r: R_EARTH * 40, label: '39 Re', dim: false },
  { r: R_EARTH * 80, label: '탈출한계', dim: false },
];

export const gridLayer = {
  name: 'grid',
  visible: ({ display }) => display.showGrid,

  draw({ ctx, W, H, vp }) {
    const cx = vp.ox, cy = vp.oy;
    ctx.save();

    for (const ring of RINGS) {
      const rPx = vp.rToScreen(ring.r);
      if (rPx < 2 || rPx > Math.max(W, H) * 1.5) continue;

      ctx.beginPath();
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
      ctx.strokeStyle = ring.dim ? 'rgba(58,142,255,0.06)' : 'rgba(58,142,255,0.10)';
      ctx.lineWidth = ring.dim ? 0.8 : 1;
      ctx.stroke();

      if (ring.dim) continue;
      const lAngle = -Math.PI / 4;
      ctx.save();
      ctx.font = '10px "Space Mono",monospace';
      ctx.fillStyle = 'rgba(58,142,255,0.45)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(ring.label, cx + rPx * Math.cos(lAngle) + 5, cy + rPx * Math.sin(lAngle) - 4);
      ctx.restore();
    }

    // 방사선 (22.5° 간격)
    ctx.strokeStyle = 'rgba(58,142,255,0.05)';
    ctx.lineWidth = 0.8;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * Math.max(W, H) * 1.4, cy + Math.sin(a) * Math.max(W, H) * 1.4);
      ctx.stroke();
    }

    // 발사 고도의 원궤도 참고원
    const rOrbitPx = vp.rToScreen(R_LAUNCH);
    if (rOrbitPx > 2 && rOrbitPx < Math.max(W, H) * 1.5) {
      ctx.beginPath();
      ctx.arc(cx, cy, rOrbitPx, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(58,142,255,0.18)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.save();
      ctx.font = '10px "Space Mono",monospace';
      ctx.fillStyle = 'rgba(58,142,255,0.55)';
      ctx.textAlign = 'center';
      ctx.fillText('원궤도', cx, cy - rOrbitPx - 6);
      ctx.restore();
    }

    ctx.restore();
  },
};
