/* TUM Modul-Updater, Browser-Teil, v6 (Anleitung: HOW_TO_UPDATE.md).
   Im Planer „Moduldaten aktualisieren“ → „Skript kopieren“. Das kopiert diese Datei mit dem Auftrag davor (window.TUMU_JOB = {...};).
   In einem eingeloggten TUMonline-Tab (campus.tum.de) die Entwicklerkonsole öffnen (F12), einfügen, Enter. Unten rechts erscheint ein
   Fenster mit „▶ Ausführen“ und „⤓ Herunterladen“. Jeder Lauf beginnt neu (nichts wird fortgesetzt). Fehlgeschlagene Abrufe und ein
   unvollständiger Studienplanbaum werden am Ende des Laufs automatisch einmal wiederholt. Die heruntergeladene Datei im Planer einlesen.
   Konsole (ohne Fenster): TUMU.start() startet einen neuen Lauf, TUMU.status() Fortschritt, TUMU.download() speichert das Ergebnis,
   TUMU.check() ruft nur die Prüfmodule ab (Entwicklung). Der Zustand liegt nur im Speicher dieses Tabs: Neuladen bricht den Lauf ab.
   Nur lesende Abrufe: Modul-Detailseiten, Termine/Gruppen, Anmeldeverfahren (nur ansehen) und der Studienplanbaum.
   Es wird nie eine Anmeldung, ein Belegwunsch oder eine Präferenz abgeschickt: das Skript ruft ausschließlich GET-Adressen ab.
   Phase R (Teilnehmerbegrenzung): Gruppen mit maxNumberOfParticipants (Plätze) und confirmedPlaces (belegt) kommen schon aus G;
   R lädt für jeden Kurs der benötigten Semester die Anmeldeverfahren (Zeitraum, Status) und deren Details (Vergabe, Reihung).
   Semester: job.F = gezählte Semester, job.P = die 4 Planungssemester. Veröffentlicht (pub) ist ein Semester, wenn
   mindestens 70 % so viele Module Lehrveranstaltungen haben wie im stärksten Semester derselben Art (W/S) in F.
   Benötigt (need): jedes veröffentlichte Planungssemester, sonst das letzte veröffentlichte derselben Art davor (Vorjahr). */
