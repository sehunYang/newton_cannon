import { R_EARTH, R_LAUNCH } from '../../core/constants.js';

/**
 * 궤도 모드 투영 — **실제 축척** (선형).
 *
 * 화면 반지름이 월드 반지름에 정비례합니다. 그래서 점질량 중력장의 궤적은
 * 화면에서도 정확히 원뿔곡선(타원·포물선·쌍곡선)이고, 지구 중심이 그 초점에
 * 놓입니다. "궤도는 타원이다"를 눈으로 확인시키려면 이 투영이어야 합니다.
 *
 * 예전에는 먼 거리를 로그로 눌러 담는 투영도 있었지만 지웠습니다. 80 Re 를 한 화면에
 * 넣는 대신 원지점이 실제보다 가까이 찍혀 타원이 달걀꼴로 일그러졌기 때문입니다.
 * 멀리 있는 궤도는 눈금을 왜곡할 게 아니라 **카메라를 물려서** 보면 됩니다.
 *
 * 대가는 하나뿐입니다 — 먼 궤도일수록 지구가 작게 그려집니다(원지점 60 Re 에서 지구 반지름
 * 약 16 px). 그건 왜곡이 아니라 사실이고, 지구가 화면 밖으로 나가면 earthLocator 가
 * 방향과 거리를 알려줍니다. 에베레스트(지구 반지름의 0.14%)도 과장하지 않습니다.
 *
 * 시점 정책은 zoomPolicy 가 담당합니다(followZoom / fitOrbitView).
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
