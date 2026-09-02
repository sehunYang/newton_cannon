import { R_LAUNCH, BASE_ANGLE } from '../core/constants.js';

/**
 * 발사 이펙트 — 포구 섬광 · 지속 연기 · 포신 반동.
 * 포신 반동 오프셋은 cannon 레이어가 읽어갑니다.
 */
export class LaunchFx {
  active = false;
  smokeTimer = 0;
  recoilT = 0;
  recoilActive = false;

  constructor(particles) {
    this.particles = particles;
  }

  /** 포구의 월드 좌표 (발사각 방향으로 포신 길이만큼) */
  static muzzleWorldPos(angleDeg, barrelLengthM = 600000) {
    const fireAngle = BASE_ANGLE + Math.PI / 2 - (angleDeg * Math.PI) / 180;
    return {
      x: barrelLengthM * Math.cos(fireAngle),
      y: -barrelLengthM * Math.sin(fireAngle) + R_LAUNCH,
    };
  }

  trigger(vp, angleDeg) {
    this.active = true;
    this.smokeTimer = 0.5;
    this.recoilT = 0;
    this.recoilActive = true;

    const muzzle = LaunchFx.muzzleWorldPos(angleDeg);
    this.particles.spawn('flash', vp, muzzle.x, muzzle.y, 28, {
      speed: 6, minSpeed: 2, spread: 8, decay: 0.06, size: 5, minSize: 2,
    });
    this.particles.spawn('smoke', vp, 0, R_LAUNCH, 12, {
      speed: 1.5, minSpeed: 0.3, spread: 6, decay: 0.008, size: 10, minSize: 6,
    });
  }

  reset() {
    this.active = false;
    this.recoilActive = false;
    this.recoilT = 0;
    this.smokeTimer = 0;
  }

  update(dt, vp) {
    if (this.active && this.smokeTimer > 0) {
      this.smokeTimer -= dt;
      if (Math.random() < 0.85) {
        this.particles.spawn('smoke', vp, 0, R_LAUNCH, 2, {
          speed: 1, minSpeed: 0.2, spread: 10, decay: 0.006, size: 14, minSize: 8,
        });
      }
      if (this.smokeTimer <= 0) this.active = false;
    }

    if (this.recoilActive) {
      this.recoilT = Math.min(1, this.recoilT + dt * 5);
      if (this.recoilT >= 1) this.recoilActive = false;
    }
  }

  /** 포신이 뒤로 밀린 px (음수). sin 곡선으로 밀렸다 복귀 */
  get recoilOffset() {
    if (!this.recoilActive && this.recoilT === 0) return 0;
    return -Math.sin(this.recoilT * Math.PI) * 12;
  }
}
