/**
 * ═══════════════════════════════════════════════════════════════
 *  Mode 인터페이스 — 이 앱의 확장 지점
 * ═══════════════════════════════════════════════════════════════
 *
 * '모드'는 하나의 완결된 화면입니다: 자기만의 시뮬레이션, 카메라/줌 정책,
 * 레이어 스택, 시간 정책을 가집니다. App 은 모드가 무엇을 하는지 모른 채
 * 현재 모드에 update/layers 를 물어볼 뿐입니다.
 *
 * 새 화면(예: 지표면 클로즈업, 다중 포탄 비교, 달 궤도)을 추가하려면
 * 이 인터페이스를 구현한 파일 하나를 만들고 modes/index.js 에 등록하면 됩니다.
 * App.js 나 Renderer.js 는 건드릴 필요가 없습니다.
 *
 * ───────────────────────────────────────────────────────────────
 * @typedef {object} ModeContext  모드가 공유받는 앱 자원
 * @property {import('../../core/EventBus.js').EventBus} bus
 * @property {import('../../render/Viewport.js').Viewport} vp
 * @property {import('../../render/Camera.js').Camera} cam
 * @property {object} fx  { particles, launch, explosion }
 *
 * @typedef {object} Mode
 * @property {string} id
 * @property {(launchState) => boolean} accepts
 *   이 발사를 이 모드가 처리할 수 있는가. 라우터가 등록 순서대로 물어봅니다.
 * @property {(ctx: ModeContext, opts: {config, carry}) => void} enter
 *   모드 진입. carry 는 직전 모드가 넘긴 FlightResult (없으면 null).
 * @property {(ctx: ModeContext) => void} exit
 * @property {(launchState) => void} launch
 * @property {() => void} reset
 * @property {(frame) => void} update  물리 전진 + 카메라/줌 갱신
 * @property {Array} layers            Renderer 에 넘길 레이어 스택
 * @property {object} sim              현재 시뮬레이션 (HUD 가 읽음)
 * @property {(result) => ({switchTo:string, carry:object}|null)} [onFlightEnd]
 *   비행이 끝났을 때 다른 모드로 넘길지 결정합니다. null 이면 현재 모드 유지.
 */

export {};
