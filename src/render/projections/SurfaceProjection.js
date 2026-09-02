import { R_EARTH, H_MOUNT } from '../../core/constants.js';

/**
 * 지표면(준궤도) 모드 투영 — 왜곡 없는 선형 반지름 매핑.
 *
 * 설계의 핵심
 * ----------
 * 이 앱은 모든 좌표를 '지구 중심 극좌표'로 다룹니다(Viewport.worldToScreen).
 * 덕분에 지표면 클로즈업은 새 좌표계가 아니라 **반지름 매핑만 다른 투영**입니다.
 *
 *   화면반지름px = R_EARTH/mpp + 고도/mpp
 *
 * 가로 방향 스케일도 자동으로 따라옵니다: 지표면 원의 화면 반지름이
 * 정확히 R_EARTH/mpp 이므로, 지표면을 따라 s 미터 이동하면 화면에서도
 * s/mpp 픽셀만큼 움직입니다. 즉 **가로·세로 축척이 같고**,
 * 수평선의 휘어짐이 실제 지구 곡률과 정확히 일치합니다.
 * 평면 근사가 아니라 진짜 구면입니다.
 *
 * 곡률의 크기는 정직하게 축척을 따릅니다:
 *   화면 폭 1,000 km → 가운데 대비 가장자리가 약 20 km 낮음 (뚜렷)
 *   화면 폭   100 km → 약 0.2 km (거의 평평)
 * "가까이서 보면 평평해 보이지만 실제로는 휘어 있다"는 것 자체가
 * 이 모드가 보여주려는 사실입니다.
 */
export function createSurfaceProjection({ metersPerPixel = 200 } = {}) {
  return {
    id: 'surface',
    metersPerPixel,

    /**
     * 지구 반지름이 화면상 수만 px 이 되므로 uiScale 은 따로 잡습니다.
     * (포탄·마커 크기가 궤도 모드와 비슷하게 보이도록 화면 짧은 변의 25%)
     */
    computeMetrics(vp) {
      const mpp = this.metersPerPixel;
      vp.rSurfacePx = R_EARTH / mpp;
      vp.rMountPx = vp.rSurfacePx + H_MOUNT / mpp;
      vp.uiScale = Math.min(vp.width, vp.height) * 0.25;
    },

    rToScreen(vp, rWorld) {
      return vp.rSurfacePx + (rWorld - R_EARTH) / this.metersPerPixel;
    },

    screenToR(vp, px) {
      return R_EARTH + (px - vp.rSurfacePx) * this.metersPerPixel;
    },
  };
}
