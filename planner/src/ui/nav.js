/* UI rework: shell. Navigation (rail / tabs / bottom bar), top bar with search and menu, screen container, module panel. */
let uiEl = null, uiLast = { screen: null, sem: 0, key: '' };
function uiShellInit(ui) {
  uiEl = ui;
  UI_SCREENS.forEach(([n, lab]) => { if (!uiScreens[n]) uiScreens[n] = { render: c => c.appendChild(h('h1', { class: 'ui-title', text: lab })) }; });
  const nav = h('nav', { class: 'ui-nav', 'aria-label': 'Ansichten' },
    h('div', { class: 'ui-brand', text: 'Modulplaner' }),
    h('div', { class: 'ui-nav-items' }, UI_SCREENS.map(([n, lab]) => h('a', { class: 'ui-nav-item', href: '#/' + n, 'data-nav': n, onclick: e => { e.preventDefault(); uiNav(n === uiRoute().screen ? uiPath({ screen: n, sem: uiRoute().sem }) : n); } },
      uiIcon(n), h('span', { class: 'ui-nav-label', text: lab }), n === 'uebersicht' ? h('span', { class: 'ui-badge', 'aria-label': 'offene Punkte', hidden: true }) : null))),
    h('div', { class: 'ui-nav-foot' }));
  const q = h('input', { class: 'ui-search', type: 'search', placeholder: 'Modul, Inhalt, Lehrveranstaltung suchen …', 'aria-label': 'Suchen', autocomplete: 'off',
    oninput: () => uiGlobalSearch(q.value) });
  const top = h('div', { class: 'ui-top' },
    h('div', { class: 'ui-top-title', text: '' }),
    h('div', { class: 'ui-top-search' }, q),
    h('button', { class: 'ui-iconbtn ui-top-searchbtn', type: 'button', 'aria-label': 'Suchen', onclick: () => { uiNav('module'); setTimeout(() => { const f = document.querySelector('#ui .ui-module-q'); if (f) f.focus(); }, 30); } }, uiIcon('search')),
    h('button', { class: 'ui-iconbtn ui-top-help', type: 'button', 'aria-label': 'Zeichen und Farben erklären', title: 'Zeichen und Farben', onclick: e => uiLegend(e.currentTarget) }, h('span', { class: 'ui-qmark', text: '?' })),
    h('button', { class: 'ui-iconbtn ui-top-settings', type: 'button', 'aria-label': 'Einstellungen', onclick: () => uiNav('einstellungen') }, uiIcon('einstellungen')),
    h('div', { class: 'ui-top-sync' }),
    h('button', { class: 'ui-iconbtn ui-top-more', type: 'button', 'aria-label': 'Menü', onclick: e => uiOpenMenu(e.currentTarget) }, uiIcon('more')));
  const screen = h('div', { class: 'ui-screen', tabindex: '-1' });
  const panel = h('aside', { class: 'ui-panel', 'aria-label': 'Modul', hidden: true });
  const dim = h('div', { class: 'ui-panel-dim', onclick: () => uiCloseModule() });
  ui.append(h('div', { class: 'ui-discslot' }), nav, top, screen, dim, panel);
  window.addEventListener('hashchange', () => uiRender());
  document.addEventListener('keydown', uiTrapKey, true);
  PL.on(() => uiRender(true));
  window.addEventListener('resize', () => { const w = uiWidthClass(); if (w !== uiEl.dataset.size) uiRender(true); });
  if (typeof uiInitExtras === 'function') try { uiInitExtras(ui); } catch (e) { console.error(e); }
  uiRender();
}
function uiWidthClass() { const w = window.innerWidth; return w < 720 ? 'phone' : w < 1200 ? 'tablet' : 'desktop'; }
function uiOpenMenu(anchor) {
  if (typeof uiMenuOpen === 'function') return uiMenuOpen(anchor);
  uiMenuSheet('Menü', [['Alte Ansicht', () => uiSetMode('old')]], anchor);
}
let uiSearchTimer = null;
function uiGlobalSearch(v) {
  clearTimeout(uiSearchTimer);
  uiSearchTimer = setTimeout(() => {
    if (typeof uiModuleFilterSet === 'function') uiModuleFilterSet({ q: v }, true); else window.uiSearchQ = v;
    if (uiRoute().screen !== 'module') uiNav('module'); else uiRender(true);
  }, 150);
}
function uiRender(force) {
  if (!uiEl || document.body.dataset.ui !== 'new') return;
  const r = uiRoute(), size = uiWidthClass();
  uiEl.dataset.size = size;
  const screen = uiEl.querySelector('.ui-screen'), panel = uiEl.querySelector('.ui-panel');
  uiEl.querySelectorAll('.ui-nav-item').forEach(a => { const on = a.dataset.nav === r.screen; a.classList.toggle('ui-on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const lab = (UI_SCREENS.find(([n]) => n === r.screen) || [, ''])[1];
  uiEl.querySelector('.ui-top-title').textContent = lab + (r.sem ? ' · ' + r.sem + '. Sem.' : '');
  let n = 0; try { n = PL.issues().filter(i => !i.hidden).length; } catch (e) {}
  const badge = uiEl.querySelector('.ui-badge'); if (badge) { badge.hidden = !n; badge.textContent = n > 99 ? '99+' : String(n); }
  const key = r.screen + '|' + r.sem;
  const same = uiLast.key === key;
  const st = same ? screen.scrollTop : 0;
  if (force || !same || !screen.firstChild) {
    const keepFocus = same && document.activeElement && screen.contains(document.activeElement) && document.activeElement.dataset && document.activeElement.dataset.keep;
    screen.innerHTML = '';
    screen.dataset.uiScreen = r.screen;
    const c = h('div', { class: 'ui-screen-in ui-s-' + r.screen, 'data-ui-screen': r.screen });
    screen.appendChild(c);
    try { uiScreens[r.screen].render(c, r); } catch (e) { console.error('UI screen', r.screen, e); c.appendChild(h('p', { class: 'ui-empty', text: 'Fehler beim Anzeigen.' })); }
    if (same) screen.scrollTop = st;
    if (keepFocus) { const f = screen.querySelector('[data-keep="' + keepFocus + '"]'); if (f) { f.focus(); if (f.setSelectionRange && f.value) f.setSelectionRange(f.value.length, f.value.length); } }
  }
  uiLast = { screen: r.screen, sem: r.sem, key };
  const open = !!r.module && !!M[r.module];
  uiEl.classList.toggle('ui-has-panel', open);
  if (open) {
    const pst = panel.querySelector('.ui-panel-body') ? panel.querySelector('.ui-panel-body').scrollTop : 0, samePanel = panel.dataset.code === r.module;
    uiRenderPanel(panel, r.module); panel.dataset.code = r.module;
    if (samePanel) { const b = panel.querySelector('.ui-panel-body'); if (b) b.scrollTop = pst; }
  } else { panel.hidden = true; panel.innerHTML = ''; delete panel.dataset.code; }
  if (typeof uiAfterRender === 'function') try { uiAfterRender(uiEl, r); } catch (e) {}
}
/* screen header row used by every screen */
function uiHead(title, ...extra) {
  return h('div', { class: 'ui-head' }, h('h1', { class: 'ui-title', text: title }), h('div', { class: 'ui-head-x' }, extra));
}
