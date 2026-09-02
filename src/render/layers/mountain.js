import { BASE_ANGLE } from '../../core/constants.js';

/** 에베레스트 — 대포가 서 있는 발사대. 12시 방향에 고정입니다. */
export const mountainLayer = {
  name: 'mountain',
  draw({ ctx, vp }) {
    const R = vp.rSurfacePx;
    const RMt = vp.rMountPx;

    ctx.save();
    ctx.translate(vp.ox, vp.oy);
    ctx.rotate(BASE_ANGLE + Math.PI / 2); // 로컬 −y 가 12시 방향

    const mW = Math.max(10, R * 0.085);
    const snowH = (RMt - R) * 0.32;

    // 산 몸체
    ctx.beginPath();
    ctx.moveTo(-mW * 2.0, -R);
    ctx.lineTo(-mW * 0.7, -(R + (RMt - R) * 0.6));
    ctx.lineTo(0, -RMt);
    ctx.lineTo(mW * 0.7, -(R + (RMt - R) * 0.6));
    ctx.lineTo(mW * 2.0, -R);
    ctx.closePath();
    const mg = ctx.createLinearGradient(0, -RMt, 0, -R);
    mg.addColorStop(0, '#4a7040');
    mg.addColorStop(0.4, '#385830');
    mg.addColorStop(1, '#223018');
    ctx.fillStyle = mg;
    ctx.fill();

    // 암벽 음영
    ctx.beginPath();
    ctx.moveTo(-mW * 0.7, -(R + (RMt - R) * 0.6));
    ctx.lineTo(0, -RMt);
    ctx.lineTo(mW * 0.7, -(R + (RMt - R) * 0.6));
    ctx.closePath();
    ctx.fillStyle = 'rgba(20,30,20,0.35)';
    ctx.fill();

    // 만년설
    ctx.beginPath();
    ctx.moveTo(-mW * 0.55, -(RMt - snowH));
    ctx.lineTo(0, -RMt);
    ctx.lineTo(mW * 0.55, -(RMt - snowH));
    ctx.closePath();
    ctx.fillStyle = 'rgba(228,240,255,0.92)';
    ctx.fill();

    // 눈 음영
    ctx.beginPath();
    ctx.moveTo(0, -RMt);
    ctx.lineTo(mW * 0.55, -(RMt - snowH));
    ctx.lineTo(0, -(RMt - snowH * 0.5));
    ctx.closePath();
    ctx.fillStyle = 'rgba(150,180,220,0.3)';
    ctx.fill();

    ctx.restore();
  },
};
