import { R_EARTH, H_MOUNT } from '../core/constants.js';

/**
 * 궤적 기록기.
 *
 * 두 가지를 동시에 관리합니다.
 *  1) points     — 화면에 그릴 궤적. 밀도 적응형으로 솎아서 저장하고,
 *                  1회 공전이 완료되면 더 이상 쌓지 않습니다(같은 선을 덧그리면
 *                  알파가 누적돼 지저분해지고 메모리도 무한히 늘어남).
 *  2) recentPos  — 포탄 꼬리를 그리기 위한 최근 위치 링 버퍼.
 *                  궤적이 잠긴 뒤에도 계속 갱신돼야 꼬리가 멈추지 않습니다.
 */
export class Trail {
  /** @type {{x:number,y:number,spd:number,alt:number}[]} */
  points = [];
  /** @type {{x:number,y:number,spd:number}[]} */
  recentPos = [];

  /** 1회 공전이 끝나 기록이 잠겼는가 */
  locked = false;

  #counter = 0;
  #prevAngle = 0;
  #totalAngle = 0;
  #orbitStarted = false;

  /**
   * @param {object} [o]
   * @param {number} [o.recentCapacity=12] 꼬리용 링 버퍼 길이
   * @param {number|null} [o.minSpacing=null]
   *   설정하면 고도 기반 솎아내기 대신 '직전 기록점에서 이 거리(m) 이상
   *   움직였을 때만 기록'합니다. 지표면 모드는 적분 간격이 1/120초라
   *   스텝 수 기준으로 솎으면 수만 점이 쌓이므로 화면 해상도에 맞춰
   *   거리 기준으로 자르는 편이 정확하고 예측 가능합니다.
   */
  constructor({ recentCapacity = 12, minSpacing = null } = {}) {
    this.recentCapacity = recentCapacity;
    this.minSpacing = minSpacing;
  }

  reset(start) {
    this.points = [];
    this.recentPos = [];
    this.locked = false;
    this.#counter = 0;
    this.#totalAngle = 0;
    this.#orbitStarted = false;
    this.#prevAngle = 0;
    if (start) this.begin(start);
  }

  begin({ x, y, spd, alt }) {
    this.points = [{ x, y, spd, alt }];
    this.recentPos = [{ x, y, spd }];
    this.#prevAngle = Math.atan2(y, x);
  }

  /**
   * 고도에 따라 기록 간격을 바꿉니다.
   * 지표 근처는 곡률 변화가 크므로 촘촘히, 먼 우주는 성기게.
   */
  #shouldRecord(alt, x, y) {
    if (this.minSpacing !== null) {
      const last = this.points[this.points.length - 1];
      if (!last) return true;
      return Math.hypot(x - last.x, y - last.y) >= this.minSpacing;
    }
    this.#counter++;
    if (alt < H_MOUNT * 20) return true;
    if (alt < R_EARTH * 0.5) return this.#counter % 2 === 0;
    if (alt < R_EARTH * 2) return this.#counter % 4 === 0;
    return this.#counter % 8 === 0;
  }

  /**
   * 누적 회전각으로 1회 공전을 감지합니다.
   * (탄젠트 부호 뒤집힘에 흔들리지 않도록 매 스텝 각도차를 −π~π 로 정규화)
   */
  #updateOrbitLock(x, y) {
    const cur = Math.atan2(y, x);
    let d = cur - this.#prevAngle;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;

    // 발사 직후 미세 진동으로 오판하지 않도록 0.5 rad 이후부터 감지 시작
    if (!this.#orbitStarted && Math.abs(this.#totalAngle) > 0.5) this.#orbitStarted = true;
    this.#totalAngle += d;
    this.#prevAngle = cur;

    if (this.#orbitStarted && Math.abs(this.#totalAngle) >= Math.PI * 2) this.locked = true;
  }

  /** 매 물리 스텝마다 호출 */
  record({ x, y, spd, alt }) {
    this.recentPos.push({ x, y, spd });
    if (this.recentPos.length > this.recentCapacity) this.recentPos.shift();

    if (this.locked) return;
    this.#updateOrbitLock(x, y);
    if (!this.locked && this.#shouldRecord(alt, x, y)) this.points.push({ x, y, spd, alt });
  }

  /** 착탄 지점처럼 반드시 남겨야 하는 점 */
  push(point) { this.points.push(point); }

  get length() { return this.points.length; }
}
