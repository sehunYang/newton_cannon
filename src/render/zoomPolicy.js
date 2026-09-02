import { R_EARTH, H_MOUNT, V1, V2 } from '../core/constants.js';
import { orbitalElements } from '../physics/orbit.js';

/**
 * 궤도 모드의 줌 정책 — "지금 무엇을 보여줘야 하는가"를 결정합니다.
 *
 * 두 투영이 서로 다른 정책을 씁니다.
 *
 * ▸ 로그 투영(압축 보기)
 *  - speedToZoom : 발사 전 미리보기. 슬라이더를 올리면 화면이 미리 물러나며
 *                  "이 속도면 이만큼 멀리 간다"를 예고합니다.
 *  - altToZoom   : 비행 중 실제 고도. 포탄이 화면 밖으로 나가지 않게 합니다.
 *  매 프레임 둘 중 **더 넓은 시야**(작은 값)를 택합니다.
 *
 * ▸ 선형 투영(실제 축척)
 *  - followZoom      : 비행 중. 카메라가 포탄을 따라가며 거리에 따라 **조금씩만** 물러납니다.
 *                      지구가 시야에서 벗어나면 earthLocator 레이어가 방향을 알려줍니다.
 *  - fitZoomForOrbit : 추적을 끄면(F) 지구를 중앙에 두고 **타원 전체**가 보이게 물러납니다.
 *                      ("지구가 초점인 타원"을 한눈에 보여줄 때)
 *  - fitZoomForRadius: 착탄·탈출 뒤 궤적 전체(최고 고도까지)가 들어오는 결과 화면.
 */

export function speedToZoom(v) {
  if (v <= V1) return 1.0;
  if (v <= V2) return 0.6 - 0.3 * ((v - V1) / (V2 - V1)); // 0.60 → 0.30
  return 0.26;
}

export function altToZoom(r) {
  const alt = r - R_EARTH;
  if (alt <= H_MOUNT * 3) return 1.0;
  if (alt <= R_EARTH * 0.3) return 0.88;
  if (alt <= R_EARTH * 0.8) return 0.72;
  if (alt <= R_EARTH * 1.5) return 0.58;
  if (alt <= R_EARTH * 3) return 0.44;
  if (alt <= R_EARTH * 10) return 0.36;
  if (alt <= R_EARTH * 30) return 0.3;
  return 0.26; // 30 Re 이상 (제2 우주속도 근처 고타원 궤도)
}

// ── 실제 축척 ──────────────────────────────────────────────────
/** 화면 짧은 변의 절반 중 이만큼까지만 궤도가 차지하게 합니다 (여백) */
const FIT_FRACTION = 0.8; // 아래쪽 체크박스 바·HUD 를 피해 원지점이 놓이도록
/** 원지점이 지표 근처인 낮은 발사에서도 지구가 화면을 넘지 않게 */
const MAX_ZOOM = 1.0;

/** 추적 카메라: 이 거리(Re)까지는 줌 1, 그 너머는 √ 로 완만하게 물러남 */
const FOLLOW_REF = 1.5;

/**
 * 비행 중 추적 줌. z = min(1, √(1.5 Re / r)) — 4 Re 에서 0.61, 30 Re 에서 0.22.
 * 거리에 비례해 물러나면(fit) 포탄이 화면에서 움직이지 않는 것처럼 보이고,
 * 아예 안 물러나면 궤적의 곡률을 읽을 수 없어 그 중간을 택했습니다.
 */
export function followZoom(r) {
  return Math.min(MAX_ZOOM, Math.sqrt((FOLLOW_REF * R_EARTH) / Math.max(r, R_EARTH)));
}

/**
 * 반지름 r(m)이 화면 안에 들어오는 줌.
 * 선형 투영에서 rToScreen(r) = baseR·zoom·r/Re 이므로 역산합니다.
 */
export function fitZoomForRadius(r, vp) {
  const halfMin = Math.min(vp.width, vp.height) / 2;
  const z = (FIT_FRACTION * halfMin * R_EARTH) / (vp.baseR * r);
  return Math.min(MAX_ZOOM, z);
}

/**
 * 발사 초기 상태로부터 "궤도 전체가 보이는" 줌.
 *  - 속박 궤도: 원지점 기준
 *  - 탈출 궤도: 원지점이 없으므로 일단 근지점 부근(2 Re)에서 시작하고,
 *              비행 중에는 fitZoomForRadius 로 따라갑니다.
 */
export function fitZoomForOrbit({ pos, vel }, vp) {
  const { bound, apoapsis } = orbitalElements(pos, vel);
  const rFit = bound && Number.isFinite(apoapsis) ? apoapsis : R_EARTH * 2;
  return fitZoomForRadius(Math.max(rFit, R_EARTH), vp);
}
