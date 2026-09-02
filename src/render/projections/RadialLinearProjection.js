import { R_EARTH, R_LAUNCH } from '../../core/constants.js';

/**
 * 궤도 모드 투영 — **실제 축척** (선형).
 *
 * 화면 반지름이 월드 반지름에 정비례합니다. 그래서 점질량 중력장의 궤적은
 * 화면에서도 정확히 원뿔곡선(타원·포물선·쌍곡선)이고, 지구 중심이 그 초점에
 * 놓입니다. "궤도는 타원이다"를 눈으로 확인시키려면 이 투영이어야 합니다.
 *
 * RadialLogProjection 과의 차이:
 *  - 로그 투영은 80 Re 를 한 화면에 담기 위해 먼 거리를 압축합니다. 그 대가로
 *    원지점이 실제보다 가까이 찍혀 타원의 초점이 지구에서 벗어나 보입니다.
 *  - 실제 축척에서는 그런 왜곡이 없는 대신, 먼 궤도일수록 지구가 작게 그려집니다.
 *    (11 km/s 발사의 원지점 ≈ 30 Re → 지구 반지름이 화면의 1/60)
 *  - 에베레스트(8,848 m = 지구 반지름의 0.14%)도 과장하지 않습니다. 실제
 *    비율에서는 산이 픽셀 이하라 보이지 않는데, 그것 자체가 사실입니다.
 *
 * 줌 정책은 zoomPolicy.fitZoomForOrbit 이 담당합니다(원지점이 화면에 들어오도록).
 */
export const RadialLinearProjection = {
  id: 'radial-linear',

  computeMetrics(vp) {
    vp.rSurfacePx = vp.baseR * vp.zoom.current;
    vp.rMountPx = this.rToScreen(vp, R_LAUNCH);
    vp.uiScale = vp.rSurfacePx;
  },

  /** 월드 반지름(m) → 화면 반지름(px): 순수 비례 */
  rToScreen(vp, rWorld) {
    return (vp.rSurfacePx * rWorld) / R_EARTH;
  },

  screenToR(vp, px) {
    return (px / vp.rSurfacePx) * R_EARTH;
  },
};
