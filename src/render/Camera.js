/**
 * 추적 카메라 — 화면상 '지구 중심'의 위치를 결정합니다.
 *
 * 발사 전 : 지구를 화면 중앙에 고정
 * 비행 중 : 포탄이 화면 중앙에 오도록 지구 중심을 반대로 밀어냄
 *
 * 카메라가 이동해도 투영은 그대로이므로, 화면 밖으로 지구가 완전히
 * 사라지지 않게 clamp 를 겁니다(학생이 방향 감각을 잃지 않도록).
 *
 * 추적 중에는 대상의 이동량을 그대로 실어 나르고(feed-forward) **오프셋만** 보간합니다.
 * 단순 lerp 는 정상 상태에서도 속도에 비례한 지연이 남아, ×128 근지점처럼
 * 프레임당 수십 px 씩 움직일 때 포탄이 화면 중앙에서 수백 px 벗어나 버립니다.
 */
export class Camera {
  targetOx = 0;
  targetOy = 0;
  smoothOx = 0;
  smoothOy = 0;
  tracking = false;

  constructor({ followLerp = 0.08, idleLerp = 0.08 } = {}) {
    this.followLerp = followLerp;
    this.idleLerp = idleLerp;
  }

  centerOn(viewport) {
    const ox = viewport.width / 2;
    const oy = viewport.height / 2;
    this.targetOx = this.smoothOx = ox;
    this.targetOy = this.smoothOy = oy;
    this.tracking = false;
    viewport.ox = ox;
    viewport.oy = oy;
  }

  /**
   * @param {Viewport} viewport
   * @param {{x:number,y:number}|null} followWorldPos 화면에 고정할 월드 좌표 (없으면 중앙)
   * @param {object} [opts]
   * @param {number} [opts.anchorX=0.5] 그 좌표를 화면 가로 어디에 둘지 (0~1)
   * @param {number} [opts.anchorY=0.5] 세로 어디에 둘지 (0~1)
   * @param {boolean} [opts.clamp=true] 지구 중심이 화면 밖으로 너무 나가지 않게 제한.
   *   궤도 모드에서는 방향 감각 유지를 위해 필요하지만, 지표면 모드에서는
   *   지구 중심이 화면 수천 px 아래에 있는 게 정상이므로 반드시 꺼야 합니다.
   * @param {boolean} [opts.immediate=false] 보간 없이 즉시 이동 (모드 전환 시)
   */
  update(viewport, followWorldPos, opts = {}) {
    const { anchorX = 0.5, anchorY = 0.5, clamp = true, immediate = false } = opts;
    const { width: W, height: H } = viewport;

    if (followWorldPos) {
      const wasTracking = this.tracking;
      this.tracking = true;
      const { x, y } = followWorldPos;
      const r = Math.hypot(x, y);
      const rPx = viewport.rToScreen(r);
      // 대상이 앵커 위치에 오려면: ox + nx·rPx = anchorX·W  →  ox = anchorX·W − nx·rPx
      let desiredOx = anchorX * W - (x / r) * rPx;
      let desiredOy = anchorY * H + (y / r) * rPx; // y 반전
      if (clamp) {
        desiredOx = Math.max(-W * 0.4, Math.min(W * 1.4, desiredOx));
        desiredOy = Math.max(-H * 0.4, Math.min(H * 1.4, desiredOy));
      }
      // 이미 추적 중이었다면 대상의 이번 프레임 이동량을 그대로 따라갑니다.
      // (추적 시작 순간의 점프는 아래 lerp 로 부드럽게 흡수)
      if (wasTracking) {
        this.smoothOx += desiredOx - this.targetOx;
        this.smoothOy += desiredOy - this.targetOy;
      }
      this.targetOx = desiredOx;
      this.targetOy = desiredOy;
    } else {
      this.tracking = false;
      this.targetOx = anchorX * W;
      this.targetOy = anchorY * H;
    }

    if (immediate) {
      this.smoothOx = this.targetOx;
      this.smoothOy = this.targetOy;
    } else {
      const k = this.tracking ? this.followLerp : this.idleLerp;
      this.smoothOx += (this.targetOx - this.smoothOx) * k;
      this.smoothOy += (this.targetOy - this.smoothOy) * k;
    }

    viewport.ox = this.smoothOx;
    viewport.oy = this.smoothOy;
  }
}
