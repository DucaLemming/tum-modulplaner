/* UI rework: boot. Moves the old page into #legacy (hidden; the engine still renders into it) and creates #ui. */
const UI_MODE_KEY = 'tum-ui-mode';
function uiSheetRoot() {
  let r = document.querySelector('.ui-sheet-root');
  if (!r) { r = document.createElement('div'); r.className = 'ui-sheet-root'; document.body.appendChild(r); }
  return r;
}
function uiBoot() {
  const b = document.body;
  let lg = document.getElementById('legacy');
  if (!lg) {
    lg = document.createElement('div'); lg.id = 'legacy';
    [...b.childNodes].forEach(n => {
      if (n.nodeType === 1 && (n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || /^sy/.test(n.id || ''))) return;
      lg.appendChild(n);
    });
    b.insertBefore(lg, b.firstChild);
  }
  let ui = document.getElementById('ui');
  if (!ui) { ui = document.createElement('div'); ui.id = 'ui'; b.insertBefore(ui, lg.nextSibling); }
  uiSheetRoot();
  try { localStorage.removeItem(UI_MODE_KEY); } catch (e) {}
  b.dataset.ui = 'new';
  if (typeof uiShellInit === 'function') {
    try { uiShellInit(ui); } catch (e) { console.error('UI', e); }
  }
}
/* The old view is gone from the UI (v87). The engine still renders into the hidden #legacy container;
   uiSetMode('old') only lays it out for the oracle tests and is not stored. */
function uiSetMode(m) {
  m = m === 'old' ? 'old' : 'new';
  document.body.dataset.ui = m;
  if (m === 'old') { try { renderPlan(); } catch (e) {} }
  else if (typeof uiRender === 'function') uiRender();
}
