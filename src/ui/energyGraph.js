import { specificEnergy, energySpan, U_LAUNCH_REF } from '../physics/energy.js';
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
 * **눈금은 그 비행의 에너지 규모에 자동으로 맞춰집니다.** 퍼텐셜의 기준점을 발사 지점으로
 * 잡았기 때문입니다(U' = GM/R_발사 − GM/r ≥ 0, energy.js 의 U_LAUNCH_REF 참고).
 * 무한대 기준으로 그리면 축의 대부분을 정보가 없는 상수(−62.5 MJ/kg)가 차지해서
 * 2 km/s 발사의 변화는 축의 1.6%(약 2 px)라 보이지 않습니다. 기준을 옮기면 같은 발사가
 * 축의 90% 를 씁니다 — 상수를 더한 것뿐이라 물리는 그대로입니다.
 *
 * **범위는 쌓인 표본이 아니라 발사 순간의 궤도에서 옵니다** (`energySpan`). 역학적 에너지가
 * 보존되므로 근지점·원지점에서 K 와 U' 가 각각 어디까지 가는지는 쏘기 전에 이미 정해져 있고,
 * 그 최저점~최고점이 곧 눈금입니다. 덕분에 첫 프레임부터 곡선이 패널을 가득 채우고, 비행
 * 도중 축이 늘어나며 이미 그린 곡선이 눌리는 일이 없습니다.
 *
 * 대신 "E < 0 이면 속박" 이 "E' < 탈출선(62.5 MJ/kg) 이면 속박" 이 되므로, 그 선이
 * 축을 크게 늘리지 않고 들어올 만한 발사에서는 점선으로 함께 그립니다. 예전처럼 무조건
 * 끼워 넣으면 9 km/s 발사에서 축의 40% 가 아무 곡선도 지나지 않는 빈 공간이 됐습니다.
 *
 * 캔버스는 시뮬레이션 캔버스와 별개인 작은 DOM 캔버스입니다. `.ui` 의 자식이라
 * earthLocator 의 창이 알아서 이 패널을 피해 갑니다.
 */

/** 보관할 표본 수. 넘치면 절반으로 솎고 기록 간격을 두 배로 — 비행 전체가 항상 화면에 */
const MAX_POINTS = 240;

const COLOR = { k: '#ffa040', u: '#3a8eff', e: '#7ef0c8' };
/**
 * 탈출선(= 무한대 기준의 E = 0)을 축에 끼워 넣을 때 허용하는 최대 확대율.
 * 축을 30% 넘게 늘려야 보이는 선이라면 그 발사는 아직 탈출과 거리가 멀다는 뜻이므로,
 * 곡선을 눌러 가며 그리지 않습니다. (≈ 9.8 km/s 부터 등장)
 */
const ESCAPE_LINE_HEADROOM = 1.3;
/** 좌우 여백은 고정, 위아래는 캔버스가 낮을수록 줄입니다(작은 폰에서 곡선이 눌리지 않게) */
const PAD_X = 8;
const padY = (h) => Math.max(9, Math.min(14, h * 0.14));

const toMJ = (v) => v / 1e6;
const fmtMJ = (v) => `${toMJ(v).toFixed(1)}`;
/** 축 눈금: 값이 작을수록 소수점을 살립니다 (2 MJ/kg 짜리 발사에서 '0, 2' 만 보이면 곤란) */
const fmtAxis = (v) => (v === 0 ? '0' : Math.abs(v) >= 10 ? toMJ(v).toFixed(0) : toMJ(v).toFixed(1));

export class EnergyGraph {
  /** @type {{t:number,k:number,u:number,e:number}[]} 단위 J/kg */
  points = [];
  /** 최소 기록 간격(시뮬 초). 0 이면 매 프레임 */
  #interval = 0;
  /** @type {{e:number,lo:number,hi:number}|null} 발사 순간의 궤도로 정한 y 범위 */
  #span = null;
  #w = 0;
  #h = 0;
  /** 마지막으로 그린 y 축 범위 (테스트·디버깅용) */
  axis = { lo: 0, hi: 0, showEscape: false };

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
    this.#span = null;
  }

  /** 매 프레임 — 비행 중에만 점을 쌓습니다 */
  sample(sim) {
    if (!sim?.active) return;
    // 첫 표본에서 이 비행의 눈금을 확정합니다. 에너지가 보존되므로 한 스텝 진행된
    // 뒤의 상태로 계산해도 발사 순간과 같은 궤도(같은 근지점·원지점)가 나옵니다.
    if (!this.points.length) {
      this.#span = energySpan(sim.pos, sim.vel, {
        surfaceRadius: sim.surfaceRadius,
        escapeRadius: sim.escapeRadius,
      });
    }
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

    // ── 값의 범위: 발사 순간의 궤도가 정해 준 최저점~최고점 (발사 지점을 0 으로 본 값) ──
    // 보통 정확히 [0, E'] 입니다 — 발사 지점에서 U' = 0 · K = E' 이고 원지점에서 둘이
    // 자리를 바꾸므로. 즉 축 하나가 통째로 그 발사의 에너지입니다.
    let lo = this.#span ? this.#span.lo : 0;
    let hi = this.#span ? this.#span.hi : 0;
    // 안전망: 항력이 있거나 적분 오차가 있어도 곡선이 축 밖으로 나가지 않게 합니다
    for (const p of pts) {
      const u = p.u + U_LAUNCH_REF;
      const e = p.e + U_LAUNCH_REF;
      lo = Math.min(lo, u, p.k, e);
      hi = Math.max(hi, u, p.k, e);
    }
    // 탈출선은 축을 크게 늘리지 않고 들어올 때만 — "얼마나 모자란가"를 보여 주되,
    // 아직 한참 먼 발사에서 곡선을 절반으로 눌러 버리지는 않습니다
    const showEscape = U_LAUNCH_REF <= hi * ESCAPE_LINE_HEADROOM;
    if (showEscape) hi = Math.max(hi, U_LAUNCH_REF);
    const margin = (hi - lo) * 0.06 || 1;
    // 발사 지점보다 살짝 아래(착탄은 에베레스트 높이만큼 낮습니다)로 내려가는 정도는
    // 0 에 맞춰 둡니다 — 눈금에 '-0.0' 이 뜨는 게 더 헷갈립니다
    lo = lo < -margin ? lo - margin : 0;
    hi += margin;
    this.axis = { lo, hi, showEscape };

    const t0 = pts[0].t;
    const t1 = Math.max(pts[pts.length - 1].t, t0 + 1e-6);
    const pad = padY(h);
    const plotW = w - PAD_X * 2;
    const plotH = h - pad * 2;
    const X = (t) => PAD_X + ((t - t0) / (t1 - t0)) * plotW;
    const Y = (v) => pad + ((hi - v) / (hi - lo)) * plotH;

    // ── 기준선 ──
    ctx.font = '9px "Space Mono",monospace';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // 0 = 발사 지점에 정지해 있는 상태
    const y0 = Y(0);
    ctx.strokeStyle = 'rgba(120,160,210,0.3)';
    ctx.beginPath();
    ctx.moveTo(PAD_X, y0);
    ctx.lineTo(w - PAD_X, y0);
    ctx.stroke();

    // 탈출선: 역학적 에너지가 이 위로 올라가면 돌아오지 않습니다 (무한대 기준의 E = 0)
    if (showEscape) {
      const yEsc = Y(U_LAUNCH_REF);
      ctx.strokeStyle = 'rgba(126,240,200,0.4)';
      ctx.beginPath();
      ctx.moveTo(PAD_X, yEsc);
      ctx.lineTo(w - PAD_X, yEsc);
      ctx.stroke();
      ctx.fillStyle = 'rgba(126,240,200,0.75)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('탈출', w - PAD_X, yEsc - 1);
    }
    ctx.setLineDash([]);

    // ── 세 곡선 (K 는 그대로, U·E 는 발사 지점 기준으로 올려서) ──
    const val = (p, key) => (key === 'k' ? p.k : p[key] + U_LAUNCH_REF);
    for (const key of ['u', 'k', 'e']) {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const x = X(pts[i].t);
        const y = Y(val(pts[i], key));
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
      ctx.arc(X(now.t), Y(val(now, key)), key === 'e' ? 2.6 : 2, 0, Math.PI * 2);
      ctx.fillStyle = COLOR[key];
      ctx.fill();
    }

    // ── 축 눈금 (MJ/kg, 경과 시간) ──
    ctx.fillStyle = 'rgba(90,122,160,0.75)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(fmtAxis(hi), PAD_X, 1);
    ctx.textBaseline = 'bottom';
    ctx.fillText(fmtAxis(lo), PAD_X, h - 1);
    ctx.textAlign = 'right';
    ctx.fillText(fmtTime(t1), w - PAD_X, h - 1);

    this.#setLegend(now);
  }

  /** 범례도 그래프와 같은 기준(발사 지점 = 0)으로 씁니다 */
  #setLegend(now) {
    const set = (el, v) => { if (el) el.textContent = now ? fmtMJ(v) : '—'; };
    set(els.energyK?.(), now?.k);
    set(els.energyU?.(), now === null ? null : now.u + U_LAUNCH_REF);
    set(els.energyE?.(), now === null ? null : now.e + U_LAUNCH_REF);
  }
}
