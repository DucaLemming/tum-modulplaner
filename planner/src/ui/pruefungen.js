/* UI rework: Prüfungen. Exam dates of one semester as a list grouped by calendar week; desktop also as a week grid. */
let uiExView = (() => { try { return localStorage.getItem('tum-ui-exview') === 'cal' ? 'cal' : 'list'; } catch (e) { return 'list'; } })(), uiExWeek = {}, uiExDay = {};
function uiExOpen(code) { uiModulOpen[code + '|pruefung'] = true; uiOpenModule(code); }
function uiExTags(r) {
  return [r.est ? h('span', { class: 'ui-tag', text: 'geschätzt' }) : null, r.retake ? h('span', { class: 'ui-tag ui-tag-retake', text: '↻ Wiederholung' }) : null,
    r.clash ? h('span', { class: 'ui-tag ui-tag-bad', text: '⚡ Überschneidung' }) : null, r.sameDay ? h('span', { class: 'ui-tag', text: 'gleicher Tag' }) : null,
    r.optional ? h('span', { class: 'ui-tag', text: 'optional' }) : null];
}
function uiExRow(r) {
  return h('button', { class: 'ui-exl-row' + (r.clash ? ' ui-exl-clash' : '') + (r.retake ? ' ui-exl-re' : ''), type: 'button', 'data-code': r.code, 'data-date': r.date, onclick: () => uiExOpen(r.code) },
    h('span', { class: 'ui-exl-d' }, h('b', { text: uiFmt.wd(r.wd) + ' ' + uiFmt.date(r.date) }), h('span', { class: 'ui-meta', text: r.v ? r.v + (r.b ? '–' + r.b : '') : 'Zeit offen' })),
    h('span', { class: 'ui-exl-m' }, h('span', { class: 'ui-meta', text: r.code + (r.room ? ' · ' + r.room : '') }), h('span', { class: 'ui-exl-n', text: r.name }), h('span', { class: 'ui-row ui-exl-tags' }, uiExTags(r))));
}
uiScreens.pruefungen = {
  render(c, rt) {
    const s = rt.sem || 1, X = PL.exams(s), wide = window.innerWidth >= 720;
    const rows = X.weeks.reduce((a, w) => a + w.rows.length, 0);
    c.appendChild(h('div', { class: 'ui-head' }, h('h1', { class: 'ui-title', text: 'Prüfungen' }),
      h('div', { class: 'ui-head-x' },
        h('div', { class: 'ui-seg ui-ex-sem', role: 'tablist', 'aria-label': 'Semester' }, [1, 2, 3, 4].map(i => h('button', { class: i === s ? 'ui-on' : '', type: 'button', role: 'tab', 'aria-selected': String(i === s), onclick: () => uiNav('pruefungen/' + i) }, i + '.'))),
        h('div', { class: 'ui-seg ui-ex-view', role: 'group', 'aria-label': 'Ansicht' }, [['list', 'Liste'], ['cal', 'Kalender']].map(([v, l]) => h('button', { class: uiExView === v ? 'ui-on' : '', type: 'button', 'aria-pressed': String(uiExView === v), onclick: () => { uiExView = v; try { localStorage.setItem('tum-ui-exview', v); } catch (e) {} uiRender(true); } }, l))))));
    c.appendChild(h('p', { class: 'ui-meta ui-ex-term', text: X.label }));
    if (!rows) c.appendChild(h('p', { class: 'ui-empty ui-card', text: 'Keine Prüfungstermine bekannt.' }));
    else if (uiExView === 'cal') {
      const ws = X.weeks, cur = ws.find(w => w.kw === uiExWeek[s]) || ws[0];
      c.appendChild(h('div', { class: 'ui-row ui-ex-weeks' }, ws.map(w => h('button', { class: 'ui-chip' + (w === cur ? ' ui-on' : ''), type: 'button', onclick: () => { uiExWeek[s] = w.kw; delete uiExDay[s]; uiRender(true); } }, 'KW ' + w.kw + ' · ' + w.rows.length))));
      let days = [1, 2, 3, 4, 5].concat(cur.rows.some(r => r.wd === 6) ? [6] : []).map(wd => {
        const iso = (() => { const d = new Date(cur.from + 'T12:00:00'); d.setDate(d.getDate() + wd - 1); return d.toISOString().slice(0, 10); })();
        return { wd, clash: cur.rows.some(r => r.wd === wd && r.clash), title: h('b', { text: uiFmt.wd(wd) + ' ' + uiFmt.date(iso) }),
          items: cur.rows.filter(r => r.wd === wd).map(r => { const a = r.v ? +r.v.slice(0, 2) * 60 + +r.v.slice(3, 5) : 8 * 60, b = r.b ? +r.b.slice(0, 2) * 60 + +r.b.slice(3, 5) : a + 90;
            return { a, b, node: h('button', { class: 'ui-ev' + (r.clash ? ' ui-ev-clash' : '') + (r.est ? ' ui-ev-faint' : '') + (r.retake ? ' ui-ev-retake' : ''), type: 'button', 'data-tip': [r.retake ? 'Wiederholungsprüfung' : '', r.est ? 'Termin geschätzt' : '', r.clash ? 'Überschneidung' : ''].filter(Boolean).join(' · ') || null, style: { '--fill': PL.color((PL.module(r.code) || { state: {} }).state.bracket) }, onclick: () => uiExOpen(r.code) },
              h('b', { class: 'ui-ev-l1', text: (r.retake ? '↻ Wdh. ' : '') + r.code }), h('span', { class: 'ui-ev-l2', text: r.name }), h('span', { class: 'ui-ev-l3', text: (r.v || '') + (r.b ? '–' + r.b : '') + (r.room ? ' · ' + r.room : '') })) }; }) };
      });
      if (!wide) {
        const withEx = days.filter(d => d.items.length), cd = days.find(d => d.wd === uiExDay[s]) || withEx[0] || days[0];
        c.appendChild(h('div', { class: 'ui-seg ui-wk-days', role: 'tablist', 'aria-label': 'Tag' }, days.map(d => h('button', { class: (d === cd ? 'ui-on' : '') + (d.items.length ? ' ui-dayhas' : ''), type: 'button', role: 'tab', 'aria-selected': String(d === cd),
          onclick: () => { uiExDay[s] = d.wd; uiRender(true); } }, uiFmt.wd(d.wd)))));
        const wrap = h('div', { class: 'ui-wk-grid' }, uiTimeGrid([cd]));
        const step = k => { const i = days.indexOf(cd) + k; if (i >= 0 && i < days.length) { uiExDay[s] = days[i].wd; uiRender(true); } };
        uiSwipe(wrap, () => step(1), () => step(-1));
        c.appendChild(wrap);
      } else c.appendChild(h('div', { class: 'ui-wk-grid' }, uiTimeGrid(days)));
    } else {
      c.appendChild(h('div', { class: 'ui-exl' }, X.weeks.map(w => [h('div', { class: 'ui-exl-kw' }, 'KW ' + w.kw, h('span', { class: 'ui-meta', text: ' · ab ' + uiFmt.date(w.from) })), w.rows.map(uiExRow)])));
    }
    if (X.undated.length) c.appendChild(h('section', { class: 'ui-ex-undated' }, h('h2', { class: 'ui-h2', text: 'Ohne Termin' }),
      X.undated.map(u => h('button', { class: 'ui-exl-row ui-exl-open', type: 'button', onclick: () => uiExOpen(u.code) }, h('span', { class: 'ui-exl-m' }, h('span', { class: 'ui-meta', text: u.code }), h('span', { class: 'ui-exl-n', text: u.name }), u.known ? h('span', { class: 'ui-meta', text: u.known }) : null)))));
  }
};
