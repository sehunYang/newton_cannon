import { R_EARTH, ESCAPE_RADIUS, DT_ORBITAL } from '../core/constants.js';
import { pointMassGravity } from '../physics/gravity.js';
import { velocityVerlet } from '../physics/integrators.js';
import { Trail } from './Trail.js';
import { createStats, createFlightResult } from './FlightResult.js';
import { EV } from '../core/events.js';

/**
 * 포탄 한 발의 상태와 적분을 담당합니다. **그리기는 전혀 하지 않습니다.**
 *
 * 궤도 모드와 지표면 모드가 이 클래스를 공유합니다.
 * 두 모드의 물리는 사실 동일하고, 다른 것은 세 가지뿐입니다:
 *   - dt        (궤도: 2초 / 지표면: 1/120초)
 *   - accel     (지표면 모드에서는 항력을 얹을 수 있음)
 *   - 종료 조건 (escapeRadius 를 Infinity 로 두면 탈출 판정이 꺼짐)
 * 그래서 "지표면 시뮬레이션"을 위해 물리를 새로 짤 필요가 없습니다.
 */
export class ProjectileSim {
  active = false;
  done = false;
  /** @type {import('./FlightResult.js').FlightOutcome|''} */
  outcome = '';

  pos = { x: 0, y: 0 };
  vel = { x: 0, y: 0 };
  acc = { x: 0, y: 0 };
  prevPos = { x: 0, y: 0 };
  elapsed = 0;

  stats = createStats();
  config = null;

  constructor({
    id = 'sim',
    bus = null,
    dt = DT_ORBITAL,
    accel = pointMassGravity,
    integrate = velocityVerlet,
    surfaceRadius = R_EARTH,
    escapeRadius = ESCAPE_RADIUS,
    trail = new Trail(),
  } = {}) {
    Object.assign(this, { id, bus, dt, accel, integrate, surfaceRadius, escapeRadius, trail });
  }

  /**
   * @param {{pos:{x,y}, vel:{x,y}, config:object}} p
   *  config 는 {angleDeg, initSpeed, ...} — 결과 기록에 그대로 실려 나갑니다.
   */
  launch({ pos, vel, config }) {
    this.pos = { ...pos };
    this.vel = { ...vel };
    this.acc = this.accel(this.pos, this.vel);
    this.prevPos = { ...pos };
    this.elapsed = 0;
    this.active = true;
    this.done = false;
    this.outcome = '';
    this.config = config;

    const r = Math.hypot(pos.x, pos.y);
    const spd = Math.hypot(vel.x, vel.y);
    const alt = r - this.surfaceRadius;

    this.launchDir = { x: pos.x / r, y: pos.y / r };
    this.stats = createStats({ maxAlt: alt, maxAltPos: { ...pos } });
    this.trail.reset({ x: pos.x, y: pos.y, spd, alt });

    this.bus?.emit(EV.LAUNCHED, { sim: this, config });
  }

  reset() {
    this.active = false;
    this.done = false;
    this.outcome = '';
    this.elapsed = 0;
    this.stats = createStats();
    this.trail.reset();
  }

  /** 현재 속력 (m/s) */
  get speed() { return Math.hypot(this.vel.x, this.vel.y); }
  /** 지구 중심으로부터의 거리 (m) */
  get radius() { return Math.hypot(this.pos.x, this.pos.y); }
  /** 지표면 기준 고도 (m) */
  get altitude() { return this.radius - this.surfaceRadius; }

  /**
   * 발사 지점에서 지표면을 따라 이동한 거리 (m).
   * 지표면 모드의 '사거리' 실시간 표시와 거리 눈금에 씁니다.
   */
  get groundDistance() {
    if (!this.launchDir) return 0;
    const r = this.radius;
    if (r < 1) return 0;
    const cos = (this.launchDir.x * this.pos.x + this.launchDir.y * this.pos.y) / r;
    return Math.acos(Math.max(-1, Math.min(1, cos))) * this.surfaceRadius;
  }

