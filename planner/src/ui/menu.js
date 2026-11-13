/* UI rework: Menü (⋯): Sync, export, import, data update, settings, help, old view. Sync status icon, first-open disclaimer. */
const UI_DISC = 'Ohne Gewähr: Alle Angaben können falsch oder veraltet sein. Prüfe alles selbst in TUMonline und in der SPO.';
const UI_SYNC_TXT = { off: 'Sync aus', ok: 'synchronisiert', busy: 'synchronisiert gerade', pending: 'Änderungen warten', err: 'Sync-Fehler', choose: 'Sync: Auswahl nötig' };
function uiMenuOpen(anchor) {
  const d = PL.dataDate();
  uiMenuSheet('Menü', [
    ['Sync', () => PL.openSync()],
    ['Plan exportieren', () => uiExport()],
    ['Plan importieren', () => uiImportPick()],
    ['Moduldaten aktualisieren' + (d ? ' (Stand: ' + uiFmt.dateY(d) + ')' : ''), () => PL.openUpdate()],
    ['Einstellungen', () => uiSettings()],
    ['Hilfe', () => uiHelpSheet()],
    ['Alte Ansicht', () => uiSetMode('old')]
  ], anchor);
}
async function uiExport() {
  const t = await PL.exportText(); if (!t) return;
  const a = h('a', { href: URL.createObjectURL(new Blob([t.replace(/\r?\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' })), download: 'Modulplan.txt' });
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function uiImportPick() {
  const f = h('input', { type: 'file', accept: '.txt,.md,text/plain', class: 'ui-sr', 'aria-label': 'Plan-Datei wählen' });
  f.addEventListener('change', () => { const file = f.files && f.files[0]; f.remove(); if (!file) return; const r = new FileReader(); r.onload = () => uiImportPreview(String(r.result || ''), file.name); r.readAsText(file, 'utf-8'); });
  uiSheetRoot().appendChild(f); f.click();
}
function uiImportPreview(text, name) {
  const P = PL.importPreview(text), empty = !PL.semesters().some(S => S.cards.length);
  let close;
  const go = how => { close(); PL.importApply(text, how); };
  const body = h('div', { class: 'ui-imp' },
    h('p', { class: 'ui-meta', text: name || '' }),
    P.modules ? h('p', null, h('b', { text: P.modules + ' Module' }), ', ' + P.ects + ' ECTS. ' + [1, 2, 3, 4].map(s => s + '. Sem: ' + P.perSem[s]).join(' · ') + (P.perSem[0] ? ' · ohne Semester: ' + P.perSem[0] : ''))
      : h('p', { text: 'Keine Module in der Datei erkannt.' }),
    P.unknown.length ? h('p', { class: 'ui-meta', text: 'Unbekannt: ' + P.unknown.join(', ') }) : null,
    P.notes.length ? h('ul', { class: 'ui-list ui-meta' }, P.notes.slice(0, 12).map(n => h('li', { text: n }))) : null,
    P.modules ? h('div', { class: 'ui-actions' }, empty
      ? h('button', { class: 'ui-btn ui-btn-primary', type: 'button', onclick: () => go('replace') }, 'Importieren')
      : [h('button', { class: 'ui-btn', type: 'button', onclick: () => go('merge') }, 'Zusammenführen'), h('button', { class: 'ui-btn ui-btn-primary', type: 'button', onclick: () => go('replace') }, 'Aktuellen Plan ersetzen')]) : null);
  close = uiSheet('Plan importieren', body, { kind: 'dialog' });
}
function uiSettings() {
  const body = h('div', { class: 'ui-settings' });
  const draw = () => {
    const S = PL.settings(); body.innerHTML = '';
    const year = h('input', { type: 'number', min: '2020', max: '2040', value: String(S.startYear), 'aria-label': 'Jahr', onchange: e => { PL.setStart(null, +e.target.value); draw(); } });
    body.append(
      h('h3', { class: 'ui-h3', text: 'Startsemester' }),
      h('div', { class: 'ui-row' }, h('select', { 'aria-label': 'Startsemester', onchange: e => { PL.setStart(e.target.value, null); draw(); } },
        [['W', 'Wintersemester'], ['S', 'Sommersemester']].map(([v, l]) => h('option', { value: v, selected: S.startSem === v }, l))), year),
      h('h3', { class: 'ui-h3', text: 'Arbeitsziel' }),
      h('label', { class: 'ui-row' }, h('input', { type: 'number', min: '0', max: '40', step: '0.5', class: 'ui-workgoal', value: String(S.workGoal), 'aria-label': 'Arbeitsziel Stunden pro Woche', onchange: e => PL.setWorkGoal(+e.target.value) }), 'h pro Woche'),
      h('h3', { class: 'ui-h3', text: 'Fahrzeiten' }),
      h('div', { class: 'ui-travel' }, S.travel.map(t => h('label', { class: 'ui-trow' }, h('span', { text: t.a + ' ↔ ' + t.b }),
        h('span', { class: 'ui-row' }, h('input', { type: 'number', min: '0', max: '240', value: t.min == null ? '' : String(t.min), 'aria-label': 'Minuten ' + t.a + ' ' + t.b, onchange: e => PL.setTravel(t.a, t.b, e.target.value) }), 'min')))),
      h('h3', { class: 'ui-h3', text: 'Eigene Termine' }),
      S.blocks.length ? h('div', { class: 'ui-blocks' }, S.blocks.map(b => h('div', { class: 'ui-trow' },
        h('span', { text: b.l + ' · ' + UI_WD[b.wd] + ' ' + b.v + '–' + b.b + (b.sems && b.sems.length ? ' · Sem ' + b.sems.join(', ') : '') }),
        h('span', { class: 'ui-row' }, h('button', { class: 'ui-btn', type: 'button', onclick: () => { close(); uiBlockForm(b.i); } }, 'Bearbeiten'),
          h('button', { class: 'ui-btn ui-btn-danger', type: 'button', onclick: async () => { if (await uiConfirm('Termin „' + b.l + '“ löschen?', 'Löschen')) { PL.removeBlock(b.i); draw(); } } }, 'Löschen')))))
        : h('p', { class: 'ui-meta', text: 'Keine eigenen Termine.' }),
      h('button', { class: 'ui-btn', type: 'button', onclick: () => { close(); uiBlockForm(null); } }, '＋ Termin'));
  };
  draw();
  const close = uiSheet('Einstellungen', body, { kind: 'dialog' });
}
function uiSyncIcon() {
  const st = PL.syncStatus();
  return h('button', { class: 'ui-sync ui-sync-' + st, type: 'button', 'aria-label': 'Sync: ' + (UI_SYNC_TXT[st] || st), title: UI_SYNC_TXT[st] || st, onclick: () => PL.openSync() },
    uiIcon('cloud', 22), h('span', { class: 'ui-sync-t', text: UI_SYNC_TXT[st] || st }));
}
function uiSyncPaint() {
  if (!uiEl) return;
  const st = PL.syncStatus();
  uiEl.querySelectorAll('.ui-nav-foot, .ui-top-sync').forEach(x => { const b = x.firstChild; if (b && b.classList.contains('ui-sync-' + st)) return; x.innerHTML = ''; x.appendChild(uiSyncIcon()); });
}
function uiDisclaimer(ui) {
  let seen = false; try { seen = localStorage.getItem('tum-ui-disc') === '1'; } catch (e) {}
  const slot = ui.querySelector('.ui-discslot'); if (seen || !slot) return;
  slot.appendChild(h('div', { class: 'ui-disc', role: 'note' }, h('span', { text: UI_DISC }),
    h('button', { class: 'ui-btn', type: 'button', onclick: () => { try { localStorage.setItem('tum-ui-disc', '1'); } catch (e) {} slot.innerHTML = ''; } }, 'Verstanden')));
}
function uiInitExtras(ui) {
  uiDisclaimer(ui);
  setTimeout(uiSyncPaint, 0);
  setInterval(uiSyncPaint, 2000);
}
function uiAfterRender() { uiSyncPaint(); }
