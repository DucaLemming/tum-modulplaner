/* UI rework: the facade PL. The only file (besides ui/boot.js) that touches engine globals.
   Read models return plain objects; actions change the plan through engine functions and notify once. */
(function () {
  'use strict';
  const subs = new Set();
  let depth = 0, pending = false;
  function notify() { if (depth) { pending = true; return; } subs.forEach(f => { try { f(); } catch (e) { console.error('PL listener', e); } }); }
  /* Run fn with all codes that are not in M (removed by a data update) taken out of the plan, as the engine expects. */
  function known(f) {
    const unk = Object.keys(marked).filter(c => !M[c]);
    if (!unk.length) return f();
    const keep = unk.map(c => [c, marked[c], sem[c], opt[c]]);
    unk.forEach(c => { delete marked[c]; delete sem[c]; delete opt[c]; });
    try { return f(); } finally { keep.forEach(([c, b, s, o]) => { marked[c] = b; if (s != null) sem[c] = s; if (o != null) opt[c] = o; }); }
  }
  const K = f => function () { const a = arguments; return known(() => f.apply(null, a)); };
  const planCodes = () => Object.keys(marked).filter(c => M[c]);
  const label = b => (BR[b] && BR[b].label) || (b === 'extern' ? 'Extern' : b === 'zusatz' ? 'Zusatzmodule' : b);
  const color = b => (typeof bColor === 'function' ? bColor(b) : (BR[b] && BR[b].color)) || '#9aa5b1';
  const sum = o => Object.values(o).reduce((a, v) => a + v, 0);
  const turnOf = c => { const t = M[c].turnus || ''; return t === 'Wintersemester/Sommersemester' ? 'W+S' : t.includes('Winter') ? 'W' : t.includes('Sommer') ? 'S' : ''; };

  /* ---------- totals, brackets, rules ---------- */
  const totals = K(() => {
    const E = semStats(planCodes()).E, EBY = ectsBy(), sure = sum(EBY.S);
    return { sure, seatOpen: sum(EBY.H) - sure, optional: E.o + E.ou, done: doneEcts(), lost: E.x, goal: 120 };
  });
  function bState(b, cur, eth) {
    const req = BR[b].req, lim = BR[b].limit;
    if ((lim === 'max' || lim === 'fixed') && cur > req) return 'bad';
    if (((lim === 'min' && cur >= req) || (lim === 'fixed' && cur === req)) && (b !== 'ueber' || eth >= ETH_REQ)) return 'ok';
    return '';
  }
  const brackets = K(() => {
    const EBY = ectsBy(), S = EBY.S, H = EBY.H, eth = ethEcts();
    const rows = ORDER.map(id => ({ id, label: BR[id].label, color: color(id), req: BR[id].req, limit: BR[id].limit,
      sure: S[id] || 0, withSeats: H[id] || 0, state: bState(id, S[id] || 0, eth), master: MMG.includes(id) }));
    const ms = MMG.reduce((a, b) => a + (S[b] || 0), 0), mh = MMG.reduce((a, b) => a + (H[b] || 0), 0);
    return { rows, master: { sure: ms, withSeats: mh, req: 60, state: ms >= 60 ? 'ok' : '' }, ethics: { have: eth, req: ETH_REQ } };
  });
  /* copied from renderPlan (let bad=[],open=[]; ... Gesamt: noch ... ECTS bis 120.) */
  const rules = K(() => {
    const t = ectsBy().S, total = sum(t), mm = MMG.reduce((s, b) => s + t[b], 0);
    const forschN = Object.keys(marked).filter(c => marked[c] === 'forsch' && cntSure(c)).length;
    let bad = [], open = [];
    ['kern', 'angr', 'flex'].forEach(b => { if (t[b] > BR[b].req) bad.push(`${BR[b].label}: ${t[b]} ECTS über dem Maximum von ${BR[b].req}.`); });
    if (t.thesis > 30) bad.push(`Master's Thesis: ${t.thesis} ECTS (genau 30 vorgesehen).`);
    if (t.forsch > 11 || forschN > 1) bad.push(`Forschungspraxis: genau ein Modul mit 11 ECTS (aktuell ${forschN} Module, ${t.forsch} ECTS).`);
    const miss = (b, req, lab) => { if ((t[b] || 0) < req) open.push(`${lab}: noch ${req - (t[b] || 0)} ECTS (min ${req}).`); };
    miss('grund', 20, 'Ing. Grundlagen');
    if (mm < 60) open.push(`Mastermodule gesamt: noch ${60 - mm} ECTS (min 60).`);
    miss('hoch', 8, 'Hochschulpraktika'); miss('ueber', 5, 'Überfachliche Ergänzung'); const eth = ethEcts(); if (eth < ETH_REQ) open.push(`Überfachliche Ergänzung: mindestens ${ETH_REQ} ECTS aus „Ethik des menschzentrierten Ingenieurwesens“ (SPO-Pflicht), aktuell ${eth}.`); miss('intl', 6, 'International Experience');
    if (t.forsch < 11) open.push(`Forschungspraxis: noch offen (11 ECTS, ein Modul).`);
    if (t.thesis < 30) open.push(`Master's Thesis: noch offen (30 ECTS).`);
    if (total < 120) open.push(`Gesamt: noch ${120 - total} ECTS bis 120.`);
    return { bad, open };
  });
  /* bracket a rule text refers to (for the Module filter) */
  const RULE_BR = [['Ing. Grundlagen', 'grund'], ['Mastermodule', ''], ['Hochschulpraktika', 'hoch'], ['Überfachliche', 'ueber'], ['International', 'intl'],
    ['Forschungspraxis', 'forsch'], ["Master's Thesis", 'thesis']];
  function ruleBracket(txt) {
    for (const id of ORDER) if (txt.startsWith(BR[id].label)) return id;
    const r = RULE_BR.find(([p]) => txt.startsWith(p)); return r ? r[1] : '';
  }

  /* ---------- issues ---------- */
  const CF_TYPE = { LV: 'Überschneidung', PF: 'Überschneidung', PFK: 'Überschneidung', LF: 'Überschneidung', PR: 'Überschneidung', PT: 'Überschneidung', PB: 'Überschneidung',
    WG: 'Weg', RF: 'Reihenfolge', T: 'Reihenfolge', DEP: 'Angebot' };
  const issues = K(() => {
    const out = [], hid = id => !!hideW[id];
    const R = rules();
    const push = (o) => { o.id = o.id || ('0|' + o.type + '|' + o.title); o.hidden = hid(o.id); o.soft = !!o.soft; o.codes = o.codes || []; o.action = o.action || null; out.push(o); };
    R.bad.concat(R.open).forEach(txt => { const i = txt.indexOf(':'); push({ type: 'Regel', sem: 0, title: i > 0 ? txt.slice(0, i) : txt, detail: i > 0 ? txt.slice(i + 1).trim() : '', full: txt, bad: R.bad.includes(txt), ref: ruleBracket(txt) }); });
    (eoList || []).forEach((g, gi) => {
      const cs = g.codes.filter(c => M[c]); if (cs.length < 2) return;
      push({ type: 'Entscheidung', sem: 0, title: cs.join(' oder '), detail: cs.map(c => M[c].ects + ' ECTS' + (sem[c] ? ', ' + sem[c] + '. Sem.' : '')).join(' / '),
        full: cs.map(c => c + ' ' + M[c].name).join(' oder '), codes: cs, action: 'compare', ref: gi });
    });
    limPlan().filter(o => !limGot(o.c)).forEach(({ c, i }) => push({ type: 'Anmeldung', sem: sem[c] || 0, title: c + ' ' + M[c].name,
      detail: limShort(i) + ' · ' + limReg(i), full: limShort(i) + ' · ' + limReg(i), codes: [c], action: 'seat', vj: !!i.vj }));
    const cf = computeConflicts();
    [1, 2, 3, 4].forEach(s => (cf[s] || []).forEach(w => {
      if (w.k === 'EO') return;
      const type = CF_TYPE[w.k] || 'Überschneidung';
      const codes = [...new Set([w.A && w.A.c, w.B && w.B.c, w.c].concat(w.cs || []).filter(c => c && M[c]))];
      let title;
      if (w.A && w.B && w.A.c && w.B.c) title = w.A.c + ' ' + w.A.t + ' ↔ ' + w.B.c + ' ' + w.B.t;
      else { const i = w.txt.indexOf(':'); title = (i > 0 ? w.txt.slice(0, i) : w.txt) + (codes[0] ? ' · ' + M[codes[0]].name : ''); }
      const id = wKey(s, w), vj = [w.A, w.B].some(x => x && x.e && x.e.vj);
      push({ id, type, sem: s, kind: w.k, title, detail: w.txt.length > 90 ? w.txt.slice(0, 89) + '…' : w.txt, full: w.txt, soft: clashSev(w) === 'soft', codes, vj,
        wd: (w.A && w.A.wd) || 0, a: (w.A && w.A.a) || 0 });
    }));
    (typeof recNotes !== 'undefined' ? recNotes : []).forEach(txt => {
      const m = /^([A-Z]{2,6}\d{3,7}[A-Z]?)\b/.exec(txt);
      push({ type: 'Datenupdate', sem: 0, title: txt.length > 70 ? txt.slice(0, 69) + '…' : txt, detail: '', full: txt, codes: m && M[m[1]] ? [m[1]] : [], action: 'ack' });
    });
    return out;
  });
  const checks = () => [1, 2, 3, 4].map(s => !collOff.has(s));

  /* ---------- module list and search ---------- */
  const modules = K(() => Object.keys(M).map(code => {
    const m = M[code];
    return { code, name: m.name, ects: m.ects, bracket: marked[code] || primaryBracket(code) || m.primary, brackets: m.brackets || [], turn: turnOf(code),
      lang: m.sprache || '', inPlan: !!marked[code], sem: sem[code] || 0, cat: marked[code] ? semCat(code) : '', limited: isLimMod(code),
      neu: !!m.neu, dep: !!m.dep, nogo: isNogo(code), eth: isEth(code), done: !!done[code] };
  }));
  function search(q) {
    const raw = String(q || '').trim(); if (!raw) return Object.keys(M);
    const terms = fold(raw).split(/\s+/).filter(Boolean), X = terms.map(expand), hits = [];
    const has = (txt, i) => X[i].some(a => txt.includes(a));
    for (const code in M) {
      const s = sc(code);
      if (!terms.every((t, i) => has(s.n, i) || has(s.l, i) || has(s.i, i) || has(s.v, i))) continue;
      const inName = terms.every((t, i) => has(s.n, i));
      let rank = inName ? 0 : (terms.some((t, i) => !has(s.n, i) && !has(s.l, i) && !has(s.i, i)) ? 1 : 2);
      if (code.toLowerCase() === raw.toLowerCase()) rank = -1;
      hits.push({ code, rank });
    }
    hits.sort((x, y) => x.rank - y.rank || M[x.code].name.localeCompare(M[y.code].name));
    return hits.map(o => o.code);
  }
  const filters = { timing: code => { try { return [...phSet(code)]; } catch (e) { return ['none']; } } };

  /* ---------- one module ---------- */
  const RESULT = (c, cat) => {
    const n = M[c].ects;
    if (done[c]) return `Abgeschlossen, zählt mit ${n} ECTS.`;
    if (cat === 's') return `Zählt mit ${n} ECTS.`;
    if (cat === 'u') return `Zählt mit ${n} ECTS, sobald du den Platz hast.`;
    if (cat === 'o') return 'Zählt nicht (optional).';
    if (cat === 'ou') return 'Zählt nicht (optional, Platz offen).';
    if (cat === 'x') { const g = eoOf(c); return `Zählt nicht: ${(g && (g.cnt || g.codes[0])) || ''} hat Vorrang (Entscheidung offen).`; }
    return 'Nicht im Plan.';
  };
  function evRow(c, e, term) {
    const st = evStatus(c, e), wd = e.d ? wdOf(e.d) : 0;
    let room = '', camp = '';
    try { const l = evLoc(c, e); if (l) { room = l.room || ''; camp = l.camp || ''; } } catch (x) {}
    let mand = false; try { mand = mandAll(c, e); } catch (x) {}
    return { key: ekeyG(e), t: e.t, n: e.n || '', wd, v: e.v || '', b: e.b || '', d: e.d || '', room: room || (e.o || ''), camp, grp: e.grp || '', gk: e.gk || '',
      status: st, def: stDefault(c, e), mand, nt: e.nt || '', one: !!(e.one || (typeof ONEOFF !== 'undefined' && ONEOFF.has(e.t))), vj: !!e.vj,
      chosen: typeof grpOK === 'function' ? !!grpOK(c, e) : true, ovr: !!(ovr[c] && ovr[c][ekeyG(e)]) };
  }
  const module = K(c => {
    const m = M[c]; if (!m) return null;
    const inPlan = !!marked[c], cat = inPlan ? semCat(c) : '';
    const term = sem[c] ? termOf(sem[c]) : wantTerm(c), LV = lvFor(c, term) || { list: [] }, list = LV.list || [];
    const events = list.map(e => evRow(c, e, term)), G = {}, gl = grpList(c);
    Object.keys(gl).forEach(gk => G[gk] = { names: gl[gk], chosen: grpChosenSet(c, gk) });
    let lim = null;
    if (isLimMod(c)) { const i = limInfo(c); if (i) lim = { short: limShort(i), reg: limReg(i), groups: (typeof limGroupsTxt === 'function' ? limGroupsTxt(i, 20) : ''), full: !!i.full, vj: !!i.vj, term: i.t, at: typeof LIMD !== 'undefined' ? LIMD : '' }; }
    const g = eoOf(c);
    const before = (m.prereqs || []).filter(x => M[x]);
    const after = Object.keys(M).filter(x => (M[x].prereqs || []).includes(c));
    let exams = [];
    try { exams = (m.ex || []).map(x => ({ d: x.d || '', v: x.v || '', b: x.b || '', room: (x.o && x.o.length ? (typeof ort === 'function' ? ort(x.o) : x.o.join(', ')) : ''), retake: !!x.re, own: !!x._own, changed: !!x._o, key: x._k || '', name: x.n || '' })); } catch (e) {}
    return { code: c, name: m.name, ects: m.ects, m,
      state: { inPlan, bracket: marked[c] || primaryBracket(c), brackets: m.brackets || [], sem: sem[c] || 0,
        status: done[c] ? 'done' : opt[c] ? 'optional' : 'count', seat: isLimMod(c) && inPlan ? (limGot(c) ? 'got' : 'open') : null,
        easy: !!frei[c], cat, result: inPlan ? RESULT(c, cat) : 'Nicht im Plan.', nogo: isNogo(c), nogoReason: nogo[c] || '' },
      term, termLabel: termLabel(term), src: LV.src || null, vj: events.some(e => e.vj) || (!!LV.src && LV.src !== term), events, groups: G,
      variant: typeof optV0 === 'function' ? optV0(c) : null, lim, exams,
      alt: g ? { codes: [g.cnt, ...g.codes.filter(x => x !== g.cnt)].filter(Boolean), rank: [g.cnt, ...g.codes.filter(x => x !== g.cnt)].indexOf(c), cnt: g.cnt, group: eoList.indexOf(g) } : null,
      fallbacks: typeof optsOf === 'function' ? optsOf(c).slice(1).map(o => o.s) : [], before, after, dep: m.dep ? (typeof depTxt === 'function' ? depTxt(c) : 'eingestellt?') : '', link: m.link || '',
      color: color(marked[c] || primaryBracket(c)), turn: turnOf(c), lang: m.sprache || '', camp: (() => { try { const l = modLoc(c); return (l && l.camp) || ''; } catch (e) { return ''; } })(),
      eth: isEth(c), neu: !!m.neu, exs: m.exs || '',
      effort: (() => { try { return typeof effortS === 'function' ? effortS(c) : effort(c); } catch (e) { return null; } })() };
  });

  /* ---------- semesters ---------- */
  const CAT_ORDER = { s: 0, u: 1, o: 2, ou: 2, x: 3 };
  const semesters = K(() => {
    const all = planCodes(), cf = computeConflicts(), iss = issues();
    const out = [];
    for (let s = 0; s <= 4; s++) {
      const L = all.filter(c => (sem[c] || 0) === s), st = semStats(L), term = s ? termOf(s) : '';
      const cards = L.map(c => ({ code: c, name: M[c].name, ects: M[c].ects, bracket: marked[c], color: color(marked[c]), cat: semCat(c), done: !!done[c],
        limited: isLimMod(c), block: typeof blkOut === 'function' ? !!blkOut(c) : false, issue: iss.some(i => !i.hidden && i.sem === s && i.codes.includes(c)) }));
      cards.sort((a, b) => CAT_ORDER[a.cat] - CAT_ORDER[b.cat] || ORDER.indexOf(a.bracket) - ORDER.indexOf(b.bracket) || a.name.localeCompare(b.name));
      out.push({ s, term, label: s ? termLabel(term) : 'Ohne Semester', pub: s ? termPub(term) : true, E: st.E, effortSure: st.es, effortAll: st.ea,
        issues: iss.filter(i => !i.hidden && i.sem === s).length, cards,
        fallbacks: s ? all.filter(c => sem[c] !== s && pUns(c) && (cand[c] || []).includes(s)) : [] });
    }
    return out;
  });

  /* ---------- week (ported from renderWeek; engine view state is set temporarily) ---------- */
  function withWeek(s, mode, f) {
    const sv = { wkSem, WKW, wkF };
    try {
      wkSem = s;
      let W = null;
      if (mode === 'pre' || mode === 'post') { const R = wkBlockInfo(s); if (R[mode] && R[mode].mon != null) W = { s, mode, mon: R[mode].mon }; }
      WKW = W; wkF = Object.assign({}, wkF, { alt: true, hid: true });
      return f(W);
    } finally { wkSem = sv.wkSem; WKW = sv.WKW; wkF = sv.wkF; }
  }
  const fm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(((m % 60) + 60) % 60).padStart(2, '0');
  const hm = m => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  const week = K((s, mode) => {
    s = +s || 1; mode = mode || 'sem';
    return withWeek(s, mode, W => {
      const tm = termOf(s), tpub = termPub(tm);
      const it = semItems(s); if (typeof wkWeekFilter === 'function') wkWeekFilter(s, it); it.forEach(x => { x.cf = false; x.cfs = 0; });
      for (let i = 0; i < it.length; i++) for (let j = i + 1; j < it.length; j++) if (itemsClash(it[i], it[j])) { it[i].cf = true; it[j].cf = true; const sv = (it[i].e && it[i].e.vj) || (it[j].e && it[j].e.vj) ? 1 : 2; it[i].cfs = Math.max(it[i].cfs || 0, sv); it[j].cfs = Math.max(it[j].cfs || 0, sv); }
      try { limFirstClashes(s, it).forEach(r => { r.A.lf = r.F; r.B.lf2 = r.F; }); } catch (e) {}
      const CAND = typeof altItemsFor === 'function' ? altItemsFor(s, it) : [];
      const all = it.concat(CAND);
      const days = [1, 2, 3, 4, 5]; if (all.some(x => x.wd === 6)) days.push(6);
      const vis = all.filter(x => days.includes(x.wd) && wkShow(x));
      /* day summary (unterwegs, Fahrt) */
      const HL = {}, DI = {};
      days.forEach(dd => {
        const Ld = vis.filter(x => x.wd === dd && !x.ign && !x.cand && !(typeof wkHidden === 'function' && wkHidden(x)) && x.loc && x.loc.camp && !['Online', 'Fahrt'].includes(x.loc.camp)).sort((p, q) => p.a - q.a); if (!Ld.length) return;
        const first = Ld[0]; let last = Ld[0]; Ld.forEach(x => { if (x.b > last.b) last = x; }); const hin = travelMin('Zuhause', first.loc.camp), zur = travelMin(last.loc.camp, 'Zuhause');
        const mid = travelIssues(Ld).filter(t => !t.alt).reduce((a, t) => a + t.need, 0), tot = hin + zur + mid; let hs = first.a - hin;
        vis.filter(o => o.wd === dd && !o.ign && o.loc && o.loc.camp === 'Online' && !o.loc.onl && o.a < first.a && o.b > first.a - hin).forEach(o => { hs = Math.min(hs, o.a - hin); });
        HL[dd] = { first, last, hin, zur, hs, tot };
        DI[dd] = `unterwegs ${fm(hs)}–${fm(last.b + zur)} · Fahrt ${Math.floor(tot / 60)}:${String(tot % 60).padStart(2, '0')} h`;
      });
      const WH = workHours(s), WD2 = {};
      if (!W) Object.keys(WH.det).forEach(d => { const r = WH.det[d]; WD2[d] = 'Arbeit ' + hm(r.net) + ' h' + (r.brk ? ' (Pause ' + r.brk + ' min)' : '') + (r.cap ? ' · über 10 h' : ''); });
      const FD = {}; let FT = 0;
      days.forEach(dd => { FD[dd] = freeDay(vis.filter(x => x.wd === dd && !x.ign && !x.cand && !x.one && !(typeof wkHidden === 'function' && wkHidden(x)))); FT += FD[dd]; });
      const SA = planCodes().filter(c => sem[c] === s), lp = SA.reduce((a, c) => a + (cntSure(c) ? (M[c].ects || 0) : 0), 0);
      /* bubbles: same module, same slot, other type = one block (as renderWeek) */
      const iss = issues().filter(i => i.sem === s && (i.type === 'Überschneidung' || i.type === 'Weg'));
      const dayOut = days.map(dd => {
        const L0 = all.filter(x => x.wd === dd).sort((p, q) => p.a - q.a || q.b - p.b), L = [], mgk = {};
        L0.forEach(x => {
          if (x.bl || !x.c || !x.e) { L.push(x); return; }
          const k = x.c + '|' + x.a + '|' + x.b + '|' + (x.ign ? 1 : 0) + '|' + (x.cand ? 1 : 0), h = mgk[k];
          if (!h) { x.mg = []; x.mt = [x.t]; mgk[k] = x; L.push(x); }
          else if (!h.mt.includes(x.t)) { h.mg.push(x); h.mt.push(x.t); h.cf = h.cf || x.cf; h.cfs = Math.max(h.cfs || 0, x.cfs || 0); if (x.lf != null && h.lf == null) h.lf = x.lf; if (x.lf2 != null && h.lf2 == null) h.lf2 = x.lf2; }
          else L.push(x);
        });
        const items = L.filter(x => wkShow(x)).map((x, n) => {
          if (x.bl) return { id: 'b' + x.bi + '-' + dd, kind: 'own', title: x.bl.l || 'Eigener Termin', t: 'JOB', a: x.a, b: x.b, room: x.loc && x.loc.camp || '', fill: '#e3e7ec',
            clash: !!x.cf, soft: x.cfs === 1, counts: true, hiddenByDefault: false, bi: x.bi, status: 'vor', key: '' };
          const c = x.c, A = [x, ...(x.mg || [])].filter(m => m.e), cat = semCat(c), st = evStatus(c, x.e);
          let mand = false; try { mand = A.some(m => mandAll(c, m.e)); } catch (e) {}
          const cf = (x.lf != null || x.lf2 != null) ? Math.max(x.cf ? (x.cfs || 2) : 0, (x.e && x.e.vj) ? 1 : 2) : (x.cf ? (x.cfs || 2) : 0);
          let room = ''; try { room = (x.loc && (x.loc.room || x.loc.camp)) || x.e.o || ''; } catch (e) {}
          const hidden = !!x.cand || !!(typeof wkHidden === 'function' && wkHidden(x));
          return { id: c + '|' + ekeyG(x.e) + '|' + dd + '|' + n, kind: 'ev', code: c, t: x.mt && x.mt.length > 1 ? x.mt.join(' + ') : x.t, title: M[c].name, a: x.a, b: x.b, room,
            fill: color(marked[c]), status: st, counts: !x.ign && !x.cand, clash: cf > 0, soft: cf === 1, mand, vj: !!(x.e && x.e.vj), one: !!x.one,
            tag: x.cand ? 'Alternative' : cat === 'x' ? 'Alternative' : (cat === 'o' || cat === 'ou') ? 'optional' : '', hiddenByDefault: hidden, cand: !!x.cand,
            key: ekeyG(x.e), keys: A.map(m => ekeyG(m.e)) };
        });
        /* travel strips */
        const ONd = L.filter(o => !o.ign && !o.cand && o.loc && o.loc.camp === 'Online'), onHit = (a, n) => ONd.some(o => o.a < a + n && o.b > a);
        const trS = t => { let a = t.A.b; if (!t.bad && onHit(a, t.need) && !onHit(t.B.a - t.need, t.need)) a = t.B.a - t.need; return a; };
        travelIssues(L.filter(x => !x.cand && wkShow(x) && !(typeof wkHidden === 'function' && wkHidden(x)))).filter(t => !t.alt || t.bad).forEach((t, i) => {
          const a = trS(t); items.push({ id: 'tr' + dd + '-' + i, kind: 'travel', title: t.A.loc.camp + ' → ' + t.B.loc.camp, a, b: a + t.need, min: t.need, clash: !!t.bad, counts: true, hiddenByDefault: false });
        });
        const o = HL[dd];
        if (o && o.hin > 0) items.push({ id: 'trh' + dd, kind: 'travel', title: 'Zuhause → ' + o.first.loc.camp, a: o.hs, b: o.hs + o.hin, min: o.hin, counts: true, hiddenByDefault: false });
        if (o && o.zur > 0) items.push({ id: 'trz' + dd, kind: 'travel', title: o.last.loc.camp + ' → Zuhause', a: o.last.b, b: o.last.b + o.zur, min: o.zur, counts: true, hiddenByDefault: false });
        return { wd: dd, summary: DI[dd] || '', label: o ? fm(o.hs) + ' bis ' + fm(o.last.b + o.zur) + ' · Fahrt ' + hm(o.tot) : '', detail: WD2[dd] || '',
          free: FD[dd] || 0, clash: items.some(x => x.clash && !x.hiddenByDefault), items };
      });
      const untimed = [];
      SA.forEach(c => {
        const un = (M[c].lv || []).filter(e => !e.d || !e.v), has = (M[c].lv || []).some(e => e.d && e.v), proj = marked[c] === 'thesis' || marked[c] === 'forsch'; let why = null;
        if (proj && !has) why = 'frei einteilbar';
        else if (!lvFor(c).src) why = 'noch keine Termine';
        else if (!has) why = 'keine Termine in TUMonline';
        else if (un.length) why = un.map(e => e.t + ' ohne Termin').join(', ');
        if (why) untimed.push({ code: c, name: M[c].name, tag: why });
      });
      const modes = ['sem']; try { const R = wkBlockInfo(s); if (R.pre && R.pre.mon != null) modes.unshift('pre'); if (R.post && R.post.mon != null) modes.push('post'); } catch (e) {}
      const src = [...new Set(vis.filter(x => x.e && x.e.vj).map(x => x.e.vj))].sort();
      return { s, term: tm, label: termLabel(tm), pub: tpub, source: src.map(termLabel).join(', '), mode: W ? W.mode : 'sem', week: W ? W.mon : null, modes,
        figures: { ects: lp, work: WH.h, free: FT / 60, goal: WORK_GOAL }, days: dayOut, untimed, issues: iss };
    });
  });

  /* ---------- exams ---------- */
  const exams = K(s => {
    s = +s || 1; const sv = EXO_ALL; let R;
    try { EXO_ALL = true; R = exItems(s); } finally { EXO_ALL = sv; }
    const weeks = [];
    R.out.forEach(o => {
      const iso = isoOf(o.n), wd = new Date(o.n * 864e5).getUTCDay(), mon = o.n - ((wd + 6) % 7), kw = isoWeek(mon);
      let w = weeks.find(x => x.kw === kw); if (!w) { w = { kw, from: isoOf(mon), rows: [] }; weeks.push(w); }
      let room = ''; try { room = o.est ? '' : (o.x.o && o.x.o.length ? ort(o.x.o) : ''); } catch (e) {}
      w.rows.push({ code: o.c, name: M[o.c].name, date: iso, wd, v: o.x.v || '', b: o.x.b || '', room, est: !!o.est, retake: !!(o.x && o.x.re), clash: !!o.cf, sameDay: !!o.sd, optional: !!opt[o.c] });
    });
    return { s, term: R.tm, label: termLabel(R.tm), weeks, undated: R.open.map(o => ({ code: o.c, name: M[o.c].name, known: o.why })) };
  });

  const settings = () => ({ startSem, startYear, workGoal: WORK_GOAL,
    travel: (typeof TRAVEL_PAIRS !== 'undefined' ? TRAVEL_PAIRS : []).map(([a, b]) => ({ a, b, min: travel.pairs[tKey(a, b)] != null ? travel.pairs[tKey(a, b)] : null })),
    blocks: blocks.map((b, i) => ({ i, l: b.l || '', wd: +b.wd, v: b.v, b: b.b, sems: b.sems || null, loc: b.loc || '', from: b.from || '', to: b.to || '' })) });

  function exportText() {
    return new Promise(res => {
      const oc = URL.createObjectURL, ck = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = b => { URL.createObjectURL = oc; b.text().then(t => res(t)); return 'blob:none'; };
      HTMLAnchorElement.prototype.click = function () { HTMLAnchorElement.prototype.click = ck; };
      try { exportPlan(); } catch (e) { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ck; res(''); }
    });
  }


  /* ---------- actions: same engine calls as the old handlers, then one notification ---------- */
  const act = f => function () { const a = arguments; let r; depth++; try { r = f.apply(null, a); } finally { depth--; pending = false; } notify(); return r; };
  const rer = c => { proposal = null; try { renderPlan(); } catch (e) { console.error(e); } try { renderSemIfOpen(); } catch (e) {} try { if (wkSem) renderWeek(); } catch (e) {} if (c) { try { syncDrawer(c); } catch (e) {} try { syncNode(c); } catch (e) {} } };
  const setInPlan = act((c, on) => { if (!M[c]) return; if (on) { if (!marked[c]) mark(c); } else if (marked[c]) { if (eoOf(c)) eoUnlink(c); unmark(c); } });
  const setBracket = act((c, b) => { if (!M[c] || !marked[c] || !(M[c].brackets || []).includes(b)) return; marked[c] = b; save(); afterChange(c); });
  const setSemester = act((c, s) => {
    s = +s || 0; if (!marked[c]) return;
    if (s && optsL[c] && optsL[c].length) { optsApply(c, [{ s, v: optV0(c) }, ...optsOf(c).slice(1).filter(o => o.s !== s)]); afterChange(c); }
    else setSem(c, s);
  });
  const setStatus = act((c, st) => {
    if (!marked[c]) return false;
    if (st === 'count' && semCat(c) === 'x') return false;
    if (st === 'optional') { opt[c] = 1; delete done[c]; }
    else if (st === 'done') { done[c] = 1; delete opt[c]; }
    else { delete opt[c]; delete done[c]; }
    saveOpt(); savePst(); if (typeof eoEnforce === 'function') eoEnforce(); afterChange(c); return true;
  });
  const setSeat = act((c, st) => { if (!marked[c]) return; if (st === 'got') pst[c] = 'z'; else delete pst[c]; savePst(); afterChange(c); });
  const setEasy = act((c, on) => { if (on) frei[c] = 1; else delete frei[c]; saveFrei(); proposal = null; renderSem(); renderPlan(); try { syncDrawer(c); } catch (e) {} });
  const setAttendance = act((c, key, st) => setStatus_(c, [key], st == null ? keyDefault(c, key) : st));
  const setStatus_ = (c, keys, st) => window.setStatus(c, keys, st);
  const setGroup = act((c, gk, names) => { grpSel[c + '|' + gk] = names; saveGroups(); afterChange(c); });
  const setVariant = act((c, v, t) => {
    const term = sem[c] ? termOf(sem[c]) : wantTerm(c), T = t ? [t] : Object.keys(varKinds(lvFor(c, term).list));
    const o = varSel[c] || (varSel[c] = {}); T.forEach(k => { if (v) o[k] = v; else delete o[k]; }); if (!Object.keys(o).length) delete varSel[c];
    saveVar(); rer(c);
  });
  const toggleMandatory = act((c, key) => toggleMand(c, key));
  const toggleMandatoryDate = act((c, key, iso) => toggleMandDate(c, key, iso));
  const toggleCancelled = act((c, key, iso) => toggleAusf(c, key, iso));
  const setOverride = act((c, key, o) => ovrSet(c, key, o || null));
  const linkAlternative = act((a, b) => { eoLink(a, b); afterChange(a); });
  const unlinkAlternative = act(c => { eoUnlink(c); afterChange(c); });
  const rankAlternative = act((c, d) => { eoMove(c, d); afterChange(c); });
  const decide = act(c => {
    const g = eoOf(c); if (!g) return false; const rest = g.codes.filter(x => x !== c);
    if (g.auto.includes(c)) delete opt[c]; saveOpt(); eoList = eoList.filter(y => y !== g); saveEo(); rest.forEach(x => unmark(x)); afterChange(c); return true;
  });
  const setFallbacks = act((c, list) => { if (!sem[c]) return; optsApply(c, [{ s: sem[c], v: optV0(c) }, ...(list || []).filter(s => s !== sem[c]).map(s => ({ s, v: null }))]); afterChange(c); });
  const hideIssue = act((id, on) => { if (on) hideW[id] = 1; else delete hideW[id]; saveHideW(); renderPlan(); });
  const ackUpdateNotes = act(() => { recNotes = []; saveRecNotes(); renderPlan(); });
  const setCheck = act((s, on) => { if (on) collOff.delete(s); else collOff.add(s); saveColl(); collRefresh(); });
  const normBlock = o => { const nb = { l: (o.l || '').trim() || 'Eigener Termin', wd: +o.wd, v: o.v, b: o.b, sems: o.sems || [], loc: o.loc || blockLoc({ l: o.l || '' }) }; if (o.from) nb.from = o.from; if (o.to) nb.to = o.to; return nb; };
  const addBlock = act(o => { blocks.push(normBlock(o)); saveBlocks(); renderSem(); rer(); return blocks.length - 1; });
  const editBlock = act((i, o) => { if (!blocks[i]) return; blocks[i] = normBlock(o); saveBlocks(); renderSem(); rer(); });
  const removeBlock = act(i => { if (!blocks[i]) return; blocks.splice(i, 1); saveBlocks(); renderSem(); rer(); });
  const setTravel = act((a, b, min) => { const k = tKey(a, b); if (min === '' || min == null) delete travel.pairs[k]; else travel.pairs[k] = +min; saveTravel(); renderSem(); rer(); });
  const setWorkGoal = act(hh => { WORK_GOAL = Math.max(0, +hh || 0); saveWorkGoal(); renderSem(); rer(); });
  const setStart = act((letter, year) => {
    if (letter === 'W' || letter === 'S') { startSem = letter; saveStart(); }
    year = +year; if (year > 2000 && year < 2100) { startYear = year; saveStartYear(); }
    renderSem(); renderPlan();
  });
  const exclude = act((c, on, reason) => setNogo(c, on, reason));
  const setExam = act((c, k, o) => exoSet(c, k, o || null));
  function importPreview(text) {
    const R = parsePlanText(text), cs = Object.keys(R.marked).filter(c => M[c]), perSem = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    cs.forEach(c => perSem[R.sem[c] || 0]++);
    return { modules: cs.length, ects: cs.reduce((a, c) => a + (R.opt[c] ? 0 : (M[c].ects || 0)), 0), perSem, notes: R.warn.slice(), unknown: R.unknown.slice() };
  }
  const importApply = act((text, how) => { applyImport(parsePlanText(text), how === 'merge' ? 'merge' : 'replace'); try { renderPlan(); renderSem(); } catch (e) {} });
  const addExtra = act((raw, code) => {
    const id = extraParse(raw), cd = String(code || '').trim().toUpperCase();
    if (!id) return { ok: false, msg: 'Kein TUMonline-Modul-Link und keine ID erkannt.' };
    const L = extraLoadedIds(); if (L[id]) return { ok: false, msg: L[id] + ' ist schon im Planer.' };
    if (cd && M[cd]) return { ok: false, msg: cd + ' ist schon im Planer.' };
    extraList[id] = { c: cd, at: new Date().toISOString().slice(0, 10) }; saveExtra();
    return { ok: true, msg: 'Vorgemerkt: wird beim nächsten Datenupdate geholt.' };
  });

  window.PL = {
    on(f) { subs.add(f); return () => subs.delete(f); },
    _notify: notify, _known: known, _batch(f) { depth++; try { return f(); } finally { depth--; if (!depth && pending) { pending = false; notify(); } } },
    totals, brackets, rules, issues, checks, modules, search, filters, module, semesters, week, exams, settings, exportText,
    setInPlan, setBracket, setSemester, setStatus, setSeat, setEasy, setAttendance, setGroup, setVariant, toggleMandatory, toggleMandatoryDate,
    toggleCancelled, setOverride, linkAlternative, unlinkAlternative, rankAlternative, decide, setFallbacks, hideIssue, ackUpdateNotes, setCheck,
    addBlock, editBlock, removeBlock, setTravel, setWorkGoal, setStart, exclude, setExam, importPreview, importApply, addExtra,
    openExtra: () => { try { openExtra(); } catch (e) { console.error(e); } },
    label, color, dataDate: () => (DATA.terms && DATA.terms.at) || ''
  };
})();
