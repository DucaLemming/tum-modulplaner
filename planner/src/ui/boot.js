/* UI rework: boot. Moves the old page into #legacy, creates #ui and switches between old and new view. */
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
  const root = uiSheetRoot();
  if (!root.querySelector('.ui-backbtn')) {
    root.appendChild(h('button', { class: 'ui-backbtn', type: 'button', onclick: () => uiSetMode('new') }, 'Neue Ansicht'));
  }
  let m = 'new';
  try { m = localStorage.getItem(UI_MODE_KEY) === 'old' ? 'old' : 'new'; } catch (e) {}
  b.dataset.ui = m;
  if (typeof uiShellInit === 'function') {
    try { uiShellInit(ui); } catch (e) { console.error('UI', e); }
  }
}
function uiSetMode(m) {
  m = m === 'old' ? 'old' : 'new';
  try { localStorage.setItem(UI_MODE_KEY, m); } catch (e) {}
  document.body.dataset.ui = m;
  if (m === 'old') {
    try { renderPlan(); } catch (e) {}
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  } else if (typeof uiRender === 'function') uiRender();
}
