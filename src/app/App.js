import { EventBus } from '../core/EventBus.js';
import { EV } from '../core/events.js';
import { Loop } from '../core/Loop.js';

import { Renderer } from '../render/Renderer.js';
import { Viewport } from '../render/Viewport.js';
import { Camera } from '../render/Camera.js';

import { ParticleSystem } from '../fx/ParticleSystem.js';
import { LaunchFx } from '../fx/LaunchFx.js';
import { ExplosionFx } from '../fx/ExplosionFx.js';

import { createLaunchState } from '../sim/launchState.js';
import { createModes, DEFAULT_MODE_ID } from './modes/index.js';
import { ModeRouter } from './ModeRouter.js';

import { els } from '../ui/dom.js';
import { Hud } from '../ui/hud.js';
import {
  bindControls, positionSpeedMarkers, setTimeScale, setModeBadge,
  setFireButtonLaunched, syncDisplayToggles, updateSpeedSliderBg,
} from '../ui/controls.js';
import { bindHotkeys } from '../ui/hotkeys.js';
import { updateMobileLayout, bindOrientationChange } from '../ui/mobileLayout.js';

/**
 * ═══════════════════════════════════════════════════════════════
 *  App — 조립과 배선만 담당합니다.
 * ═══════════════════════════════════════════════════════════════
 *
 * 여기에는 물리 공식도, 그리기 코드도, CSS 도 없습니다.
 * App 이 하는 일은 정확히 네 가지입니다.
 *   1. 자원(캔버스·뷰포트·카메라·이펙트) 생성
 *   2. 앱 상태(config / display) 소유 — 상태를 바꾸는 유일한 곳
 *   3. UI 이벤트를 상태 변경과 모드 호출로 번역
 *   4. 매 프레임 현재 모드에게 update 를 시키고 그 레이어를 그리게 함
 *
 * 그래서 새 모드·새 레이어·새 컨트롤을 추가할 때 이 파일은
 * 거의 손대지 않게 됩니다.
 */
export class App {
  /** 발사 설정 — UI 와 모드가 공유하는 유일한 진실 */
  config = { angleDeg: 0, initSpeed: 4000, timeScale: 8 };
  /** 표시 옵션 */
  display = { showTrail: true, showGrid: false, trueScale: true, followCam: true };

  /**
   * 사용자가 마지막으로 고른 배속.
   * 지표면 모드는 리얼타임(×1)을 강제하는데, 궤도 모드로 돌아올 때
   * 원래 쓰던 배속을 되돌려 주기 위해 따로 기억합니다.
   */
  #userTimeScale = 8;

  constructor(canvas) {
    this.bus = new EventBus();
    this.renderer = new Renderer(canvas);
    this.vp = new Viewport();
    this.cam = new Camera();
    this.hud = new Hud();

    const particles = new ParticleSystem();
    this.fx = {
      particles,
      launch: new LaunchFx(particles),
      explosion: new ExplosionFx(particles),
    };

    /** 모드에게 넘겨줄 공유 자원 묶음 */
    // config / display 는 같은 객체를 넘깁니다 — App 이 제자리에서 갱신하므로 항상 최신입니다
    this.modeCtx = {
      bus: this.bus, vp: this.vp, cam: this.cam, fx: this.fx,
      config: this.config, display: this.display,
    };

    this.router = new ModeRouter({
      modes: createModes(),
      ctx: this.modeCtx,
      bus: this.bus,
      defaultId: DEFAULT_MODE_ID,
    });

    this.loop = new Loop((dt, now) => this.frame(dt, now));
  }

  start() {
    this.#bindEvents();
    bindControls(this.bus, this.config);
    bindHotkeys(this.bus, { getDisplay: () => this.display });
    bindOrientationChange(() => this.resize());

    window.addEventListener('resize', () => this.resize());
    this.resize();

    this.router.switchTo(DEFAULT_MODE_ID, { config: this.config, reason: 'boot' });

    syncDisplayToggles(this.display);
    setTimeScale(this.config.timeScale);
    updateSpeedSliderBg(this.config.initSpeed);
    this.hud.showIdle(this.config);

    // 컨트롤 패널의 실제 높이가 잡힌 뒤에 모바일 레이아웃을 계산해야 합니다
    requestAnimationFrame(() => updateMobileLayout());
    this.loop.start();
  }

  resize() {
    const { width, height } = this.renderer.resize();
    this.vp.resize(width, height);
    positionSpeedMarkers();
    updateMobileLayout();
    this.bus.emit(EV.RESIZED, { width, height });
  }

  // ─────────────────────────────────────────────────────────────
  //  이벤트 배선 — UI 의 "무슨 일이 있었다" → 상태 변경
  // ─────────────────────────────────────────────────────────────
  #bindEvents() {
    const { bus } = this;

    bus.on(EV.CONFIG_CHANGED, (patch) => {
      Object.assign(this.config, patch);
      const sim = this.router.current?.sim;
      // 발사 전에만 HUD 미리보기를 갱신합니다 (줌 미리보기는 모드가 매 프레임 계산)
      if (sim && !sim.active && !sim.done) this.hud.showIdle(this.config);
    });

