/**
 * 파티클 시스템 (발사 불꽃 · 연기 · 폭발 · 파편).
 *
 * 파티클은 스폰 순간에 월드→화면 변환을 한 번만 하고, 그 뒤로는 **화면 좌표**에서
 * 움직입니다. 수명이 1~2초로 짧아 카메라 이동의 영향이 거의 없기 때문입니다.
 * (worldX/worldY 를 함께 저장해 두었으니, 나중에 카메라 보정이 필요해지면
 *  update 에서 화면 좌표를 다시 계산하도록 바꾸면 됩니다.)
 *
 * 새 파티클 종류를 추가하려면 RENDERERS 에 항목 하나만 추가하세요.
 */

const RENDERERS = {
  /** 발사 섬광: 노랑 → 주황 → 빨강 */
  flash(ctx, p, a) {
    const t = 1 - p.life;
    const g = Math.round(220 * (1 - t) + 80 * t);
    const b = Math.round(50 * (1 - t));
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,${g},${b},${a * 0.9})`;
    ctx.fill();
  },

  /** 연기: 커지면서 옅어짐 */
  smoke(ctx, p, a) {
    const sz = p.size * (1 + (1 - p.life) * 2.5);
    ctx.beginPath();
    ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,190,200,${a * 0.22})`;
    ctx.fill();
  },

  /** 폭발: 빨강 → 노랑 */
  explosion(ctx, p, a) {
    const hue = 10 + (1 - p.life) * 40;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue},100%,60%,${a * 0.88})`;
    ctx.fill();
  },

  /** 파편: 회전하는 작은 사각형 */
  debris(ctx, p, a) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.life * 8);
    ctx.fillStyle = `rgba(255,180,80,${a * 0.75})`;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  },
};

export class ParticleSystem {
  /** @type {object[]} */
  items = [];

  constructor({ max = 800 } = {}) {
    this.max = max;
  }

  clear() { this.items = []; }

  /**
   * @param {string} type RENDERERS 의 키
   * @param {Viewport} vp
   */
  spawn(type, vp, worldX, worldY, count, options = {}) {
    const sp = vp.worldToScreen(worldX, worldY);
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.max) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = options.speed
        ? (options.minSpeed || 0.5) + Math.random() * options.speed
        : 1 + Math.random() * 3;
      this.items.push({
        type,
        x: sp.x + (Math.random() - 0.5) * (options.spread || 4),
        y: sp.y + (Math.random() - 0.5) * (options.spread || 4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: options.decay || 0.015 + Math.random() * 0.025,
        size: options.size ? options.minSize + Math.random() * options.size : 2 + Math.random() * 4,
        gravity: options.gravity || 0,
        worldX, worldY,
      });
    }
  }

  updateAndDraw(ctx) {
    ctx.save();
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= p.decay;
      if (p.life <= 0) { this.items.splice(i, 1); continue; }
      RENDERERS[p.type]?.(ctx, p, Math.max(0, p.life));
    }
    ctx.restore();
  }
}