(() => {
  const KEY = 'tumu', JOBKEY = 'tumu_job', WORKERS = 3;
  const REST = '/tumonline/ee/rest/', MOD = REST + 'slc.cm.reg/student/modules/detail/', GRP = REST + 'slc.tm.cp/student/courseGroups/';
  const TREE = '/tumonline/wbStpCs.cbSpoTree?pStStudiumNr=&pStPersonNr=&pIsStudSicht=FALSE&pShowErg=J&pHideInactive=TRUE&pCaller=&pAction=0';
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const DESC = { 'Turnus': 'turnus', 'Sprache': 'sprache', 'Moduldauer': 'dauer', 'Kürzel': 'kuerzel', '(Empfohlene) Voraussetzungen': 'vora',
    'Angestrebte Lernergebnisse': 'lern', 'Inhalt': 'inhalt', 'Lehr- und Lernmethode': 'lehr', 'Medienformen': 'medien', 'Literatur': 'lit',
    'Name(n)': 'verantw', 'Beschreibung der Studien-/Prüfungsleistungen': 'pruef', 'Gesamtstunden': 'h0', 'Präsenzstunden': 'h1',
    'Eigenstudiumstunden': 'h2', 'Prüfungswiederholung im Folgesemester': 'whF', 'Prüfungswiederholung am Semesterende': 'whE' };
  /* Fallback, falls ein Feldname keine deutsche Übersetzung hat (TUMonline auf Englisch) */
  const DESC_EN = { 'Frequency': 'turnus', 'Language': 'sprache', 'Duration': 'dauer', 'Abbrevation': 'kuerzel', 'Abbreviation': 'kuerzel',
    '(Recommended) Prerequisites': 'vora', 'Intended Learning Outcomes': 'lern', 'Content': 'inhalt', 'Teaching and Learning Methods': 'lehr',
    'Media': 'medien', 'Reading List': 'lit', 'Description of exams and course work': 'pruef' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const val = x => (x && typeof x === 'object' && 'value' in x) ? x.value : x;
  /* v4: Texte unabhängig von der Sprache, auf die TUMonline gerade gestellt ist: zuerst Deutsch, dann Englisch, dann der Wert der
     Sitzung, dann Französisch/Italienisch. Leer, "-" und "Siehe ... Beschreibungsversion" zählen nicht. l = Sprache, wenn nicht Deutsch. */
  const goodTxt = s => s != null && String(s).trim() !== '' && String(s).trim() !== '-' && !/^(siehe (englische|deutsche) beschreibungsversion|see (english|german) (description )?version)/i.test(String(s).trim());
  const pickTxt = x => {
    if (!x || typeof x !== 'object') return goodTxt(x) ? { v: String(x), l: '' } : null;
    const tr = (x.translations && x.translations.translation) || [], tl = lg => tr.find(t => t.lang === lg && goodTxt(t.value));
    const de = tl('de'); if (de) return { v: String(de.value), l: '' };
    const en = tl('en'); if (en) return { v: String(en.value), l: 'en' };
    if (goodTxt(x.value)) return { v: String(x.value), l: '' };
    for (const lg of ['fr', 'it']) { const t = tl(lg); if (t) return { v: String(t.value), l: lg }; }
    return null;
  };
  const tx = x => { const p = pickTxt(x); return p ? p.v : (val(x) == null ? '' : String(val(x))); };   /* Namen, Typen: Deutsch zuerst */
  const dec = s => { const e = document.createElement('textarea'); e.innerHTML = s; return e.value; };
  const decode = str => { let v = 0; return String(str || '').split(',').filter(Boolean).map(x => (v += parseInt(x, 36))); };
  let S = null, J = null, busy = false, note = '', stopped = false;
  try { if (window.TUMU && window.TUMU._stop) window.TUMU._stop(); } catch (e) {}   /* erneut eingefügt: alten Lauf in diesem Tab beenden */
  try { localStorage.removeItem(KEY); localStorage.removeItem(JOBKEY); } catch (e) {}   /* Reste älterer Versionen (v4 und früher speicherten den Lauf) */
  const save = () => {};   /* v5: kein gespeicherter Zustand, jeder Lauf beginnt neu */

  async function get(url, asText) {
    let last = '';
    for (let k = 0; k < 4; k++) {
      try {
        const r = await fetch(url, { headers: asText ? {} : { Accept: 'application/json' } });
        if (r.ok) return asText ? r.text() : r.json();
        if (r.status === 404) return null;
        last = 'HTTP ' + r.status;
        if (r.status === 401 || r.status === 403) break;
      } catch (e) { last = e.message; }
      await sleep(800 * (k + 1));
    }
    throw new Error(last + ' ' + url.replace(/^.*\/(rest|tumonline)\//, '').slice(0, 90));
  }

  /* ---------- Studienplanbaum: [Eltern-ID, Art (M Modul / C Kategorie), Code, Name, Modul-ID, ECTS] je Knoten ---------- */
  async function treeChildren(k) {
    const t = await get(TREE + '&pStpStpNr=' + J.cv + '&pSJNr=' + J.sj + '&pStpKnotenNr=' + k + '&pId=kn' + k, true);
    const out = [];
    for (const m of (t || '').matchAll(/<tr class="coRow[^"]*" id="kn(\d+)">([\s\S]*?)<\/tr>/g)) {
      const s = m[2].match(/<span class="KnotenText[^"]*" title="([^"]*)">([\s\S]*?)<\/span>/); if (!s) continue;
      const title = dec(s[1]), isMod = /Modulknoten|Module node/i.test(title) || (/detail\/light\/\d+\//.test(m[2]) && /^\s*\[/.test(dec(s[2].replace(/<[^>]+>/g, ''))));
      const kind = isMod ? 'M' : /Regelknoten|SPO-Version|Rule node|SPO.?version/i.test(title) ? 'C' : '';   /* v4: Deutsch und Englisch */
      if (!kind) continue;
      const txt = dec(s[2].replace(/<[^>]+>/g, '')).trim(), mm = txt.match(/^\[([^\]]+)\]\s*(.*)$/);
      const light = m[2].match(/detail\/light\/(\d+)\//), ects = (m[2].match(/<div class="R[^"]*">\s*<span>([^<]*)<\/span>/) || [])[1] || '';
      out.push([m[1], kind, kind === 'M' && mm ? mm[1] : '', kind === 'M' && mm ? mm[2] : txt, light ? +light[1] : 0, ects.trim(), /cs_loadSubElems/.test(m[2])]);
    }
    return out;
  }
  async function crawl() {
    if (!S.tq) S.tq = [String(J.root)];
    while (S.tq.length && !stopped) {
      const k = S.tq[0]; let kids = [];
      try { kids = await treeChildren(k); } catch (e) { S.treeErr = (S.treeErr || 0) + 1; S.err.push('Baum ' + k + ' ' + e.message); }
      for (const [id, kind, code, name, mid, ects, exp] of kids) {
        if (!S.tree[id]) S.tree[id] = [k, kind, code, name, mid, ects];
        if (kind === 'C' && exp) S.tq.push(id);
      }
      S.tq.shift(); save();
    }
    if (!Object.values(S.tree).some(x => x[1] === 'M')) { S.treeErr = (S.treeErr || 0) + 1; S.err.push('Baum leer: keine Modulknoten erkannt (Seitenformat geändert?)'); save(); }
  }

  /* ---------- Modul: Semester, Lehrveranstaltungen, Termine, Angebot ---------- */
  async function termIds(mid) {
    const j = await get(MOD + mid + '/availableSemesters'), o = {};
    for (const r of (j && j.resource) || []) { const s = r.content.selectableSemesterLibDto; o[val(s.optionText)] = s.id; }
    return o;
  }
  async function listTerm(mid, tid) { // [[Elementname (rotes Dreieck), Kurs-ID, Typ, SWS, Lehrende]]
    const l = await get(MOD + mid + '/' + tid + '/courseGroupings/courses'), out = [];
    for (const g of ((l && l.resource) || []).map(r => r.content.cmNodeListItemDto)) {
      const c = await get(MOD + mid + '/' + tid + '/courseGroupings/courses/' + g.id);
      for (const r of (c && c.resource) || []) {
        const d = r.content.coPersonalCourseDetailsDto; if (!d) continue;
        const ppl = new Map(); // Lehrende: "Nachname V" in TUMonline-Reihenfolge, Leitung mit [L]
        for (const x of (d.lectureships || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0))) {
          const p = x.identityLibDto; if (!p) continue;
          const nm = ((p.lastName || '') + ' ' + (p.firstName || '').charAt(0)).trim();
          ppl.set(nm, ppl.get(nm) || ((x.teachingFunction || {}).key === 'L'));
        }
        const doz = [...ppl].map(([nm, l]) => nm + (l ? ' [L]' : '')).join(', ');
        out.push([tx(g.name) || '', d.id, tx(d.courseTypeShortName) || '', d.duration == null ? '' : String(d.duration), doz]);
      }
    }
    return out;
  }
  async function detail(mid, tid, full) {
    const j = await get(MOD + mid + '/' + tid), d = j && j.resource && j.resource[0] && j.resource[0].content.moduleTemplateDetailDto;
    if (!d) return null;
    const f = {};
    for (const g of ((d.nodeDescription || {}).nodeDescriptionGroupingDtos) || []) for (const v of g.nodeDescriptionValueDtos || []) {
      const k = DESC[tx(v.descriptionName)] || DESC_EN[tx(v.descriptionName)] || DESC[val(v.descriptionName)] || DESC_EN[val(v.descriptionName)]; if (!k) continue;
      const vs = [];
      for (const x of (Array.isArray(v.descriptionValues) ? v.descriptionValues : Object.values(v.descriptionValues || {}))) {
        const p = pickTxt(x); if (p && !vs.includes(p.v)) { vs.push(p.v); if (p.l && (k === 'lern' || k === 'inhalt')) f.dl = p.l; }
      }
      if (vs.length) f[k] = vs.join('\n');
    }
    const o = { code: d.identification || '', n: tx(d.name) || '', cr: d.credits ? d.credits.value : null, tt: f.turnus || '', sp: f.sprache || '' };
    if (full) { const dl = f.dl; delete f.dl; o.f = f; if (dl) o.dl = dl; o.dept = d.organisation ? tx(d.organisation.name) || '' : ''; }
    return o;
  }
  async function fetchGroups(cid) { // wie collect_tumonline.js: Gruppen mit Serien und Einzelterminen
    const a = await get(GRP + 'firstGroups/' + cid);
    let gs = (a && a.courseGroupDtos) || [];
    if (a && (a.totalCount || 0) > gs.length) { try { const b = await get(GRP + 'remainingGroups/' + cid); gs = gs.concat((b && b.courseGroupDtos) || []); } catch (e) {} }
    return gs.map(g => {
      const ap = (g.appointmentDtos || []).filter(p => p.appointmentStatusType === 'CONFIRMED');
      /* Serie: [id, Wochentage (JS getDay aus den echten Terminen), von, bis, Beginn, Ende, Raum, Anzahl, Daten nur bei kurzen Serien] */
      const ser = (g.appointmentSeriesDtos || []).map(s => {
        const own = ap.filter(p => p.appointmentSeriesId === s.id).map(p => p.timestampFrom.value.slice(0, 10)).sort();
        const wds = [...new Set(own.map(d => new Date(d + 'T12:00:00').getDay()))].join('/');
        const b = s.seriesBegin.value.slice(0, 10), e = s.seriesEnd.value.slice(0, 10);
        return [s.id, wds, s.seriesBeginTime, s.seriesEndTime, b, e, s.resourceName || '', own.length, (new Date(e) - new Date(b)) / 864e5 < 28 ? own : null];
      }).filter(s => s[7] > 0);
      const ids = new Set(ser.map(s => s[0]));
      const one = ap.filter(p => !ids.has(p.appointmentSeriesId))
        .map(p => [p.timestampFrom.value.slice(0, 16), p.timestampTo.value.slice(11, 16), p.resourceName || '', (p.appointmentEventTypeDto || {}).key || '']);
      const r = { n: (g.name || '').trim(), s: ser, o: one };
      if (g.maxNumberOfParticipants != null) { r.mx = g.maxNumberOfParticipants; r.cf = g.confirmedPlaces || 0; } // begrenzte Gruppe
      return r;
    });
  }
  const CP = REST + 'slc.tm.cp/student/';
  async function fetchProcs(cid) { // Anmeldeverfahren eines Kurses -> [Verfahrens-IDs]; Verfahren selbst in S.pr
    const j = await get(CP + 'courses/' + cid + '/registrationProcedures'), ids = [];
    for (const r of (j && j.resource) || []) {
      const d = ((r.content || {}).cpCourseRegProcRelationsDto || {}).registrationProcedureDto; if (!d || d.id == null) continue;
      ids.push(d.id);
      if (!S.pr[d.id]) S.pr[d.id] = { n: tx(d.name) || '', b: val(d.registrationBegin) || '', e: val(d.registrationEnd) || '',
        de: val(d.deregistrationEnd) || '', i: d.registrationInfo || '', st: d.registrationInfoStatus || '', auto: !!d.isAutomaticAllocationEnabled };
    }
    return ids;
  }
  async function procDetail(pid) { // Vergabedatum, Reihungskriterien, Gesamtplätze des Verfahrens
    const j = await get(CP + 'registrationProcedures/' + pid), d = j && j.resource && j.resource[0] && j.resource[0].content.rpRegistrationToRegProcDto;
    const p = S.pr[pid]; p.ok = 1; if (!d) return;
    p.z = val(d.allocationDate) || ''; p.r = (d.rankingOptions || []).map(x => tx(x.name) || '').filter(Boolean).join('; ');
    if (d.maxNumberOfParticipants != null) p.mx = d.maxNumberOfParticipants;
    if (d.minRequestsForPlacesPerStudent != null) p.minw = d.minRequestsForPlacesPerStudent;
    if (d.maxConfirmedPlacesPerStudent != null) p.maxp = d.maxConfirmedPlacesPerStudent;
  }
  const limited = cid => (S.c[cid] || []).some(g => g.mx != null) || (S.rp && (S.rp[cid] || []).some(p => S.pr[p] && S.pr[p].mx != null));
  const letter = t => /winter/i.test(t) && /sommer/i.test(t) ? 'B' : /winter/i.test(t) ? 'W' : /sommer/i.test(t) ? 'S' : 'U';
  async function doModule(mid, isNew) { // {tu, cnt: {Semester: Anzahl LV, -1 = nicht wählbar}, L: {Semester: Kurse}, old: letztes Semester vor F}
    const t = await termIds(mid), keys = Object.keys(t).sort(), p0 = J.P[0];
    const dTerm = t[p0] ? p0 : keys.filter(k => k <= p0).pop() || keys.pop();
    const nd = (J._nd || (J._nd = new Set(decode(J.nd || '')))).has(mid), want = isNew || nd;  // nd: Modul ohne gespeicherte Beschreibung
    let d = dTerm ? await detail(mid, t[dTerm], true) : null;   /* v4: Beschreibung immer (aktualisiert auch vorhandene) */
    if (nd && d && d.f && !d.f.lern && !d.f.inhalt) {   // ältere Fassungen des Moduls probieren (neueste zuerst, höchstens 4)
      for (const k of keys.filter(k => k !== dTerm).reverse().slice(0, 4)) {
        const d2 = await detail(mid, t[k], true);
        if (d2 && d2.f && (d2.f.lern || d2.f.inhalt)) { d.f = Object.assign({}, d2.f, d.f, { lern: d2.f.lern, inhalt: d2.f.inhalt }); d.dl = d2.dl || d.dl; break; }
      }
    }
    const tu = d && d.tt ? letter(d.tt) : ((J.tuOf || {})[mid] || 'U');
    const cnt = {}, L = {};
    for (const s of J.F) { if (!t[s]) { cnt[s] = -1; continue; } const l = await listTerm(mid, t[s]); cnt[s] = l.length; if (l.length) L[s] = l; }
    let old = '';
    if (!Object.keys(L).length) for (const s of J.back) { if (!t[s]) continue; if ((await listTerm(mid, t[s])).length) { old = s; break; } }
    const rec = { tu, cnt, L, old };
    if (d) Object.assign(rec, { code: d.code, n: d.n, cr: d.cr, tt: d.tt, sp: d.sp, f: d.f, dept: d.dept, dl: d.dl || '' });
    return rec;
  }
  function termsOf(recs) { // veröffentlichte und benötigte Semester aus den Zählungen aller Module
    const n = {}; for (const s of J.F) n[s] = 0;
    for (const r of recs) if (r && r.cnt) for (const s of J.F) if (r.cnt[s] > 0) n[s]++;
    const mx = { W: 0, S: 0 }; for (const s of J.F) mx[s.slice(-1)] = Math.max(mx[s.slice(-1)], n[s]);
    const pub = J.F.filter(s => n[s] > 0 && n[s] >= 0.7 * mx[s.slice(-1)]), need = [];
    for (const p of J.P) {
      const q = pub.includes(p) ? p : pub.filter(s => s.slice(-1) === p.slice(-1) && s < p).pop();
      if (q && !need.includes(q)) need.push(q);
    }
    return { pub, need, n };
  }
  async function pool(items, fn) { let i = 0, k = 0; const w = async () => { while (i < items.length && !stopped) { const x = items[i++]; await fn(x); if (++k % 20 === 0) save(); } }; const ws = []; for (let n = 0; n < WORKERS; n++) ws.push(w()); await Promise.all(ws); }   /* kein Array.from: ältere TUMonline-Seiten laden Prototype.js, dessen Array.from die Funktion ignoriert */

  async function run() {
    if (busy || !S || !J) return; busy = true;
    try {
      S.phase = 'T'; await crawl();
      if (S.treeErr) {   /* Baum unvollständig: einmal automatisch neu laden */
        S.retryTree = 1; await sleep(4000);
        S.tree = {}; S.tq = null; S.treeErr = 0; S.err = S.err.filter(x => !x.startsWith('Baum ')); await crawl();
      }
      const known = new Set(decode(J.ids)), q = [...known];
      for (const x of decode(J.xid || '')) if (!q.includes(x)) q.push(x);   /* Zusatzmodule außerhalb des Studiengangs (v6) */
      for (const x of Object.values(S.tree)) if (x[1] === 'M' && x[4] && !known.has(x[4]) && !q.includes(x[4])) q.push(x[4]);
      S.q = S.only ? S.only : q;
      for (let pass = 0; pass < 2; pass++) {
        if (pass) {   /* zweiter Durchgang: nur was im ersten fehlgeschlagen ist */
          const bad = Object.keys(S.m).filter(k => S.m[k] === 'err');
          if (!bad.length && !S.err.some(x => /^(Kurs|Anmeldung|Verfahren) /.test(x))) break;
          S.retry = 1; S.phase = 'W'; await sleep(5000);
          bad.forEach(k => delete S.m[k]); S.err = S.err.filter(x => x.startsWith('Baum '));
        }
        S.phase = 'M';
        await pool(S.q.filter(m => !(m in S.m)), async mid => {
          try { S.m[mid] = await doModule(mid, !known.has(mid)); } catch (e) { S.m[mid] = 'err'; S.err.push(mid + ' ' + e.message); }
        });
        Object.assign(S, termsOf(Object.values(S.m)));
        S.phase = 'G';
        const cids = new Set();
        for (const r of Object.values(S.m)) if (r && r.L) for (const s of S.need) for (const c of r.L[s] || []) if (!(c[1] in S.c)) cids.add(c[1]);
        await pool([...cids], async cid => { try { S.c[cid] = await fetchGroups(cid); } catch (e) { S.err.push('Kurs ' + cid + ' ' + e.message); } });
        S.phase = 'R'; S.rp = S.rp || {}; S.pr = S.pr || {};
        await pool(Object.keys(S.c).filter(cid => !(cid in S.rp)), async cid => { try { S.rp[cid] = await fetchProcs(cid); } catch (e) { S.err.push('Anmeldung ' + cid + ' ' + e.message); } });
        await pool(Object.keys(S.pr).filter(p => !S.pr[p].ok), async pid => { try { await procDetail(pid); } catch (e) { S.err.push('Verfahren ' + pid + ' ' + e.message); } });
      }
      if (stopped) throw new Error('beendet (Skript neu eingefügt)');
      for (const r of Object.values(S.m)) if (r && r.L) for (const s of Object.keys(r.L)) if (!S.need.includes(s)) delete r.L[s];
      S.limAt = new Date().toISOString(); S.phase = 'done'; S.finished = new Date().toISOString();
    } catch (e) { S.err.push('Lauf ' + e.message); S.phase = 'abort'; } finally { busy = false; }
  }

  function fmtCourses(list, C) {
    const out = [];
    for (const [, cid, typ] of list) {
      const gs = (C[cid] || []).filter(g => g.s.length || g.o.length);
      if (!gs.length) { out.push(typ + ' ohne Termine'); continue; }
      for (const g of gs) {
        const ser = g.s.filter(s => !s[8]).map(s => s[1].split('/').map(w => WD[+w]).join('/') + ' ' + s[2] + '-' + s[3]);
        const one = g.o.length + g.s.filter(s => s[8]).reduce((a, s) => a + s[8].length, 0);
        out.push(typ + (gs.length > 1 ? ' ' + g.n : '') + (g.mx != null ? ' [' + g.cf + '/' + g.mx + ']' : '') + ' ' + ser.join(', ') + (one ? ' +' + one + ' Einzeltermine' : ''));
      }
    }
    return out.join('; ') || '-';
  }
  const setJob = job => {
    if (job) { J = typeof job === 'string' ? JSON.parse(job) : job; J.tuOf = {}; decode(J.ids).forEach((m, k) => J.tuOf[m] = (J.tu || '')[k] || 'U'); }
    return J;
  };

  window.TUMU = {
    async check(job) { // Probelauf: eine Zeile je Prüfmodul (Anzahl LV je Semester, Termine je Planungssemester mit LV)
      if (!setJob(job)) return 'kein Auftrag: im Planer „Skript kopieren“ verwenden';
      const C = {}, out = [];
      for (const [code, mid] of Object.entries(J.chk || {})) {
        try {
          const r = await doModule(mid, false), ev = [];
          for (const s of J.P) if (r.L[s]) { for (const c of r.L[s]) if (!(c[1] in C)) C[c[1]] = await fetchGroups(c[1]); ev.push(s + ': ' + fmtCourses(r.L[s], C)); }
          out.push(`${code} ${r.tu} | ${J.F.map(s => s + ':' + r.cnt[s]).join(' ')}${r.old ? ' | zuletzt ' + r.old : ''} | ${ev.join(' | ') || 'keine LV in ' + J.P.join('/')}`);
        } catch (e) { out.push(code + ' FEHLER ' + e.message); }
      }
      return out.join('\n');
    },
    start(job, opts) {
      if (!setJob(job)) return 'kein Job: TUMU.start("<job.txt>")';
      if (busy) return 'läuft bereits: ' + this.status();
      S = { v: 1, cv: J.cv, started: new Date().toISOString(), phase: 'T', tree: {}, tq: null, treeErr: 0, q: [], m: {}, c: {}, err: [], only: opts && opts.only || null };
      save(); run(); return 'gestartet: ' + this.status();
    },
    status() {
      if (!S) return 'kein Lauf';
      const tv = Object.values(S.tree), nM = tv.filter(x => x[1] === 'M').length, nC = tv.length - nM, ms = Object.values(S.m);
      const err = ms.filter(x => x === 'err').length, known = new Set(decode((J || {}).ids));
      const nNew = Object.keys(S.m).filter(k => !known.has(+k)).length;
      return `Phase ${S.phase} | Baum ${nC} Kategorien, ${nM} Modulpositionen${S.tq && S.tq.length ? ', offen ' + S.tq.length : ''}${S.treeErr ? ', Baumfehler ' + S.treeErr : ''}`
        + ` | Module ${ms.length}/${S.q.length || '?'} (neu ${nNew}, Fehler ${err})${S.err.some(x => x.startsWith('Kurs ')) ? ' | Kursfehler ' + S.err.filter(x => x.startsWith('Kurs ')).length : ''}${S.pub ? ' | veröffentlicht ' + S.pub.join(' ') + ', benötigt ' + S.need.join(' ') : ''}`
        + ` | Termine ${Object.keys(S.c).length} Kurse`
        + (S.rp ? ` | Anmeldung ${Object.keys(S.rp).length} Kurse, ${Object.keys(S.pr || {}).length} Verfahren, begrenzt ${Object.keys(S.c).filter(limited).length} Kurse` : '')
        + `${S.err.some(x => /^(Anmeldung|Verfahren) /.test(x)) ? ' | Anmeldefehler ' + S.err.filter(x => /^(Anmeldung|Verfahren) /.test(x)).length : ''} | läuft ${busy}${note ? ' | ' + note : ''}`;
    },
    errors(n = 10) { return S ? S.err.slice(-n) : []; },
    download(name) {
      if (!S) return 'kein Lauf';
      name = name || 'tum_update_' + S.started.slice(0, 10) + '.json';
      const data = { v: 2, sv: 6, lang: 'de-en', job: Object.assign({}, J, { ids: undefined, tu: undefined, tuOf: undefined, chk: undefined }), started: S.started, finished: S.finished || null, phase: S.phase,
        treeErr: S.treeErr, pub: S.pub || null, need: S.need || null, nTerm: S.n || null, tree: S.tree, m: S.m, c: S.c,
        rp: S.rp || null, pr: S.pr || null, limAt: S.limAt || null, err: S.err.slice(-300) };
      const b = new Blob([JSON.stringify(data)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      return name + ' (' + Math.round(b.size / 1024) + ' KB)';
    },
    reset() { if (busy) return 'läuft noch'; S = null; return 'zurückgesetzt'; },
    _state() { return S; },
    _stop() { stopped = true; }
  };
  /* ---------- Fenster (Panel) im TUMonline-Tab ---------- */
  function panel() {
    let p = document.getElementById('tumuPanel'); if (p) p.remove();
    p = document.createElement('div'); p.id = 'tumuPanel';
    p.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:420px;max-width:calc(100vw - 32px);background:#fff;color:#1d2833;border:2px solid #3070b3;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.3);font:13px/1.4 system-ui,Segoe UI,Arial,sans-serif;padding:12px 14px';
    const btn = (id, t, title) => `<button id="${id}" title="${title || ''}" style="margin:3px 4px 3px 0;padding:5px 10px;border:1px solid #3070b3;border-radius:6px;background:#fff;color:#3070b3;cursor:pointer;font:inherit">${t}</button>`;
    p.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:14px">TUM Modul-Updater</b><span id="tumuX" title="Fenster schließen (der Lauf geht weiter)" style="cursor:pointer;font-size:18px;color:#888">×</span></div>
      <div style="color:#666;font-size:11.5px;margin:2px 0 6px">Nur lesende Abrufe. Meldet dich nirgends an, schickt keine Belegwünsche. Tab offen lassen; Neuladen bricht den Lauf ab.</div>
      <div id="tumuJob" style="font-size:12px;margin-bottom:4px"></div>
      <div style="height:8px;background:#eef1f4;border-radius:4px;overflow:hidden;margin:6px 0"><i id="tumuBar" style="display:block;height:100%;width:0;background:#3070b3;transition:width .4s"></i></div>
      <div id="tumuSt" style="font-size:12px;white-space:pre-wrap;max-height:120px;overflow:auto"></div>
      <div style="margin-top:8px">${btn('tumuGo', '▶ Ausführen', 'Startet einen neuen Lauf (immer von vorn)')}${btn('tumuDl', '⤓ Herunterladen', 'Ergebnis als tum_update_JJJJ-MM-TT.json speichern')}</div>
      <pre id="tumuOut" style="display:none;margin:6px 0 0;max-height:160px;overflow:auto;font-size:11px;background:#f6f8fa;padding:6px;border-radius:6px;white-space:pre-wrap"></pre>`;
    document.body.appendChild(p);
    const $ = id => p.querySelector('#' + id), out = t => { const o = $('tumuOut'); o.style.display = 'block'; o.textContent = t; };
    $('tumuX').onclick = () => p.remove();
    $('tumuGo').onclick = () => { if (busy) return; $('tumuOut').style.display = 'none'; TUMU.start(); upd(); };
    $('tumuDl').onclick = () => { if (!S || S.phase !== 'done') return; out('Gespeichert: ' + TUMU.download() + '\nJetzt im Planer unter „Moduldaten aktualisieren“, Schritt 3, einlesen.'); };
    function upd() {
      if (!document.getElementById('tumuPanel')) return;
      $('tumuJob').textContent = J ? 'Auftrag: Start ' + J.start + ', Planungssemester ' + J.P.join(', ') + ', ' + decode(J.ids).length + ' bekannte Module' + (J.xid ? ', ' + decode(J.xid).length + ' neue Zusatzmodule' : '') : 'Kein Auftrag: im Planer „Skript kopieren“ verwenden.';
      const ph = S ? S.phase : null, ms = S ? Object.keys(S.m).length : 0, q = S ? (S.q.length || 0) : 0;
      const pct = !S ? 0 : ph === 'done' ? 100 : ph === 'T' ? 3 : ph === 'M' ? (S.retry ? 94 : 5 + 70 * (q ? ms / q : 0)) : ph === 'G' ? (S.retry ? 96 : 80) : ph === 'R' ? (S.retry ? 98 : 88) : ph === 'W' ? 93 : 0;
      $('tumuBar').style.width = Math.round(pct) + '%';
      const lab = { T: S && S.retryTree ? 'Studienplanbaum wird erneut geladen' : 'Studienplanbaum laden', M: 'Module abrufen', G: 'Termine und Gruppen laden', R: 'Anmeldeverfahren (Plätze) laden', W: 'Fehlgeschlagene Abrufe werden automatisch wiederholt', done: 'Fertig: jetzt herunterladen', abort: 'Abgebrochen: ▶ Ausführen startet neu' };
      const empty = ph === 'done' && (!S.pub || !S.pub.length || !Object.keys(S.m || {}).some(k => S.m[k] && S.m[k].L && Object.keys(S.m[k].L).length));
      const nBad = S ? Object.values(S.m).filter(x => x === 'err').length + S.err.filter(x => /^(Kurs|Anmeldung|Verfahren) /.test(x)).length : 0;
      const msgs = [];
      if (ph === 'done' && S.treeErr) msgs.push('Hinweis: Studienplanbaum auch nach Wiederholung unvollständig: neue Module und „nicht mehr im Studienplan“ werden diesmal nicht erkannt; Termine, Plätze und Beschreibungen schon. Später erneut ausführen.');
      if (ph === 'done' && nBad) msgs.push(nBad + ' Abrufe auch nach automatischer Wiederholung fehlgeschlagen (Sitzung abgelaufen?). Betroffene Module bleiben im Planer unverändert. Herunterladen geht trotzdem, oder neu einloggen und ▶ Ausführen.');
      if (empty) msgs.push('ACHTUNG: keine Daten erhalten (eingeloggt? Seite campus.tum.de?). Nicht einlesen, neu einloggen und ▶ Ausführen.');
      $('tumuSt').textContent = S ? (msgs.length ? msgs.join('\n') + '\n' : '') + (lab[ph] || ph) + (ph === 'M' && !S.retry ? ' (' + ms + ' von ' + (q || '?') + ')' : '') + (busy ? ' …' : '') + '\n' + TUMU.status() : 'Bereit: ▶ Ausführen.';
      $('tumuGo').disabled = busy; $('tumuGo').style.opacity = busy ? .5 : 1; $('tumuGo').style.cursor = busy ? 'default' : 'pointer';
      $('tumuDl').disabled = ph !== 'done'; $('tumuDl').style.opacity = ph === 'done' ? 1 : .5;
      $('tumuDl').style.background = ph === 'done' ? '#3070b3' : '#fff'; $('tumuDl').style.color = ph === 'done' ? '#fff' : '#3070b3';
      setTimeout(upd, 2000);
    }
    upd();
  }
  TUMU.panel = panel;
  if (!/(^|\.)campus\.tum\.de$/.test(location.hostname)) { const m = 'TUM Modul-Updater: Bitte in einem eingeloggten TUMonline-Tab auf campus.tum.de ausführen (aktuell: ' + location.hostname + ').'; try { alert(m); } catch (e) {} return m; }
  if (window.TUMU_JOB) setJob(window.TUMU_JOB);
  if (document.body) panel();
  return 'TUMU bereit. ' + TUMU.status();
})();
