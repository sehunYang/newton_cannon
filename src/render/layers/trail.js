import { R_EARTH, V2 } from '../../core/constants.js';
import { trailColor } from '../palette.js';

/**
 * 궤적 렌더링 — 이 앱에서 가장 성능에 민감한 레이어입니다.
 *
 * 세 가지 최적화가 들어 있습니다.
 *  ① worldToScreen 을 점당 정확히 1회만 호출 (예전엔 세그먼트마다 2회)
 *  ② 세그먼트를 속도 버킷 24개로 묶어 stroke() 호출을 N회 → 24회로 축소
 *  ③ 1회 공전이 끝나 궤적이 고정되면 오프스크린 캔버스에 한 번 그려두고 blit
 *
 * ③의 함정: rToScreen 은 줌에 대해 **비선형**이라, 줌이 바뀌면 캐시를
 * 평행이동으로 보정할 수 없습니다. 그래서 줌 변화가 감지되면 무조건 재렌더합니다.
 */
const NUM_BUCKETS = 24;
const SPD_MAX = V2 * 1.15;
/** 이 픽셀 이상 카메라가 움직이면 캐시를 다시 그림 */
const CACHE_PAN_TOLERANCE = 150;
const CACHE_ZOOM_TOLERANCE = 0.0008;

export function createTrailLayer() {
  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d');

  let cacheOx = null;
  let cacheOy = null;
  let cacheZoom = null;
  let cacheLen = 0;
  let dirty = true;

  /** 궤적 전체를 지정된 컨텍스트에 배치 렌더 */
  function renderBatched(targetCtx, points, vp, ox, oy) {
    const total = points.length;
    if (total < 2) return;

    // ① 화면 좌표 1회 계산
    const spts = vp.withOrigin(ox, oy, () =>
      points.map((p) => vp.worldToScreen(p.x, p.y)));

    // ② 속도 버킷별 그룹화
    const bucketWidth = SPD_MAX / NUM_BUCKETS;
    const buckets = Array.from({ length: NUM_BUCKETS }, (_, b) => ({
      indices: [], sumI: 0, sumAlt: 0, spdMid: (b + 0.5) * bucketWidth,
    }));

    for (let i = 1; i < total; i++) {
      const b = Math.min(NUM_BUCKETS - 1, Math.floor((points[i].spd || 0) / bucketWidth));
      buckets[b].indices.push(i);
      buckets[b].sumI += i;
      buckets[b].sumAlt += points[i].alt || 0;
    }

    targetCtx.save();
    targetCtx.lineJoin = 'round';
    targetCtx.lineCap = 'round';

    for (const { indices, sumI, sumAlt, spdMid } of buckets) {
      if (indices.length === 0) continue;
      const n = indices.length;
      // 버킷 대표값: 진행도(알파)와 고도(선 두께)의 평균
      const alpha = 0.12 + (sumI / n / total) * 0.75;
      const altNorm = Math.min(1, sumAlt / n / (R_EARTH * 2));

      targetCtx.lineWidth = Math.max(0.8, 2.5 - altNorm * 1.2);
      targetCtx.strokeStyle = trailColor(spdMid, alpha);
      targetCtx.beginPath();
      for (const i of indices) {
        targetCtx.moveTo(spts[i - 1].x, spts[i - 1].y);
        targetCtx.lineTo(spts[i].x, spts[i].y);
      }
      targetCtx.stroke();
    }
    targetCtx.restore();
  }

  return {
    name: 'trail',
    visible: ({ display, sim }) => display.showTrail && sim.trail.length >= 2,

    /** 리셋·옵션 변경 시 App 이 호출 */
    invalidate() {
      dirty = true;
      cacheLen = 0;
      cacheZoom = null;
    },

    draw({ ctx, W, H, vp, sim }) {
      const points = sim.trail.points;
      const total = points.length;

      if (!sim.trail.locked) {
        // 궤적이 자라는 중 — 캐시는 의미가 없으므로 매 프레임 직접 렌더
        dirty = true;
        renderBatched(ctx, points, vp, vp.ox, vp.oy);
        return;
      }

      const dx = cacheOx !== null ? vp.ox - cacheOx : Infinity;
      const dy = cacheOy !== null ? vp.oy - cacheOy : Infinity;
      const dz = cacheZoom !== null ? Math.abs(vp.zoom.current - cacheZoom) : Infinity;

      const needsRedraw = dirty
        || cacheLen !== total
        || dz > CACHE_ZOOM_TOLERANCE
        || Math.abs(dx) > CACHE_PAN_TOLERANCE
        || Math.abs(dy) > CACHE_PAN_TOLERANCE;

      if (needsRedraw) {
        if (offscreen.width !== W || offscreen.height !== H) {
          offscreen.width = W;
          offscreen.height = H;
        }
        offCtx.clearRect(0, 0, W, H);
        renderBatched(offCtx, points, vp, vp.ox, vp.oy);
        cacheOx = vp.ox;
        cacheOy = vp.oy;
        cacheZoom = vp.zoom.current;
        cacheLen = total;
        dirty = false;
      }

      // 줌이 그대로면 카메라 이동분만큼 평행이동해서 붙이면 됩니다
      ctx.drawImage(offscreen, vp.ox - cacheOx, vp.oy - cacheOy);
    },
  };
}
