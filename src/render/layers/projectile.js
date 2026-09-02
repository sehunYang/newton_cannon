import { V1 } from '../../core/constants.js';
import { trailColor } from '../palette.js';

/**
 * 포탄 본체 + 속도 꼬리.
 *
 * 위치는 궤적 배열이 아니라 물리 상태(sim.pos)에서 직접 읽습니다 —
 * 궤적 기록이 잠긴 뒤에도 포탄이 멈춰 보이면 안 되기 때문입니다.
 * 꼬리는 Trail 의 recentPos 링 버퍼를 씁니다(같은 이유).
 */
export const projectileLayer = {
  name: 'projectile',
  // 비행이 끝나면 마커가 자리를 대신하므로 포탄은 숨깁니다
  visible: ({ sim }) => sim.active && !sim.done && sim.trail.length > 0,

  draw({ ctx, vp, sim, config }) {
    const sp = vp.worldToScreen(sim.pos.x, sim.pos.y);
    const br = Math.max(4, vp.uiScale * 0.032);
    const spd = sim.speed || config.initSpeed;

    // 속도가 빠를수록 흰-푸른 빛
    const t1 = Math.min(1, spd / V1);
    const inner = `rgb(${Math.round(255 * (1 - t1) + 120 * t1)},${Math.round(220 * (1 - t1) + 240 * t1)},255)`;

    ctx.beginPath();
    ctx.arc(sp.x, sp.y, br, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(sp.x - br * 0.3, sp.y - br * 0.3, 0, sp.x, sp.y, br);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, inner);
    g.addColorStop(1, trailColor(spd, 1));
    ctx.fillStyle = g;
    ctx.fill();

    // 글로우
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, br * 3, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(sp.x, sp.y, br * 0.5, sp.x, sp.y, br * 3);
    glow.addColorStop(0, trailColor(spd, 0.3));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fill();

    // 속도 꼬리
    const recent = sim.trail.recentPos;
    if (spd > 500 && recent.length > 3) {
      const tail = recent.length >= 6 ? recent[recent.length - 6] : recent[0];
      const ts = vp.worldToScreen(tail.x, tail.y);
      ctx.save();
      const grad = ctx.createLinearGradient(ts.x, ts.y, sp.x, sp.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, trailColor(spd, 0.6));
      ctx.beginPath();
      ctx.moveTo(ts.x, ts.y);
      ctx.lineTo(sp.x, sp.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = br * 1.2;
      ctx.stroke();
      ctx.restore();
    }
  },
};
