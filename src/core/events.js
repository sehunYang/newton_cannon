/** 이벤트 이름 상수 — 오타로 인한 "조용한 미동작"을 막습니다. */
export const EV = {
  /** 발사 설정(각도/속도) 변경 { angleDeg, initSpeed } */
  CONFIG_CHANGED: 'config:changed',
  /** 표시 옵션(궤적/격자) 변경 { showTrail, showGrid } */
  DISPLAY_CHANGED: 'display:changed',
  /** 시뮬 배속 변경 { mult } */
  TIME_SCALE_CHANGED: 'time:scale',

  /** 발사 요청 (UI → App) */
  LAUNCH_REQUESTED: 'launch:requested',
  /** 리셋 요청 (UI → App) */
  RESET_REQUESTED: 'reset:requested',

  /** 실제 발사됨 { mode, config } */
  LAUNCHED: 'flight:launched',
  /** 비행 종료 { result: FlightResult } */
  FLIGHT_ENDED: 'flight:ended',
  /** 리셋 완료 */
  RESET: 'flight:reset',

  /** 모드 전환 { from, to, reason, result } */
  MODE_CHANGED: 'mode:changed',

  /** 캔버스 리사이즈 { width, height } */
  RESIZED: 'view:resized',
};
