/**
 * 초경량 발행/구독 버스.
 *
 * 왜 필요한가: 물리(sim) → UI(HUD/버튼) → 이펙트(fx) 가 서로를 직접
 * 호출하면 삼각 결합이 생깁니다. 시뮬레이션은 "무슨 일이 있었다"만 알리고,
 * 듣는 쪽이 각자 반응하게 두면 나중에 모드를 추가해도 배선이 늘지 않습니다.
 *
 * 사용 중인 이벤트는 core/events.js 에 상수로 정리돼 있습니다.
 */
export class EventBus {
  #handlers = new Map();

  /** @returns {() => void} 구독 해제 함수 */
  on(type, fn) {
    if (!this.#handlers.has(type)) this.#handlers.set(type, new Set());
    this.#handlers.get(type).add(fn);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const off = this.on(type, (payload) => { off(); fn(payload); });
    return off;
  }

  off(type, fn) {
    this.#handlers.get(type)?.delete(fn);
  }

  emit(type, payload) {
    const set = this.#handlers.get(type);
    if (!set) return;
    // 핸들러 안에서 구독 해제를 해도 안전하도록 복사본 순회
    for (const fn of [...set]) fn(payload);
  }

  clear() { this.#handlers.clear(); }
}
