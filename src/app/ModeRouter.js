import { EV } from '../core/events.js';

/**
 * 어떤 화면으로 갈지 결정하고, 모드 전환의 생명주기를 관리합니다.
 *
 * 규칙은 두 줄입니다.
 *  1. 발사할 때: 등록 순서대로 accepts() 를 물어 처음 승낙한 모드로 간다.
 *  2. 비행이 끝났을 때: 현재 모드의 onFlightEnd() 가 목적지를 지정하면 그리로 간다.
 *
 * 전환 시 carry 로 FlightResult 를 넘길 수 있어서, 지표면 모드에서 착탄해도
 * 궤도 모드가 그 결과를 이어받아 마커와 이펙트를 그대로 보여줄 수 있습니다.
 */
export class ModeRouter {
  /** @type {import('./modes/Mode.js').Mode|null} */
  current = null;

  /** 지연 전환 예약 (착지 후 잠시 머물렀다 넘어가기) */
  #pending = null;

  constructor({ modes, ctx, bus, defaultId }) {
    this.modes = modes;
    this.ctx = ctx;
    this.bus = bus;
    this.defaultId = defaultId;
    this.byId = new Map(modes.map((m) => [m.id, m]));
  }

  get(id) {
    const mode = this.byId.get(id);
    if (!mode) throw new Error(`알 수 없는 모드: ${id}`);
    return mode;
  }

  /** 이 발사를 처리할 모드를 고릅니다. enabled === false 인 모드는 건너뜁니다. */
  select(launchState) {
    for (const mode of this.modes) {
      if (mode.enabled === false) continue;
      if (mode.accepts(launchState)) return mode;
    }
    return this.get(this.defaultId);
  }

  /**
   * @param {string} id
   * @param {{config?:object, carry?:object, reason?:string}} opts
   */
  switchTo(id, { config, carry = null, reason = 'manual' } = {}) {
    const next = this.get(id);
    if (this.current === next && !carry) return next;

    const from = this.current?.id ?? null;
    this.current?.exit(this.ctx);

    // 이펙트는 화면 좌표에 묶여 있습니다. 축척이 완전히 다른 화면으로 넘어가면
    // 남은 파티클이 엉뚱한 자리에 떠 있게 되므로 전환 시점에 비웁니다.
    // (도착 모드가 restoreResult 로 충돌 이펙트를 다시 재생합니다)
    this.ctx.fx.particles.clear();
    this.ctx.fx.launch.reset();
    this.ctx.fx.explosion.reset();

    this.current = next;
    next.enter(this.ctx, { config, carry });

    this.bus.emit(EV.MODE_CHANGED, { from, to: id, reason, carry });
    return next;
  }

  /**
   * 비행 종료를 처리합니다.
   * 모드가 delay(초)를 지정하면 그만큼 현재 화면에 머문 뒤 전환합니다 —
   * 착지 순간을 보여주고 넘어가기 위한 여유입니다.
   * @returns {boolean} 모드 전환이 일어났거나 예약되었는지
   */
  handleFlightEnd(result) {
    const instruction = this.current?.onFlightEnd?.(result);
    if (!instruction) return false;

    const target = {
      id: instruction.switchTo,
      config: result.config,
      carry: instruction.carry ?? result,
    };

    if (instruction.delay > 0) {
      this.#pending = { ...target, remaining: instruction.delay };
    } else {
      this.switchTo(target.id, { ...target, reason: 'flight-end' });
    }
    return true;
  }

  /** 예약된 전환의 시간을 흘려보냅니다. App 이 매 프레임 호출합니다. */
  tick(dt) {
    if (!this.#pending) return;
    this.#pending.remaining -= dt;
    if (this.#pending.remaining > 0) return;
    const p = this.#pending;
    this.#pending = null;
    this.switchTo(p.id, { config: p.config, carry: p.carry, reason: 'flight-end' });
  }

  /** 리셋 등으로 예약을 취소합니다 */
  cancelPending() {
    this.#pending = null;
  }

  get hasPendingSwitch() { return this.#pending !== null; }
}
