import { DT_ORBITAL, ESCAPE_RADIUS, R_EARTH } from '../../core/constants.js';
import { ProjectileSim } from '../../sim/ProjectileSim.js';
import { Trail } from '../../sim/Trail.js';
import { pointMassGravity } from '../../physics/gravity.js';
import { RadialLogProjection } from '../../render/projections/RadialLogProjection.js';
import { speedToZoom, altToZoom } from '../../render/zoomPolicy.js';

import { backgroundLayer } from '../../render/layers/background.js';
import { createStarsLayer } from '../../render/layers/stars.js';
import { gridLayer } from '../../render/layers/grid.js';
import { earthLayer } from '../../render/layers/earth.js';
import { aimLayer } from '../../render/layers/aim.js';
import { mountainLayer } from '../../render/layers/mountain.js';
import { cannonLayer } from '../../render/layers/cannon.js';
import { createTrailLayer } from '../../render/layers/trail.js';
import { markersLayer } from '../../render/layers/markers.js';
import { projectileLayer } from '../../render/layers/projectile.js';
import { particlesLayer, explosionLayer } from '../../render/layers/effects.js';

/**
 * 궤도 모드 — 지구 전체가 보이는 기본 화면.
 *
 * 시간은 배속(×1~×128)으로 흐르고, 한 프레임에 timeScale 번의
 * 2초 스텝을 진행합니다. 궤도 주기가 90분 이상이라 실시간으로는
 * 아무 일도 일어나지 않기 때문입니다.
 */
export function createOrbitalMode() {
  const sim = new ProjectileSim({
    id: 'orbital',
    dt: DT_ORBITAL,
    accel: pointMassGravity,
    surfaceRadius: R_EARTH,
    escapeRadius: ESCAPE_RADIUS,
    trail: new Trail(),
  });

  const trailLayer = createTrailLayer();

  const layers = [
    backgroundLayer,
    createStarsLayer(),
    gridLayer,
    earthLayer,
    aimLayer,
    mountainLayer,
    cannonLayer,
    trailLayer,
    markersLayer,
    projectileLayer,
    particlesLayer,
    explosionLayer,
  ];

  let ctx = null;

  return {
    id: 'orbital',
    sim,
    layers,

    /** 기본 모드이므로 모든 발사를 받아줍니다 (라우터의 최후 폴백) */
    accepts: () => true,

    enter(modeCtx, { config, carry } = {}) {
      ctx = modeCtx;
      sim.bus = modeCtx.bus;
      modeCtx.vp.setProjection(RadialLogProjection);
      modeCtx.vp.setZoom(speedToZoom(config?.initSpeed ?? 0), { immediate: !carry });
      modeCtx.cam.centerOn(modeCtx.vp);
      trailLayer.invalidate();

      // ★ 다른 모드에서 넘어온 비행 결과 이어받기
      //   지표면 모드에서 착탄이 일어나면 그 결과를 그대로 복원해서
      //   "원래 화면으로 돌아와 충돌 이펙트를 표기"합니다.
      if (carry) this.restoreResult(carry);
    },

    exit() { ctx = null; },

    launch(launchState) {
      sim.launch(launchState);
      ctx.fx.launch.trigger(ctx.vp, launchState.config.angleDeg);
    },

    reset() {
      sim.reset();
      trailLayer.invalidate();
    },

    /** 표시 옵션이 바뀌어 캐시된 렌더를 버려야 할 때 App 이 호출 */
    invalidateRender() {
      trailLayer.invalidate();
    },

    /**
     * 다른 모드의 비행 결과를 이 화면에 얹습니다.
     * 궤적 점들이 함께 오면 그대로 그려지고, 없으면 착탄 마커와
     * 폭발 이펙트만 재생됩니다.
     */
    restoreResult(result) {
      sim.done = true;
      sim.active = false;
      sim.outcome = result.outcome;
      sim.elapsed = result.elapsed;
      sim.stats = result.stats;
      sim.config = result.config;
      // 종료 순간의 물리 상태까지 이어받아야 HUD 가 착탄 속력·고도를 제대로 보여줍니다
      if (result.state) {
        sim.pos = { ...result.state.pos };
        sim.vel = { ...result.state.vel };
      }
      if (result.trailPoints) sim.trail.points = result.trailPoints;
      trailLayer.invalidate();

      if (result.outcome === 'impact' && result.stats.impactPos) {
        ctx.fx.explosion.trigger(ctx.vp, result.stats.impactPos, result);
      }
    },

    /** 궤도 모드는 착탄/탈출 후에도 이 화면에 머무릅니다 */
    onFlightEnd: () => null,

    update({ vp, cam, config }) {
      // ── 줌: 발사 전엔 속도 미리보기, 비행 중엔 고도와 함께 더 넓은 쪽 ──
      if (!sim.active && !sim.done) {
        vp.zoom.target = speedToZoom(config.initSpeed);
      } else if (sim.active) {
        vp.zoom.target = Math.min(speedToZoom(config.initSpeed), altToZoom(sim.radius));
      }
      vp.updateZoom();

      // ── 카메라: 비행 중에만 포탄 추적 ──
      const follow = sim.active && sim.trail.length > 0 ? sim.pos : null;
      cam.update(vp, follow);
      if (!sim.active && !sim.done) cam.centerOn(vp);

      // ── 물리: 배속만큼 스텝 진행 ──
      sim.advance(config.timeScale);
    },
  };
}
