/* UI rework: Woche. Time grid of one semester week (desktop: Mo to Fr, phone: one day), key figures, conflicts, own appointments. */
const UI_WD = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const UI_HOUR = 56;
const uiWeekView = (() => { let v = {}; try { v = JSON.parse(localStorage.getItem('tum-ui-woche') || '{}') || {}; } catch (e) {} return Object.assign({ alt: false, hid: false, cf: false, list: false }, v); })();
const uiWeekMode = {};
let uiWeekDay = 0;
function uiWeekSave() { try { localStorage.setItem('tum-ui-woche', JSON.stringify(uiWeekView)); } catch (e) {} }
/* lanes: overlapping items of one day share the width in equal columns */
function uiLanes(L) {
  const S = L.slice().sort((x, y) => x.a - y.a || y.b - x.b); let cl = [], end = -1;
  const flush = () => { const cols = []; cl.forEach(it => { let i = cols.findIndex(e => e <= it.a); if (i < 0) { i = cols.length; cols.push(0); } cols[i] = it.b; it._lane = i; }); cl.forEach(it => it._n = cols.length); cl = []; };
  S.forEach(it => { if (it.a >= end && cl.length) flush(); cl.push(it); end = Math.max(end, it.b); }); if (cl.length) flush();
  return S;
}
/* generic time grid used by Woche and Prüfungen: days [{wd, title, sub, items: [{a, b, node, travel}]}] */
function uiTimeGrid(days, o) {
  o = o || {};
  let lo = 7 * 60, hi = 20 * 60;
  days.forEach(d => d.items.forEach(it => { lo = Math.min(lo, Math.floor(it.a / 60) * 60); hi = Math.max(hi, Math.ceil(it.b / 60) * 60); }));
  const H = (hi - lo) / 60 * UI_HOUR, y = m => (m - lo) / 60 * UI_HOUR;
  const hours = h('div', { class: 'ui-tg-hours', style: { height: H + 'px' } }); for (let m = lo; m < hi; m += 60) hours.appendChild(h('span', { style: { top: y(m) + 'px' }, text: uiFmt.time(m) }));
  const cols = days.map(d => {
    const body = h('div', { class: 'ui-tg-body', 'data-wd': String(d.wd), style: { height: H + 'px' } });
    for (let m = lo + 60; m < hi; m += 60) body.appendChild(h('i', { class: 'ui-tg-line', style: { top: y(m) + 'px' } }));
    d.items.filter(it => it.travel).forEach(it => { it.node.style.top = y(it.a) + 'px'; it.node.style.height = Math.max(4, y(it.b) - y(it.a)) + 'px'; body.appendChild(it.node); });
    uiLanes(d.items.filter(it => !it.travel)).forEach(it => {
      const n = it.node; n.style.top = y(it.a) + 'px'; n.style.height = Math.max(18, y(it.b) - y(it.a) - 1) + 'px';
      n.style.left = 'calc(' + (100 * it._lane / it._n) + '% + 2px)'; n.style.width = 'calc(' + (100 / it._n) + '% - 4px)';
      n.dataset.a = it.a; n.dataset.b = it.b; body.appendChild(n);
    });
    if (o.onDraw) o.onDraw(body, d.wd, lo);
    return h('div', { class: 'ui-tg-col' }, h('div', { class: 'ui-tg-head' + (d.clash ? ' ui-tg-clash' : '') }, d.title, d.sub || null), body);
  });
  return h('div', { class: 'ui-tg', style: { '--n': String(days.length) } }, h('div', { class: 'ui-tg-hcol' }, h('div', { class: 'ui-tg-head' }), hours), cols);
}
function uiEvNode(it, s) {
  if (it.kind === 'own') return h('button', { class: 'ui-ev ui-ev-own' + (it.clash ? ' ui-ev-clash' : ''), type: 'button', onclick: () => uiBlockForm(it.bi) },
    h('b', { class: 'ui-ev-l1', text: it.title }), h('span', { class: 'ui-ev-l3', text: uiFmt.time(it.a) + '–' + uiFmt.time(it.b) }));
  if (it.kind === 'travel') return h('div', { class: 'ui-ev-travel' + (it.clash ? ' ui-ev-clash' : ''), title: it.title + ' · ' + it.min + ' min' }, h('span', { text: it.min + "'" }));
  const st = { onl: 'online', rec: 'rec', skip: 'skip', done: 'done' }[it.status] || 'vor';
  return h('button', { class: 'ui-ev ui-ev-' + st + (it.clash ? ' ui-ev-clash' : '') + (it.soft ? ' ui-ev-soft' : '') + (it.tag ? ' ui-ev-faint' : '') + (it.hiddenByDefault ? ' ui-ev-hidden' : ''),
    type: 'button', 'data-code': it.code, 'data-key': it.key, 'data-tip': [{ vor: 'Vor Ort', online: 'Online', rec: 'Aufzeichnung (zählt nicht)', skip: 'Nicht (zählt nicht)', done: 'Erledigt (zählt nicht)' }[st], it.clash ? (it.soft ? 'unsichere Überschneidung' : 'Überschneidung') : '', it.mand ? 'Pflicht' : '', it.tag, it.vj ? 'Zeit aus dem Vorjahr' : '', 'Antippen zum Ändern'].filter(Boolean).join(' · '), style: { '--fill': it.fill }, onclick: e => uiEventSheet(it.code, it.key, e.currentTarget, s) },
    h('span', { class: 'ui-ev-l1' }, h('b', { text: it.code + ' ' + it.t }), it.clash ? ' ⚡' : '', it.mand ? ' ❗' : '', st === 'online' ? ' 💻' : ''),
    h('span', { class: 'ui-ev-l2', text: it.title }),
    h('span', { class: 'ui-ev-l3', text: uiFmt.time(it.a) + '–' + uiFmt.time(it.b) + (it.room ? ' · ' + it.room : '') }),
    it.tag ? h('span', { class: 'ui-tag', text: it.tag }) : null);
}
function uiWeekShow(it) {
  if (it.kind !== 'ev') return true;
  if (it.cand) return uiWeekView.alt;
  if (it.hiddenByDefault) return uiWeekView.hid;
  if (uiWeekView.cf) return it.clash;
  return true;
}
uiScreens.woche = {
  render(c, r) {
    const s = r.sem || 1, W = PL.week(s, uiWeekMode[s] || 'sem');
    const SS = PL.semesters();
    const semSel = h('select', { class: 'ui-wk-sem', 'aria-label': 'Semester', onchange: e => uiNav('woche/' + e.target.value) },
      [1, 2, 3, 4].map(i => h('option', { value: String(i), selected: i === s }, i + '. Sem · ' + SS[i].label)));
    const modeLab = { pre: 'Blockwoche davor', sem: 'Semesterwoche', post: 'Blockwoche danach' };
    const modeSel = W.modes.length > 1 ? h('select', { class: 'ui-wk-mode', 'aria-label': 'Woche', onchange: e => { uiWeekMode[s] = e.target.value; uiRender(true); } },
      W.modes.map(m => h('option', { value: m, selected: m === W.mode }, modeLab[m]))) : null;
    const tog = (k, lab) => [lab, uiWeekView[k], () => { uiWeekView[k] = !uiWeekView[k]; uiWeekSave(); }];
    c.appendChild(h('div', { class: 'ui-head ui-wk-head' },
      h('h1', { class: 'ui-title ui-sr', text: 'Woche' }), semSel, modeSel,
      h('div', { class: 'ui-wk-figs' }, h('span', { class: 'ui-wk-ects', text: W.figures.ects + ' ECTS' }), h('span', { class: 'ui-wk-work', text: uiFmt.num(W.figures.work, 1) + ' h Arbeit' }),
        h('span', { class: 'ui-wk-free', text: uiFmt.num(W.figures.free, 1) + ' h frei' })),
      !W.pub ? h('span', { class: 'ui-tag', text: 'Zeiten: Vorjahr' }) : null,
      h('div', { class: 'ui-head-x' },
        h('button', { class: 'ui-btn', type: 'button', 'aria-haspopup': 'true', onclick: e => uiFilterPop(e.currentTarget, 'Anzeige', () => [tog('alt', 'Alternativen zeigen'), tog('hid', 'Ausgeblendete zeigen'), tog('cf', 'nur Überschneidungen'), tog('list', 'Liste')]) }, 'Anzeige ▾'),
        h('button', { class: 'ui-btn ui-btn-primary', type: 'button', onclick: () => uiBlockForm(null, { wd: uiWeekDay || 1 }) }, '＋ Termin'))));
    const phone = window.innerWidth < 720;
    const td = new Date().getDay(); if (!uiWeekDay) uiWeekDay = td >= 1 && td <= 5 ? td : 1;
    if (!W.days.some(d => d.wd === uiWeekDay)) uiWeekDay = 1;
    const dayObj = d => ({ wd: d.wd, clash: d.clash,
      title: h('b', { text: UI_WD[d.wd] }),
      sub: d.label || d.detail ? h('button', { class: 'ui-tg-sum', type: 'button', 'aria-expanded': 'false', onclick: e => { const b = e.currentTarget; const o = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(o)); b.textContent = o ? [d.label, d.detail, uiFmt.num(d.free / 60, 1) + ' h frei'].filter(Boolean).join(' · ') : (d.label || d.detail); } }, d.label || d.detail) : null,
      items: d.items.filter(uiWeekShow).map(it => ({ a: it.a, b: it.b, travel: it.kind === 'travel', node: uiEvNode(it, s) })) });
    const draw = (body, wd, lo) => {
      if (phone || !(window.matchMedia && matchMedia('(pointer: fine)').matches)) return;
      body.addEventListener('pointerdown', e => {
        if (e.target !== body && !e.target.classList.contains('ui-tg-line')) return;
        const r0 = body.getBoundingClientRect(), m = y => Math.round((lo + (y - r0.top) / UI_HOUR * 60) / 15) * 15, a = m(e.clientY);
        const ghost = h('div', { class: 'ui-ev ui-ev-own ui-ev-draw', style: { top: (a - lo) / 60 * UI_HOUR + 'px', height: '4px', left: '2px', width: 'calc(100% - 4px)' } }); body.appendChild(ghost);
        let b = a;
        const mv = ev => { b = Math.max(a + 15, m(ev.clientY)); ghost.style.height = (b - a) / 60 * UI_HOUR + 'px'; };
        const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); ghost.remove(); if (b - a >= 30) uiBlockForm(null, { wd, v: uiFmt.time(a), b: uiFmt.time(b) }); };
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
      });
    };
    if (phone) {
      c.appendChild(h('div', { class: 'ui-seg ui-wk-days', role: 'tablist', 'aria-label': 'Tag' }, W.days.map(d => h('button', { class: (d.wd === uiWeekDay ? 'ui-on' : '') + (d.clash ? ' ui-dayclash' : ''), type: 'button', role: 'tab', 'aria-selected': String(d.wd === uiWeekDay),
        onclick: () => { uiWeekDay = d.wd; uiRender(true); } }, UI_WD[d.wd]))));
      const D = W.days.find(d => d.wd === uiWeekDay), o = dayObj(D);
      let el;
      if (uiWeekView.list) el = h('div', { class: 'ui-agenda' }, h('div', { class: 'ui-tg-head' }, o.title, o.sub), D.items.filter(uiWeekShow).filter(it => it.kind !== 'travel').sort((x, y) => x.a - y.a).map(it => h('div', { class: 'ui-agenda-row' },
        h('span', { class: 'ui-agenda-t', text: uiFmt.time(it.a) + '–' + uiFmt.time(it.b) }), uiEvNode(it, s))), !D.items.length ? h('p', { class: 'ui-empty', text: 'Keine Termine.' }) : null);
      else el = uiTimeGrid([o], { onDraw: draw });
      const wrap = h('div', { class: 'ui-wk-grid' }, el);
      const step = d => { const i = W.days.indexOf(D), j = i + d; if (j >= 0 && j < W.days.length) { uiWeekDay = W.days[j].wd; uiRender(true); } };
      uiSwipe(wrap, () => step(1), () => step(-1));
      c.appendChild(wrap);
    } else c.appendChild(h('div', { class: 'ui-wk-grid' }, uiTimeGrid(W.days.map(dayObj), { onDraw: draw })));
    if (W.untimed.length) c.appendChild(h('div', { class: 'ui-wk-untimed' }, h('span', { class: 'ui-meta', text: 'Ohne Zeit' }),
      W.untimed.map(u => h('button', { class: 'ui-chip ui-untimed', type: 'button', onclick: () => uiOpenModule(u.code) }, h('b', { text: u.code + ' ' + u.name }), h('span', { class: 'ui-meta', text: ' · ' + u.tag })))));
    const iss = W.issues.filter(i => !i.hidden);
    c.appendChild(h('details', { class: 'ui-wk-cf', open: iss.length > 0 && iss.length <= 6 }, h('summary', { class: 'ui-h2', text: 'Überschneidungen in dieser Woche (' + iss.length + ')' }),
      h('div', { class: 'ui-issues' }, iss.map(uiIssueCard), !iss.length ? h('p', { class: 'ui-meta', text: 'Keine.' }) : null)));
  }
};
/* own appointment form (new or edit) */
function uiBlockForm(i, preset) {
  const B = i != null ? PL.settings().blocks[i] : null, v = Object.assign({ l: '', wd: 1, v: '08:00', b: '12:00', sems: [] }, B || {}, preset || {});
  const l = h('input', { type: 'text', value: v.l, placeholder: 'z. B. Arbeit', 'aria-label': 'Bezeichnung' });
  const wd = h('select', { 'aria-label': 'Tag' }, [1, 2, 3, 4, 5, 6].map(d => h('option', { value: String(d), selected: +v.wd === d }, UI_WD[d])));
  const a = h('input', { type: 'time', value: v.v, 'aria-label': 'von' }), b = h('input', { type: 'time', value: v.b, 'aria-label': 'bis' });
  const sems = new Set(v.sems || []);
  const semRow = h('div', { class: 'ui-row' }, [1, 2, 3, 4].map(s => { const btn = h('button', { class: 'ui-chip' + (sems.has(s) ? ' ui-on' : ''), type: 'button', 'aria-pressed': String(sems.has(s)),
    onclick: () => { if (sems.has(s)) sems.delete(s); else sems.add(s); btn.classList.toggle('ui-on'); btn.setAttribute('aria-pressed', String(sems.has(s))); } }, s + '.'); return btn; }));
  const err = h('p', { class: 'ui-err' });
  const body = h('div', { class: 'ui-blockform' },
    h('label', { class: 'ui-field' }, h('span', { text: 'Bezeichnung' }), l),
    h('div', { class: 'ui-row' }, h('label', { class: 'ui-field' }, h('span', { text: 'Tag' }), wd), h('label', { class: 'ui-field' }, h('span', { text: 'von' }), a), h('label', { class: 'ui-field' }, h('span', { text: 'bis' }), b)),
    h('div', { class: 'ui-field' }, h('span', { text: 'Semester (keins gewählt: alle)' }), semRow), err,
    h('div', { class: 'ui-actions' },
      B ? h('button', { class: 'ui-btn ui-btn-danger', type: 'button', onclick: async () => { close(); if (await uiConfirm('Termin „' + B.l + '“ löschen?', 'Löschen')) PL.removeBlock(i); } }, 'Löschen') : null,
      h('button', { class: 'ui-btn ui-btn-primary ui-block-save', type: 'button', onclick: () => {
        if (!a.value || !b.value || b.value <= a.value) { err.textContent = 'Ende muss nach dem Beginn liegen.'; return; }
        const o = { l: l.value, wd: +wd.value, v: a.value, b: b.value, sems: [...sems].sort() };
        if (B) PL.editBlock(i, Object.assign({}, B, o, { loc: B.loc })); else PL.addBlock(o); close(); } }, 'Speichern')));
  const close = uiSheet(B ? 'Termin bearbeiten' : 'Neuer Termin', body, { kind: 'dialog' });
}
