/**
 * 이펙트 레이어 — 항상 마지막에 그려집니다.
 * 파티클(월드 위) → 폭발 링/오버레이/경고 텍스트(화면 전체) 순서.
 *
 * 이 두 레이어는 그리기 직전에 자기 상태를 갱신합니다. 이펙트의 수명은
 * 물리가 아니라 '화면에 보인 시간'으로 세는 게 자연스럽기 때문입니다.
 */
export const particlesLayer = {
  name: 'particles',
  draw({ ctx, fx, vp }) {
    fx.particles.updateAndDraw(ctx, vp);
  },
};

export const explosionLayer = {
  name: 'explosion',
  draw(frame) {
    frame.fx.explosion.update(frame.dt);
    frame.fx.explosion.draw(frame);
  },
};
