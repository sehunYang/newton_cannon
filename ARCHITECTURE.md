# 아키텍처

## 한 줄 요약

**물리는 모른다 / 그림은 모른다 / 배선만 한다** — 세 층을 분리했습니다.
단일 `index.html` 2,265줄이 역할별 모듈 40여 개로 나뉘었고,
빌드 도구는 여전히 필요 없습니다(네이티브 ES 모듈).

## 실행

```bash
npm run dev           # http://localhost:5173
npm run check         # 모든 모듈 로드 (import 경로/문법 검증)
npm test              # 헤드리스 스모크 테스트 (물리 + 배선 + 라우팅)
npm run test:browser  # 실제 Chrome E2E (Playwright) + 스크린샷
npm run verify:physics # 궤적 vs 해석적 원뿔곡선 (물리 + 화면 투영)
```

### 테스트 3단
| 명령 | 잡는 것 | 못 잡는 것 |
|---|---|---|
| `check` | import 경로, 문법 | 동작 |
| `test` | 물리 결과, 이벤트 배선, 모드 라우팅 | 렌더링, CSS, 브라우저 API |
| `test:browser` | ES 모듈 로드, 콘솔 에러, CSS, 캔버스 실제 렌더, 사용자 조작, 반응형 레이아웃 | 그림의 '미적' 정확성 (스크린샷을 눈으로) |
| `verify:physics` | 17개 발사 조건의 궤적이 `r(θ)=p/(1+e·cos(θ−ω))` 과 일치하는가 (월드 10⁻⁴, 실제 축척 화면 2×10⁻³) | — |

> `file://` 로 직접 열면 브라우저가 ES 모듈을 차단합니다. 반드시 서버로 여세요.

## 디렉터리

```
index.html            마크업만 (138줄)
styles/               역할별 CSS — tokens → base → layout → hud → controls → responsive
src/
  main.js             엔트리포인트 (5줄)
  app/
    App.js            ★ 조립·배선·상태 소유. 물리/그리기 코드 없음
    ModeRouter.js     ★ 어떤 화면으로 갈지 결정 + 모드 전환 생명주기
    modes/
      Mode.js         모드 인터페이스 정의 (문서)
      OrbitalMode.js  궤도 모드 (기본 화면)
      SurfaceMode.js  지표면 모드 (준궤도 발사 전담)
      index.js        모드 레지스트리 = 라우팅 우선순위
  core/               상수 · 이벤트버스 · 루프 · 벡터 · 포매터
  physics/            중력장 · 적분기 · 케플러 궤도요소   ← DOM 을 전혀 모름
  sim/                ProjectileSim · Trail · FlightResult · launchState · predict
  render/             Renderer · Viewport · Camera · palette · zoomPolicy
    projections/      반지름 매핑 (화면 성격을 결정하는 핵심 축)
    layers/           16개 레이어 — 각자 그리기만 함
    surfaceView.js    지표면 화면 기하 헬퍼
  fx/                 파티클 · 발사 이펙트 · 폭발 이펙트
  ui/                 dom · hud · controls · hotkeys · mobileLayout
  data/               대륙 폴리곤
```

## 데이터 흐름

```
사용자 조작
    │  (UI 는 상태를 바꾸지 않고 "사실"만 알림)
    ▼
EventBus ──► App  (유일한 상태 소유자: config / display)
                │
                ├─► ModeRouter.select()  ← 발사 시 어느 화면인지 결정
                │
                └─► 매 프레임:
                      mode.update(frame)     물리 전진 + 줌/카메라 정책
                      renderer.render(mode.layers, frame)
                      hud.showFlight(mode.sim)
```

`frame` 객체 하나가 레이어들이 필요로 하는 모든 것을 담습니다
(`ctx, W, H, dt, now, vp, cam, sim, config, display, fx`).
레이어는 이 객체만 받고 전역 변수를 보지 않습니다.

## 확장하려면 어디를 건드리나

| 하고 싶은 것 | 고칠 파일 | App.js 수정 |
|---|---|---|
| 색·테마 변경 | `styles/tokens.css` | ✗ |
| 새 그래픽 요소 (예: 궤도 요소 오버레이) | `render/layers/*.js` + 모드의 layers 배열 | ✗ |
| 새 물리 (항력, 달 중력, J2) | `physics/gravity.js` 에 제공자 추가 후 `combine()` | ✗ |
| 새 적분기 | `physics/integrators.js` | ✗ |
| 다른 천체 (달·화성) | `core/constants.js` | ✗ |
| 새 단축키 | `ui/hotkeys.js` 의 표 | ✗ |
| **새 화면(모드)** | `app/modes/새모드.js` + `modes/index.js` 등록 | ✗ |
| 지표면 모드 라우팅 범위 | `core/constants.js` 의 `SURFACE_MAX_ARC` | ✗ |