    bus.on(EV.DISPLAY_CHANGED, (patch) => {
      Object.assign(this.display, patch);
      syncDisplayToggles(this.display);
      this.router.current?.invalidateRender?.();
    });

    bus.on(EV.TIME_SCALE_CHANGED, ({ mult }) => {
      this.config.timeScale = mult;
      this.#userTimeScale = mult;
      setTimeScale(mult);
    });

    // 화면이 바뀌면 일단 사용자가 고른 배속으로 되돌립니다.
    // (지표면 모드가 발사마다 제안하는 배속은 launch() 에서 덮어씁니다)
    bus.on(EV.MODE_CHANGED, ({ to }) => {
      this.#setTimeScale(this.#userTimeScale);
      setModeBadge(to);
    });

    bus.on(EV.LAUNCH_REQUESTED, () => this.launch());
    bus.on(EV.RESET_REQUESTED, () => this.reset());

    bus.on(EV.FLIGHT_ENDED, (result) => {
      setFireButtonLaunched(false);

      // 충돌 이펙트는 언제나 '지금 보이는 화면'에서 먼저 재생합니다.
      // 지표면 모드라면 곡면 위에 떨어지는 순간이 여기서 보이고,
      // 잠시 뒤 궤도 모드로 넘어가면 그쪽에서 다시 재생됩니다
      // ("원래 화면으로 돌아와서 충돌 이펙트를 그대로 표기").
      if (result.outcome === 'impact' && result.stats.impactPos) {
        this.fx.explosion.trigger(this.vp, result.stats.impactPos, result);
      }

      // 모드가 다른 화면으로 넘기고 싶다면 여기서 (필요하면 지연) 전환됩니다
      this.router.handleFlightEnd(result);
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  동작
  // ─────────────────────────────────────────────────────────────
  launch() {
    if (this.router.current?.sim.active) return;

    // ★ 라우팅 지점: 초기 상태로 궤도를 계산해 어느 화면으로 갈지 정합니다
    const launchState = createLaunchState(this.config);
    const target = this.router.select(launchState);
    if (target !== this.router.current) {
      this.router.switchTo(target.id, { config: this.config, reason: 'launch' });
    }

    // 모드가 이 발사에 어울리는 배속을 제안하면 적용합니다.
    // 지표면 모드는 비행시간을 미리 알고 있어서, 몇 분짜리 비행도
    // 화면에서는 25초쯤에 끝나도록 배속을 골라 줍니다.
    // 사용자가 직접 고른 배속은 #userTimeScale 에 남아 있다가 화면 복귀 시 되돌아옵니다.
    const preferred = this.router.current.preferredTimeScale?.(launchState);
    if (preferred) this.#setTimeScale(preferred);

    this.router.current.launch(launchState);
    setFireButtonLaunched(true);
  }

  /** config.timeScale 과 버튼 UI 를 함께 맞춥니다 (사용자 선택 기록은 건드리지 않음) */
  #setTimeScale(mult) {
    if (mult === this.config.timeScale) return;
    this.config.timeScale = mult;
    setTimeScale(mult);
  }

  reset() {
    this.router.cancelPending();
    this.router.current?.reset();
    // 리셋은 언제나 기본 화면(궤도)으로 되돌아갑니다
    if (this.router.current?.id !== DEFAULT_MODE_ID) {
      this.router.switchTo(DEFAULT_MODE_ID, { config: this.config, reason: 'reset' });
    }
    this.fx.particles.clear();
    this.fx.launch.reset();
    this.fx.explosion.reset();

    setFireButtonLaunched(false);
    updateSpeedSliderBg(this.config.initSpeed);
    this.hud.showIdle(this.config);
    this.bus.emit(EV.RESET);
  }

  // ─────────────────────────────────────────────────────────────
  //  프레임
  // ─────────────────────────────────────────────────────────────
  frame(dt, now) {
    const mode = this.router.current;
    if (!mode) return;

    const { width: W, height: H } = this.vp;
    this.renderer.clear(W, H);

    // 반동 애니메이션·연기는 물리보다 앞서 갱신해야 이번 프레임에 반영됩니다
    this.fx.launch.update(dt, this.vp);

    const frame = {
      ctx: this.renderer.ctx,
      W, H, dt, now,
      vp: this.vp,
      cam: this.cam,
      sim: mode.sim,
      mode,                          // 레이어가 모드별 값(축척 등)을 읽습니다
      config: this.config,
      display: this.display,
      fx: this.fx,
    };

    mode.update(frame);              // 줌·카메라 정책 + 물리 전진
    this.renderer.render(mode.layers, frame);

    // 예약된 모드 전환(착지 후 잠깐 머물기)의 시간을 흘려보냅니다
    this.router.tick(dt);

    this.hud.setZoom(this.vp.zoom.current);
    if (mode.sim.active || mode.sim.done) this.hud.showFlight(mode.sim, mode.id);
  }
}
