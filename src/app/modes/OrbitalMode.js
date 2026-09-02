import { DT_ORBITAL, ESCAPE_RADIUS, R_EARTH } from '../../core/constants.js';
import { ProjectileSim } from '../../sim/ProjectileSim.js';
import { Trail } from '../../sim/Trail.js';
import { pointMassGravity } from '../../physics/gravity.js';
import { RadialLinearProjection } from '../../render/projections/RadialLinearProjection.js';
import { followZoom, fitOrbitView, fitRadiusView } from '../../render/zoomPolicy.js';

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
 * 투영은 **실제 축척(선형)** 하나뿐입니다. 화면의 궤적이 곧 정확한 원뿔곡선이고
 * 지구가 그 초점에 놓입니다. 멀리 있는 궤도는 눈금을 눌러 담는 대신 카메라를 물려서 봅니다.
 *
 * 시점은 display.followCam 이 정합니다(zoomPolicy 참고).
 *  - 켜짐(기본): 카메라가 포탄을 따라가며 거리에 따라 조금씩만 물러납니다.
 *                지구가 화면 밖으로 나가면 earthLocator 가 방향과 거리를 알려줍니다.
 *  - 꺼짐(F)   : 궤도 전체가 들어오도록 물러납니다(타원의 경계 상자에 맞춤).
 * 비행이 끝나면 추적 여부와 무관하게 결과 전체가 보이는 시점으로 물러납니다.
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
  /** display.followCam (기본 켬). 끄면 궤도 전체가 보이도록 물러납니다 */
  let followCam = true;
  /** 직전 프레임의 시점 종류 — 바뀌면 카메라 feed-forward 를 끊어 부드럽게 옮겨갑니다 */
  let lastViewKind = null;

  /**
   * 지금 화면이 보여줘야 할 시점 — `{ kind, zoom, center }`.
   * center 가 null 이면 지구가 화면 한가운데입니다.
   */
  function currentView(vp) {
    const state = { pos: sim.pos, vel: sim.vel };
    if (sim.active) {
      if (followCam) return { kind: 'ball', zoom: followZoom(sim.radius), center: sim.pos };
      return { kind: 'orbit', ...fitOrbitView(state, vp) };
    }
    if (sim.done) {
      // 탈출은 원지점이 없으므로 지구~포탄 상자로, 착탄은 최고 고도까지가 들어오게
      return sim.unbound
        ? { kind: 'result', ...fitOrbitView(state, vp) }
        : { kind: 'result', ...fitRadiusView(R_EARTH + sim.stats.maxAlt, vp) };
    }
    return { kind: 'idle', zoom: 1, center: null }; // 발사 전: 지구를 원래 크기로
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
      modeCtx.vp.setProjection(RadialLinearProjection); // 지표면 모드가 바꿔 놓았을 수 있습니다
      lastViewKind = null;
      // 이월된 비행(지표면 착탄)은 그 비행이 다 보이는 줌으로
      const z = carry?.stats ? fitRadiusView(R_EARTH + carry.stats.maxAlt, modeCtx.vp).zoom : 1;
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
      lastViewKind = null;
      if (ctx) {
        ctx.vp.setZoom(1);
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

    update({ vp, cam, display, config }) {
      followCam = display?.followCam !== false;

      // ── 물리: 배속만큼 스텝 진행 ──
      // 카메라보다 **먼저** 진행합니다. 나중에 하면 카메라는 한 스텝 전 위치를 보고 맞추는데,
      // 화면에는 진행 후 위치가 그려져 항상 한 프레임씩 뒤처집니다
      // (×128 근지점에서는 한 프레임이 40 px 이 넘습니다).
      sim.advance(config.timeScale);

      // ── 시점: 포탄 추적 / 궤도 전체 / 결과 화면 ──
      const view = currentView(vp);
      vp.zoom.target = view.zoom;
      vp.updateZoom();

      // 추적 대상이 바뀌는 프레임에는 feed-forward 를 끊습니다(순간이동 방지)
      if (view.kind !== lastViewKind) {
        cam.retarget();
        lastViewKind = view.kind;
      }
      // 지구가 화면 밖으로 나가는 건 정상입니다(earthLocator 가 방향을 알려줌) — clamp 없음
      cam.update(vp, view.center, { clamp: false });
    },
  };
}