`App.js` 를 고쳐야 하는 경우는 "앱 전역 상태에 새 항목이 생길 때"뿐입니다.

---

# 지표면(준궤도) 모드

> 제1 우주속도보다 느려 궤도를 완주하지 못하는 발사를, "쏘자마자 땅에 박히는
> 짧은 선"이 아니라 **곡면 위의 탄도 비행**으로 보여줍니다.
> 착지하면 궤도 화면으로 돌아와 충돌 이펙트를 그대로 표기합니다.

## 왜 물리를 새로 짜지 않았나

궤도 모드와 **완전히 같은** `ProjectileSim`·중력·적분기를 씁니다. 다른 건 셋뿐입니다.

| | 궤도 모드 | 지표면 모드 |
|---|---|---|
| 적분 간격 | 2 초 | 1/120 초 |
| 시간 진행 | 프레임당 고정 스텝 수 | **실제 경과 시간 기준** (누적기) |
| 기본 배속 | 사용자 선택 유지 | 비행시간에 맞춰 자동 (`preferredTimeScale(launchState)`) |
| 투영 | `RadialLinearProjection` (실제 축척, 기본) / `RadialLogProjection` (압축 보기, `L`) | `SurfaceProjection` (선형) |

### 궤도 모드의 두 투영과 줌 정책

`RadialLogProjection` 은 지표 근처는 선형, 먼 곳은 로그로 눌러 80 Re 까지 한 화면에
담지만, 반지름을 비선형으로 바꾸므로 **타원이 타원으로 보이지 않습니다**(원지점/근지점 화면 비율
3.08 vs 실제 4.01, 초점이 지구에서 벗어남). 물리는 정확한데 그림이 틀리는 상황이라
`RadialLinearProjection` (`rPx = rSurfacePx · r / R_EARTH`)을 기본으로 두고, 로그 투영은
`display.trueScale=false` 일 때만 씁니다. `OrbitalMode.syncProjection` 이 매 프레임 `display` 와
비교해 갈아끼우고 궤적 캐시를 비웁니다.

줌·카메라는 투영에 따라 다릅니다(`render/zoomPolicy.js`, `OrbitalMode.policyZoom`).
- 압축 보기: `speedToZoom(initSpeed)` / 비행 중 `altToZoom(r)` 과의 min. 카메라는 화면 밖 clamp.
- 실제 축척 — 세 단계로 나뉩니다.
  1. 발사 전: 줌 1, 지구 중앙.
  2. 비행 중: **카메라가 포탄을 따라가고** 줌은 `followZoom(r) = min(1, √(1.5 Re / r))`.
     궤도 전체를 미리 넣지 않고 거리의 제곱근으로만 물러나서 "떠나는 느낌"을 남깁니다.
     clamp 는 끄므로 지구가 화면 밖으로 나갈 수 있고, 그때 `earthLocator` 레이어가
     지구 방향 가장자리에 둥근 창(미니 지구 + 거리)을 띄웁니다. 창이 DOM 오버레이(타이틀·HUD·패널)와
     겹치면 같은 가장자리를 따라 비켜섭니다(`.ui > *` 의 사각형을 읽음).
  3. `display.followCam` 을 끄면(`F` / 포탄 추적 체크 해제) 지구를 중앙에 두고 `fitZoomForOrbit` 으로
     **타원 전체**(원지점이 화면의 80% 안)를, 비속박이면 `fitZoomForRadius(r·1.05)` 를 보여 줍니다.
     착탄·탈출 뒤에는 `fitZoomForRadius(R_EARTH + maxAlt)`.
  압축 보기에서는 좌상단에 `축척 압축 · 모양 왜곡` 경고 배지(`#scale-badge`)가 뜹니다 —
  로그 반지름은 먼 타원의 원지점 쪽을 뾰족한 달걀꼴로 만들기 때문입니다.

  추적 카메라(`Camera.update`)는 대상의 프레임당 이동량을 그대로 실어 나르고 **오프셋만** lerp 합니다
  (feed-forward). 단순 lerp 는 정상 상태에서도 속도에 비례한 지연이 남아 ×128 근지점에서 포탄이
  화면 중앙을 수백 px 벗어났습니다. 파티클(`fx/ParticleSystem`)도 같은 이유로 월드 기준점 +
  화면 오프셋으로 바꿔, 카메라가 달려가도 발사 연기가 발사대에 붙어 있고 줌에 맞춰 줄어듭니다.

