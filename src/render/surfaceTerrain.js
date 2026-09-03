/**
 * 지표면 모드의 지형 무늬 — 지표면을 '지구처럼' 칠하기 위한 값들.
 *
 * ★ 물리와는 완전히 무관합니다. 지표면의 기하는 여전히 반지름 R_EARTH 인 정확한
 *   원이고, 착탄 판정·고도·궤적은 이 파일을 쳐다보지도 않습니다. 여기서 정하는
 *   것은 오직 **그 원을 어떤 색으로 칠할 것인가** 뿐이라, 지형이 지평선의 모양을
 *   바꾸거나 포탄이 산에 걸리는 일은 없습니다. (그래야 '이 호가 곧 지구 곡률'
 *   이라는 이 화면의 주장이 유지됩니다)
 *
 * 왜 실제 지형 데이터를 쓰지 않는가
 * --------------------------------
 * 이 화면의 지표면은 발사 지점에서 지표를 따라 잰 거리 s 하나로만 매개되는
 * **1차원 단면**입니다. 궤도 모드의 대륙 데이터에서 이 단면에 해당하는 자오선
 * (60°E — 원반의 가장자리)을 따라가 보면 발사 지점(북극) 부근 2,400 km 가
 * 전부 북극해라, 어떤 발사에서도 파란색 한 가지만 보입니다. 초록 한 가지가
 * 파랑 한 가지로 바뀔 뿐이죠.
 *
 * 그래서 s 의 결정론적 함수로 '있을 법한 지형'을 만듭니다. 같은 거리에는 언제나
 * 같은 지형이 나오므로 프레임마다 무늬가 흔들리지 않고, 축척이 바뀌어도 지형이
 * 지표면에 붙어 있습니다.
 *
 * 다만 발사 지점만은 고정입니다 — 대포는 에베레스트 위에 서 있으니까요.
 * 발사 지점 주변 ±190 km 는 항상 고산지대이고(노이즈가 거기에 바다를 놓으면
 * 산이 물에 잠깁니다), 거기서 멀어지면서 일반 지형으로 섞여 듭니다.
 */

/** 지표면을 따라 잰 거리 s 의 결정론적 해시 (0~1). 같은 s → 언제나 같은 값 */
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** 파장 len(m) 짜리 값 노이즈 — 부드럽게 보간해서 각진 곳이 없게 합니다 */
function vnoise(s, len) {
  const t = s / len;
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f); // smoothstep — 격자점에서 기울기가 0
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

/**
 * 고도 노이즈의 옥타브. 파장은 '대륙 규모 → 밭 한 뙈기'까지 걸칩니다.
 * 서로 배수 관계가 아니어야 반복되는 무늬로 보이지 않습니다.
 *
 * 이 화면의 시야 폭은 발사에 따라 1 km(근접) ~ 5,800 km(최대 사거리) 로 변하는데,
 * 옥타브를 이렇게 넓게 깔아 두면 어느 축척에서도 볼거리가 남습니다.
 */
const OCTAVES = [
  { len: 780e3, amp: 2600 },
  { len: 260e3, amp: 1500 },
  { len: 88e3, amp: 760 },
  { len: 26e3, amp: 360 },
  { len: 7.2e3, amp: 165 },
  { len: 1.9e3, amp: 70 },
  { len: 420, amp: 26 },
];

/** 평균 고도를 해수면 아래로 내려 바다를 조금 더 넓게 (실제 지구는 71% 가 바다) */
const SEA_BIAS = -400;
/**
 * 옥타브끼리 어긋나게 놓는 간격. 값 자체에 의미는 없지만, 이걸 고르면 발사 지점에서
 * 멀어질수록 **설산 → 산악 → 구릉 → 평야 → 해안 → 바다** 순서가 나옵니다.
 * (에베레스트에서 남쪽으로 700 km 남짓이면 벵골만인 것과 얼추 비슷한 규모입니다)
 */
const SEED = 41;
/** 발사 지점(에베레스트) 주변 고지대 */
const MASSIF = { peak: 4600, width: 190e3 };

/**
 * 발사 지점에서 지표를 따라 s(m) 떨어진 곳의 고도 (m, 해수면 기준).
 * 음수면 바다입니다.
 *
 * @param {number} s
 * @param {number} [minFeature] 화면이 실제로 구분할 수 있는 최소 지형 규모(m).
 *   보통 (한 px 당 미터) × (표본 간격 px) 로 넘깁니다. 사거리가 길어 축척이
 *   커지면(1 px 가 수 km) 420 m·1.9 km 짜리 산세는 이웃 표본과 상관없는 값을
 *   찍어 화면에 '지지직'거리는 세로줄로 보입니다 — 실존하지 않는 무늬입니다.
 *   그래서 파장이 minFeature 보다 짧은 옥타브는 부드럽게 죽입니다. 이건 밉맵과
 *   같은 이치입니다: 화면에 담을 수 없는 디테일은 평균으로 뭉개는 게 맞습니다.
 */
