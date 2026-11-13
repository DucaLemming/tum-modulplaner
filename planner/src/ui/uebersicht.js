/* UI rework: Übersicht. Progress, Offene Punkte (the single inbox), Bereiche. */
const UI_ISSUE_ICON = { Regel: '⚠', Entscheidung: '⇄', Anmeldung: '🔒', 'Überschneidung': '⚡', Weg: '🚆', Reihenfolge: '↕', Angebot: 'ⓘ', Datenupdate: '↻' };
const UI_ISSUE_ORDER = ['Regel', 'Entscheidung', 'Anmeldung', 'Überschneidung', 'Weg', 'Reihenfolge', 'Angebot', 'Datenupdate'];
const uiIssueView = { sem: 0, type: '', showHidden: false, open: new Set() };
function uiSortIssues(L) {
  return L.map((x, i) => [x, i]).sort((A, B) => {
    const a = A[0], b = B[0], d = UI_ISSUE_ORDER.indexOf(a.type) - UI_ISSUE_ORDER.indexOf(b.type);
    if (d) return d;
    if (a.type === 'Überschneidung') return (a.sem - b.sem) || (a.wd - b.wd) || (a.a - b.a) || A[1] - B[1];
    return A[1] - B[1];
  }).map(x => x[0]);
}
function uiIssueGo(x) {
  if (x.type === 'Regel') { if (typeof uiModuleFilterSet === 'function') uiModuleFilterSet({ brackets: x.ref ? [x.ref] : [], plan: '' }, true); uiNav('module'); }
  else if (x.type === 'Entscheidung') uiCompareSheet(x.ref);
  else if (x.type === 'Überschneidung' || x.type === 'Weg') uiNav('woche/' + (x.sem || 1));
  else if (x.type === 'Reihenfolge') uiNav('plan');
  else if (x.codes[0]) uiOpenModule(x.codes[0]);
}
function uiIssueCard(x) {
  const open = uiIssueView.open.has(x.id), hasMore = x.full && x.full !== x.detail;
  const actions = { compare: ['Vergleichen', () => uiCompareSheet(x.ref)], seat: ['Platz erhalten', () => PL.setSeat(x.codes[0], 'got')], ack: ['OK', () => PL.ackUpdateNotes()] };
  const A = x.action && actions[x.action];
  const more = h('button', { class: 'ui-iconbtn ui-issue-more', type: 'button', 'aria-label': 'Weitere Aktionen',
    onclick: e => { e.stopPropagation(); uiMenuSheet(x.title, [[x.hidden ? 'Einblenden' : 'Ausblenden', () => PL.hideIssue(x.id, !x.hidden)]], e.currentTarget); } }, uiIcon('more', 20));
  const detail = x.detail || x.full ? h(hasMore ? 'button' : 'p', { class: 'ui-issue-detail' + (open ? ' ui-open' : ''), type: hasMore ? 'button' : null, 'aria-expanded': hasMore ? String(open) : null,
    onclick: hasMore ? e => { e.stopPropagation(); if (open) uiIssueView.open.delete(x.id); else uiIssueView.open.add(x.id); uiRender(true); } : null }, open ? x.full : (x.detail || x.full)) : null;
  return h('div', { class: 'ui-issue ui-card' + (x.soft ? ' ui-soft' : '') + (x.hidden ? ' ui-hid' : '') + (x.bad || (x.type === 'Überschneidung' && !x.soft) ? ' ui-issue-bad' : ''), 'data-type': x.type },
    h('div', { class: 'ui-issue-main' },
      h('div', { class: 'ui-issue-top' }, h('span', { class: 'ui-issue-ic', 'aria-hidden': 'true', text: UI_ISSUE_ICON[x.type] || '•' }),
        h('span', { class: 'ui-issue-type', text: x.type + (x.sem ? ' · ' + x.sem + '. Sem.' : '') }), x.vj ? h('span', { class: 'ui-tag', text: 'Vorjahr' }) : null,
        x.soft && x.type === 'Überschneidung' ? h('span', { class: 'ui-tag', text: 'unsicher' }) : null),
      h('button', { class: 'ui-issue-title', type: 'button', onclick: () => uiIssueGo(x) }, x.title),
      detail,
      A ? h('div', { class: 'ui-issue-act' }, h('button', { class: 'ui-btn ui-btn-primary', type: 'button', onclick: e => { e.stopPropagation(); A[1](); } }, A[0])) : null),
    h('div', { class: 'ui-issue-side' }, more,
      h('button', { class: 'ui-iconbtn ui-issue-go', type: 'button', 'aria-label': 'Öffnen', onclick: () => uiIssueGo(x) }, uiIcon('chev', 20))));
}
function uiProgress() {
  const T = PL.totals(), max = Math.max(120, T.sure + T.seatOpen + T.optional), w = v => (100 * v / max).toFixed(2) + '%';
  return h('section', { class: 'ui-progress ui-card', 'aria-label': 'Fortschritt' },
    h('div', { class: 'ui-progress-top' },
      h('span', { class: 'ui-big' }, h('b', { class: 'ui-big-n', text: String(T.sure) }), h('span', { class: 'ui-big-unit', text: ' / 120 ECTS sicher' })),
      h('div', { class: 'ui-progress-chips' },
        T.seatOpen ? h('span', { class: 'ui-tag ui-tag-seat', text: '+' + T.seatOpen + ' Platz offen' }) : null,
        T.optional ? h('span', { class: 'ui-tag', text: '+' + T.optional + ' optional' }) : null,
        T.done ? h('span', { class: 'ui-tag ui-tag-ok', text: T.done + ' abgeschlossen' }) : null)),
    h('div', { class: 'ui-pbar', role: 'img', 'aria-label': T.sure + ' von 120 ECTS sicher' },
      h('i', { class: 'ui-pbar-s', style: { width: w(Math.min(T.sure, max)) } }),
      T.seatOpen ? h('i', { class: 'ui-pbar-u', style: { left: w(T.sure), width: w(T.seatOpen) } }) : null,
      T.optional ? h('i', { class: 'ui-pbar-o', style: { left: w(T.sure + T.seatOpen), width: w(T.optional) } }) : null,
      h('b', { class: 'ui-pbar-120', style: { left: w(120) } })));
}
function uiBrackets() {
  const B = PL.brackets(), go = id => { if (typeof uiModuleFilterSet === 'function') uiModuleFilterSet({ brackets: [id], plan: 'in' }, true); uiNav('module'); };
  const row = r => h('button', { class: 'ui-bracket-row', type: 'button', 'data-br': r.id, onclick: () => go(r.id) },
    h('span', { class: 'ui-bracket-name' }, h('span', { class: 'ui-dot', style: { background: r.color } }), r.label),
    h('span', { class: 'ui-bracket-val', text: r.sure + ' / ' + r.req }),
    h('span', { class: 'ui-bracket-st ui-st-' + (r.state || 'open'), 'aria-label': r.state === 'ok' ? 'erfüllt' : r.state === 'bad' ? 'verletzt' : 'offen', text: r.state === 'ok' ? '✓' : r.state === 'bad' ? '⚠' : '' }),
    h('span', { class: 'ui-meter ui-bracket-meter' }, h('i', { style: { width: Math.min(100, r.req ? 100 * r.sure / r.req : 0) + '%', background: r.state === 'bad' ? 'var(--bad)' : r.color } })),
    r.id === 'ueber' ? h('span', { class: 'ui-bracket-eth ui-meta', text: 'davon Ethik ' + B.ethics.have + ' / ' + B.ethics.req }) : null);
  const rows = B.rows.filter(r => !r.master).map(row);
  rows.push(h('div', { class: 'ui-bracket-sub' }, h('span', { text: 'Mastermodule' }), h('span', { class: 'ui-bracket-val', text: B.master.sure + ' / ' + B.master.req }),
    h('span', { class: 'ui-bracket-st ui-st-' + (B.master.state || 'open'), text: B.master.state === 'ok' ? '✓' : '' })));
  B.rows.filter(r => r.master).forEach(r => rows.push(row(r)));
  return h('section', { class: 'ui-brackets ui-card', 'aria-label': 'Bereiche' }, h('h2', { class: 'ui-h2', text: 'Bereiche' }), rows);
}
function uiInbox() {
  const all = uiSortIssues(PL.issues()), vis = all.filter(x => !x.hidden), nh = all.length - vis.length, V = uiIssueView;
  const base = V.showHidden ? all : vis;
  const pass = x => (!V.sem || x.sem === V.sem) && (!V.type || x.type === V.type);
  const L = base.filter(pass);
  const chip = (lab, on, f, n) => h('button', { class: 'ui-chip' + (on ? ' ui-on' : ''), type: 'button', 'aria-pressed': String(on), onclick: () => { f(); uiRender(true); } }, lab, n != null ? h('span', { class: 'ui-chip-n', text: String(n) }) : null);
  const types = UI_ISSUE_ORDER.filter(t => base.some(x => x.type === t));
  const chips = h('div', { class: 'ui-chips' },
    chip('Alle', !V.sem && !V.type, () => { V.sem = 0; V.type = ''; }, base.length),
    [1, 2, 3, 4].map(s => chip(s + '.', V.sem === s, () => { V.sem = V.sem === s ? 0 : s; }, base.filter(x => x.sem === s).length)),
    types.map(t => chip(t, V.type === t, () => { V.type = V.type === t ? '' : t; }, base.filter(x => x.type === t).length)));
  const checks = PL.checks();
  const muted = [1, 2, 3, 4].filter(s => !checks[s - 1] && (!V.sem || V.sem === s)).map(s => h('div', { class: 'ui-issue-muted ui-card', text: 'Überschneidungen im ' + s + '. Sem. nicht geprüft' }));
  return h('section', { class: 'ui-inbox', 'aria-label': 'Offene Punkte' },
    h('h2', { class: 'ui-h2', text: 'Offene Punkte (' + vis.length + ')' }), chips,
    h('div', { class: 'ui-issues' }, L.map(uiIssueCard), muted, !L.length && !muted.length ? h('p', { class: 'ui-empty', text: 'Keine offenen Punkte.' }) : null),
    nh ? h('button', { class: 'ui-linkbtn ui-hidden-link', type: 'button', onclick: () => { V.showHidden = !V.showHidden; uiRender(true); } }, nh + ' ausgeblendet · ' + (V.showHidden ? 'verbergen' : 'anzeigen')) : null,
    h('div', { class: 'ui-checks' }, h('span', { class: 'ui-meta', text: 'Überschneidungen prüfen' }),
      h('div', { class: 'ui-seg', role: 'group', 'aria-label': 'Überschneidungen prüfen' }, [1, 2, 3, 4].map(s => h('button', { class: checks[s - 1] ? 'ui-on' : '', type: 'button', 'aria-pressed': String(checks[s - 1]),
        'aria-label': s + '. Semester prüfen', onclick: () => PL.setCheck(s, !checks[s - 1]) }, s + '.')))));
}
uiScreens.uebersicht = {
  render(c) {
    c.appendChild(uiHead('Übersicht'));
    if (!PL.semesters().some(S => S.cards.length)) {
      c.appendChild(h('div', { class: 'ui-card ui-emptycard' }, h('p', { text: 'Noch keine Module im Plan.' }),
        h('button', { class: 'ui-btn ui-btn-primary', type: 'button', onclick: () => uiNav('module') }, 'Module ansehen')));
      c.appendChild(h('div', { class: 'ui-ov-cols' }, uiInbox(), uiBrackets()));
      return;
    }
    c.appendChild(uiProgress());
    c.appendChild(h('div', { class: 'ui-ov-cols' }, uiInbox(), uiBrackets()));
  }
};
function uiCompareSheet(gi) {
  const iss = PL.issues().find(x => x.type === 'Entscheidung' && x.ref === gi); if (!iss) return;
  const D = iss.codes.map(c => PL.module(c)).filter(Boolean);
  let close;
  const ev = m => { const L = m.events.filter(e => e.wd && e.chosen); if (!L.length) return m.events.length ? 'ohne feste Zeit' : 'keine'; const s = [...new Set(L.map(e => e.t + ' ' + uiFmt.wd(e.wd) + ' ' + e.v))]; return s.slice(0, 4).join(', ') + (s.length > 4 ? ' …' : ''); };
  const ex = m => { const x = m.exams.find(e => e.d && !e.retake); return x ? uiFmt.dateY(x.d) + (x.v ? ' ' + x.v : '') : (m.exs || 'offen'); };
  const rows = [['Semester', m => m.state.sem ? m.state.sem + '. Sem.' : 'offen'], ['ECTS', m => String(m.ects)], ['Bereich', m => PL.label(m.state.bracket)],
    ['Turnus', m => m.turn || '?'], ['Termine', ev], ['Prüfung', ex], ['Aufwand', m => m.effort != null ? '≈ ' + Math.round(m.effort) : '?'],
    ['Voraussetzungen', m => m.before.length ? m.before.join(', ') : 'keine']];
  const tbl = h('div', { class: 'ui-cmp', style: { gridTemplateColumns: 'minmax(90px,auto) repeat(' + D.length + ', minmax(0,1fr))' } },
    h('span'), D.map(m => h('b', { class: 'ui-cmp-h' }, m.code, h('span', { class: 'ui-meta ui-cmp-n', text: m.name }), m.alt && m.alt.rank === 0 ? h('span', { class: 'ui-tag', text: 'zählt vorerst' }) : null)),
    rows.map(([lab, f]) => [h('span', { class: 'ui-meta', text: lab }), D.map(m => h('span', { class: 'ui-cmp-v', text: f(m) }))]),
    h('span'), D.map(m => h('div', { class: 'ui-cmp-act' },
      h('button', { class: 'ui-btn', type: 'button', onclick: () => { close(); uiOpenModule(m.code); } }, 'Details'),
      m.alt && m.alt.rank > 0 ? h('button', { class: 'ui-btn', type: 'button', onclick: () => { for (let i = PL.module(m.code).alt.rank; i > 0; i--) PL.rankAlternative(m.code, -1); close(); uiCompareSheet(gi); } }, 'Zählt vorerst') : null,
      h('button', { class: 'ui-btn ui-btn-primary', type: 'button', onclick: async () => { close(); if (await uiConfirm(m.code + ' behalten, die anderen Module aus dem Plan entfernen?', 'Dafür entscheiden')) PL.decide(m.code); } }, 'Dafür entscheiden'))));
  close = uiSheet('Entscheidung: ' + iss.title, tbl, { kind: 'dialog' });
}
