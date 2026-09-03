import {
  DT_SURFACE, R_EARTH, MIN_METERS_PER_PIXEL, LANDING_HOLD, SURFACE_MAX_ARC,
} from '../../core/constants.js';
import { ProjectileSim } from '../../sim/ProjectileSim.js';
import { Trail } from '../../sim/Trail.js';
import { predictTrajectory } from '../../sim/predict.js';
import { pointMassGravity } from '../../physics/gravity.js';
import { isSuborbital } from '../../physics/orbit.js';
import { createSurfaceProjection } from '../../render/projections/SurfaceProjection.js';

import { backgroundLayer } from '../../render/layers/background.js';
import { createStarsLayer } from '../../render/layers/stars.js';
import { createTerrainLayer } from '../../render/layers/terrain.js';
import { surfaceGridLayer } from '../../render/layers/surfaceGrid.js';
import { launchSiteLayer } from '../../render/layers/launchSite.js';
import { createTrailLayer } from '../../render/layers/trail.js';
import { markersLayer } from '../../render/layers/markers.js';
import { projectileLayer } from '../../render/layers/projectile.js';
import { particlesLayer, explosionLayer } from '../../render/layers/effects.js';

/**
 * ═══════════════════════════════════════════════════════════════
 *  지표면(준궤도) 모드
 * ═══════════════════════════════════════════════════════════════
 *
 * 궤도를 완주하지 못하는 발사 — 즉 근지점이 지표면 아래인 발사를 받아,
 * 지구 전체 시점 대신 **지표면에 붙어서** 포탄의 운동을 보여줍니다.
 * 궤도 모드에서는 "쏘자마자 땅에 박히는 짧은 선"으로 끝나던 것이
 * 여기서는 곡면 위를 날아가는 탄도 궤적이 됩니다.
 *
 * 물리는 궤도 모드와 완전히 동일합니다 (같은 중력, 같은 적분기).
 * 다른 것은 셋뿐입니다.
 *   1. 적분 간격  2초 → 1/120초    (리얼타임 재생에 필요한 해상도)
 *   2. 시간 배속  ×8 → ×1          (preferredTimeScale)
 *   3. 투영과 카메라                (지구 중심 극좌표는 그대로, 반지름 매핑만 교체)
 *
 * 지표면이 곡면인 이유:
 *   이 앱의 모든 렌더가 지구 중심 극좌표 기반이라, 지표면은 화면 좌표계에서
 *   '중심이 화면 훨씬 아래에 있는 거대한 원'입니다. 축척(m/px)만 정하면
 *   곡률은 실제 지구 곡률 그대로 따라옵니다. 평면 근사가 아닙니다.
 *
 * 착지하면 LANDING_HOLD 만큼 그 자리에 머물러 충돌을 보여준 뒤,
 * 궤도 모드로 돌아가면서 비행 결과를 넘깁니다. 궤도 모드는 그 결과로
 * 착탄 마커와 폭발 이펙트를 그대로 재생합니다 (OrbitalMode.restoreResult).
 */

/**
 * 궤적을 화면에 담을 때 쓰는 여백 비율.
 *
 * rightLimit 이 있는 이유: 우하단에 발사 설정 패널이, 우상단에 텔레메트리
 * 패널이 떠 있습니다. 착탄점은 궤적에서 가장 중요한 지점인데 그게 패널 뒤로
 * 들어가면 안 되므로, 궤적의 오른쪽 끝을 화면 74% 안쪽으로 묶습니다.
 */
const FRAME = {
  horizontal: 0.66, // 사거리가 차지할 화면 폭 비율
  rightLimit: 0.74, // 착탄점이 넘지 않아야 할 화면 가로 위치
  vertical: 0.78, // 최고고도 + 곡률 낙차가 차지할 화면 높이 비율
  skyMargin: 0.11, // 최고점 위에 남길 여백
  minGroundY: 0.55, // 지표면이 이보다 위로 올라오지 않게 (땅이 화면을 덮지 않도록)
};

/** 한 프레임에서 허용할 최대 물리 스텝 (배속을 높여도 프레임이 멈추지 않게) */
const MAX_STEPS_PER_FRAME = 1500;

/**
 * 비행 한 번이 화면에서 이 시간을 넘지 않도록 기본 배속을 고릅니다 (초).
 *
 * 왜 필요한가: 탄도 비행은 실제로 몇 분씩 걸립니다
 * (2.5 km/s 발사 = 6.6분, 4 km/s = 12분). 물리적으로는 정직하지만
 * 수업에서 12분을 기다릴 수는 없습니다.
 */
