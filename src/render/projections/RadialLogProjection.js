import { R_EARTH, H_MOUNT, R_LAUNCH } from '../../core/constants.js';

/**
 * 궤도 모드 투영 — '이중 스케일' 반지름 매핑.
 *
 *  ① 지표면 ~ 에베레스트 꼭대기 : 선형 확대 (8,848 m 를 눈에 보이게 뻥튀기)
 *  ② 에베레스트 위 우주        : 로그 압축 (80 Re 까지 한 화면에)
 *  두 구간은 에베레스트 꼭대기에서 연속입니다.
 *
 * 로그 계수 k 를 제한하는 이유(중요):
 *   근지점에서 화면상 곡률이 뒤집혀 궤도가 하트 모양으로 찌그러지는 조건이
 *     k > R_MOUNT_PX · (1+e)/e      (e: 이심률)
 *   입니다. 탈출 궤도(e→1)까지 커버하려면 k < 2·R_MOUNT_PX 여야 하므로
 *   여유를 두어 1.5배로 묶습니다.
 */
export const RadialLogProjection = {
  id: 'radial-log',

  /** 이 투영이 화면 가장자리(80%)에 놓는 최대 반지름 */
  outerRadius: R_EARTH * 80,

  /**
   * 줌으로부터 화면 반지름 파생값을 계산합니다.
   * 이 화면에서는 지구가 통째로 보이므로 UI 크기 기준도 지구 반지름입니다.
   */
  computeMetrics(vp) {
    const z = vp.zoom.current;
    vp.rSurfacePx = vp.baseR * z;
    // 에베레스트 고도는 실제 비율(0.14%)로는 보이지 않으므로 SURFACE_SCALE 배 확대
    vp.rMountPx = vp.rSurfacePx + (H_MOUNT / R_EARTH) * vp.baseR * vp.surfaceScale * z;
    vp.uiScale = vp.rSurfacePx;
  },

  /** 월드 반지름(m) → 화면 반지름(px) */
  rToScreen(vp, rWorld) {
    if (rWorld <= R_LAUNCH) {
      const t = Math.max(0, (rWorld - R_EARTH) / H_MOUNT);
      return vp.rSurfacePx + t * (vp.rMountPx - vp.rSurfacePx);
    }
    const maxPx = Math.max(vp.width, vp.height) * 0.8;
    const kRaw = (maxPx - vp.rMountPx) / Math.log(this.outerRadius / R_LAUNCH);
    const k = Math.min(kRaw, 1.5 * vp.rMountPx);
    return vp.rMountPx + k * Math.log(rWorld / R_LAUNCH);
  },

  /** 화면 반지름(px) → 월드 반지름(m). 격자 라벨·마우스 픽킹용 역변환. */
  screenToR(vp, px) {
    if (px <= vp.rMountPx) {
      const t = (px - vp.rSurfacePx) / (vp.rMountPx - vp.rSurfacePx);
      return R_EARTH + t * H_MOUNT;
    }
    const maxPx = Math.max(vp.width, vp.height) * 0.8;
    const kRaw = (maxPx - vp.rMountPx) / Math.log(this.outerRadius / R_LAUNCH);
    const k = Math.min(kRaw, 1.5 * vp.rMountPx);
    return R_LAUNCH * Math.exp((px - vp.rMountPx) / k);
  },
};
