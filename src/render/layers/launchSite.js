import { R_EARTH, R_LAUNCH, H_MOUNT } from '../../core/constants.js';
import { groundWorldAt } from '../surfaceView.js';

/**
 * 지표면 모드의 발사 지점 — 에베레스트와 대포.
 *
 * 궤도 모드와 다른 점: **산을 실제 비율로 그립니다.**
 * 궤도 모드에서는 8,848 m 가 지구 반지름의 0.14% 라 안 보여서 8배 뻥튀기했지만,
 * 이 화면은 축척이 수백 m/px 이므로 산이 있는 그대로 보입니다.
 * 사거리가 길어 축척이 커지면 산은 정직하게 점처럼 작아집니다 —
 * "에베레스트도 지구 곡률 앞에서는 티끌"이라는 걸 그대로 보여줍니다.
 *
 * 대포만은 고정 픽셀 크기로 그립니다. 실제 대포는 수 미터라 어떤 축척에서도
 * 1픽셀 미만이라서, 위치를 알리는 기호로 취급합니다.
 */
export const launchSiteLayer = {
  name: 'launch-site',

  draw({ ctx, vp, config, fx, mode }) {
    const mpp = mode.metersPerPixel;
    const base = vp.worldToScreen(0, R_EARTH);
    const peak = vp.worldToScreen(0, R_LAUNCH);
    const mountainPx = base.y - peak.y;

    if (mountainPx >= 3) drawMountain(ctx, base, peak, mountainPx, H_MOUNT / mpp);
    drawCannon(ctx, peak, config.angleDeg, fx.launch.recoilOffset, vp.uiScale);
    drawLabel(ctx, peak, mountainPx);
  },
};

/**
 * 산 — 밑변은 실제 에베레스트 산괴 비율(높이의 약 2.4배)을 씁니다.
 * 궤도 모드의 산과 같은 색을 유지해 같은 장소임을 알립니다.
 */
function drawMountain(ctx, base, peak, heightPx, trueHeightPx) {
  const halfWidth = Math.max(6, trueHeightPx * 1.2);
  const snowH = heightPx * 0.32;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(base.x - halfWidth * 2, base.y + 1);
  ctx.lineTo(base.x - halfWidth * 0.55, peak.y + heightPx * 0.4);
  ctx.lineTo(peak.x, peak.y);
  ctx.lineTo(base.x + halfWidth * 0.55, peak.y + heightPx * 0.4);
  ctx.lineTo(base.x + halfWidth * 2, base.y + 1);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, peak.y, 0, base.y);
  g.addColorStop(0, '#4a7040');
  g.addColorStop(0.4, '#385830');
  g.addColorStop(1, '#223018');
  ctx.fillStyle = g;
  ctx.fill();

  if (snowH > 2) {
    ctx.beginPath();
    ctx.moveTo(peak.x - halfWidth * 0.42, peak.y + snowH);
    ctx.lineTo(peak.x, peak.y);
    ctx.lineTo(peak.x + halfWidth * 0.42, peak.y + snowH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(228,240,255,0.92)';
    ctx.fill();
  }
  ctx.restore();
}

/** 대포 — 발사각대로 돌아가고 반동도 그대로 반영됩니다 (궤도 모드와 동일한 규칙) */
function drawCannon(ctx, peak, angleDeg, recoil, uiScale) {
  const barrelL = Math.max(12, uiScale * 0.09);
  const barrelW = Math.max(4, uiScale * 0.024);
  // 이 화면에서 '지평선 방향'은 화면 오른쪽. 발사각이 커지면 위로 듭니다.
  const fireAngle = -(angleDeg * Math.PI) / 180;

  ctx.save();
  ctx.translate(peak.x, peak.y);

  // 받침
  ctx.beginPath();
  ctx.roundRect(-barrelL * 0.42, -barrelW * 0.5, barrelL * 0.84, barrelW * 0.5, barrelW * 0.2);
  ctx.fillStyle = '#243c58';
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,180,255,0.22)';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  // 포신
  ctx.rotate(fireAngle);
  const bg = ctx.createLinearGradient(0, -barrelW * 0.5, 0, barrelW * 0.5);
  bg.addColorStop(0, '#9ac0e0');
  bg.addColorStop(0.4, '#6090b8');
  bg.addColorStop(1, '#2a4460');
  ctx.beginPath();
  ctx.roundRect(recoil, -barrelW * 0.5, barrelL, barrelW, barrelW * 0.35);
  ctx.fillStyle = bg;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(barrelL + recoil, 0, barrelW * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#4a7898';
  ctx.fill();
  ctx.restore();
}

/** 산이 점처럼 작아졌을 때 여기가 어디인지 알려주는 라벨 */
function drawLabel(ctx, peak, mountainPx) {
  if (mountainPx > 26) return;
  ctx.save();
  ctx.font = '10px "Space Mono",monospace';
  ctx.fillStyle = 'rgba(126,240,200,0.55)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('에베레스트 8,848 m', peak.x, peak.y - 14);
  ctx.restore();
}
