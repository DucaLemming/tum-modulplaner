/* UI rework: event sheet (one event or series): attendance, group, mandatory, cancelled dates, own time, done. */
const UI_ATT = [['vor', 'Vor Ort'], ['onl', 'Online'], ['rec', 'Aufzeichnung'], ['skip', 'Nicht']];
function uiEventSheet(code, key, anchor) {
  const find = () => { const m = PL.module(code); return m && { m, e: m.events.find(x => x.key === key) }; };
  const F = find(); if (!F || !F.e) return;
  const body = h('div', { class: 'ui-evsheet' });
  let sub = '';
  const draw = () => {
    const G = find(); if (!G || !G.e) { close(); return; }
    const { m, e } = G; body.innerHTML = '';
    body.append(
      h('p', { class: 'ui-meta', text: [e.wd ? uiFmt.wd(e.wd) + ' ' + e.v + (e.b ? '–' + e.b : '') : 'ohne Zeit', e.room, e.grp].filter(Boolean).join(' · ') }),
      h('button', { class: 'ui-linkbtn', type: 'button', onclick: () => { close(); uiOpenModule(code); } }, 'Details zum Modul ›'),
      h('div', { class: 'ui-field' }, h('span', { text: 'Teilnahme' }),
        h('div', { class: 'ui-seg ui-att', role: 'group', 'aria-label': 'Teilnahme' }, UI_ATT.map(([v, l]) => h('button', { class: (e.status === v ? 'ui-on' : '') + (e.def === v ? ' ui-def' : ''), type: 'button', 'aria-pressed': String(e.status === v),
          onclick: () => { PL.setAttendance(code, key, e.status === v ? null : v); draw(); } }, l, e.def === v ? h('span', { class: 'ui-defdot', 'aria-label': '(Standard)', text: ' •' }) : null)))));
    const g = e.gk && m.groups[e.gk];
    if (g && g.names.length > 1) body.appendChild(h('div', { class: 'ui-field' }, h('span', { text: 'Gruppe' }),
      h('div', { class: 'ui-grp', role: 'radiogroup' }, g.names.map(n => h('button', { class: 'ui-grp-o' + (g.chosen.includes(n) ? ' ui-on' : ''), type: 'button', role: 'radio', 'aria-checked': String(g.chosen.includes(n)),
        onclick: () => { PL.setGroup(code, e.gk, [n]); draw(); } }, h('span', { class: 'ui-radio', 'aria-hidden': 'true' }), n)))));
    body.appendChild(h('div', { class: 'ui-row ui-evacts' },
      h('button', { class: 'ui-btn' + (e.mand ? ' ui-btn-on' : ''), type: 'button', 'aria-pressed': String(e.mand), onclick: () => { PL.toggleMandatory(code, key); draw(); } }, '❗ Pflicht'),
      e.dates.length ? h('button', { class: 'ui-btn' + (sub === 'ausf' ? ' ui-btn-on' : ''), type: 'button', onclick: () => { sub = sub === 'ausf' ? '' : 'ausf'; draw(); } }, '🚫 Fällt aus …') : null,
      h('button', { class: 'ui-btn' + (sub === 'ovr' || e.ovr ? ' ui-btn-on' : ''), type: 'button', onclick: () => { sub = sub === 'ovr' ? '' : 'ovr'; draw(); } }, '✎ Zeit/Raum'),
      h('button', { class: 'ui-btn' + (e.status === 'done' ? ' ui-btn-on' : ''), type: 'button', 'aria-pressed': String(e.status === 'done'), onclick: () => { PL.setAttendance(code, key, e.status === 'done' ? null : 'done'); draw(); } }, '✓ Erledigt')));
    if (sub === 'ausf') body.appendChild(h('div', { class: 'ui-dates' }, h('span', { class: 'ui-meta', text: 'Fällt aus am (antippen):' }),
      h('div', { class: 'ui-row' }, e.dates.map(d => h('button', { class: 'ui-chip' + (e.cancelled.includes(d) ? ' ui-on' : ''), type: 'button', 'aria-pressed': String(e.cancelled.includes(d)),
        onclick: () => { PL.toggleCancelled(code, key, d); draw(); } }, uiFmt.wd(new Date(d + 'T12:00:00').getDay()) + ' ' + uiFmt.date(d))))));
    if (sub === 'ovr') {
      const o = e.ovrO || {}, a = h('input', { type: 'time', value: o.v || e.v, 'aria-label': 'Beginn' }), b = h('input', { type: 'time', value: o.b || e.b, 'aria-label': 'Ende' }),
        r = h('input', { type: 'text', value: o.room || '', placeholder: 'Raum, z. B. MW 1801', 'aria-label': 'Raum' }), err = h('p', { class: 'ui-err' });
      body.appendChild(h('div', { class: 'ui-ovr' }, h('div', { class: 'ui-row' }, a, '–', b), r, err,
        h('p', { class: 'ui-meta', text: 'Gilt für alle Termine dieser Reihe.' }),
        h('div', { class: 'ui-row' },
          h('button', { class: 'ui-btn ui-btn-primary', type: 'button', onclick: () => { if (!a.value || !b.value || b.value <= a.value) { err.textContent = 'Ende muss nach dem Beginn liegen.'; return; }
            const n = { v: a.value, b: b.value }; if (r.value.trim()) n.room = r.value.trim(); if (o.camp) n.camp = o.camp; if (o.wd) n.wd = o.wd;
            PL.setOverride(code, key, n.v === e.v && n.b === e.b && !n.room && !n.camp && !n.wd ? null : n); sub = ''; draw(); } }, 'Speichern'),
          e.ovr ? h('button', { class: 'ui-btn', type: 'button', onclick: () => { PL.setOverride(code, key, null); sub = ''; draw(); } }, 'Zurücksetzen') : null)));
    }
  };
  draw();
  const close = uiSheet(code + ' ' + F.e.t, body, { kind: 'popover', anchor });
  return close;
}
