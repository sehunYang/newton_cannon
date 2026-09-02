import { R_EARTH, H_MOUNT, V1, V2 } from '../core/constants.js';

/**
 * 궤도 모드의 줌 정책 — "지금 무엇을 보여줘야 하는가"를 결정합니다.
 *
 * 두 가지 신호를 씁니다.
 *  - speedToZoom : 발사 전 미리보기. 슬라이더를 올리면 화면이 미리 물러나며
 *                  "이 속도면 이만큼 멀리 간다"를 예고합니다.
 *  - altToZoom   : 비행 중 실제 고도. 포탄이 화면 밖으로 나가지 않게 합니다.
 * 매 프레임 둘 중 **더 넓은 시야**(작은 값)를 택합니다.
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
