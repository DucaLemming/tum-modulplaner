/* Legend of every symbol, colour and border, one section per screen; the current screen comes first. */
const UI_LEGEND = {
  uebersicht: ['Übersicht', [['⚠ Regel', 'eine SPO-Regel ist noch offen oder verletzt'], ['⇄ Entscheidung', 'mehrere Module als Alternativen, nur eines zählt'], ['🔒 Anmeldung', 'begrenztes Modul, Platz noch nicht erhalten'],
    ['⚡ Überschneidung', 'zwei Termine oder Prüfungen zur selben Zeit'], ['🚆 Weg', 'Fahrzeit zwischen zwei Orten reicht nicht'], ['↕ Reihenfolge', 'Turnus passt nicht zum Semester oder Voraussetzung liegt später'],
    ['ⓘ Angebot', 'Modul wird vielleicht nicht mehr angeboten'], ['↻ Datenupdate', 'beim letzten Update hat sich etwas geändert'], ['roter linker Rand', 'Regel verletzt oder sichere Überschneidung'],
    ['Vorjahr', 'Zeiten aus dem Vorjahr, das Semester ist noch nicht veröffentlicht'], ['stabil 3/3', 'gleicher Wochentag und Beginn (bei Blöcken: gleiche Lage vor, in oder nach der Vorlesungszeit) in den letzten 3 Semestern derselben Art'], ['meist 2/3', 'in 2 von 3 Semestern gleich wie zuletzt'], ['wechselt', 'zuletzt anders als in den Semestern davor'], ['neu', 'erst ein Semester dieser Art bekannt'], ['unsicher', 'Überschneidung nur mit Vorjahreszeiten'], ['✓ / ⚠ bei Bereichen', 'erfüllt / über dem Maximum'],
    ['Balken oben', 'dunkel: sicher, gestreift: zählt, sobald der Platz da ist, Umriss: optional, schwarzer Strich: 120 ECTS']]],
  module: ['Module', [['● 2', 'im Plan, im 2. Semester (Farbe = Bereich)'], ['✓', 'schon im Plan'], ['＋', 'zum Plan hinzufügen'], ['W / S / W+S', 'Angebot im Winter, im Sommer, in beiden'],
    ['Zahl rechts', 'ECTS'], ['🔒', 'Teilnehmerzahl begrenzt'], ['neu', 'neu in den Moduldaten'], ['eingestellt?', 'wird vielleicht nicht mehr angeboten'], ['⛔', 'als „Nicht für mich“ markiert']]],
  plan: ['Plan', [['1 2 3 4 auf der Karte', 'grün: in diesem Semester angeboten (laut Terminen der letzten Jahre, nicht nur laut Turnus), gelb gestrichelt: unsicher (nur Turnus oder nur alte Termine), durchgestrichen: nicht angeboten; umrandet: aktuelles Semester'], ['beim Ziehen', 'Spalten färben sich grün, gelb oder grau, je nachdem ob das Modul dort angeboten wird'], ['farbiger linker Rand', 'Bereich, für den das Modul zählt'], ['blass und gestrichelter Rand', 'zählt nicht: optional oder Alternative'], ['optional, Alternative, abgeschlossen', 'Status des Moduls'],
    ['Platz offen', 'zählt erst, sobald du den Platz hast'], ['⚡ (rot umrandet)', 'das Modul hat eine Überschneidung oder einen Hinweis'], ['ECTS-Balken', 'dunkel: sicher, gestreift: Platz offen, Umriss: optional; Strich in der Mitte: 30 ECTS'],
    ['Aufwand-Balken', 'grün bis 30, gelb bis 36, rot darüber; blasser Teil: mit unsicheren Modulen']]],
  woche: ['Woche', [['Vor Ort', 'durchgezogener Rand'], ['Online', 'gestrichelter Rand und 💻'], ['Aufzeichnung, Nicht, Erledigt', 'blass, zählt nicht, ausgeblendet (sichtbar mit Anzeige > Ausgeblendete zeigen)'],
    ['Überschneidung', 'roter Rand und ⚡'], ['unsichere Überschneidung', 'gelber Rand (Vorjahreszeiten)'], ['3/3, 2/3, ≠, neu (bei Vorjahreszeiten)', 'wie oft der Termin in den letzten Semestern derselben Art gleich lag'], ['Pflicht', '❗'], ['optional, Alternative', 'schraffiert mit Etikett'], ['Eigener Termin', 'grau'],
    ['☕ Pause N min (in Arbeitsblöcken)', 'gesetzliche Pause (ArbZG): ab mehr als 6 h Arbeit 30 min, ab mehr als 9 h 45 min; Lücken ab 15 min zwischen Blöcken zählen mit; schraffierter Streifen = Vorschlag, wo sie liegt'], ['Fahrt', 'schmaler schraffierter Streifen links mit Minuten'], ['Punkt unter dem Tag (Handy)', 'an diesem Tag gibt es eine Überschneidung']]],
  pruefungen: ['Prüfungen', [['geschätzt', 'noch kein Termin, aus dem Vorjahr geschätzt'], ['↻ Wiederholung (gelb schraffiert)', 'Wiederholungsprüfung, zählt nicht für Überschneidungen'], ['⚡ Überschneidung', 'zwei Prüfungen zur selben Zeit'],
    ['gleicher Tag', 'zwei Prüfungen am selben Tag'], ['roter linker Rand', 'Überschneidung']]],
  modul: ['Modul', [['Teilnahme-Etikett hervorgehoben', 'von der Voreinstellung abweichend'], ['Vorjahr', 'Zeit aus dem Vorjahr'], ['stabil 3/3', 'gleicher Wochentag und Beginn (bei Blöcken: gleiche Lage vor, in oder nach der Vorlesungszeit) in den letzten 3 Semestern derselben Art'], ['meist 2/3', 'in 2 von 3 Semestern gleich wie zuletzt'], ['wechselt', 'zuletzt anders als in den Semestern davor'], ['neu', 'erst ein Semester dieser Art bekannt'], ['läuft in beiden', 'laut Turnus nur ein Semester, es gab aber Termine im Winter und im Sommer'], ['❗', 'Anwesenheitspflicht'], ['blasse Terminzeile', 'gehört zu einer nicht gewählten Gruppe']]],
  platz: ['Begrenzte Module', [['🔒 voll (rot)', 'alle Plätze im geplanten Semester vergeben'], ['🔒 teils voll (gelb)', 'einige Gruppen voll'], ['🔒 N von M frei (grün)', 'noch Plätze frei'],
    ['🔒 Platz erhalten', 'du hast den Platz'], ['🔒 Belegung unbekannt', 'TUMonline zeigt noch keine Belegung'], ['grau', 'Zahlen aus einem anderen Semester (meist Vorjahr)']]]
};
/* which legend sections can occur on which page */
const UI_LEGEND_FOR = { uebersicht: ['uebersicht', 'platz'], module: ['module', 'platz'], plan: ['plan', 'platz'], woche: ['woche'], pruefungen: ['pruefungen'], modul: ['modul', 'platz'] };
function uiLegendKey() { const r = uiRoute(); return r.module ? 'modul' : r.screen; }
function uiLegendBody(first) {
  const only = first ? UI_LEGEND_FOR[first] : null;
  const keys = only && only.length ? only : Object.keys(UI_LEGEND);
  const box = h('div', { class: 'ui-legenddoc' }, keys.map(k => [only ? (keys.length > 1 ? h('h3', { class: 'ui-h3', text: UI_LEGEND[k][0] }) : null) : h('h3', { class: 'ui-h3', text: UI_LEGEND[k][0] }),
    h('dl', { class: 'ui-legend' }, UI_LEGEND[k][1].map(([a, b]) => [h('dt', { text: a }), h('dd', { text: b })]))]));
  if (only && only.length) box.appendChild(h('button', { class: 'ui-linkbtn', type: 'button', onclick: () => { box.replaceWith(uiLegendBody('')); } }, 'Alle Zeichen anzeigen'));
  return box;
}
function uiLegend(anchor, first) {
  const k = first || uiLegendKey(), L = UI_LEGEND_FOR[k];
  const title = L && L.length ? 'Zeichen: ' + UI_LEGEND[L[0]][0] : 'Zeichen und Farben';
  uiSheet(title, uiLegendBody(L && L.length ? k : ''), { kind: 'dialog' });
}
function uiHelpBtn(first) { return h('button', { class: 'ui-iconbtn ui-help-btn', type: 'button', 'aria-label': 'Zeichen und Farben erklären', title: 'Zeichen und Farben', onclick: e => uiLegend(e.currentTarget, first) }, '?'); }

