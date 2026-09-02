/**
 * 파티클 시스템 (발사 불꽃 · 연기 · 폭발 · 파편).
 *
 * 파티클은 **월드 좌표의 기준점** 하나와, 거기서부터의 **화면 픽셀 오프셋**으로 움직입니다.
 * 매 프레임 기준점을 다시 투영하므로 카메라가 포탄을 따라 달려가도 발사 연기는
 * 발사대에 붙어 있고, 줌이 바뀌면 크기도 그에 맞춰 줄어듭니다.
 * (화면 픽셀에서 움직이는 이유: 연기·불꽃의 퍼짐은 물리량이 아니라 연출이라
 *  줌과 무관하게 같은 속도로 보이는 게 자연스럽습니다.)
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
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.max) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = options.speed
        ? (options.minSpeed || 0.5) + Math.random() * options.speed
        : 1 + Math.random() * 3;
      this.items.push({
        type,
        // 기준점(worldX, worldY)으로부터의 화면 오프셋 (px)
        x: (Math.random() - 0.5) * (options.spread || 4),
        y: (Math.random() - 0.5) * (options.spread || 4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: options.decay || 0.015 + Math.random() * 0.025,
        size: options.size ? options.minSize + Math.random() * options.size : 2 + Math.random() * 4,
        gravity: options.gravity || 0,
        worldX, worldY,
        uiScale0: vp.uiScale, // 스폰 당시 줌 — 이후 줌 아웃하면 그 비율만큼 축소
      });
    }
  }

  /** @param {Viewport} vp 기준점을 다시 투영할 뷰포트 */
  updateAndDraw(ctx, vp) {
    ctx.save();
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= p.decay;
      if (p.life <= 0) { this.items.splice(i, 1); continue; }
      const anchor = vp.worldToScreen(p.worldX, p.worldY);
      const k = Math.min(1, vp.uiScale / p.uiScale0);
      ctx.save();
      ctx.translate(anchor.x, anchor.y);
      ctx.scale(k, k);
      RENDERERS[p.type]?.(ctx, p, Math.max(0, p.life));
      ctx.restore();
    }
    ctx.restore();
  }
}