  /**
   * 물리를 steps 번 전진시킵니다.
   * @returns {import('./FlightResult.js').FlightOutcome|null} 이번 호출에서 비행이 끝났으면 그 결과
   */
  advance(steps) {
    if (!this.active || this.done) return null;

    for (let i = 0; i < steps; i++) {
      this.prevPos = { ...this.pos };
      const next = this.integrate(this, this.dt, this.accel);
      this.pos = next.pos;
      this.vel = next.vel;
      this.acc = next.acc;
      this.elapsed += this.dt;

      const r = this.radius;
      const alt = r - this.surfaceRadius;
      const spd = this.speed;

      if (alt > this.stats.maxAlt) {
        this.stats.maxAlt = alt;
        this.stats.maxAltPos = { ...this.pos };
      }

      this.trail.record({ x: this.pos.x, y: this.pos.y, spd, alt });

      if (r <= this.surfaceRadius) return this.#finishImpact(spd);
      if (r >= this.escapeRadius) return this.#finishEscape();
    }
    return null;
  }

  #finishImpact(spd) {
    // 지표면을 정확히 통과한 지점을 선형 보간으로 되짚습니다.
    // (한 스텝이 크면 땅속 깊이 박힌 좌표가 잡혀 착탄각이 틀어짐)
    const prevR = Math.hypot(this.prevPos.x, this.prevPos.y);
    const r = this.radius;
    const t = (prevR - this.surfaceRadius) / (prevR - r);
    const impactPos = {
      x: this.prevPos.x + (this.pos.x - this.prevPos.x) * t,
      y: this.prevPos.y + (this.pos.y - this.prevPos.y) * t,
    };

    // 선형 보간은 곡선 궤적을 '현(chord)'으로 근사하므로 결과가 구 안쪽에
    // 조금 들어갑니다 (새그 ≈ 현²/8R — 한 스텝 8 km 면 약 1.3 m).
    // 반지름 방향으로 구면에 투영해 정확히 지표면 위로 올립니다.
    // 아래 착탄각 계산이 |impactPos| == surfaceRadius 를 가정하므로 이 보정이 필수입니다.
    const rI = Math.hypot(impactPos.x, impactPos.y);
    impactPos.x *= this.surfaceRadius / rI;
    impactPos.y *= this.surfaceRadius / rI;

    // 착탄각 = 속도 벡터와 지표면 법선 사이 각 (0° = 수직 낙하)
    const nx = impactPos.x / this.surfaceRadius;
    const ny = impactPos.y / this.surfaceRadius;
    const vMag = Math.hypot(this.vel.x, this.vel.y);
    const cosI = (this.vel.x * nx + this.vel.y * ny) / vMag;
    this.stats.impactPos = impactPos;
    this.stats.impactAngle = (Math.acos(Math.max(-1, Math.min(1, -cosI))) * 180) / Math.PI;

    // 비행 거리 = 발사점 ↔ 착탄점 사이 지표면 호 길이
    const d = this.launchDir;
    const cosArc = (d.x * impactPos.x + d.y * impactPos.y) / this.surfaceRadius;
    this.stats.flightDist =
      Math.acos(Math.max(-1, Math.min(1, cosArc))) * this.surfaceRadius;

    this.trail.push({ x: impactPos.x, y: impactPos.y, spd, alt: 0 });

    // 마지막 적분 스텝은 지표면을 '지나친' 지점이라 그대로 두면
    // 고도가 음수로 남습니다. 비행의 종료 상태는 지표면 위이므로
    // 물리 상태도 보간된 착탄 지점으로 맞춥니다.
    this.pos = { ...impactPos };
    return this.#end('impact');
  }

  #finishEscape() {
    this.stats.escapeDir = Math.atan2(this.vel.y, this.vel.x);
    // 정밀한 값이 아니라 "얼마나 멀리 갔는지" 감각용 근사치
    this.stats.flightDist = this.elapsed * ((this.config?.initSpeed ?? 0) * 0.5);
    return this.#end('escape');
  }

  #end(outcome) {
    this.done = true;
    this.active = false;
    this.outcome = outcome;
    const result = createFlightResult({
      outcome,
      mode: this.id,
      elapsed: this.elapsed,
      stats: this.stats,
      config: this.config,
      state: { pos: { ...this.pos }, vel: { ...this.vel } },
    });
    this.result = result;
    this.bus?.emit(EV.FLIGHT_ENDED, result);
    return outcome;
  }
}
