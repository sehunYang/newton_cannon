import { R_EARTH } from '../core/constants.js';
import { orbitalElements } from '../physics/orbit.js';

/**
 * 궤도 모드의 시점 정책 — "지금 무엇이 화면에 들어와야 하는가"를 줌과 카메라 중심으로 답합니다.
 *
 * 투영이 선형(실제 축척) 하나뿐이라 화면은 월드의 순수한 확대·축소입니다.
 * 그래서 **멀리 보는 일은 눈금을 왜곡할 게 아니라 카메라를 뒤로 물리면 됩니다.**
 * (예전에는 먼 곳을 로그로 눌러 담았는데, 그러면 타원이 달걀꼴로 일그러졌습니다)
 *
 *  - followZoom    : 비행 중 포탄 추적. 거리에 따라 √ 로 조금씩만 물러납니다.
 *  - fitOrbitView  : 궤도 전체 보기. 궤도의 **경계 상자**에 맞추고 카메라를 그 상자 중심에 둡니다.
 *  - fitRadiusView : 착탄 결과 화면 등, 지구 중심 반지름 r 이 들어오면 되는 경우.
 *
 * 뷰는 `{ zoom, center }` 로 돌려줍니다. center 는 화면 한가운데에 놓을 월드 좌표(없으면 지구).
 */

/** 경계 상자가 화면 가로·세로에서 차지할 최대 비율 (나머지는 HUD·패널 여백) */
const FIT_W = 0.86; // 좌우는 여백이 넉넉합니다
const FIT_H = 0.74; // 아래쪽 체크박스·단축키 힌트 줄을 피합니다
/** 지구가 화면을 넘칠 만큼 확대하지는 않습니다 */
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
 * 월드 경계 상자 {x0,y0,x1,y1} 를 화면에 맞추는 뷰.
 * 선형 투영에서 화면 = baseR·zoom/R_EARTH 배이므로 필요한 배율을 그대로 역산합니다.
 */
function fitBox(box, vp) {
  const hx = Math.max((box.x1 - box.x0) / 2, 1);
  const hy = Math.max((box.y1 - box.y0) / 2, 1);
  const kx = (FIT_W * vp.width) / (2 * hx);
  const ky = (FIT_H * vp.height) / (2 * hy);
  const zoom = Math.min(MAX_ZOOM, (Math.min(kx, ky) * R_EARTH) / vp.baseR);
  return { zoom, center: { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 } };
}

/** 지구 원판(반지름 1 Re)을 항상 포함시킵니다 — 시점을 잃지 않도록 */
const withEarth = (box) => ({
  x0: Math.min(box.x0, -R_EARTH), y0: Math.min(box.y0, -R_EARTH),
  x1: Math.max(box.x1, R_EARTH), y1: Math.max(box.y1, R_EARTH),
});

/** 지구 중심에서 반지름 r 까지가 들어오는 뷰 (지구가 화면 가운데) */
export function fitRadiusView(r, vp) {
  const R = Math.max(r, R_EARTH);
  return fitBox({ x0: -R, y0: -R, x1: R, y1: R }, vp);
}

/**
 * 궤도 전체가 한눈에 들어오는 뷰.
 *
 * 속박 궤도는 **타원의 경계 상자**에 맞춥니다. 지구(초점)를 화면 중앙에 두고 원지점 반지름의
 * '원'에 맞추던 예전 방식은, 길쭉한 타원일수록 화면이 텅 비었습니다 — e = 0.97 이면 타원의
 * 폭이 길이의 1/4 이라 궤적이 가운데 얇은 조각으로 남습니다. 상자에 맞추면 같은 궤도가
 * 3~4배 크게 들어옵니다(그 대신 지구는 초점이므로 화면 중앙에서 비켜 앉습니다 — 그게 사실입니다).
 *
 * 탈출 궤도는 원지점이 없으므로 지구와 포탄을 함께 담는 상자를 씁니다.
 */
export function fitOrbitView({ pos, vel }, vp) {
  const { bound, a, e, ex, ey } = orbitalElements(pos, vel);

  if (!bound || !Number.isFinite(a) || e >= 1) {
    return fitBox(withEarth({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y }), vp);
  }

  // 근지점 방향 단위벡터 (원궤도면 e⃗ 가 0 이라 아무 방향이나 무방)
  const ux = e > 1e-9 ? ex / e : 1;
  const uy = e > 1e-9 ? ey / e : 0;
  const b = a * Math.sqrt(Math.max(0, 1 - e * e));
  // 타원 중심은 초점(지구)에서 원지점 쪽으로 a·e 만큼 떨어져 있습니다
  const cx = -a * e * ux;
  const cy = -a * e * uy;
  // 회전한 타원의 축 정렬 반폭: 장축 a·û 와 단축 b·v̂ (v̂ = û 를 90° 돌린 것)
  const hx = Math.hypot(a * ux, b * uy);
  const hy = Math.hypot(a * uy, b * ux);

  return fitBox(withEarth({ x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy }), vp);
}
