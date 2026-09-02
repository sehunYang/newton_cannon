/**
 * 별 배경.
 * 좌표는 0~1 정규화 값으로 한 번만 생성해두고 매 프레임 화면 크기에 곱합니다.
 * (리사이즈해도 별이 다시 흩어지지 않음)
 */
export function createStarsLayer({ count = 320 } = {}) {
  const stars = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.2 + 0.2,
    a: Math.random() * 0.55 + 0.25,
  }));

  return {
    name: 'stars',
    draw({ ctx, W, H }) {
      for (const s of stars) {
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${s.a})`;
        ctx.fill();
      }
    },
  };
}