export function elevationAt(s, minFeature = 0) {
  let e = SEA_BIAS;
  for (let i = 0; i < OCTAVES.length; i++) {
    const o = OCTAVES[i];
    // len ≤ minFeature 는 완전히 죽이고, len ≥ 4×minFeature 는 그대로 — 그 사이는 부드럽게
    const w = minFeature <= 0 ? 1
      : o.len <= minFeature ? 0
      : o.len >= minFeature * 4 ? 1
      : smoothstep(minFeature, minFeature * 4, o.len);
    if (w > 0) e += o.amp * w * (2 * vnoise(s + (i + 1) * SEED * o.len, o.len) - 1);
  }
  // 발사 지점 쪽으로 갈수록 고산지대로 수렴합니다 (노이즈는 기복으로만 남김)
  const w = Math.exp(-((s / MASSIF.width) ** 2));
  return e * (1 - w) + (MASSIF.peak + e * 0.25) * w;
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * 고도 → 색. 지도책의 단채(段彩) 배색과 같은 순서입니다:
 * 심해 → 대륙붕 → 해안 → 평야 → 구릉 → 산악 → 바위 → 만년설.
 *
 * 해수면(0 m) 앞뒤로 색이 급하게 바뀌는 게 핵심입니다 — 그래야 **해안선**이
 * 선명하게 서고, 한눈에 '바다와 육지'로 읽힙니다.
 * 전체적으로 실제보다 어둡고 채도가 낮은 것은 이 앱의 밤하늘 배경 위에서
 * 궤적(속도 색)과 HUD 가 묻히지 않아야 하기 때문입니다.
 */
const STOPS = [
  [-6000, [10, 26, 44]], // 심해
  [-2400, [15, 44, 70]],
  [-700, [22, 68, 98]], // 대륙붕
  [-90, [38, 108, 134]], // 얕은 바다
  [0, [104, 118, 96]], // 해안 — 모래·갯벌
  [70, [58, 98, 54]], // 해안 평야
  [700, [46, 84, 44]], // 평야·숲
  [1700, [70, 90, 50]], // 구릉·초지
  [3100, [86, 78, 58]], // 산악
  [4400, [100, 98, 94]], // 바위
  [5100, [172, 184, 192]], // 만년설
  [6300, [224, 236, 246]], // 설원
];

const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** 두 색 사이 선형 보간 */
function mix(a, b, t) {
  return css([
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]);
}

/** 고도(m) → 지표 색 */
export function terrainColor(elev) {
  if (elev <= STOPS[0][0]) return css(STOPS[0][1]);
  for (let i = 1; i < STOPS.length; i++) {
    if (elev <= STOPS[i][0]) {
      const [e0, c0] = STOPS[i - 1];
      const [e1, c1] = STOPS[i];
      return mix(c0, c1, (elev - e0) / (e1 - e0));
    }
  }
  return css(STOPS[STOPS.length - 1][1]);
}

/** 거리 s 에서의 지표 색 (고도 계산 포함). minFeature 는 elevationAt 과 같습니다 */
export const terrainColorAt = (s, minFeature = 0) => terrainColor(elevationAt(s, minFeature));

// ── 구름 ────────────────────────────────────────────────────────
/**
 * 구름도 거리 s 에 붙여 둡니다 — 지형과 같은 이유로, 축척이 바뀌어도
 * 같은 자리에 있어야 하늘이 미끄러지지 않습니다.
 *
 * 고도는 2~11 km 로, 대류권 구름의 실제 높이입니다. 그래서 축척이 커지면
 * 구름은 카르만 선(100 km) 대기층 아래쪽에 얇게 깔리고, 가까이 다가가면
 * 화면 위로 올라가 사라집니다 — 그것도 실제 비율입니다.
 */
const CLOUD_SPACING = 30e3;

/**
 * [sMin, sMax] 구간의 구름들.
 * @returns {{s:number, alt:number, halfWidth:number, alpha:number}[]}
 */
export function cloudsIn(sMin, sMax, { limit = 60 } = {}) {
  const out = [];
  const i0 = Math.floor(sMin / CLOUD_SPACING);
  const i1 = Math.ceil(sMax / CLOUD_SPACING);
  // 축척이 아주 클 때 셀 수가 폭발하지 않도록 (5,800 km 시야 = 190셀) 상한을 둡니다
  for (let i = i0; i <= i1 && out.length < limit; i++) {
    const a = hash(i * 3.7);
    if (a < 0.42) continue; // 하늘의 절반쯤은 맑게
    const b = hash(i * 8.3 + 17);
    const c = hash(i * 5.1 + 91);
    out.push({
      s: (i + b) * CLOUD_SPACING,
      alt: 2000 + c * 9000,
      halfWidth: 5000 + a * 22000,
      alpha: 0.1 + (a - 0.42) * 0.3,
    });
  }
  return out;
}
