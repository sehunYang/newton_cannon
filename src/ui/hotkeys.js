import { EV } from '../core/events.js';

/**
 * 키보드 단축키.
 *
 * 매핑을 표로 분리해 두었기 때문에 새 단축키를 추가할 때
 * 표에 한 줄만 넣으면 되고, 화면 하단 힌트 문구와 어긋날 위험도 줄어듭니다.
 */
export function bindHotkeys(bus, { getDisplay } = {}) {
  const actions = {
    ' ': () => bus.emit(EV.LAUNCH_REQUESTED),
    Enter: () => bus.emit(EV.LAUNCH_REQUESTED),
    r: () => bus.emit(EV.RESET_REQUESTED),
    g: () => bus.emit(EV.DISPLAY_CHANGED, { showGrid: !getDisplay().showGrid }),
    t: () => bus.emit(EV.DISPLAY_CHANGED, { showTrail: !getDisplay().showTrail }),
    1: () => bus.emit(EV.TIME_SCALE_CHANGED, { mult: 1 }),
    2: () => bus.emit(EV.TIME_SCALE_CHANGED, { mult: 8 }),
    3: () => bus.emit(EV.TIME_SCALE_CHANGED, { mult: 32 }),
    4: () => bus.emit(EV.TIME_SCALE_CHANGED, { mult: 128 }),
  };

  document.addEventListener('keydown', (e) => {
    // 슬라이더에 포커스가 있을 때 방향키/스페이스를 가로채지 않습니다
    if (e.target.tagName === 'INPUT') return;
    const action = actions[e.key] ?? actions[e.key.toLowerCase()];
    if (!action) return;
    if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
    action();
  });
}