const MAX_WALL_SECONDS = 40;

/** 시뮬 속도 버튼과 같은 선택지 — 버튼 UI 와 어긋나지 않게 */
const SCALE_CHOICES = [1, 8, 32, 128];

/**
 * '화면에서 MAX_WALL_SECONDS 를 넘지 않는 가장 느린 배속'을 고릅니다.
 *
 * 가장 느린 쪽을 고르는 이유: 느릴수록 학생이 운동을 따라가기 좋습니다.
 * 그래서 40초 안에 끝나는 짧은 발사는 ×1 리얼타임 그대로 재생되고,
 * 긴 발사만 필요한 만큼 빨라집니다.
 */
function scaleForDuration(durationSec) {
  return SCALE_CHOICES.find((s) => durationSec / s <= MAX_WALL_SECONDS)
    ?? SCALE_CHOICES[SCALE_CHOICES.length - 1];
}

export function createSurfaceMode() {
  const projection = createSurfaceProjection({ metersPerPixel: 200 });

  const sim = new ProjectileSim({
    id: 'surface',
    dt: DT_SURFACE,
    accel: pointMassGravity,
    surfaceRadius: R_EARTH,
    // 이 모드로 오는 발사는 정의상 지구를 벗어나지 않으므로 탈출 판정은 끕니다
    escapeRadius: Infinity,
    trail: new Trail({ recentCapacity: 24 }),
  });

  const trailLayer = createTrailLayer();

  const layers = [
    backgroundLayer,
    createStarsLayer({ count: 220 }),
    createTerrainLayer(), // 지표면 + 대기 (별을 가림)
    surfaceGridLayer, // 거리 눈금 · 고도선 · 평면 지구 비교선
    launchSiteLayer, // 에베레스트 + 대포
    trailLayer,
    markersLayer, // 최고고도 · 착탄 마커
    projectileLayer,
    particlesLayer,
    explosionLayer,
  ];

  let ctx = null;
  /** 현재 비행의 궤적 예측 — 프레이밍과 기본 배속의 근거 */
  let prediction = null;
  /** 아직 물리로 소비하지 못한 시간 (초). 리얼타임 정확도의 핵심 */
  let pending = 0;

  /**
   * 예측 캐시.
   * accepts() 와 launch() 가 같은 발사에 대해 각각 예측을 돌리면 낭비이므로
   * 발사 설정을 키로 한 번만 계산합니다.
   */
  let cache = null;
  function predictFor(launchState) {
    const key = `${launchState.config.angleDeg}|${launchState.config.initSpeed}`;
    if (cache?.key !== key) cache = { key, value: predictTrajectory(launchState) };
    return cache.value;
  }

  const mode = {
    id: 'surface',
    sim,
    layers,

    /** 레이어가 축척을 읽어갑니다 (mode.metersPerPixel) */
    get metersPerPixel() { return projection.metersPerPixel; },

    /**
     * 이 발사에 어울리는 기본 배속.
     *
     * 물리는 언제나 리얼타임 기준으로 계산되고(1초 = 1초), 배속은 그 시간을
     * 몇 배로 빨리 감아 보여줄지일 뿐입니다. 짧은 비행은 ×1 그대로,
     * 몇 분짜리 비행은 25초 안에 끝나도록 자동으로 올려 줍니다.
     * 학생이 시뮬속도 버튼으로 언제든 ×1 리얼타임으로 되돌릴 수 있습니다.
     */
    preferredTimeScale(launchState) {
      return scaleForDuration(predictFor(launchState).duration);
    },

    /**
     * 이 모드가 처리할 발사인가.
     *
     * ① 근지점이 지표면 아래 = 궤도를 완주하지 못하고 반드시 착탄한다.
     *    (속도만 비교하는 것보다 발사각까지 반영되어 정확합니다)
     * ② 사거리가 SURFACE_MAX_ARC 이하 = 지표면에 붙어서 볼 만한 규모다.
     *    더 멀리 나가면 지구를 크게 돌아가므로 궤도 화면이 더 잘 보여줍니다.
     */
    accepts(launchState) {
      if (!isSuborbital(launchState.pos, launchState.vel)) return false;
      const p = predictFor(launchState);
      return p.hitGround && p.arcLength <= SURFACE_MAX_ARC;
    },

    enter(modeCtx) {
      ctx = modeCtx;
      sim.bus = modeCtx.bus;
      modeCtx.vp.setProjection(projection);
    },

    exit() {
      ctx = null;
      prediction = null;
    },

    launch(launchState) {
      // ① 쏘기 전에 궤적을 훑어 최고고도와 사거리를 알아냅니다 (accepts 에서 계산된 값 재사용)
      prediction = predictFor(launchState);
      // ② 그 값으로 축척과 카메라를 확정 (비행 내내 고정 — 궤적 전체가 보입니다)
      applyFraming(ctx.vp, ctx.cam);
      // ③ 궤적 기록은 화면 해상도에 맞춰 2px 간격으로
      sim.trail.minSpacing = projection.metersPerPixel * 2;
      pending = 0;

      sim.launch(launchState);
      ctx.fx.launch.trigger(ctx.vp, launchState.config.angleDeg);
    },

    reset() {
      sim.reset();
      prediction = null;
      pending = 0;
      trailLayer.invalidate();
    },

    invalidateRender() {
      trailLayer.invalidate();
    },

    /**
     * ★ 착지 → 궤도 모드 복귀.
     * delay 만큼 이 화면에 머물러 충돌 순간을 보여준 뒤 전환합니다.
     * carry 에 궤적까지 실어 보내므로 돌아간 화면에도 탄도 궤적이 남습니다.
     */
    onFlightEnd: (result) => ({
      switchTo: 'orbital',
      carry: { ...result, trailPoints: sim.trail.points.slice() },
      delay: LANDING_HOLD,
    }),

    update({ vp, cam, dt, config }) {
      // 리사이즈에도 프레이밍이 유지되도록 매 프레임 다시 적용합니다 (연산은 몇 줄)
      applyFraming(vp, cam);

      // ── 리얼타임 재생 ──
      // 이번 프레임에 흐른 시간만큼만 물리를 전진시킵니다. 프레임 간격이
      // 적분 간격(1/120초)의 정수배가 아니므로 남는 시간을 다음 프레임으로
      // 이월해야 합니다. 반올림해 버리면 화면 주사율에 따라 시간이 빨라집니다
      // (144Hz 에서 20% 빠름). 누적기를 쓰면 어떤 주사율에서도 1.000× 입니다.
      pending += dt * config.timeScale;
      let steps = Math.floor(pending / sim.dt);

      if (steps > MAX_STEPS_PER_FRAME) {
        // 따라잡기를 포기합니다. 밀린 시간을 계속 쌓으면 프레임이 멈춥니다.
        steps = MAX_STEPS_PER_FRAME;
        pending = 0;
      } else {
        pending -= steps * sim.dt;
      }

      if (steps > 0) sim.advance(steps);
    },
  };

  /**
   * 궤적 전체가 화면에 들어오도록 축척(m/px)과 카메라 위치를 정합니다.
   *
   * 세로로 필요한 공간은 '최고고도 + 곡률 낙차'입니다. 사거리가 길면
   * 착탄점이 발사점보다 화면상 한참 아래에 찍히기 때문입니다
   * (그 낙차 자체가 지구가 둥글다는 증거이고, 잘리면 안 됩니다).
   */
  function applyFraming(vp, cam) {
    if (!prediction) return;
    const W = vp.width;
    const H = vp.height;

    // 사거리 arc 에 대한 지표면 낙차 (원의 새그) = arc² / 8R
    const sagitta = (prediction.arcLength * prediction.arcLength) / (8 * R_EARTH);

    const mpp = Math.max(
      prediction.arcLength / (W * FRAME.horizontal),
      (prediction.apexAlt + sagitta) / (H * FRAME.vertical),
      MIN_METERS_PER_PIXEL,
    );
    projection.metersPerPixel = mpp;
    vp.recomputeDerived();

    const apexPx = prediction.apexAlt / mpp;
    const arcPx = prediction.arcLength / mpp;

    // 발사 지점의 지표면을 화면 어디에 둘지.
    // 가로는 '궤적을 가운데 두되, 착탄점이 오른쪽 패널에 가리지 않는 선까지만'.
    const groundY = Math.max(H * FRAME.skyMargin + apexPx, H * FRAME.minGroundY);
    const arcFrac = arcPx / W;
    const anchorX = Math.max(0.06, Math.min(0.5 - arcFrac / 2, FRAME.rightLimit - arcFrac));

    cam.update(vp, { x: 0, y: R_EARTH }, {
      anchorX,
      anchorY: groundY / H,
      clamp: false, // 지구 중심은 화면 수천 px 아래 — 제한을 걸면 화면이 깨집니다
      immediate: true, // 고정 프레이밍이라 보간하지 않습니다
    });
  }

  return mode;
}
