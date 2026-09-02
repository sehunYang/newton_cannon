import { createOrbitalMode } from './OrbitalMode.js';
import { createSurfaceMode } from './SurfaceMode.js';

/**
 * 모드 레지스트리.
 *
 * ★ 배열 순서 = 라우팅 우선순위입니다.
 *   라우터는 앞에서부터 accepts() 를 물어보고 처음 승낙한 모드를 고릅니다.
 *   그래서 조건이 좁은 모드(지표면)를 먼저, 항상 받아주는 기본 모드(궤도)를
 *   마지막에 둡니다.
 *
 * 새 모드를 추가할 때 고쳐야 하는 파일은 여기 하나뿐입니다.
 */
export function createModes() {
  return [
    createSurfaceMode(), // 준궤도(제1 우주속도 미만) 발사 전담
    createOrbitalMode(), // 기본값 (accepts: 항상 true)
  ];
}

export const DEFAULT_MODE_ID = 'orbital';
