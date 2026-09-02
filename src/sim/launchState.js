import { R_LAUNCH, BASE_ANGLE } from '../core/constants.js';

/**
 * 발사 설정(각도·속도) → 초기 상태 벡터.
 *
 * 어느 모드로 갈지 **결정하기 전에** 필요하기 때문에 모드 바깥에 둡니다.
 * (라우터가 이 상태로 궤도 요소를 계산해서 목적지 모드를 고름)
 *
 * 좌표계: 지구 중심 원점, +y 가 12시(대포가 선 방향), +x 가 발사 방향.
 * 그래서 발사각 0° 는 정확히 +x, 90° 는 +y 입니다.
 */
export function createLaunchState({ angleDeg, initSpeed }) {
  const a = (angleDeg * Math.PI) / 180;
  return {
    pos: { x: 0, y: R_LAUNCH },
    vel: { x: initSpeed * Math.cos(a), y: initSpeed * Math.sin(a) },
    config: { angleDeg, initSpeed },
  };
}

/** 대포가 놓인 지표면 방향(단위 벡터) — 지표면 모드에서 지평선 기준으로 씁니다 */
export const launchSiteNormal = { x: Math.cos(BASE_ANGLE + Math.PI / 2 - Math.PI / 2), y: 1 };
