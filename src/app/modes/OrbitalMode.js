import { DT_ORBITAL, ESCAPE_RADIUS, R_EARTH } from '../../core/constants.js';
import { ProjectileSim } from '../../sim/ProjectileSim.js';
import { Trail } from '../../sim/Trail.js';
import { pointMassGravity } from '../../physics/gravity.js';
import { RadialLogProjection } from '../../render/projections/RadialLogProjection.js';
import { RadialLinearProjection } from '../../render/projections/RadialLinearProjection.js';
import {
  speedToZoom, altToZoom, followZoom, fitZoomForOrbit, fitZoomForRadius,
} from '../../render/zoomPolicy.js';

import { backgroundLayer } from '../../render/layers/background.js';
import { createStarsLayer } from '../../render/layers/stars.js';
import { gridLayer } from '../../render/layers/grid.js';
import { earthLayer } from '../../render/layers/earth.js';
import { aimLayer } from '../../render/layers/aim.js';
import { mountainLayer } from '../../render/layers/mountain.js';
import { cannonLayer } from '../../render/layers/cannon.js';
import { createTrailLayer } from '../../render/layers/trail.js';
import { markersLayer } from '../../render/layers/markers.js';
import { earthLocatorLayer } from '../../render/layers/earthLocator.js';
import { projectileLayer } from '../../render/layers/projectile.js';
import { particlesLayer, explosionLayer } from '../../render/layers/effects.js';

/**
 * 궤도 모드 — 지구 전체가 보이는 기본 화면.
 *
 * 시간은 배속(×1~×128)으로 흐르고, 한 프레임에 timeScale 번의
 * 2초 스텝을 진행합니다. 궤도 주기가 90분 이상이라 실시간으로는
 * 아무 일도 일어나지 않기 때문입니다.
 *
 * 투영은 두 가지 중 display.trueScale 로 고릅니다.
 *  - 실제 축척(기본): 궤적이 화면에서도 정확한 원뿔곡선. 지구가 초점에 있습니다.
 *                     카메라가 포탄을 따라가고(followZoom), 비행이 끝나면 지구를 중앙에
 *                     두고 전체가 보이게 물러납니다. display.followCam 을 끄면(F) 비행 중에도
 *                     지구 중앙 + 궤도 전체 보기.
 *  - 압축 보기      : 로그 반지름. 30 Re 탈출까지 한 화면 — 대신 모양은 왜곡됩니다.
 * 줌·카메라 정책도 투영에 따라 다르므로 여기서 함께 고릅니다(zoomPolicy 참고).
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
    earthLocatorLayer,
  ];

  let ctx = null;
  /** 현재 적용된 투영이 실제 축척인지 (display 와 어긋나면 update 에서 갈아끼움) */
  let trueScale = null;

  const projectionFor = (isTrue) => (isTrue ? RadialLinearProjection : RadialLogProjection);

  /** display.followCam (기본 켬). 끄면 지구를 가운데 두고 궤도 전체를 보여줍니다 */
  let followCam = true;

  /** 실제 축척에서 "궤도 전체 보기" — 지구 중앙 + 궤도(또는 탈출 경로)가 다 들어오는 줌 */
  const overview = () => trueScale && !followCam;

  /** 발사 전·리셋 시의 줌. 압축 보기는 속도로 미리 물러나고, 실제 축척은 지구를 그대로 둡니다 */
  function previewZoom(vp, config) {
    if (!trueScale) return speedToZoom(config.initSpeed);
    return 1;
  }

  /** 비행 중 줌 */
  function flightZoom(vp, config) {
    if (!trueScale) return Math.min(speedToZoom(config.initSpeed), altToZoom(sim.radius));
    if (overview()) {
      return sim.unbound
        ? fitZoomForRadius(sim.radius * 1.05, vp)
        : fitZoomForOrbit({ pos: sim.pos, vel: sim.vel }, vp);
    }
    return followZoom(sim.radius);
  }

  /** 착탄·탈출 뒤 결과 화면: 궤적 전체(최고 고도까지)가 보이게. 압축 보기는 그대로 둡니다 */
  function doneZoom(vp) {
    if (!trueScale) return vp.zoom.target;
    return fitZoomForRadius(R_EARTH + sim.stats.maxAlt, vp);
  }

  /** 지금 상태에서 정책이 원하는 줌 */
  function policyZoom(vp, config) {
    if (sim.active) return flightZoom(vp, config);
    if (sim.done) return doneZoom(vp);
    return previewZoom(vp, config);
  }

  /**
   * display.trueScale 이 바뀌었으면 투영을 갈아끼웁니다.
   * 비행 중이든 아니든 즉시 바꾸고, 궤적 캐시는 무효화합니다.
   * @returns {boolean} 바뀌었는가
   */
  function syncProjection(vp, display) {
    const want = display?.trueScale !== false;
    if (want === trueScale) return false;
    trueScale = want;
    vp.setProjection(projectionFor(want));
    trailLayer.invalidate();
    return true;
  }

  return {
    id: 'orbital',
    sim,
    layers,

    /** 기본 모드이므로 모든 발사를 받아줍니다 (라우터의 최후 폴백) */
    accepts: () => true,

    enter(modeCtx, { config, carry } = {}) {
      ctx = modeCtx;
      sim.bus = modeCtx.bus;
      trueScale = null; // 다른 모드가 투영을 바꿔 놓았으므로 다시 고릅니다
      syncProjection(modeCtx.vp, modeCtx.display);
      const cfg = config ?? { angleDeg: 0, initSpeed: 0 };
      // 이월된 비행(지표면 착탄)은 그 비행이 다 보이는 줌으로
      const z = carry?.state
        ? Math.min(previewZoom(modeCtx.vp, cfg), fitZoomForRadius(R_EARTH + carry.stats.maxAlt, modeCtx.vp))
        : previewZoom(modeCtx.vp, cfg);
      modeCtx.vp.setZoom(z, { immediate: !carry });
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
      if (ctx) {
        ctx.vp.setZoom(previewZoom(ctx.vp, ctx.config));
        ctx.cam.centerOn(ctx.vp);
      }
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

    update({ vp, cam, config, display }) {
      followCam = display?.followCam !== false;
      // 체크박스로 축척을 바꾸면 그 자리에서 투영을 갈아끼웁니다
      if (syncProjection(vp, display)) vp.setZoom(policyZoom(vp, config), { immediate: true });

      // ── 줌: 발사 전 미리보기 / 비행 중 추적 / 결과 화면 ──
      vp.zoom.target = policyZoom(vp, config);
      vp.updateZoom();

      // ── 카메라: 비행 중 포탄 추적 (F 로 끄면 지구 중앙 + 궤도 전체) ──
      // 압축 보기는 지구가 화면에서 너무 멀어지지 않게 clamp 하지만, 실제 축척은
      // 지구가 수천 px 밖에 있는 게 정상이므로(earthLocator 가 방향을 알려줌) 풀어 둡니다.
      const follow = sim.active && sim.trail.length > 0 && !overview() ? sim.pos : null;
      cam.update(vp, follow, { clamp: !trueScale });
      if (!sim.active && !sim.done) cam.centerOn(vp);

      // ── 물리: 배속만큼 스텝 진행 ──
      sim.advance(config.timeScale);
    },
  };
}
