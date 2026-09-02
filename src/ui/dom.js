/**
 * DOM 조회를 한 곳으로 모읍니다.
 *
 * 이렇게 두면 마크업의 id 가 바뀌었을 때 고칠 곳이 이 파일 하나이고,
 * 오타로 인해 null 에 접근하는 사고를 초기에 잡을 수 있습니다.
 */
export const $ = (id) => document.getElementById(id);
export const $$ = (sel) => [...document.querySelectorAll(sel)];

export const els = {
  canvas: () => $('c'),

  // 텔레메트리 HUD
  hudPanel: () => $('hud-panel'),
  hudSpeed: () => $('hud-spd'),
  hudAlt: () => $('hud-alt'),
  hudTime: () => $('hud-t'),
  hudOrbit: () => $('hud-orbit'),
  hudStats: () => $('hud-stats'),
  hudMaxAlt: () => $('hud-maxalt'),
  hudImpactRow: () => $('hud-impact-row'),
  hudImpactAngle: () => $('hud-impang'),
  hudDistRow: () => $('hud-dist-row'),
  hudDist: () => $('hud-dist'),

  // 좌상단 배지
  zoomVal: () => $('zoom-val'),
  simSpeedBadge: () => $('simspd-badge'),
  simSpeedVal: () => $('simspd-val'),
  modeBadge: () => $('mode-badge'),
  modeVal: () => $('mode-val'),

  // 컨트롤
  sliderAngle: () => $('s-ang'),
  sliderSpeed: () => $('s-spd'),
  valAngle: () => $('v-ang'),
  valSpeed: () => $('v-spd'),
  markerV1: () => $('marker-v1'),
  markerV2: () => $('marker-v2'),
  speedButtons: () => $$('.speed-btn'),
  btnFire: () => $('btn-fire'),
  btnReset: () => $('btn-reset'),
  chkTrail: () => $('chk-trail'),
  chkGrid: () => $('chk-grid'),
  chkScale: () => $('chk-scale'),

  // 모바일 레이아웃 계산용
  ctrlPanel: () => document.querySelector('.ctrl-panel'),
  btnGroup: () => document.querySelector('.btn-group'),
  checkGroup: () => document.querySelector('.check-group'),
};
