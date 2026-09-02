/**
 * 한 번의 비행이 끝났을 때 남는 기록.
 *
 * ★ 이 객체가 '모드 간 계약'입니다.
 * 지표면(준궤도) 모드에서 착탄이 일어나도 이 형태로 결과를 만들어 넘기면,
 * 궤도 모드의 HUD·폭발 이펙트·착탄 마커가 코드 수정 없이 그대로 동작합니다.
 * 새 필드는 추가해도 되지만, 기존 필드의 의미는 바꾸지 마세요.
 */

/** @typedef {'impact'|'escape'|'landed'} FlightOutcome */

export function createStats(overrides = {}) {
  return {
    /** 최고 고도 (m) */
    maxAlt: 0,
    /** 최고 고도 지점의 월드 좌표 */
    maxAltPos: null,
    /** 착탄각 — 지표면 법선 기준 입사각 (°) */
    impactAngle: 0,
    /** 착탄 지점 월드 좌표 */
    impactPos: null,
    /** 비행 거리 — 지표면을 따라 잰 호 길이 (m) */
    flightDist: 0,
    /** 탈출 방향 (rad) */
    escapeDir: 0,
    ...overrides,
  };
}

/**
 * @param {object} p
 * @param {FlightOutcome} p.outcome
 * @param {string} p.mode      결과를 만든 모드 id ('orbital' | 'surface')
 * @param {number} p.elapsed   비행 시간 (s)
 * @param {{pos:{x,y}, vel:{x,y}}} [p.state]
 *   비행이 끝난 순간의 물리 상태. 다른 모드로 결과를 넘길 때 이게 없으면
 *   도착한 화면의 HUD 가 '속력 0 m/s' 를 보여주게 됩니다.
 */
export function createFlightResult({ outcome, mode, elapsed, stats, config, state }) {
  return { outcome, mode, elapsed, stats, config, state, at: Date.now() };
}
