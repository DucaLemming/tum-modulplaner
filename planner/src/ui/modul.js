/* UI rework: Modul (detail panel). The only place where a module's state is edited. */
const UI_ST_LABEL = { vor: 'Vor Ort', onl: 'Online', rec: 'Aufzeichnung', skip: 'Nicht', done: 'Erledigt' };
const UI_VAR_LABEL = { block: 'Block', woche: 'semesterbegleitend' };
const uiModulOpen = {};
const UI_DESC = [['lern', 'Lernergebnisse'], ['inhalt', 'Inhalt'], ['pruef', 'Prüfungsform'], ['lehr', 'Lehrmethoden'], ['medien', 'Medien'], ['lit', 'Literatur'], ['h', 'Stunden'], ['verantw', 'Verantwortlich']];
function uiSwitch(on, label, f) {
  return h('button', { class: 'ui-switch' + (on ? ' ui-on' : ''), type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': label, onclick: () => f(!on) }, h('span', { class: 'ui-switch-k' }));
}
function uiHelp(text, label) {
  return h('button', { class: 'ui-help', type: 'button', 'aria-label': 'Hilfe: ' + (label || ''), onclick: e => uiSheet(label || 'Hilfe', h('p', { text }), { kind: 'popover', anchor: e.currentTarget }) }, '?');
}
function uiSec(code, id, title, open, body, badge) {
  const k = code + '|' + id, isOpen = k in uiModulOpen ? uiModulOpen[k] : open;
  const d = h('details', { class: 'ui-sec', 'data-sec': id, open: isOpen }, h('summary', { class: 'ui-sec-h' }, h('span', { text: title }), badge ? h('span', { class: 'ui-tag', text: badge }) : null), h('div', { class: 'ui-sec-b' }, body));
  d.addEventListener('toggle', () => { uiModulOpen[k] = d.open; });
  return d;
}
function uiHasOwn(m) { return m.events.some(e => e.status !== e.def || e.mand || e.ovr) || m.exams.some(x => x.own || x.changed); }
function uiModulPlanBlock(m) {
  const S = m.state, c = m.code, rows = [];
  const row = (lab, ctl, help) => h('div', { class: 'ui-prow' }, h('span', { class: 'ui-prow-l' }, lab, help || null), h('div', { class: 'ui-prow-c' }, ctl));
  rows.push(row('Im Plan', uiSwitch(S.inPlan, 'Im Plan', async on => {
    if (!on && uiHasOwn(m) && !(await uiConfirm(c + ' aus dem Plan nehmen? Eigene Einstellungen (Teilnahme, Prüfungstermine) bleiben gespeichert.', 'Aus Plan entfernen'))) return;
    PL.setInPlan(c, on);
  })));
  if (S.inPlan) {
    if (S.brackets.length > 1) rows.push(row('Zählt für', h('select', { class: 'ui-sel-br', 'aria-label': 'Zählt für', onchange: e => PL.setBracket(c, e.target.value) },
      S.brackets.map(b => h('option', { value: b, selected: b === S.bracket }, PL.label(b))))));
    rows.push(row('Semester', h('div', { class: 'ui-seg ui-seg-sem', role: 'group', 'aria-label': 'Semester' },
      [1, 2, 3, 4].map(s => h('button', { class: S.sem === s ? 'ui-on' : '', type: 'button', 'aria-pressed': String(S.sem === s), onclick: () => PL.setSemester(c, s) }, String(s))),
      h('button', { class: !S.sem ? 'ui-on' : '', type: 'button', 'aria-pressed': String(!S.sem), onclick: () => PL.setSemester(c, 0) }, 'offen'))));
    rows.push(row('Status', h('select', { class: 'ui-sel-status', 'aria-label': 'Status', disabled: S.cat === 'x', onchange: e => PL.setStatus(c, e.target.value) },
      [['count', 'Zählt'], ['optional', 'Optional'], ['done', 'Abgeschlossen']].map(([v, l]) => h('option', { value: v, selected: S.status === v }, l)))));
    if (S.seat !== null) rows.push(row('Platz', h('div', { class: 'ui-seg ui-seg-seat', role: 'group', 'aria-label': 'Platz' },
      [['open', 'offen'], ['got', 'erhalten']].map(([v, l]) => h('button', { class: S.seat === v ? 'ui-on' : '', type: 'button', 'aria-pressed': String(S.seat === v), onclick: () => PL.setSeat(c, v) }, l)))));
    rows.push(row('Wenig Aufwand', uiSwitch(S.easy, 'Wenig Aufwand', on => PL.setEasy(c, on)),
      uiHelp('Für Module, die du nur nebenbei machst: Übungen und Tutorien zählen nicht für Überschneidungen und Aufwand.', 'Wenig Aufwand')));
  }
  return h('section', { class: 'ui-plan-block' }, rows, h('p', { class: 'ui-result', text: S.result }));
}
function uiEventsBlock(m) {
  const c = m.code, by = {};
  m.events.forEach(e => (by[e.t] = by[e.t] || []).push(e));
  const blocks = Object.keys(by).map(t => {
    const L = by[t], gks = [...new Set(L.map(e => e.gk).filter(Boolean))];
    const vr = m.variants.find(v => v.t === t);
    return h('div', { class: 'ui-evtype' },
      h('div', { class: 'ui-evtype-h' }, h('b', { text: t }), L.some(e => e.n && e.n !== m.name) ? h('span', { class: 'ui-meta ui-ellip', text: L[0].n }) : null),
      vr ? h('div', { class: 'ui-seg ui-seg-var', role: 'group', 'aria-label': 'Variante ' + t }, vr.options.map(o => h('button', { class: vr.chosen === o ? 'ui-on' : '', type: 'button', onclick: () => PL.setVariant(c, vr.chosen === o ? null : o, t) }, UI_VAR_LABEL[o] || o))) : null,
      gks.map(gk => { const G = m.groups[gk]; if (!G || G.names.length < 2) return null;
        return h('div', { class: 'ui-grp', role: 'radiogroup', 'aria-label': 'Gruppe' }, G.names.map(n => h('button', { class: 'ui-grp-o' + (G.chosen.includes(n) ? ' ui-on' : ''), type: 'button', role: 'radio', 'aria-checked': String(G.chosen.includes(n)),
          onclick: () => PL.setGroup(c, gk, [n]) }, h('span', { class: 'ui-radio', 'aria-hidden': 'true' }), n))); }),
      L.map(e => h('button', { class: 'ui-evrow' + (e.chosen ? '' : ' ui-off'), type: 'button', 'data-key': e.key,
        onclick: ev => { if (typeof uiEventSheet === 'function') uiEventSheet(c, e.key, ev.currentTarget); } },
        h('span', { class: 'ui-evrow-t', text: e.wd ? uiFmt.wd(e.wd) + ' ' + e.v + (e.b ? '–' + e.b : '') : 'ohne Zeit' }),
        h('span', { class: 'ui-evrow-r ui-meta', text: [e.grp, e.one && e.d ? 'einmalig ' + uiFmt.date(e.d) : '', e.room].filter(Boolean).join(' · ') }),
        h('span', { class: 'ui-evrow-tags' }, e.vj ? h('span', { class: 'ui-tag', text: 'Vorjahr' }) : null, e.mand ? h('span', { title: 'Pflicht', text: '❗' }) : null,
          h('span', { class: 'ui-chip ui-chip-static ui-st-' + e.status + (e.status !== e.def ? ' ui-on' : ''), text: UI_ST_LABEL[e.status] || e.status })))));
  });
  return h('div', { class: 'ui-events' }, m.vj ? h('p', { class: 'ui-meta' }, h('span', { class: 'ui-tag', text: 'Vorjahr' }), ' ' + m.termLabel + ' noch nicht veröffentlicht, Zeiten aus dem Vorjahr.') : null,
    blocks.length ? blocks : h('p', { class: 'ui-meta', text: 'Keine Termine bekannt.' }));
}
function uiLimBlock(m) {
  const L = m.lim;
  return h('div', { class: 'ui-lim' },
    h('p', null, h('b', { text: '🔒 ' + L.short })), h('p', { class: 'ui-meta', text: L.reg }),
    L.groups ? h('p', { class: 'ui-meta ui-wrap', text: L.groups }) : null,
    L.at ? h('p', { class: 'ui-meta', text: 'Stand ' + uiFmt.dateY(L.at) }) : null,
    h('button', { class: 'ui-linkbtn', type: 'button', onclick: e => { const p = e.currentTarget.closest('.ui-panel-body'); if (p) p.scrollTop = 0; } }, 'Status ändern ↑'));
}
function uiExamForm(c, x) {
  const v = x || {}, f = h('div', { class: 'ui-exform' });
  const d = h('input', { type: 'date', value: (v.d || '').slice(0, 10), 'aria-label': 'Datum' }), a = h('input', { type: 'time', value: v.v || '', 'aria-label': 'Beginn' }),
    b = h('input', { type: 'time', value: v.b || '', 'aria-label': 'Ende' }), r = h('input', { type: 'text', value: '', placeholder: 'Raum / Ort', 'aria-label': 'Raum' }),
    re = h('input', { type: 'checkbox', checked: !!(x && x.retake) }), err = h('p', { class: 'ui-err' });
  f.append(h('div', { class: 'ui-row' }, d, a, '–', b), r, x ? null : h('label', { class: 'ui-row' }, re, 'Wiederholung'), err,
    h('div', { class: 'ui-actions' }, h('button', { class: 'ui-btn ui-btn-primary', type: 'button', onclick: () => {
      const msg = PL.examSave(c, x ? x.key : null, { d: d.value, v: a.value, b: b.value, room: r.value, re: re.checked }); if (msg) err.textContent = msg; else close(); } }, 'Speichern')));
  const close = uiSheet(x ? 'Prüfungstermin ändern' : 'Prüfungstermin hinzufügen', f, { kind: 'dialog' });
}
function uiExamBlock(m) {
  const c = m.code;
  return h('div', { class: 'ui-exams' }, m.exams.length ? m.exams.map(x => h('div', { class: 'ui-exrow' },
    h('div', { class: 'ui-exrow-m' }, h('b', { text: x.d ? uiFmt.dateY(x.d) : 'ohne Datum' }), ' ' + (x.v || '') + (x.b ? '–' + x.b : ''),
      x.retake ? h('span', { class: 'ui-tag', text: 'Wiederholung' }) : null, x.own ? h('span', { class: 'ui-tag', text: 'eigener Termin' }) : x.changed ? h('span', { class: 'ui-tag', text: 'geändert' }) : null,
      h('div', { class: 'ui-meta', text: [x.room, x.reg ? 'Anmeldung ' + x.reg : ''].filter(Boolean).join(' · ') })),
    h('div', { class: 'ui-exrow-a' },
      h('button', { class: 'ui-btn', type: 'button', onclick: () => uiExamForm(c, x) }, '✎'),
      h('button', { class: 'ui-btn' + (x.retake ? ' ui-btn-on' : ''), type: 'button', 'aria-pressed': String(x.retake), onclick: () => PL.examRetake(c, x.key, !x.retake) }, 'Wiederholung'),
      x.own || x.changed ? h('button', { class: 'ui-btn', type: 'button', onclick: () => PL.examReset(c, x.key) }, x.own ? 'Entfernen' : 'Zurücksetzen') : null)))
    : h('p', { class: 'ui-meta', text: m.exs || 'Kein Prüfungstermin bekannt.' }),
    h('button', { class: 'ui-btn', type: 'button', onclick: () => uiExamForm(c, null) }, '＋ Termin'));
}
function uiAltBlock(m) {
  const c = m.code, A = m.alt, S = m.state, out = [];
  if (A) {
    out.push(h('p', { class: 'ui-meta', text: 'Nur eines dieser Module zählt (Rang 1).' }));
    A.codes.forEach((x, i) => out.push(h('div', { class: 'ui-altrow' + (x === c ? ' ui-cur' : '') },
      h('span', { class: 'ui-altrank', text: (i + 1) + '.' }), h('button', { class: 'ui-linkbtn ui-ellip', type: 'button', onclick: () => uiOpenModule(x) }, x + ' ' + (PL.module(x) || {}).name),
      h('button', { class: 'ui-iconbtn', type: 'button', 'aria-label': 'nach oben', disabled: i === 0, onclick: () => PL.rankAlternative(x, -1) }, '↑'),
      h('button', { class: 'ui-iconbtn', type: 'button', 'aria-label': 'nach unten', disabled: i === A.codes.length - 1, onclick: () => PL.rankAlternative(x, 1) }, '↓'))));
    out.push(h('div', { class: 'ui-row' },
      typeof uiCompareSheet === 'function' ? h('button', { class: 'ui-btn', type: 'button', onclick: () => uiCompareSheet(A.group) }, 'Vergleichen') : null,
      h('button', { class: 'ui-btn ui-btn-primary', type: 'button', onclick: async () => { if (await uiConfirm(c + ' behalten, die anderen Module aus dem Plan entfernen?', 'Dafür entscheiden')) PL.decide(c); } }, 'Dafür entscheiden'),
      h('button', { class: 'ui-btn', type: 'button', onclick: () => PL.unlinkAlternative(c) }, 'Aus Gruppe lösen')));
  }
  const others = PL.modules().filter(x => x.inPlan && x.code !== c && !(A && A.codes.includes(x.code)));
  if (S.inPlan && others.length) out.push(h('label', { class: 'ui-field' }, h('span', { text: 'Alternative zu …' }),
    h('select', { 'aria-label': 'Alternative zu', onchange: e => { if (e.target.value) PL.linkAlternative(c, e.target.value); } },
      h('option', { value: '' }, 'Modul wählen'), others.map(x => h('option', { value: x.code }, x.code + ' ' + x.name)))));
  if (S.inPlan && S.sem) out.push(h('div', { class: 'ui-fallback' }, h('span', { class: 'ui-meta', text: 'Ausweichsemester' }),
    h('div', { class: 'ui-row' }, [1, 2, 3, 4].filter(s => s !== S.sem).map(s => { const on = m.fallbacks.includes(s);
      return h('button', { class: 'ui-chip' + (on ? ' ui-on' : ''), type: 'button', 'aria-pressed': String(on),
        onclick: () => PL.setFallbacks(c, on ? m.fallbacks.filter(x => x !== s) : m.fallbacks.concat([s]).sort()) }, 'sonst ' + s + '.'); }))));
  if (!out.length) out.push(h('p', { class: 'ui-meta', text: 'Erst in den Plan aufnehmen.' }));
  return h('div', { class: 'ui-alt' }, out);
}
function uiPreBlock(m) {
  const mine = m.state.sem || 0;
  const item = x => { const o = PL.module(x); if (!o) return null; const ok = o.state.inPlan && o.state.sem && (!mine || o.state.sem < mine);
    return h('li', null, h('button', { class: 'ui-linkbtn', type: 'button', onclick: () => uiOpenModule(x) }, x + ' ' + o.name), ok ? h('span', { class: 'ui-st-ok', text: ' ✓' }) : null); };
  return h('div', { class: 'ui-pre' },
    h('h3', { class: 'ui-h3', text: 'Vorher empfohlen' }), m.before.length ? h('ul', { class: 'ui-list' }, m.before.map(item)) : h('p', { class: 'ui-meta', text: 'keine' }),
    h('h3', { class: 'ui-h3', text: 'Wird empfohlen für' }), m.after.length ? h('ul', { class: 'ui-list' }, m.after.map(item)) : h('p', { class: 'ui-meta', text: 'keine' }));
}
function uiDescBlock(m) {
  const R = UI_DESC.map(([k, lab]) => { let v = m.m[k]; if (v == null || String(v).trim() === '') return null; if (Array.isArray(v)) v = v.filter(x => x != null).join(' / ');
    return h('details', { class: 'ui-acc' }, h('summary', { text: lab }), h('div', { class: 'ui-wrap ui-desc', text: String(v) })); }).filter(Boolean);
  return h('div', { class: 'ui-descs' }, R.length ? R : h('p', { class: 'ui-meta', text: 'Keine Beschreibung.' }));
}
uiScreens.modul = {
  render(c, code) {
    const m = PL.module(code);
    if (!m) { c.appendChild(h('div', { class: 'ui-modul' }, h('p', { class: 'ui-empty', text: 'Modul nicht gefunden.' }))); return; }
    const S = m.state, root = h('div', { class: 'ui-modul' });
    [
      h('div', { class: 'ui-mhead' },
        h('h2', { class: 'ui-mname', text: m.name }),
        h('div', { class: 'ui-row ui-mchips' },
          h('span', { class: 'ui-tag', text: m.ects + ' ECTS' }),
          h('span', { class: 'ui-tag' }, h('span', { class: 'ui-dot', style: { background: m.color } }), PL.label(S.bracket)),
          m.turn ? h('span', { class: 'ui-tag', text: m.turn === 'W+S' ? 'Winter und Sommer' : m.turn === 'W' ? 'Winter' : 'Sommer' }) : null,
          m.lang ? h('span', { class: 'ui-tag', text: m.lang }) : null, m.camp ? h('span', { class: 'ui-tag', text: m.camp }) : null,
          m.neu ? h('span', { class: 'ui-tag', text: 'neu' }) : null, m.eth ? h('span', { class: 'ui-tag', text: 'Ethik' }) : null,
          m.link ? h('a', { class: 'ui-linkbtn', href: m.link, target: '_blank', rel: 'noopener' }, 'TUMonline ↗') : null),
        m.dep ? h('p', { class: 'ui-banner', text: 'Angebot: ' + m.dep }) : null),
      uiModulPlanBlock(m),
      uiSec(code, 'termine', 'Termine (' + m.events.length + ')', S.inPlan, uiEventsBlock(m)),
      m.lim ? uiSec(code, 'platz', 'Platz & Anmeldung', S.seat === 'open', uiLimBlock(m)) : null,
      uiSec(code, 'pruefung', 'Prüfung', false, uiExamBlock(m)),
      uiSec(code, 'alt', 'Alternativen & Ausweichsemester', false, uiAltBlock(m), m.alt || m.fallbacks.length ? 'genutzt' : null),
      uiSec(code, 'pre', 'Voraussetzungen', false, uiPreBlock(m)),
      uiSec(code, 'beschreibung', 'Beschreibung', false, uiDescBlock(m)),
      !S.inPlan ? h('section', { class: 'ui-nogo' }, S.nogo
        ? h('div', { class: 'ui-row' }, h('span', { text: '⛔ Nicht für mich' + (S.nogoReason ? ': ' + S.nogoReason : '') }), h('button', { class: 'ui-btn', type: 'button', onclick: () => PL.exclude(code, false) }, 'Zurücknehmen'))
        : (() => { const r = h('input', { type: 'text', placeholder: 'Grund (optional)', 'aria-label': 'Grund' });
          return h('div', { class: 'ui-row' }, r, h('button', { class: 'ui-btn ui-btn-danger', type: 'button', onclick: () => PL.exclude(code, true, r.value.trim()) }, '⛔ Nicht für mich')); })()) : null].forEach(x => { if (x) root.appendChild(x); });
    c.appendChild(root);
  }
};