/* desktop: hover over a symbol or tag shows what it means, above the page content */
const UI_TIPS = {
  'optional': 'Steht im Plan, zählt aber nicht', 'Alternative': 'Von mehreren Modulen einer Entscheidung zählt nur das erste', 'Platz offen': 'Zählt erst, sobald du den Platz hast',
  'abgeschlossen': 'Schon bestanden', 'Vorjahr': 'Zeiten aus dem Vorjahr, das Semester ist noch nicht veröffentlicht', 'Zeiten: Vorjahr': 'Dieses Semester ist noch nicht veröffentlicht, die Zeiten stammen aus dem Vorjahr',
  'unsicher': 'Überschneidung nur mit Vorjahreszeiten', 'geschätzt': 'Noch kein Termin, aus dem Vorjahr geschätzt', '↻ Wiederholung': 'Wiederholungsprüfung, zählt nicht für Überschneidungen',
  'gleicher Tag': 'Zwei Prüfungen am selben Tag', '⚡ Überschneidung': 'Zwei Prüfungen zur selben Zeit', 'neu': 'Neu in den Moduldaten', 'eingestellt?': 'Wird vielleicht nicht mehr angeboten',
  'Block': 'Blockveranstaltung', 'Ethik': 'Zählt für die Ethik-Pflicht (Überfachliche Ergänzung)', 'eigener Termin': 'Von dir eingetragener Prüfungstermin', 'geändert': 'Von dir geänderter Prüfungstermin',
  'zählt vorerst': 'Zählt, solange die Entscheidung offen ist', 'genutzt': 'In diesem Abschnitt ist etwas eingestellt', '⚡': 'Überschneidung oder Hinweis zu diesem Modul',
  '⚠': 'Regel', '⇄': 'Entscheidung zwischen Alternativen', '🔒': 'Teilnehmerzahl begrenzt', '🚆': 'Fahrzeit reicht nicht', '↕': 'Reihenfolge: Turnus oder Voraussetzung', 'ⓘ': 'Angebot unsicher', '↻': 'Datenupdate',
  '✓': 'erfüllt', '⛔': 'Als „Nicht für mich“ markiert', '❗': 'Anwesenheitspflicht', '💻': 'Online', 'W': 'Nur im Wintersemester angeboten', 'S': 'Nur im Sommersemester angeboten', 'W+S': 'Im Winter und im Sommer angeboten',
  'Vor Ort': 'Du gehst hin (zählt für Überschneidungen und Wege)', 'Online': 'Du nimmst online teil', 'Aufzeichnung': 'Du schaust die Aufzeichnung (zählt nicht)', 'Nicht': 'Du gehst nicht hin (zählt nicht)', 'Erledigt': 'Schon erledigt (zählt nicht)'
};
const UI_SEAT_TIP = { full: 'Alle Plätze im geplanten Semester vergeben', part: 'Einige Gruppen sind voll', free: 'Noch Plätze frei', unknown: 'TUMonline zeigt noch keine Belegung', old: 'Zahlen aus einem anderen Semester, meist Vorjahr', got: 'Du hast den Platz' };
function uiTipText(el) {
  if (el.dataset.tip) return el.dataset.tip;
  const seat = [...el.classList].find(c => c.startsWith('ui-seat-'));
  if (seat) return UI_SEAT_TIP[seat.slice(8)] || '';
  if (el.title) return el.title;
  const t = (el.textContent || '').trim();
  if (UI_TIPS[t]) return UI_TIPS[t];
  const first = t.split(/\s+/)[0];
  return el.classList.contains('ui-issue-ic') || el.classList.contains('ui-bracket-st') ? (UI_TIPS[first] || '') : '';
}
const UI_TIP_SEL = '[data-tip], .ui-tag, .ui-issue-ic, .ui-bracket-st, .ui-planmark, .ui-mrow-turn, .ui-mrow-icons > span, .ui-evrow-tags > span, .ui-pcard-tags > span, .ui-ev-l1 .ui-ic';
function uiTipInit() {
  if (!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches)) return;
  let tip = null, cur = null;
  const hide = () => { if (tip) tip.remove(); tip = null; cur = null; };
  document.addEventListener('mouseover', e => {
    const el = e.target.closest && e.target.closest(UI_TIP_SEL);
    if (!el || !(el.closest('#ui') || el.closest('.ui-sheet-root'))) { if (cur && !(el && el === cur)) hide(); return; }
    if (el === cur) return;
    const txt = uiTipText(el); hide(); if (!txt) return;
    cur = el; if (el.title) { el.dataset.tip = el.dataset.tip || txt; el.removeAttribute('title'); }
    tip = h('div', { class: 'ui-tip', role: 'tooltip', text: txt }); uiSheetRoot().appendChild(tip);
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, hh = tip.offsetHeight;
    let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8), top = r.top - hh - 8;
    if (top < 8) top = r.bottom + 8;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  });
  document.addEventListener('scroll', hide, true);
  document.addEventListener('mousedown', hide, true);
}
function uiHelpSheet() {
  const T = PL.eventTypes();
  const body = h('div', { class: 'ui-helpdoc' },
    h('h3', { class: 'ui-h3', text: 'Kürzel' }),
    h('dl', { class: 'ui-legend' }, T.map(t => [h('dt', { text: t.k }), h('dd', null, h('b', { text: t.name }), t.text ? ' · ' + t.text : '')])),
    uiLegendBody(''),
    h('h3', { class: 'ui-h3', text: 'Was zählt' }),
    h('ul', { class: 'ui-list' },
      h('li', { text: 'Zählt: das Modul ist im Plan und zählt mit seinen ECTS.' }),
      h('li', { text: 'Platz offen: ein begrenztes Modul zählt erst, sobald du den Platz hast.' }),
      h('li', { text: 'Optional: das Modul steht im Plan, zählt aber nicht.' }),
      h('li', { text: 'Alternative: von mehreren Modulen einer Entscheidung zählt nur das erste.' })),
    h('h3', { class: 'ui-h3', text: 'Ohne Gewähr' }),
    h('p', { class: 'ui-disc-text', text: UI_DISC }));
  uiSheet('Hilfe', body, { kind: 'dialog' });
}
