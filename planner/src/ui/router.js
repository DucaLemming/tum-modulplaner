/* UI rework: hash router. #/uebersicht, #/module, #/plan, #/woche/<1-4>, #/pruefungen/<1-4>, each optionally + /m/<CODE>.
   Hashes starting with #/connect/ belong to sync.js and are ignored here. */
const uiScreens = {};
const UI_SCREENS = [['uebersicht', 'Übersicht'], ['module', 'Module'], ['plan', 'Plan'], ['woche', 'Woche'], ['pruefungen', 'Prüfungen'], ['einstellungen', 'Einstellungen']];
const UI_SEM_SCREENS = ['woche', 'pruefungen'];
let uiPushedModule = false;
function uiParse(hash) {
  const p = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const r = { screen: 'uebersicht', sem: 0, module: null };
  if (p[0] === 'connect') return r;
  if (UI_SCREENS.some(([n]) => n === p[0])) r.screen = p.shift(); else if (p.length && p[0] !== 'm') p.shift();
  if (UI_SEM_SCREENS.includes(r.screen)) { const s = +p[0]; if (s >= 1 && s <= 4) { r.sem = s; p.shift(); } }
  if (p[0] === 'm' && p[1]) r.module = p[1];
  if (UI_SEM_SCREENS.includes(r.screen) && !r.sem) r.sem = uiLastSem(r.screen);
  return r;
}
function uiLastSem(screen) { try { const v = +localStorage.getItem('tum-ui-sem-' + screen); return v >= 1 && v <= 4 ? v : 1; } catch (e) { return 1; } }
function uiRoute() { return uiParse(location.hash); }
function uiPath(r) {
  let p = '#/' + r.screen;
  if (UI_SEM_SCREENS.includes(r.screen)) p += '/' + (r.sem || 1);
  if (r.module) p += '/m/' + encodeURIComponent(r.module);
  return p;
}
function uiNav(path, replace) {
  let h = typeof path === 'string' ? (path.startsWith('#') ? path : '#/' + path.replace(/^\/+/, '')) : uiPath(path);
  const r = uiParse(h);
  if (r.sem && UI_SEM_SCREENS.includes(r.screen)) { try { localStorage.setItem('tum-ui-sem-' + r.screen, String(r.sem)); } catch (e) {} }
  h = uiPath(r);
  if (h === location.hash) { if (typeof uiRender === 'function') uiRender(); return; }
  uiPushedModule = false;
  if (replace) { history.replaceState(null, '', h); if (typeof uiRender === 'function') uiRender(); }
  else location.hash = h;
}
function uiOpenModule(code) {
  if (!code) return;
  const r = uiRoute(); if (r.module === code) return;
  const had = !!r.module; r.module = code;
  const h = uiPath(r);
  if (had) { history.replaceState(null, '', h); if (typeof uiRender === 'function') uiRender(); }
  else { location.hash = h; uiPushedModule = true; }
}
function uiCloseModule() {
  const r = uiRoute(); if (!r.module) return;
  if (uiPushedModule) { uiPushedModule = false; history.back(); return; }
  r.module = null; history.replaceState(null, '', uiPath(r)); if (typeof uiRender === 'function') uiRender();
}
