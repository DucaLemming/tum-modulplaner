/* UI rework: Hilfe. Kürzel, legend, counting rules, disclaimer. */
function uiHelpSheet() {
  const T = PL.eventTypes();
  const body = h('div', { class: 'ui-helpdoc' },
    h('h3', { class: 'ui-h3', text: 'Kürzel' }),
    h('dl', { class: 'ui-legend' }, T.map(t => [h('dt', { text: t.k }), h('dd', null, h('b', { text: t.name }), t.text ? ' · ' + t.text : '')])),
    h('h3', { class: 'ui-h3', text: 'Woche: Farben und Zeichen' }),
    h('dl', { class: 'ui-legend' }, [['Vor Ort', 'durchgezogener Rand'], ['Online', 'gestrichelter Rand und 💻'], ['Aufzeichnung, Nicht, Erledigt', 'blass, zählt nicht, ausgeblendet'],
      ['Überschneidung', 'roter Rand und ⚡'], ['Pflicht', '❗'], ['optional, Alternative', 'schraffiert mit Etikett'], ['Eigener Termin', 'grau'], ['Fahrt', 'schmaler schraffierter Streifen mit Minuten'],
      ['Platz offen', 'gestreift: zählt, sobald du den Platz hast']].map(([a, b]) => [h('dt', { text: a }), h('dd', { text: b })])),
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
