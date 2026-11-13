/* UI rework: Module. Searchable, filterable list of all modules, grouped by bracket. */
const uiModuleFilter = { q: '', brackets: new Set(), ects: new Set(), turn: new Set(), plan: '', limited: '', dep: '', timing: new Set(), eth: false, lang: new Set() };
const uiModuleMore = {};
/* collapsed groups, per device; default: all collapsed. Active filters open every group. */
const uiMGroups = (() => { try { const v = JSON.parse(localStorage.getItem('tum-ui-mgroups') || 'null'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } })();
function uiMGroupOpen(b) { return uiMGroups[b] === true; }
function uiMGroupSet(b, on) { uiMGroups[b] = on; try { localStorage.setItem('tum-ui-mgroups', JSON.stringify(uiMGroups)); } catch (e) {} uiRender(true); }
function uiModuleFiltered(F) { return F.brackets.size || F.ects.size || F.turn.size || F.plan || F.limited || F.dep || F.timing.size || F.eth || F.lang.size; }
function uiModuleFilterSet(p, silent) {
  for (const k in p) {
    const v = p[k];
    if (uiModuleFilter[k] instanceof Set) uiModuleFilter[k] = new Set(v instanceof Set ? [...v] : (Array.isArray(v) ? v : (v ? [v] : [])));
    else uiModuleFilter[k] = v;
  }
  if (!silent && typeof uiRender === 'function') uiRender(true);
}
function uiModuleFilterReset() {
  uiModuleFilterSet({ q: '', brackets: [], ects: [], turn: [], plan: '', limited: '', dep: '', timing: [], eth: false, lang: [] }, true);
  const t = document.querySelector('#ui .ui-search'); if (t) t.value = '';
}
const UI_TIMING = [['vor', 'Block vor'], ['in', 'während'], ['nach', 'Block nach'], ['none', 'ohne Termine']];
function uiModulePass(m, F) {
  if (F.brackets.size && !F.brackets.has(m.bracket)) return false;
  if (F.ects.size && !F.ects.has(Math.round(m.ects))) return false;
  if (F.turn.size && ![...F.turn].some(t => m.turn.includes(t))) return false;
  if (F.plan === 'in' && !m.inPlan) return false;
  if (F.plan === 'out' && m.inPlan) return false;
  if (F.limited === 'hide' && m.limited) return false;
  if (F.limited === 'only' && !m.limited) return false;
  if (F.dep === 'hide' && m.dep) return false;
  if (F.eth && !m.eth) return false;
  if (F.lang.size && ![...F.lang].some(l => m.lang.includes(l))) return false;
  if (F.timing.size && !PL.filters.timing(m.code).some(t => F.timing.has(t))) return false;
  return true;
}
function uiFilterPop(anchor, title, build) {
  const body = h('div', { class: 'ui-fpop' });
  const draw = () => { body.innerHTML = ''; build().forEach(([lab, on, f]) => body.appendChild(h('button', { class: 'ui-fopt' + (on ? ' ui-on' : ''), type: 'button', role: 'menuitemcheckbox', 'aria-checked': String(on),
    onclick: () => { f(); uiRender(true); draw(); } }, h('span', { class: 'ui-fbox', 'aria-hidden': 'true', text: on ? '✓' : '' }), lab))); };
  draw();
  uiSheet(title, body, { kind: 'popover', anchor });
}
const uiTog = (set, v) => () => { if (set.has(v)) set.delete(v); else set.add(v); };
function uiModuleChips(all) {
  const F = uiModuleFilter, chips = [];
  const chip = (lab, active, open, clear) => h('span', { class: 'ui-fchip' + (active ? ' ui-on' : '') },
    h('button', { class: 'ui-chip' + (active ? ' ui-on' : ''), type: 'button', 'aria-haspopup': 'true', onclick: e => open(e.currentTarget) }, lab, active ? '' : ' ▾'),
    active ? h('button', { class: 'ui-chip ui-on ui-chip-x', type: 'button', 'aria-label': lab + ' zurücksetzen', onclick: () => { clear(); uiRender(true); } }, '✕') : null);
  const brs = PL.brackets().rows.map(r => [r.id, r.label]).concat([['extern', PL.label('extern')], ['zusatz', PL.label('zusatz')]]);
  chips.push(chip(F.brackets.size ? 'Bereich: ' + [...F.brackets].map(b => (brs.find(x => x[0] === b) || [, b])[1]).join(', ') : 'Bereich', F.brackets.size > 0,
    a => uiFilterPop(a, 'Bereich', () => brs.map(([id, lab]) => [lab, F.brackets.has(id), uiTog(F.brackets, id)])), () => F.brackets.clear()));
  const ects = [...new Set(all.map(m => Math.round(m.ects)))].sort((a, b) => a - b);
  chips.push(chip(F.ects.size ? 'ECTS: ' + [...F.ects].sort((a, b) => a - b).join(', ') : 'ECTS', F.ects.size > 0,
    a => uiFilterPop(a, 'ECTS', () => ects.map(v => [String(v), F.ects.has(v), uiTog(F.ects, v)])), () => F.ects.clear()));
  chips.push(chip(F.turn.size ? [...F.turn].map(t => t === 'W' ? 'Winter' : 'Sommer').join(', ') : 'Semester', F.turn.size > 0,
    a => uiFilterPop(a, 'Semester', () => [['Winter', F.turn.has('W'), uiTog(F.turn, 'W')], ['Sommer', F.turn.has('S'), uiTog(F.turn, 'S')]]), () => F.turn.clear()));
  chips.push(chip(F.plan === 'in' ? 'nur im Plan' : F.plan === 'out' ? 'nur nicht im Plan' : 'Im Plan', !!F.plan,
    a => uiFilterPop(a, 'Im Plan', () => [['nur im Plan', F.plan === 'in', () => { F.plan = F.plan === 'in' ? '' : 'in'; }], ['nur nicht im Plan', F.plan === 'out', () => { F.plan = F.plan === 'out' ? '' : 'out'; }]]), () => { F.plan = ''; }));
  const nMore = (F.limited ? 1 : 0) + (F.dep ? 1 : 0) + F.timing.size + (F.eth ? 1 : 0) + F.lang.size;
  chips.push(chip(nMore ? 'Mehr (' + nMore + ')' : 'Mehr', nMore > 0, a => uiFilterPop(a, 'Mehr', () => [
    ['begrenzte ausblenden', F.limited === 'hide', () => { F.limited = F.limited === 'hide' ? '' : 'hide'; }],
    ['nur begrenzte', F.limited === 'only', () => { F.limited = F.limited === 'only' ? '' : 'only'; }],
    ['eingestellte ausblenden', F.dep === 'hide', () => { F.dep = F.dep === 'hide' ? '' : 'hide'; }],
    ...UI_TIMING.map(([v, lab]) => ['Zeitlage: ' + lab, F.timing.has(v), uiTog(F.timing, v)]),
    ['nur Ethik', F.eth, () => { F.eth = !F.eth; }],
    ['Sprache: Deutsch', F.lang.has('Deutsch'), uiTog(F.lang, 'Deutsch')], ['Sprache: Englisch', F.lang.has('Englisch'), uiTog(F.lang, 'Englisch')]]),
    () => { F.limited = ''; F.dep = ''; F.timing.clear(); F.eth = false; F.lang.clear(); }));
  chips.push(h('button', { class: 'ui-chip ui-chip-reset', type: 'button', onclick: () => { uiModuleFilterReset(); uiRender(true); } }, 'Zurücksetzen'));
  return h('div', { class: 'ui-chips ui-fchips' }, chips);
}
function uiModuleRow(m) {
  return h('div', { class: 'ui-mrow' + (m.inPlan ? ' ui-inplan' : ''), 'data-code': m.code, 'data-br': m.bracket },
    h('button', { class: 'ui-mrow-main', type: 'button', onclick: () => uiOpenModule(m.code) },
      h('span', { class: 'ui-mrow-code', text: m.code }),
      h('span', { class: 'ui-mrow-name', text: m.name, title: m.name }),
      h('span', { class: 'ui-mrow-icons' },
        m.inPlan ? h('span', { class: 'ui-planmark', title: 'Im Plan' + (m.sem ? ', ' + m.sem + '. Semester' : '') }, h('span', { class: 'ui-dot', style: { background: PL.color(m.bracket) } }), m.sem ? String(m.sem) : '') : null,
        m.seat ? uiSeatTag(m.seat) : m.limited ? h('span', { title: 'Teilnehmerzahl begrenzt', text: '🔒' }) : null,
        m.neu ? h('span', { class: 'ui-tag', text: 'neu' }) : null,
        m.dep ? h('span', { class: 'ui-tag', text: 'eingestellt?' }) : null,
        m.nogo ? h('span', { title: 'Nicht für mich', text: '⛔' }) : null),
      h('span', { class: 'ui-mrow-ects', text: String(m.ects) }),
      h('span', { class: 'ui-mrow-turn', text: m.turn || '–', title: 'Turnus' })),
    m.inPlan ? h('span', { class: 'ui-mrow-add ui-done', 'aria-label': 'im Plan', text: '✓' })
      : h('button', { class: 'ui-iconbtn ui-mrow-add', type: 'button', 'aria-label': m.code + ' zum Plan hinzufügen', onclick: () => PL.setInPlan(m.code, true) }, uiIcon('plus', 20)));
}
uiScreens.module = {
  render(c) {
    const F = uiModuleFilter;
    if (window.uiSearchQ != null) { F.q = window.uiSearchQ; window.uiSearchQ = null; }
    const all = PL.modules(), byCode = {}; all.forEach(m => byCode[m.code] = m);
    const order = F.q.trim() ? PL.search(F.q) : null;
    const list = (order ? order.map(c => byCode[c]).filter(Boolean) : all).filter(m => uiModulePass(m, F));
    let t = null;
    const q = h('input', { class: 'ui-module-q', type: 'search', value: F.q, placeholder: 'Modul, Inhalt, Lehrveranstaltung suchen …', 'aria-label': 'Module suchen', 'data-keep': 'mq', autocomplete: 'off',
      oninput: () => { clearTimeout(t); t = setTimeout(() => { F.q = q.value; const g = document.querySelector('#ui .ui-search'); if (g && g !== document.activeElement) g.value = q.value; uiRender(true); }, 150); } });
    c.appendChild(uiHead('Module'));
    c.appendChild(h('div', { class: 'ui-msearch' }, q, h('span', { class: 'ui-module-count ui-meta', text: list.length + ' Module' })));
    c.appendChild(uiModuleChips(all));
    const box = h('div', { class: 'ui-mlist' });
    if (order) {
      box.appendChild(h('div', { class: 'ui-mgroup-h' }, h('span', { text: 'Treffer' }), h('span', { class: 'ui-meta', text: String(list.length) })));
      const n = uiModuleMore.hits || 100;
      list.slice(0, n).forEach(m => box.appendChild(uiModuleRow(m)));
      if (list.length > n) box.appendChild(h('button', { class: 'ui-btn ui-more', type: 'button', onclick: () => { uiModuleMore.hits = n + 100; uiRender(true); } }, 'Weitere ' + Math.min(100, list.length - n) + ' anzeigen'));
    } else {
      const groups = {}; list.forEach(m => (groups[m.bracket] = groups[m.bracket] || []).push(m));
      const ids = PL.brackets().rows.map(r => r.id).concat(['extern', 'zusatz']).concat(Object.keys(groups).filter(b => !PL.brackets().rows.some(r => r.id === b) && b !== 'extern' && b !== 'zusatz'));
      const forced = !!uiModuleFiltered(F), shown = ids.filter(b => groups[b] && groups[b].length);
      if (!forced && shown.length > 1) {
        const allOpen = shown.every(uiMGroupOpen);
        c.lastChild.appendChild(h('button', { class: 'ui-chip ui-chip-all', type: 'button', onclick: () => { shown.forEach(b => uiMGroups[b] = !allOpen); uiMGroupSet(shown[0], !allOpen); } }, allOpen ? 'Alle zuklappen' : 'Alle aufklappen'));
      }
      shown.forEach(b => {
        const L = groups[b], open = forced || uiMGroupOpen(b), inP = L.filter(m => m.inPlan).length;
        L.sort((x, y) => x.name.localeCompare(y.name));
        const n = uiModuleMore[b] || 100;
        box.appendChild(h('button', { class: 'ui-mgroup-h ui-mgroup-btn', type: 'button', 'aria-expanded': String(open), 'data-group': b, disabled: forced,
          onclick: () => uiMGroupSet(b, !open) },
          h('span', { class: 'ui-mgroup-chev', 'aria-hidden': 'true', text: open ? '▾' : '▸' }),
          h('span', { class: 'ui-dot', style: { background: PL.color(b) } }), h('span', { class: 'ui-mgroup-n', text: PL.label(b) }),
          inP ? h('span', { class: 'ui-meta', text: inP + ' im Plan · ' }) : null, h('span', { class: 'ui-meta', text: L.length + ' Module' })));
        if (!open) return;
        L.slice(0, n).forEach(m => box.appendChild(uiModuleRow(m)));
        if (L.length > n) box.appendChild(h('button', { class: 'ui-btn ui-more', type: 'button', onclick: () => { uiModuleMore[b] = n + 100; uiRender(true); } }, 'Weitere ' + Math.min(100, L.length - n) + ' anzeigen'));
      });
    }
    if (!list.length) box.appendChild(h('p', { class: 'ui-empty', text: 'Keine Module für diese Suche und Filter.' }));
    c.appendChild(box);
    c.appendChild(h('button', { class: 'ui-btn ui-extra', type: 'button', onclick: () => PL.openExtra() }, '＋ Zusatzmodul'));
  }
};
