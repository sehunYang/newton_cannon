/** 우주 배경 그라디언트 — 항상 맨 처음 그려집니다. */
export const backgroundLayer = {
  name: 'background',
  draw({ ctx, W, H }) {
    const g = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
    g.addColorStop(0, '#0b1220');
    g.addColorStop(1, '#050a14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  },
};
