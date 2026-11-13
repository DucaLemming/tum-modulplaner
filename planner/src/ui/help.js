/* Legend of every symbol, colour and border, one section per screen; the current screen comes first. */
const UI_LEGEND = {
  uebersicht: ['Übersicht', [['⚠ Regel', 'eine SPO-Regel ist noch offen oder verletzt'], ['⇄ Entscheidung', 'mehrere Module als Alternativen, nur eines zählt'], ['🔒 Anmeldung', 'begrenztes Modul, Platz noch nicht erhalten'],
    ['⚡ Überschneidung', 'zwei Termine oder Prüfungen zur selben Zeit'], ['🚆 Weg', 'Fahrzeit zwischen zwei Orten reicht nicht'], ['↕ Reihenfolge', 'Turnus passt nicht zum Semester oder Voraussetzung liegt später'],
    ['ⓘ Angebot', 'Modul wird vielleicht nicht mehr angeboten'], ['↻ Datenupdate', 'beim letzten Update hat sich etwas geändert'], ['roter linker Rand', 'Regel verletzt oder sichere Überschneidung'],
    ['Vorjahr', 'Zeiten aus dem Vorjahr, das Semester ist noch nicht veröffentlicht'], ['unsicher', 'Überschneidung nur mit Vorjahreszeiten'], ['✓ / ⚠ bei Bereichen', 'erfüllt / über dem Maximum'],
    ['Balken oben', 'dunkel: sicher, gestreift: zählt, sobald der Platz da ist, Umriss: optional, schwarzer Strich: 120 ECTS']]],
  module: ['Module', [['● 2', 'im Plan, im 2. Semester (Farbe = Bereich)'], ['✓', 'schon im Plan'], ['＋', 'zum Plan hinzufügen'], ['W / S / W+S', 'Angebot im Winter, im Sommer, in beiden'],
    ['Zahl rechts', 'ECTS'], ['🔒', 'Teilnehmerzahl begrenzt'], ['neu', 'neu in den Moduldaten'], ['eingestellt?', 'wird vielleicht nicht mehr angeboten'], ['⛔', 'als „Nicht für mich“ markiert']]],
  plan: ['Plan', [['farbiger linker Rand', 'Bereich, für den das Modul zählt'], ['blass und gestrichelter Rand', 'zählt nicht: optional oder Alternative'], ['optional, Alternative, abgeschlossen', 'Status des Moduls'],
    ['Platz offen', 'zählt erst, sobald du den Platz hast'], ['⚡ (rot umrandet)', 'das Modul hat eine Überschneidung oder einen Hinweis'], ['ECTS-Balken', 'dunkel: sicher, gestreift: Platz offen, Umriss: optional; Strich in der Mitte: 30 ECTS'],
    ['Aufwand-Balken', 'grün bis 30, gelb bis 36, rot darüber; blasser Teil: mit unsicheren Modulen']]],
  woche: ['Woche', [['Vor Ort', 'durchgezogener Rand'], ['Online', 'gestrichelter Rand und 💻'], ['Aufzeichnung, Nicht, Erledigt', 'blass, zählt nicht, ausgeblendet (sichtbar mit Anzeige > Ausgeblendete zeigen)'],
    ['Überschneidung', 'roter Rand und ⚡'], ['unsichere Überschneidung', 'gelber Rand (Vorjahreszeiten)'], ['Pflicht', '❗'], ['optional, Alternative', 'schraffiert mit Etikett'], ['Eigener Termin', 'grau'],
    ['Fahrt', 'schmaler schraffierter Streifen links mit Minuten'], ['Punkt unter dem Tag (Handy)', 'an diesem Tag gibt es eine Überschneidung']]],
  pruefungen: ['Prüfungen', [['geschätzt', 'noch kein Termin, aus dem Vorjahr geschätzt'], ['Wiederholung', 'Wiederholungsprüfung, zählt nicht für Überschneidungen'], ['⚡ Überschneidung', 'zwei Prüfungen zur selben Zeit'],
    ['gleicher Tag', 'zwei Prüfungen am selben Tag'], ['roter linker Rand', 'Überschneidung']]],
  modul: ['Modul', [['Teilnahme-Etikett hervorgehoben', 'von der Voreinstellung abweichend'], ['Vorjahr', 'Zeit aus dem Vorjahr'], ['❗', 'Anwesenheitspflicht'], ['blasse Terminzeile', 'gehört zu einer nicht gewählten Gruppe']]],
  platz: ['Begrenzte Module', [['🔒 voll (rot)', 'alle Plätze im geplanten Semester vergeben'], ['🔒 teils voll (gelb)', 'einige Gruppen voll'], ['🔒 N von M frei (grün)', 'noch Plätze frei'],
    ['🔒 Platz erhalten', 'du hast den Platz'], ['🔒 Belegung unbekannt', 'TUMonline zeigt noch keine Belegung'], ['grau', 'Zahlen aus einem anderen Semester (meist Vorjahr)']]]
};
function uiLegendBody(first) {
  const keys = Object.keys(UI_LEGEND).sort((a, b) => (b === first) - (a === first));
  return h('div', { class: 'ui-legenddoc' }, keys.map(k => [h('h3', { class: 'ui-h3', text: UI_LEGEND[k][0] }),
    h('dl', { class: 'ui-legend' }, UI_LEGEND[k][1].map(([a, b]) => [h('dt', { text: a }), h('dd', { text: b })]))]));
}
function uiLegend(anchor, first) { uiSheet('Zeichen und Farben', uiLegendBody(first || (uiRoute().module ? 'modul' : uiRoute().screen)), { kind: 'dialog' }); }
function uiHelpBtn(first) { return h('button', { class: 'ui-iconbtn ui-help-btn', type: 'button', 'aria-label': 'Zeichen und Farben erklären', title: 'Zeichen und Farben', onclick: e => uiLegend(e.currentTarget, first) }, '?'); }
/* UI rework: Hilfe. Kürzel, legend, counting rules, disclaimer. */
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
