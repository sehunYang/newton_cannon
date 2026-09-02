/**
 * 물리 상수 · 시뮬레이션 튜닝 값의 단일 출처(single source of truth).
 *
 * 여기 있는 값은 전부 SI 단위(m, s, kg)입니다.
 * "화면 픽셀"과 관련된 값은 render/ 쪽에 두고, 이 파일에는 절대 넣지 마세요.
 * 그래야 나중에 달·화성 등 다른 천체를 추가할 때 이 파일만 바꾸면 됩니다.
 */

// ── 만유인력 ──
export const G = 6.674e-11;              // 중력 상수 (N·m²/kg²)
export const M_EARTH = 5.972e24;         // 지구 질량 (kg)
export const R_EARTH = 6.371e6;          // 지구 반지름 (m)
export const GM = G * M_EARTH;           // 표준 중력 매개변수 (m³/s²)

// ── 발사 지점 ──
export const H_MOUNT = 8848;             // 에베레스트 고도 (m)
export const R_LAUNCH = R_EARTH + H_MOUNT; // 발사 지점의 지구 중심 거리 (m)

/** 제1 우주속도 — 발사 고도 기준 원궤도 속도 (≈7,905 m/s) */
export const V1 = Math.sqrt(GM / R_LAUNCH);
/** 제2 우주속도 — 탈출 속도 (≈11,186 m/s) */
export const V2 = V1 * Math.SQRT2;

/**
 * 탈출을 '확정'하는 거리.
 *
 * 탈출 여부 자체는 거리가 아니라 **에너지 부호**(속박 궤도인가)로 판정합니다.
 * 11,150 m/s 는 제2 우주속도(11,186) 미만이라 원지점이 194 Re 나 되어도 반드시
 * 돌아오는 타원이고, 시뮬레이터도 끝까지 따라갑니다. 이 값은 "에너지가 양수이고
 * 여기까지 왔으면 더 볼 것 없다"고 시뮬레이션을 끝내는 거리일 뿐입니다.
 */
export const ESCAPE_RADIUS = R_EARTH * 30;

// ── 시뮬레이션 ──
/** 궤도 모드 고정 적분 간격 (s). 크게 잡아도 되는 이유: 궤도 스케일이 크다 */
export const DT_ORBITAL = 2;
/**
 * 지표면(준궤도) 모드 적분 간격 (s).
 * 리얼타임 재생이라 프레임당 진행 시간이 작으므로 훨씬 촘촘해야 합니다.
 */
export const DT_SURFACE = 1 / 120;

/**
 * 지표면 근처 고도 확대 배율.
 * 에베레스트(8,848 m)는 지구 반지름의 0.14% 라 실제 비율로 그리면 보이지 않습니다.
 * 대포와 산이 보이도록 이 구간만 과장합니다 — 우주 구간 스케일과는 무관합니다.
 */
export const SURFACE_SCALE = 8;

/** UI 속도 슬라이더 최대값 (m/s) */
export const SPEED_SLIDER_MAX = 12000;

// ── 기하 ──
/** 대포가 놓인 방향: 화면 12시(지구 북극) */
export const BASE_ANGLE = -Math.PI / 2;

// ── 지표면(준궤도) 모드 ──
/** 카르만 선 — 통상적인 '우주의 경계' (m) */
export const KARMAN_LINE = 1e5;
/** 착지 후 궤도 모드로 돌아가기까지 머무는 시간 (s) */
export const LANDING_HOLD = 0.9;
/** 지표면 모드 최소 스케일 (m/px). 너무 확대하면 곡률이 안 보입니다 */
export const MIN_METERS_PER_PIXEL = 1;

/**
 * 지표면 모드가 받아줄 최대 사거리 (m).
 *
 * 이보다 멀리 나가는 발사는 지구를 상당 부분 돌아가므로, 지표면에 붙은
 * 시점보다 지구 전체가 보이는 궤도 모드가 더 잘 보여줍니다.
 * (제1 우주속도 미만이어도 5.5 km/s 쯤부터는 궤도 화면에서 이미 훌륭한 호가 보입니다.)
 *
 * 이 값을 키우면 더 먼 발사까지 지표면 시점으로 보게 됩니다 — 라우팅 정책의 유일한 손잡이입니다.
 */
export const SURFACE_MAX_ARC = R_EARTH * 0.6; // ≈ 3,820 km
