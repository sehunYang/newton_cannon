import { fmtDist } from '../core/format.js';

/**
 * 착탄 폭발 이펙트 — 파티클 · 충격파 링 · 화면 붉은 플래시 · 경고 텍스트.
 *
 * ★ 확장 메모 (지표면 모드)
 * 이 이펙트는 **월드 좌표 하나와 FlightResult 만 있으면** 재생됩니다.
 * 어느 모드에서 착탄이 일어났는지는 전혀 알 필요가 없으므로,
 * 지표면 모드에서 착지 → 궤도 모드로 복귀할 때
 *   explosion.trigger(vp, result.stats.impactPos, result)
 * 한 줄이면 "충돌 이펙트는 그대로 표기" 요구를 만족합니다.
 */
export class ExplosionFx {
  active = false;
  timer = 0;
  duration = 2.2;
  pos = { x: 0, y: 0 };
  rings = [];
  overlayAlpha = 0;
  /** 텍스트에 띄울 비행 결과 (착탄각·비행거리) */
  result = null;

  constructor(particles) {
    this.particles = particles;
  }

  trigger(vp, worldPos, result = null) {
    this.active = true;
    this.timer = 0;
    this.pos = { ...worldPos };
    this.overlayAlpha = 0;
    this.result = result;

    this.particles.spawn('explosion', vp, worldPos.x, worldPos.y, 55, {
      speed: 9, minSpeed: 2, spread: 5, decay: 0.018, size: 7, minSize: 3, gravity: 0.05,
    });
    this.particles.spawn('debris', vp, worldPos.x, worldPos.y, 20, {
      speed: 5, minSpeed: 1, spread: 3, decay: 0.008, size: 4, minSize: 2, gravity: 0.08,
    });

    this.rings = [
      { r: 0, maxR: 60, speed: 3.5, alpha: 0.8 },
      { r: 0, maxR: 100, speed: 2.2, alpha: 0.5 },
      { r: 0, maxR: 160, speed: 1.4, alpha: 0.3 },
    ];
  }

  reset() {
    this.active = false;
    this.overlayAlpha = 0;
    this.rings = [];
    this.result = null;
  }

  update(dt) {
    if (!this.active) return;
    this.timer += dt;
    const t = this.timer / this.duration;

    for (const ring of this.rings) ring.r = Math.min(ring.maxR, ring.r + ring.speed);

    // 0 → 0.35 로 튀었다가 서서히 사라짐
    this.overlayAlpha = t < 0.15
      ? (t / 0.15) * 0.35
      : Math.max(0, 0.35 * (1 - (t - 0.15) / 0.85));

    if (this.timer >= this.duration) this.reset();
  }

  draw({ ctx, W, H, vp }) {
    if (!this.active) return;
    const sp = vp.worldToScreen(this.pos.x, this.pos.y);
    const t = this.timer / this.duration;

    ctx.save();
    for (const ring of this.rings) {
      if (ring.r <= 0) continue;
      const a = ring.alpha * Math.max(0, 1 - ring.r / ring.maxR);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,140,40,${a})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();

    if (this.overlayAlpha > 0.005) {
      ctx.save();
      ctx.fillStyle = `rgba(200,40,20,${this.overlayAlpha})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (t > 0.05 && t < 0.75) this.#drawWarningText(ctx, W, H, t);
  }

  #drawWarningText(ctx, W, H, t) {
    const alpha = t < 0.15 ? (t - 0.05) / 0.1
      : t > 0.6 ? 1 - (t - 0.6) / 0.15
      : 1;

    ctx.save();
    ctx.shadowColor = 'rgba(255,60,20,0.8)';
    ctx.shadowBlur = 24;
    ctx.font = `bold ${Math.round(W * 0.032)}px 'Noto Sans KR', sans-serif`;
    ctx.fillStyle = `rgba(255,220,200,${alpha})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('포탄이 지구에 충돌했습니다!', W / 2, H / 2);
    ctx.shadowBlur = 0;

    const stats = this.result?.stats;
    if (stats) {
      ctx.font = `${Math.round(W * 0.016)}px 'Space Mono', monospace`;
      ctx.fillStyle = `rgba(255,160,120,${alpha * 0.75})`;
      ctx.fillText(
        `착탄각 ${stats.impactAngle.toFixed(1)}°  |  비행거리 ${fmtDist(stats.flightDist)}`,
        W / 2, H / 2 + W * 0.038,
      );
    }
    ctx.restore();
  }
}
