import { specificEnergy } from '../physics/energy.js';
import { fmtTime } from '../core/format.js';
import { els } from './dom.js';

/**
 * 실시간 에너지 그래프 — 운동 · 퍼텐셜 · 역학적 에너지가 시간에 따라 어떻게 변하는가.
 *
 * 수업에서 노리는 것:
 *  - 타원 궤도에서 **K 와 U 가 반대로 출렁이는데 그 합(E)은 수평선**이라는 것.
 *    (근지점에서 빠르고 원지점에서 느린 이유가 바로 이 교환입니다)
 *  - **E 의 부호가 궤도의 운명**이라는 것. 0 선을 항상 그려서, 탈출 발사에서는
 *    E 가 0 위로 올라가 있는 게 한눈에 보입니다.
 *  - 적분기(속도 베를레)가 에너지를 정말 보존하는지 눈으로 확인시켜 줍니다.
 *
 * 캔버스는 시뮬레이션 캔버스와 별개인 작은 DOM 캔버스입니다. `.ui` 의 자식이라
 * earthLocator 의 창이 알아서 이 패널을 피해 갑니다.
 */

/** 보관할 표본 수. 넘치면 절반으로 솎고 기록 간격을 두 배로 — 비행 전체가 항상 화면에 */
const MAX_POINTS = 240;

const COLOR = { k: '#ffa040', u: '#3a8eff', e: '#7ef0c8' };
const PAD = { l: 8, r: 8, t: 14, b: 14 };

const toMJ = (v) => v / 1e6;
const fmtMJ = (v) => `${toMJ(v).toFixed(1)}`;

export class EnergyGraph {
  /** @type {{t:number,k:number,u:number,e:number}[]} 단위 J/kg */
  points = [];
  /** 최소 기록 간격(시뮬 초). 0 이면 매 프레임 */
  #interval = 0;
  #w = 0;
  #h = 0;

  constructor() {
    this.canvas = els.energyCanvas?.();
    this.ctx = this.canvas?.getContext('2d');
    this.resize();
  }

  /** CSS 크기에 맞춰 백버퍼를 다시 잡습니다 (레이아웃 읽기라 매 프레임 하지 않습니다) */
  resize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    this.#w = this.canvas.clientWidth || 260;
    this.#h = this.canvas.clientHeight || 120;
    this.canvas.width = Math.round(this.#w * dpr);
    this.canvas.height = Math.round(this.#h * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear() {
    this.points = [];
    this.#interval = 0;
  }

  /** 매 프레임 — 비행 중에만 점을 쌓습니다 */
  sample(sim) {
    if (!sim?.active) return;
    const last = this.points[this.points.length - 1];
    if (last && sim.elapsed - last.t < this.#interval) return;
    const { k, u, e } = specificEnergy(sim.pos, sim.vel);
    this.points.push({ t: sim.elapsed, k, u, e });
    if (this.points.length > MAX_POINTS) this.#decimate();
  }

  /** 표본을 절반으로 솎고, 앞으로는 두 배 간격으로 기록합니다 */
  #decimate() {
    this.points = this.points.filter((_, i) => i % 2 === 0);
    const span = this.points[this.points.length - 1].t - this.points[0].t;
    this.#interval = Math.max(this.#interval * 2, span / MAX_POINTS);
  }

  draw() {
    const { ctx } = this;
    if (!ctx) return;
    const w = this.#w;
    const h = this.#h;
    ctx.clearRect(0, 0, w, h);

    const pts = this.points;
    if (pts.length < 2) {
      ctx.fillStyle = 'rgba(90,122,160,0.7)';
      ctx.font = '11px "Noto Sans KR",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('발사하면 그려집니다', w / 2, h / 2);
      this.#setLegend(null);
      return;
    }

    // ── 값의 범위. 0 을 반드시 포함시킵니다 (E 의 부호가 궤도의 운명이므로) ──
    let lo = 0;
    let hi = 0;
    for (const p of pts) {
      lo = Math.min(lo, p.u, p.k, p.e);
      hi = Math.max(hi, p.u, p.k, p.e);
    }
    const margin = (hi - lo) * 0.08 || 1;
    lo -= margin;
    hi += margin;

    const t0 = pts[0].t;
    const t1 = Math.max(pts[pts.length - 1].t, t0 + 1e-6);
    const plotW = w - PAD.l - PAD.r;
    const plotH = h - PAD.t - PAD.b;
    const X = (t) => PAD.l + ((t - t0) / (t1 - t0)) * plotW;
    const Y = (v) => PAD.t + ((hi - v) / (hi - lo)) * plotH;

    // ── 0 선 ──
    const y0 = Y(0);
    ctx.strokeStyle = 'rgba(120,160,210,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(PAD.l, y0);
    ctx.lineTo(w - PAD.r, y0);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '9px "Space Mono",monospace';
    ctx.fillStyle = 'rgba(120,160,210,0.6)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('0', PAD.l, y0 - 1);

    // ── 세 곡선 ──
    for (const key of ['u', 'k', 'e']) {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const x = X(pts[i].t);
        const y = Y(pts[i][key]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = COLOR[key];
      ctx.lineWidth = key === 'e' ? 2 : 1.4;
      ctx.stroke();
    }

    // ── 지금 값 표시(오른쪽 끝 점) ──
    const now = pts[pts.length - 1];
    for (const key of ['u', 'k', 'e']) {
      ctx.beginPath();
      ctx.arc(X(now.t), Y(now[key]), key === 'e' ? 2.6 : 2, 0, Math.PI * 2);
      ctx.fillStyle = COLOR[key];
      ctx.fill();
    }

    // ── 축 눈금 (MJ/kg, 경과 시간) ──
    ctx.fillStyle = 'rgba(90,122,160,0.75)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${toMJ(hi).toFixed(0)}`, PAD.l, 2);
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${toMJ(lo).toFixed(0)}`, PAD.l, h - 2);
    ctx.textAlign = 'right';
    ctx.fillText(fmtTime(t1), w - PAD.r, h - 2);

    this.#setLegend(now);
  }

  #setLegend(now) {
    const set = (el, v) => { if (el) el.textContent = now ? fmtMJ(v) : '—'; };
    set(els.energyK?.(), now?.k);
    set(els.energyU?.(), now?.u);
    set(els.energyE?.(), now?.e);
  }
}
