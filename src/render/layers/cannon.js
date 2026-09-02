import { BASE_ANGLE } from '../../core/constants.js';

/**
 * 대포 — 받침·바퀴는 지표면 접선에 고정, 포신만 발사각으로 회전합니다.
 * 반동 오프셋은 fx.launch 에서 읽어옵니다(이펙트와 렌더의 유일한 접점).
 */
export const cannonLayer = {
  name: 'cannon',
  draw({ ctx, vp, config, fx }) {
    const R = vp.rSurfacePx;
    const RMt = vp.rMountPx;
    const pivotX = vp.ox + Math.cos(BASE_ANGLE) * RMt;
    const pivotY = vp.oy + Math.sin(BASE_ANGLE) * RMt;
    const fireAngle = BASE_ANGLE + Math.PI / 2 - (config.angleDeg * Math.PI) / 180;

    const barrelL = Math.max(16, R * 0.12);
    const barrelW = Math.max(6, R * 0.03);
    const wheelR = Math.max(5, R * 0.024);

    ctx.save();
    ctx.translate(pivotX, pivotY);

    // ── 받침 + 바퀴 (지표면 접선 방향 고정) ──
    ctx.save();
    ctx.rotate(BASE_ANGLE + Math.PI / 2);
    const platW = barrelL * 0.9;
    const platH = barrelW * 0.5;
    ctx.beginPath();
    ctx.roundRect(-platW * 0.5, -platH, platW, platH, platH * 0.3);
    ctx.fillStyle = '#243c58';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,180,255,0.22)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    for (const wx of [-platW * 0.28, platW * 0.28]) {
      ctx.beginPath();
      ctx.arc(wx, 0, wheelR, 0, Math.PI * 2);
      ctx.fillStyle = '#1a2d42';
      ctx.fill();
      ctx.strokeStyle = '#4a80aa';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(wx, 0);
        ctx.lineTo(wx + Math.cos(a) * wheelR * 0.8, Math.sin(a) * wheelR * 0.8);
        ctx.strokeStyle = 'rgba(100,160,200,0.55)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
    }
    ctx.restore();

    // ── 포신 (발사각 + 반동) ──
    ctx.save();
    ctx.rotate(fireAngle);
    const recoil = fx.launch.recoilOffset;
    const bg = ctx.createLinearGradient(0, -barrelW * 0.5, 0, barrelW * 0.5);
    bg.addColorStop(0, '#9ac0e0');
    bg.addColorStop(0.4, '#6090b8');
    bg.addColorStop(1, '#2a4460');
    ctx.beginPath();
    ctx.roundRect(recoil, -barrelW * 0.5, barrelL, barrelW, barrelW * 0.35);
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(barrelL + recoil, 0, barrelW * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#4a7898';
    ctx.fill();
    ctx.strokeStyle = '#8abcdc';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(barrelL + recoil, 0, barrelW * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#08111e';
    ctx.fill();
    ctx.restore();

    ctx.restore();
  },
};