### 탈출 판정

탈출은 거리가 아니라 **에너지 부호**(`ProjectileSim.unbound`: v²/2 − GM/r ≥ 0)로 정합니다.
`ESCAPE_RADIUS`(30 Re)는 "속박이 아닌 포탄의 시뮬레이션을 어디서 끝낼지"일 뿐이라, 탈출속도 바로
아래인 11,150 m/s(원지점 ≈ 194 Re, 주기 ≈ 59 일)도 반드시 돌아옵니다. 그런 긴 타원이 궤적 점을
폭발적으로 쌓지 않도록 `Trail` 은 먼 우주에서 반지름의 0.3% 이상 움직였을 때만 점을 찍습니다
(스모크 테스트 `[5b]` 가 199 Re 왕복을 3,900 점 정도로 검증).

### 시간 처리

지표면 모드는 프레임 간격 `dt` 를 그대로 물리에 흘려보냅니다. 프레임 간격이
적분 간격(1/120초)의 정수배가 아니므로 **남는 시간을 다음 프레임으로 이월**해야
합니다 — 반올림하면 화면 주사율에 따라 시간이 어긋납니다(144Hz 에서 20% 빠름).
브라우저 테스트가 `×1 에서 시뮬 시간 = 실제 시간` 을 비율 0.02 오차로 검증합니다.

기본 배속은 발사 전 예측한 비행시간으로부터 고릅니다: **화면에서 40초를 넘지 않는
가장 느린 배속**(`MAX_WALL_SECONDS`). 40초 안에 끝나는 짧은 발사는 ×1 리얼타임
그대로이고, 12분짜리 비행은 ×32 로 23초에 끝납니다. 사용자가 버튼으로 바꾼 값은
`App.#userTimeScale` 에 남아 화면 복귀 시 되돌아옵니다.

## 지표면이 진짜 곡면인 이유

이 앱의 모든 렌더는 **지구 중심 극좌표**입니다(`Viewport.worldToScreen`).
그래서 지표면은 화면 좌표계에서 정확히 하나의 원 — 중심 `(vp.ox, vp.oy)`,
반지름 `vp.rSurfacePx` — 이고, 지구 중심이 화면 수천 px 아래에 있으니
화면에는 그 거대한 원의 완만한 꼭대기 호가 보입니다.

`SurfaceProjection` 은 `rSurfacePx = R_EARTH / mpp` 로 잡습니다. 그러면
**가로·세로 축척이 같아지고** 수평선의 휘어짐이 실제 지구 곡률과 일치합니다.
브라우저 테스트가 이걸 수치로 검증합니다 (오차 0.1% 미만).

곡률은 축척을 정직하게 따릅니다:

| 화면 폭 | 가장자리 낙차 |
|---|---|
| 2,100 km | 357 km (확연히 휨) |
| 300 km | 9 km (은근히 휨) |
| 30 km | 90 m (거의 평평) |

"가까이 보면 평평하지만 실제로는 휘어 있다"는 것 자체가 이 모드가 보여주려는
사실이므로, 곡률을 과장하지 않습니다. 대신 발사 지점 접선을 점선으로 그려
(`평평한 지구라면`) 실제 지표면이 거기서 얼마나 내려갔는지를 수치로 보여줍니다.

## 프레이밍 — 궤적 전체가 한 화면에

카메라가 포탄을 쫓아다니면 지면이 흘러가 궤적의 '모양'을 볼 수 없습니다.
그래서 **발사 전에 궤적을 미리 훑어**(`sim/predict.js`) 최고고도와 사거리를
알아낸 뒤, 축척과 카메라를 고정합니다.

```
mpp = max( 사거리 / (W × 0.66),
           (최고고도 + 곡률낙차) / (H × 0.78),
           MIN_METERS_PER_PIXEL )
```

세로 계산에 곡률 낙차를 더하는 이유: 사거리가 길면 착탄점이 발사점보다
화면상 한참 아래에 찍히는데, 그 낙차야말로 지구가 둥글다는 증거라 잘리면 안 됩니다.
가로 앵커는 착탄점이 우하단 발사 설정 패널 뒤로 숨지 않도록 제한합니다.

