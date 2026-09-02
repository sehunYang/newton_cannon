/**
 * requestAnimationFrame 루프 래퍼.
 *
 * 콜백에 넘기는 dt 는 0.05s 로 상한을 둡니다 — 탭이 백그라운드로 갔다가
 * 돌아올 때 dt 가 수 초로 튀어서 파티클/폭발이 순간이동하는 걸 막습니다.
 */
export class Loop {
  #raf = 0;
  #last = 0;
  #cb;

  constructor(callback, { maxDt = 0.05 } = {}) {
    this.#cb = callback;
    this.maxDt = maxDt;
  }

  start() {
    if (this.#raf) return;
    this.#last = performance.now();
    const tick = (now) => {
      this.#raf = requestAnimationFrame(tick);
      const dt = Math.min(this.maxDt, (now - this.#last) / 1000);
      this.#last = now;
      this.#cb(dt, now);
    };
    this.#raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
  }
}
