/**
 * 캔버스 소유자 + 레이어 파이프라인.
 *
 * 레이어는 { name, draw(frame), visible?(frame) } 형태의 평범한 객체입니다.
 * 모드(Mode)가 자기 레이어 배열을 넘겨주면 Renderer 는 순서대로 그릴 뿐,
 * 무엇이 그려지는지는 모릅니다. 새 화면을 추가할 때 Renderer 는 건드리지 않습니다.
 *
 * @typedef {object} Frame  레이어에 전달되는 프레임 컨텍스트
 * @property {CanvasRenderingContext2D} ctx
 * @property {number} W @property {number} H
 * @property {number} dt  이번 프레임 경과 시간(s, 상한 0.05)
 * @property {number} now performance.now()
 * @property {import('./Viewport.js').Viewport} vp
 * @property {import('./Camera.js').Camera} cam
 * @property {import('../sim/ProjectileSim.js').ProjectileSim} sim
 * @property {object} config   {angleDeg, initSpeed, timeScale}
 * @property {object} display  {showTrail, showGrid}
 * @property {object} fx       {particles, launch, explosion}
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /** DPR 을 반영해 백버퍼 크기를 맞춥니다. @returns {{width,height}} CSS 픽셀 크기 */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    // 이후 모든 그리기는 CSS 픽셀 좌표로 하면 됩니다.
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: w, height: h };
  }

  clear(W, H) {
    this.ctx.clearRect(0, 0, W, H);
  }

  /** @param {Array} layers @param {Frame} frame */
  render(layers, frame) {
    for (const layer of layers) {
      if (!layer) continue;
      if (layer.visible && !layer.visible(frame)) continue;
      layer.draw(frame);
    }
  }
}