## 라우팅 규칙

`SurfaceMode.accepts()` 가 두 조건을 봅니다.

1. **근지점이 지표면 아래** (`isSuborbital`) — 궤도를 완주하지 못하고 반드시 착탄.
   속도만 비교하는 것보다 발사각까지 반영되어 정확합니다.
2. **사거리 ≤ `SURFACE_MAX_ARC`** (기본 `R_EARTH × 0.6` ≈ 3,820 km) —
   이보다 멀리 나가면 지구를 크게 돌아가므로 궤도 화면이 더 잘 보여줍니다.
   실질적으로 **0 ~ 약 5.5 km/s** 가 지표면 모드로 갑니다.

라우팅 정책을 넓히거나 좁히려면 `SURFACE_MAX_ARC` 상수 하나만 바꾸면 됩니다.

## 복귀 — "충돌 이펙트는 그대로 표기"

```
착탄
 ├─ App: 지금 보이는 화면(지표면)에서 폭발 이펙트 재생
 ├─ SurfaceMode.onFlightEnd() → { switchTo:'orbital', carry: FlightResult, delay: 0.9초 }
 ├─ 0.9초 동안 곡면 위 착탄 장면 유지 (ModeRouter.tick)
 └─ ModeRouter.switchTo('orbital')
      ├─ 이펙트 정리 (파티클은 화면 좌표에 묶여 있음)
      └─ OrbitalMode.enter({carry}) → restoreResult()
           → 착탄 마커 + 폭발 이펙트 재생 + 탄도 궤적 + 종단 상태(속력·고도) 복원
```

`FlightResult` 가 모드 간 유일한 계약입니다. `state`(종료 순간의 pos/vel)까지
싣기 때문에 도착한 화면의 HUD 가 착탄 속력을 그대로 보여줍니다.

## 지표면 모드 전용 레이어

| 레이어 | 하는 일 |
|---|---|
| `terrain.js` | 지표면 호 · 땅 채우기 · 대기층. 그라디언트는 **지구 중심 기준 방사형** — 화면 세로 선형으로 하면 곡면과 어긋나 색 쐐기가 생깁니다 |
| `surfaceGrid.js` | 지표면 거리 눈금(항상) · 고도선 + 카르만 선(격자 켤 때) · 평평한 지구 비교선 |
| `launchSite.js` | 에베레스트를 **실제 비율로** 그림 (궤도 모드는 8배 과장). 대포만 고정 픽셀 크기 |

`background` / `stars` / `trail` / `markers` / `projectile` / `effects` 는 궤도 모드와 그대로 공유합니다.

## 이 기능 때문에 바뀐 공용 구조

- `Viewport.uiScale` — 포탄·마커 크기 기준을 `rSurfacePx` 에서 분리.
  지표면 모드의 지구 반지름은 화면상 수천~수만 px 이라 그 값으로 크기를 잡으면 화면을 덮습니다.
- `Viewport.recomputeDerived()` → 투영의 `computeMetrics(vp)` 로 위임.
  "지구를 얼마 크기로 그릴지"는 화면의 성격이지 뷰포트의 문제가 아닙니다.
- `Camera.update(vp, follow, {anchorX, anchorY, clamp, immediate})` —
  `clamp:false` 가 필수입니다. 궤도 모드의 화면 밖 제한을 그대로 두면
  지구 중심을 화면 수천 px 아래에 둘 수 없어 화면이 깨집니다.
- `Trail.minSpacing` — 거리 기반 기록. 1/120초 간격에서 스텝 기준으로 솎으면
  수만 점이 쌓입니다. 화면 2px 간격으로 자르면 500~600점이면 충분합니다.

## 참고: 그 외 자연스러운 확장 지점

- **대기 항력** — `physics/gravity.js` 의 `atmosphericDrag()` 가 이미 있습니다.
  `combine(pointMassGravity, atmosphericDrag)` 로 켜면 저궤도 감쇠를 보여줄 수 있습니다.
- **궤도 요소 HUD** — `orbitalElements()` 가 장반경·이심률·주기·근/원지점을 계산합니다.
- **발사 프리셋 / URL 공유** — `EV.CONFIG_CHANGED` 만 쏘면 됩니다(슬라이더 흉내 불필요).
