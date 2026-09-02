import { BASE_ANGLE } from '../../core/constants.js';

/**
 * 조준 UI — 발사 전에만 보입니다.
 * 점선 조준선 + 각도 호 + 각도 레이블로, 슬라이더 각도가 실제 발사 방향과
 * 어떻게 연결되는지 학생이 바로 볼 수 있게 합니다.
 */
export const aimLayer = {
  name: 'aim',
  visible: ({ sim }) => !sim.active && !sim.done,

  draw({ ctx, W, H, vp, config }) {
    const { angleDeg } = config;
    const RMt = vp.rMountPx;
    const pivotX = vp.ox + Math.cos(BASE_ANGLE) * RMt;
    const pivotY = vp.oy + Math.sin(BASE_ANGLE) * RMt;

    const horizAngle = BASE_ANGLE + Math.PI / 2;             // 지평선(오른쪽)
    const fireAngle = horizAngle - (angleDeg * Math.PI) / 180; // 실제 발사 방향

    // 에베레스트 반경 링
    ctx.save();
    ctx.setLineDash([4, 8]);
    ctx.strokeStyle = 'rgba(58,142,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(vp.ox, vp.oy, RMt, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 조준선
    const aimLen = Math.max(W, H) * 0.7;
    ctx.save();
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(pivotX + Math.cos(fireAngle) * aimLen, pivotY + Math.sin(fireAngle) * aimLen);
    ctx.strokeStyle = 'rgba(58,142,255,0.30)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 각도 호
    const arcR = Math.max(30, RMt * 0.55);
    ctx.save();
    ctx.translate(pivotX, pivotY);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(horizAngle) * arcR * 1.15, Math.sin(horizAngle) * arcR * 1.15);
    ctx.strokeStyle = 'rgba(58,142,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (Math.abs(angleDeg) > 0.25) {  // 최소 눈금(0.5°)에서도 호가 그려지도록
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, arcR, Math.min(horizAngle, fireAngle), Math.max(horizAngle, fireAngle));
      ctx.closePath();
      ctx.fillStyle = 'rgba(58,142,255,0.07)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, arcR,
        angleDeg >= 0 ? fireAngle : horizAngle,
        angleDeg >= 0 ? horizAngle : fireAngle);
      ctx.strokeStyle = 'rgba(58,142,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const midA = (horizAngle + fireAngle) / 2;
      const lblR = arcR + 16;
      ctx.font = 'bold 13px "Space Mono",monospace';
      ctx.fillStyle = 'rgba(126,240,200,0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(angleDeg.toFixed(1) + '°', Math.cos(midA) * lblR, Math.sin(midA) * lblR);
    }

    // 포구 pivot 점
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(58,142,255,0.7)';
    ctx.fill();
    ctx.restore();

    // 0° 기준 레이블
    ctx.save();
    ctx.font = '11px "Space Mono",monospace';
    ctx.fillStyle = 'rgba(90,122,160,0.6)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('0°',
      pivotX + Math.cos(horizAngle) * (arcR * 1.2 + 10),
      pivotY + Math.sin(horizAngle) * (arcR * 1.2 + 10));
    ctx.restore();
  },
};
