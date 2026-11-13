#!/usr/bin/env python3
"""TUM Modul-Updater, Planer-Teil (siehe agents/modul-updater/PROMPT.md).

  python3 tum_update.py prep  --planner TUM_Modulplaner.html --plan Modulplan.txt --out job.txt [--start 2026W] [--check MW0850,MW2435]
      Schreibt den Job (eine Zeile JSON) für TUMU.check()/TUMU.start(): Modul-IDs aller Planer-Module, Turnus,
      Studienplan-Konfiguration, die 4 Planungssemester (ab dem Startsemester aus Modulplan.txt) und die gezählten Semester.

  python3 tum_update.py apply --planner TUM_Modulplaner.html --data tum_update_JJJJ-MM-TT.json --out TUM_Modulplaner_neu.html
      [--plan Modulplan.txt] [--check]
      Übernimmt Termine je Semester (lvt), Angebot (dep), neue Module, nicht mehr vorhandene Module, geänderte Stammdaten
      (Name, ECTS, Turnus, Sprache) und die Teilnehmerbegrenzung (lim) und gibt einen kurzen Bericht aus.
      Module mit Fehlern bleiben unverändert. --data darf auch der Text von TUMU.limitsText() sein (nur Teilnehmerbegrenzung).

  python3 tum_update.py show --planner TUM_Modulplaner.html --codes MW0850,MW0142
      Zeigt die Termine (lv) einzelner Module kompakt, zum Abgleich mit TUMonline.
"""
import argparse, datetime, json, re, sys
from collections import Counter, defaultdict

STUDY_LINK = 'https://campus.tum.de/tumonline/ee/ui/ca2/app/desktop/#/slc.cm.reg/student/modules/detail/light/{mid}/study-year/{sj}'
CHECK_DEFAULT = 'MW0850,MW0142,MW1846,MW1277,MW2098,MW2435,MW1982'
NEVER_DEP = {'thesis', 'forsch'}  # Master's Thesis und Forschungspraxis: haben keine Lehrveranstaltungen, nie als eingestellt markieren
WDN = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']


# ---------------------------------------------------------------- Planer lesen/schreiben
def load_planner(path):
    h = open(path, encoding='utf-8').read()
    i = h.index('const DATA=') + len('const DATA=')
    D, end = json.JSONDecoder().raw_decode(h[i:])
    return h, i, end, D

def planner_html(h, i, end, D):
    new = json.dumps(D, ensure_ascii=False, separators=(',', ':'))
    assert '</script' not in new.lower()
    return h[:i] + new + h[i + end:]

def module_ids(M):
    out = {}
    for c, m in M.items():
        mm = re.search(r'/detail/light/(\d+)/', m.get('link') or '')
        if mm: out[c] = int(mm.group(1))
    return out

def turn_letter(t):
    t = t or ''
    if re.search('winter', t, re.I) and re.search('sommer', t, re.I): return 'B'
    if re.search('winter', t, re.I): return 'W'
    if re.search('sommer', t, re.I): return 'S'
    return 'U'

def b36(n):
    a = '0123456789abcdefghijklmnopqrstuvwxyz'; r = ''
    while True:
        n, k = divmod(n, 36); r = a[k] + r
        if n == 0: return r

def decode(line):
    v = 0; out = []
    for x in (line or '').strip().split(','):
        if x: v += int(x, 36); out.append(v)
    return out


# ---------------------------------------------------------------- prep
def tkey(t): return int(t[:4]) * 2 + (1 if t[4] == 'W' else 0)        # Sortierschlüssel: 2026S < 2026W < 2027S
def tshift(t, n):                                                       # Semester n Schritte weiter (n < 0: zurück)
    k = tkey(t) + n; return f"{k // 2}{'W' if k % 2 else 'S'}"
def tlabel(t): return f"WiSe {t[:4]}/{int(t[:4]) % 100 + 1:02d}" if t[4] == 'W' else f"SoSe {t[:4]}"

def start_from_plan(path):
    """Startsemester aus Modulplan.txt: "Startsemester: WiSe 2026" -> 2026W (ohne Jahr: None)."""
    try: txt = open(path, encoding='utf-8').read()
    except OSError: return None
    m = re.search(r'^\s*(?:startsemester|erstes semester)\s*[:=]\s*(\S+)\s+(\d{4})', txt, re.I | re.M)
    if not m: return None
    return m.group(2) + ('W' if re.match(r'(w|winter|wise)', m.group(1), re.I) else 'S')

def cmd_prep(a):
    _, _, _, D = load_planner(a.planner); M = D['modules']
    ids = module_ids(M); by_id = {v: c for c, v in ids.items()}
    s = sorted(by_id); prev = 0; parts = []
    for x in s: parts.append(b36(x - prev)); prev = x
    sj = Counter(re.findall(r'/study-year/(\d+)', ' '.join(m.get('link') or '' for m in M.values()))).most_common(1)
    start = a.start or (start_from_plan(a.plan) if a.plan else None) or (D.get('terms') or {}).get('start') or '2026W'
    P = [tshift(start, k) for k in range(4)]
    F = [tshift(start, k) for k in range(-3, 4)]        # gezählt: 3 Semester vor dem Start bis zum letzten Planungssemester
    back = [tshift(start, k) for k in range(-4, -10, -1)]
    nd = sorted(ids[c] for c, m in M.items() if c in ids and not (m.get('lern') or '').strip() and not (m.get('inhalt') or '').strip())
    ndp = []; pv = 0
    for x in nd: ndp.append(b36(x - pv)); pv = x
    job = {'v': 2, 'cv': a.cv, 'sj': int(a.sj or (sj[0][0] if sj else 1623)), 'root': a.root, 'start': start, 'P': P, 'F': F, 'back': back,
           'ids': ','.join(parts), 'nd': ','.join(ndp), 'tu': ''.join(turn_letter(M[by_id[x]].get('turnus')) for x in s),
           'chk': {c: ids[c] for c in a.check.split(',') if c in ids}}
    xs = sorted({int(x) for x in re.findall(r'\d+', a.extra or '') if int(x) > 0 and int(x) not in by_id})   # Zusatzmodule (TUMonline-IDs)
    if xs:
        xp = []; px = 0
        for x in xs: xp.append(b36(x - px)); px = x
        job['xid'] = ','.join(xp)
    open(a.out, 'w', encoding='utf-8').write(json.dumps(job, separators=(',', ':')) + '\n')
    print(f"Job -> {a.out}: {len(s)} Module, Studienplan {a.cv} (Wurzel {a.root}, Studienjahr {job['sj']}), "
          f"Planungssemester {', '.join(P)} (Start {start}), gezählt {F[0]} bis {F[-1]}, Prüfmodule {', '.join(job['chk'])}")


# ---------------------------------------------------------------- Termine -> lv (aus tumonline_merge.py übernommen)
def fmt(d): return f'{d[8:10]}.{d[5:7]}.{d[0:4]}'

def jsweekday(date):
    return (datetime.date.fromisoformat(date).weekday() + 1) % 7  # Mo=1..So=0

def first_on_weekday(begin, wd_js):
    d = datetime.date.fromisoformat(begin)
    for _ in range(7):
        if (d.weekday() + 1) % 7 == wd_js: return d.isoformat()
        d += datetime.timedelta(days=1)
    return begin

def group_entries(g, base):
    """Einträge (ohne grp) für eine Gruppe: Serien, angehängte und übrige Einzeltermine."""
    ents, singles = [], list(g['o'])
    for row in g['s']:
        sid, wds, v, b, beg, end, room = row[:7]
        short = row[8] if len(row) > 8 else None
        if short:  # kurze Serie (Block): als Einzeltermine behandeln
            singles += [[d + 'T' + v, b, room, 'A'] for d in short]; continue
        for w in str(wds).split('/'):
            if w == '': continue
            wj = int(w)
            ents.append(dict(base, o=room, d=first_on_weekday(beg, wj), v=v, b=b, _end=end, _wd=wj))
    rest = []
    for ts, to, room, typ in singles:
        d, v = ts[:10], ts[11:16]; wj = jsweekday(d)
        hit = next((e for e in ents if e['_wd'] == wj and e['v'] == v and e['b'] == to and d < e['d']), None)
        if hit: hit['d'] = d; continue
        rest.append((d, v, to, room, typ, wj))
    by = defaultdict(list)
    for r in rest: by[(r[5], r[1], r[2])].append(r)
    for (wj, v, to), rs in by.items():
        rs.sort()
        if len(rs) >= 3:
            ents.append(dict(base, o=rs[0][3], d=rs[0][0], v=v, b=to, _end=rs[-1][0], _wd=wj,
                             _extra=f'{len(rs)} Einzeltermine: ' + ', '.join(fmt(r[0])[:6] for r in rs)))
        else:
            for d, v2, to2, room, typ, _ in rs:
                ents.append(dict(base, o=room, d=d, v=v2, b=to2, one=True, _end=d, _wd=wj,
                                 _extra='Einzeltermin' + ('' if typ in ('', 'A') else f' ({typ})')))
    return ents

ONL = re.compile(r'online|videokonferenz|zoom|livestream|virtuell', re.I)
def slot(e): return (e['_wd'], e['v'], e['b'], e.get('one', False) and e['d'])
def dedupe(ents):
    seen, out = set(), []
    for e in sorted(ents, key=lambda e: (e['d'], e['v'])):
        if slot(e) in seen: continue
        seen.add(slot(e)); out.append(e)
    return out

def variants(gname, ents):
    """Hybride Gruppen (gleichzeitig Präsenz und online) werden in "(vor Ort)" und "(online)" aufgeteilt."""
    if re.search('online', gname, re.I):
        return [(gname, dedupe([dict(e, o='Online') for e in ents]))]
    on = [e for e in ents if ONL.search(e['o'])]; off = [e for e in ents if not ONL.search(e['o'])]
    son, soff = {slot(e) for e in on}, {slot(e) for e in off}
    if on and off and son & soff:
        return [(gname + ' (vor Ort)', dedupe(off + [e for e in on if slot(e) not in soff])),
                (gname + ' (online)', dedupe([dict(e, o='Online') for e in on] + [e for e in off if slot(e) not in son]))]
    return [(gname, dedupe(ents))]

def finish(e):
    nt = 'laut TUMonline ' + (fmt(e['d']) if e.get('one') else fmt(e['d']) + '–' + fmt(e['_end']))
    if e.get('_extra'): nt += ', ' + e['_extra']
    e['nt'] = nt
    for k in ('_end', '_wd', '_extra'): e.pop(k, None)
    return e

def build(code, courses, old_lv, review):
    """courses: [(Kurs-ID, Typ, SWS, Name, Lehrende, Gruppen)] eines Semesters -> lv-Liste."""
    lv, cnt = [], Counter(c[1] for c in courses)
    if any(v > 1 for v in cnt.values()):
        review.append(code + ': mehrere LVs gleichen Typs ' + ', '.join(f'{c[1]} {c[3]}' for c in courses))
    seen_t = Counter()
    olddef = {(e.get('gk'), e.get('grp')) for e in old_lv or [] if e.get('gdef')}
    for cid, typ, sws, name, doz, groups in courses:
        seen_t[typ] += 1
        gk = typ if cnt[typ] == 1 else f'{typ}{seen_t[typ]}'
        base = {'t': typ, 'n': name, 'sws': sws, 'doz': doz, 'o': ''}
        gs = [g for g in groups if g['s'] or g['o']]
        if not gs:
            lv.append(dict(base, nt='laut TUMonline noch ohne Termine')); continue
        per, used = [], Counter()
        for g in gs:
            for nm, ents in variants(g['n'].strip() or 'Gruppe', group_entries(g, base)):
                used[nm] += 1
                per.append((nm if used[nm] == 1 else f'{nm} ({used[nm]})', ents))
        if len(per) == 1:
            lv += [finish(e) for e in per[0][1]]
        else:  # mehrere Gruppen oder vor Ort/online: im Planer wählbar (Gruppenwahl)
            for gname, ents in per:
                for e in ents:
                    e = finish(e); e['grp'] = gname; e['gk'] = gk
                    if (gk, gname) in olddef: e['gdef'] = True
                    lv.append(e)
    return lv

def courses_of(lst, C):
    """[[Element, Kurs-ID, Typ, SWS, Lehrende]] -> build()-Eingabe; None, wenn Termine eines Kurses fehlen."""
    per = Counter(x[0] for x in lst); out = {}
    for el, cid, typ, sws, doz in lst:
        g = C.get(str(cid))
        if g is None: return None
        typ = typ or 'VO'
        out.setdefault(cid, (cid, typ, sws, el if per[el] == 1 else f'{el} ({typ})', doz, g))
    return list(out.values())

def lv_sig(lv):   # zeitlich relevante Teile (für "Termine geändert"; Lehrende, Räume und Notizen zählen nicht)
    return sorted({(e.get('t', ''), e.get('grp', ''), jsweekday(e['d']) if e.get('d') else -1, e.get('v', ''), e.get('b', ''), bool(e.get('one'))) for e in lv or []})

def lv_summary(lv, maxn=12):
    ev = [f"{e['t']}{(' ' + e['grp']) if e.get('grp') else ''} {WDN[jsweekday(e['d'])]} {e['v']}-{e['b']}{' am ' + fmt(e['d']) if e.get('one') else ''}"
          for e in lv or [] if e.get('d')]
    return ('; '.join(ev[:maxn]) + (f' … (+{len(ev) - maxn})' if len(ev) > maxn else '')) if ev else '(keine Termine)'


# ---------------------------------------------------------------- Studienplanbaum
def tree_index(T, root):
    """Baum {Knoten: [Eltern, Art, Code, Name, Modul-ID, ECTS]} -> {Code: [(Kategorie-Kette, Modul-ID, ECTS)]} in Baumreihenfolge."""
    pos = defaultdict(list)
    def chain(k):
        out, seen = [], set()
        while k in T and k not in seen:
            seen.add(k); out.append(k); k = T[k][0]
        return out[::-1]
    for k, (par, kind, code, name, mid, ects) in T.items():
        if kind == 'M' and code: pos[code].append((chain(par), mid, ects, k))
    for c in pos: pos[c].sort(key=lambda x: int(x[3]))
    return pos

def bracket_model(pos, M):
    """Kategorie-Knoten -> Bereich, gelernt aus den vorhandenen Planer-Modulen (Mehrheit >= 80 %)."""
    cnt = defaultdict(Counter)
    for c, ps in pos.items():
        if c not in M: continue
        for ch, *_ in ps:
            for k in ch: cnt[k].update(M[c].get('brackets') or [])
    model = {}
    for k, cn in cnt.items():
        b, n = cn.most_common(1)[0]
        if n / sum(cn.values()) >= 0.8: model[k] = b
    return model

def predict(ps, model):
    out = []
    for ch, *_ in ps:
        for k in reversed(ch):
            if k in model: out.append(model[k]); break
    return list(dict.fromkeys(out))


# ---------------------------------------------------------------- Planer-Code (einmalig, idempotent)
DESC_KEYS = ('lern', 'inhalt', 'lehr', 'medien', 'lit', 'vora', 'pruef', 'verantw', 'kuerzel', 'dauer')
PATCH_MARK = '/*tumupd:1*/'
TERM_MARK = '/*tumterm:1*/'   # Planer kann Termine je Semester (lvt) anzeigen (ab Planer v21)
LIM_MARK = '/*tumlim:1*/'     # Planer zeigt die Teilnehmerbegrenzung (lim) an (ab Planer v33)
def ensure_code(h):
    """Anzeige für neue Module ("neu") und Module, die nicht mehr im Studienplan stehen. Liefert (html, Hinweis)."""
    if PATCH_MARK in h: return h, 'Planer-Code aktuell'
    m1 = re.search(r"function depTxt\(c\)\{[^\n]*\n", h); m2 = re.search(r"function depBadge\(c\)\{[^\n]*\n", h)
    if not (m1 and m2 and h.count('</style>') == 1):
        return h, 'WARNUNG: Planer-Code nicht erkannt, Anzeige "neu" / "nicht mehr im Studienplan" fehlt (Daten sind trotzdem gesetzt)'
    dep_txt = ("function depTxt(c){" + PATCH_MARK + "const d=M[c].dep;if(!d)return '';const a=[];if(d.stp===false)a.push('nicht mehr im Studienplan');"
               "if(d.miss&&d.miss.length)a.push('kein Angebot in '+d.miss.join(', ')+(d.last?' (zuletzt '+d.last+')':' (auch davor keines gefunden)'));"
               "return a.join(', ');}\n")
    dep_badge = ("function depBadge(c){const d=M[c].dep,n=M[c].neu;return (n?`<span class=\"rtag ntag\" title=\"Neu im Studienplan, gefunden am ${fmtD(n)} (Modul-Updater)\">neu</span>`:'')"
                 "+(d?`<span class=\"rtag dtag\" title=\"${esc('Möglicherweise eingestellt: '+depTxt(c)+'. Geprüft am '+fmtD(d.at)+' in TUMonline.')}\">eingestellt?</span>`:'');}\n")
    h = h[:m1.start()] + dep_txt + h[m1.end():]
    m2 = re.search(r"function depBadge\(c\)\{[^\n]*\n", h)
    h = h[:m2.start()] + dep_badge + h[m2.end():]
    h = h.replace('</style>', '.rtag.ntag{background:#e3f4e8;color:#1f6b3a;border-color:#a9d8b8}\n</style>')
    return h, 'Planer-Code ergänzt (Anzeige "neu" und "nicht mehr im Studienplan")'


# ---------------------------------------------------------------- apply
def new_module(code, ps, rec, model, M, sj, today):
    f = rec.get('f') or {}
    br = predict(ps, model)
    m = {'name': rec.get('n') or '', 'ects': int(float(str(ps[0][2]).replace(',', '.') or rec.get('cr') or 0)), 'brackets': br,
         'primary': br[0] if br else '', 'lvt': {}, 'ex': [], 'exs': 'Termin noch offen', 'pfad': '', 'link': STUDY_LINK.format(mid=ps[0][1], sj=sj), 'neu': today}
    for k in ('sprache', 'turnus', 'dauer', 'kuerzel', 'vora', 'pruef', 'lern', 'inhalt', 'lehr', 'medien', 'lit', 'verantw'):
        if f.get(k) and not (k == 'sprache' and f[k] == 'Unterrichtete Sprache'): m[k] = f[k]
    if rec.get('dept'): m['dept'] = rec['dept']
    if any(f.get(k) for k in ('h0', 'h1', 'h2')): m['h'] = [f.get('h0', ''), f.get('h1', ''), f.get('h2', '')]
    wf, we = f.get('whF') == 'Ja', f.get('whE') == 'Ja'
    if wf or we: m['wh'] = 'im Folgesemester und am Semesterende' if wf and we else 'im Folgesemester' if wf else 'am Semesterende'
    pre = [p for p in dict.fromkeys(re.findall(r'\b([A-Z]{2,5}\d{3,6}[A-Z]?)\b', m.get('vora', ''))) if p in M and p != code]
    if pre: m['prereqs'] = pre
    return m

# ---------------------------------------------------------------- Teilnehmerbegrenzung
def _add_proc_row(gs, typ, mx, pid, used):
    """Platzzahl nur am Anmeldeverfahren (keine Gruppe begrenzt): eine Zeile je Verfahren, Typen mehrerer Kurse mit '+' verbunden."""
    if pid in used:
        row = used[pid]
        if typ not in row[0].split('+'): row[0] += '+' + typ
        return
    row = [typ, '', mx, None]; used[pid] = row; gs.append(row)

def limits_from_full(R):
    """Aus einem vollen Lauf (c: Gruppen mit mx/cf, rp: Kurs -> Verfahren, pr: Verfahren) -> {Modul-ID: {Semester: {g, p}}}."""
    C = R.get('c') or {}; RP = R.get('rp') or {}; PR = R.get('pr') or {}; need = R.get('need') or []
    out = {}
    for mid_s, rec in (R.get('m') or {}).items():
        if not isinstance(rec, dict): continue
        lim = {}
        for t, lst in (rec.get('L') or {}).items():
            if t not in need: continue
            gs, ps, used, seen = [], [], {}, set()
            for x in lst:
                cid, typ = str(x[1]), x[2] or 'VO'
                if cid in seen: continue     # derselbe Kurs unter mehreren Elementen
                seen.add(cid)
                groups = C.get(cid) or []
                pids = [str(p) for p in RP.get(cid) or [] if str(p) in PR]
                lg = [g for g in groups if g.get('mx') is not None]
                pm = [p for p in pids if PR[p].get('mx') is not None]
                if not lg and not pm: continue
                for g in lg: gs.append([typ, (g.get('n') or '').strip()[:40] if len(groups) > 1 else '', g['mx'], g.get('cf')])
                if not lg:
                    for p in pm: _add_proc_row(gs, typ, PR[p]['mx'], p, used)
                for p in pids:
                    q = PR[p]
                    row = [(q.get('n') or '')[:80], (q.get('b') or '')[:10], (q.get('e') or '')[:10], (q.get('z') or '')[:10], q.get('r') or '',
                           q.get('i') or '', q.get('mx'), (q.get('de') or '')[:10]]
                    if row not in ps: ps.append(row)
            if gs: lim[t] = {'g': gs, 'p': ps}
        if lim: out[int(mid_s)] = lim
    return out

def limits_from_text(R):
    """Aus TUMU.limitsText() (kind lim, v3): Zeilen sind schon berechnet, Verfahren als IDs, Reihung als Index in rk."""
    PR = R.get('pr') or {}; RK = R.get('rk') or []; need = R.get('need') or []
    prow = lambda q: [q[0], q[1], q[2], q[3], RK[q[4]] if isinstance(q[4], int) and 0 <= q[4] < len(RK) else '', q[5], q[6], q[7]]
    out = {}
    for mid_s, terms in (R.get('m') or {}).items():
        uniq = lambda rows: [r for k, r in enumerate(rows) if r not in rows[:k]]   # gleiche Verfahrenszeilen nur einmal (wie im vollen Lauf)
        lim = {t: {'g': v['g'], 'p': uniq([prow(PR[str(p)]) for p in v.get('p') or [] if str(p) in PR])} for t, v in terms.items() if t in need and v.get('g')}
        if lim: out[int(mid_s)] = lim
    return out

def apply_limits(M, R, code_of, checked):
    """lim je Modul und Semester: {Semester: {'g': [[Typ, Gruppe, Plätze, belegt]], 'p': [[Verfahren, Anmeldung von, bis,
    Vergabe, Reihung, Status, Plätze gesamt, Abmeldung bis]]}}. Nur Kurse mit begrenzter Gruppe (oder Verfahren mit Platzzahl).
    checked: Modul-IDs, deren Kurse vollständig geprüft wurden (dort wird eine alte Begrenzung entfernt, wenn keine mehr da ist)."""
    by_mid = limits_from_text(R) if R.get('kind') == 'lim' else limits_from_full(R)
    out = {code_of[m]: v for m, v in by_mid.items() if m in code_of}
    n_cleared = 0
    for mid in checked:
        c = code_of.get(mid)
        if not c: continue
        if c in out: M[c]['lim'] = out[c]
        elif M[c].pop('lim', None) is not None: n_cleared += 1
    return out, n_cleared

def lim_text(lim, t=None):
    """Kurzfassung: 'PR 15/15 VOLL, Anmeldung 01.09.–31.10.2026' (je Semester)."""
    parts = []
    for tt, L in sorted((lim or {}).items(), key=lambda x: tkey(x[0])):
        if t and tt != t: continue
        by = defaultdict(lambda: [0, 0, 0, 0])
        for typ, grp, mx, cf in L['g']:
            b = by[typ]; b[0] += mx or 0; b[1] += cf or 0; b[2] += 1; b[3] += 1 if (cf or 0) >= (mx or 0) else 0
        g = ', '.join(f"{typ} {cf}/{mx}{' VOLL' if full == n else ''}{f' ({n} Gruppen)' if n > 1 else ''}" for typ, (mx, cf, n, full) in by.items())
        p = '; '.join(dict.fromkeys(f"Anmeldung {fmt(b)}–{fmt(e)}" + (f", Vergabe {fmt(z)}" if z else '') for _, b, e, z, *_ in L['p'] if b and e))
        parts.append(f"{tt}: {g}" + (f" | {p}" if p else ''))
    return ' || '.join(parts)

def cmd_apply_limits_only(a, h, i, end, D, R):
    M = D['modules']; ids = module_ids(M); code_of = {v: c for c, v in ids.items()}
    checked = decode(R.get('ids')); today = (R.get('limAt') or datetime.date.today().isoformat())[:10]
    old_need = (D.get('terms') or {}).get('need')
    if old_need and sorted(old_need) != sorted(R.get('need') or []):
        print(f"WARNUNG: Semester der Begrenzung ({' '.join(R.get('need') or [])}) passen nicht zu den Terminen im Planer ({' '.join(old_need)}); "
              "erst einen vollen Lauf machen.")
    out, cleared = apply_limits(M, R, code_of, checked)
    D.setdefault('terms', {})['lim'] = today
    html = planner_html(h, i, end, D)
    open(a.out, 'w', encoding='utf-8').write(html)
    lim_report(M, out, cleared, len(checked), len(R.get('err') or []), a.plan, LIM_MARK in h)
    if a.check: check(a.out)

def lim_report(M, out, cleared, n_checked, n_err, plan, shown):
    full = [c for c, L in out.items() if any(all((cf or 0) >= mx for _, _, mx, cf in v['g']) for v in L.values())]
    print(f"Teilnehmerbegrenzung: geprüft {n_checked} Module{', Fehler ' + str(n_err) if n_err else ''} | begrenzt {len(out)} Module, "
          f"davon voll {len(full)} | Begrenzung entfernt {cleared}")
    if not shown: print('WARNUNG: Dieser Planer zeigt die Teilnehmerbegrenzung nicht an (Marker ' + LIM_MARK + ' fehlt, Planer ab v33 nötig). Daten sind gesetzt.')
    if plan:
        codes = [c for c in dict.fromkeys(re.findall(r'\b([A-Z]{2,5}\d{3,6}[A-Z]?)\b', open(plan, encoding='utf-8').read())) if c in M]
        hits = [c for c in codes if M[c].get('lim')]
        print('PLAN-MODULE mit Teilnehmerbegrenzung:' + ('' if hits else ' keine'))
        for c in hits: print(f"  {c} {M[c]['name'][:45]}: {lim_text(M[c]['lim'])}")

def cmd_apply(a):
    h, i, end, D = load_planner(a.planner); M = D['modules']; T = D['tree']
    if TERM_MARK not in h:
        sys.exit('ABBRUCH: Der Planer ist zu alt (keine Termine je Semester, Marker ' + TERM_MARK + '). Erst den Planer ab v21 verwenden.')
    R = json.load(open(a.data, encoding='utf-8'))
    if R.get('kind') == 'lim': return cmd_apply_limits_only(a, h, i, end, D, R)
    job = R['job']; C = R['c']; recs = R['m']
    if job.get('v') != 2 or not R.get('need'):
        sys.exit('ABBRUCH: Daten passen nicht zu dieser Version (Job v2 mit pub/need erwartet). Browser-Teil und Skript aus demselben Ordner verwenden.')
    pub = sorted(R['pub'], key=tkey); need = R['need']
    win = {'W': [t for t in pub if t[4] == 'W'][-2:], 'S': [t for t in pub if t[4] == 'S'][-2:], 'B': pub[-3:], 'U': pub[-4:]}
    dep_before = sum(1 for m in M.values() if m.get('dep'))
    today = (R.get('finished') or R.get('started') or datetime.date.today().isoformat())[:10]
    old = {c: json.dumps(m.get('lvt') or {}, sort_keys=True) for c, m in M.items()}
    old_dep = {c: json.dumps({k: v for k, v in (m.get('dep') or {}).items() if k != 'at'}, sort_keys=True) for c, m in M.items()}
    rep = defaultdict(list); review = []
    if R.get('phase') != 'done':
        print(f"WARNUNG: Lauf nicht fertig (Phase {R.get('phase')}), nur abgerufene Module werden übernommen.")

    # Baum
    tree = R.get('tree') or {}
    pos = tree_index(tree, str(job['root']))
    model = bracket_model(pos, M)
    ids = module_ids(M); code_of = {v: c for c, v in ids.items()}
    in_sp = [c for c in ids if not M[c].get('ext')]
    linked_in_tree = sum(1 for c in in_sp if c in pos)
    tree_ok = not R.get('treeErr') and linked_in_tree >= 0.9 * max(1, len(in_sp))
    names = {k: v[3] for k, v in tree.items()}
    for c, ps in pos.items():   # Pfad (Kategorien ohne Wurzel) für neue Module
        if c not in M: continue
        if not M[c].get('pfad'): M[c]['pfad'] = ' > '.join(names[k] for k in ps[0][0])

    # neue Module
    for c, ps in pos.items():
        if c in M: continue
        mid = ps[0][1]; rec = recs.get(str(mid))
        if not mid or not isinstance(rec, dict): rep['neu_fehler'].append(c); continue
        M[c] = new_module(c, ps, rec, model, M, job['sj'], today)
        M[c]['pfad'] = ' > '.join(names[k] for k in ps[0][0])
        code_of[mid] = c
        if not M[c]['brackets']: rep['neu_ohne_bereich'].append(c)
        else:
            lane = M[c]['primary']; ords = [n['ord'] for n in T['nodes'].values() if n['lane'] == lane]
            T['nodes'][c] = {'lane': lane, 'ects': M[c]['ects'], 'ord': (max(ords) + 1) if ords else 0}
            T['edges'] += [[p, c] for p in M[c].get('prereqs', [])]
        rep['neu'].append(c)

    # Zusatzmodule (außerhalb des Studiengangs, v57): eigene Spur "zusatz", zählen nie
    for mid in decode(job.get('xid') or ''):
        if mid in code_of: continue
        rec = recs.get(str(mid))
        if not isinstance(rec, dict) or not rec.get('code'): rep['zusatz_fehler'].append(str(mid)); continue
        c = rec['code']
        if c in M: rep['zusatz_doppelt'].append(c); continue
        m = new_module(c, [[[], mid, '']], rec, {}, M, job['sj'], today)
        m.update({'brackets': ['zusatz'], 'primary': 'zusatz', 'ext': True, 'pfad': 'Zusatzmodul (außerhalb des Studiengangs)'})
        del m['neu']
        M[c] = m; code_of[mid] = c; ids[c] = mid
        if 'zusatz' not in T['lanes']: T['lanes'].append('zusatz')
        ords = [n['ord'] for n in T['nodes'].values() if n['lane'] == 'zusatz']
        T['nodes'][c] = {'lane': 'zusatz', 'ects': m['ects'], 'ord': (max(ords) + 1) if ords else 0}
        T['edges'] += [[p, c] for p in m.get('prereqs', [])]
        rep['zusatz'].append(c)

    # Module, die nicht mehr im Studienplan stehen
    gone = set()
    if tree_ok:
        tree_mids = {p[1] for ps in pos.values() for p in ps}
        for c, mid in ids.items():
            if not M[c].get('ext') and c not in pos and mid not in tree_mids and not set(M[c].get('brackets') or []) & NEVER_DEP: gone.add(c)

    # je Modul: Termine, Angebot, Stammdaten
    for mid_s, rec in recs.items():
        c = code_of.get(int(mid_s))
        if not c: continue
        if rec == 'err': rep['fehler'].append(c); continue
        m = M[c]
        L = rec.get('L') or {}; cnt = rec.get('cnt') or {}; lvt = {}; ok = True
        for t in need:
            if cnt.get(t, 0) > 0 and t not in L: ok = False; break      # Kursliste fehlt (z. B. nach Wiederholung)
            cs = courses_of(L.get(t, []), C)
            if cs is None: ok = False; break
            lvt[t] = build(c, cs, (m.get('lvt') or {}).get(t), review if t == need[0] else [])
        if not ok: rep['termine_fehlen'].append(c)
        else:
            m['lvt'] = lvt; rep['termine'].append(c)
            for k in ('lv', 'lvS', 'lvSTerm'): m.pop(k, None)
        tu = rec.get('tu') or 'U'; w = win[tu]
        miss = [t for t in w if cnt.get(t, -1) <= 0]
        # Nicht eingestellt, sobald das neueste Fenstersemester (oder ein späteres) Lehrveranstaltungen hat: neue Module oder
        # Module mit Lücke in älteren Semestern bleiben unmarkiert. Unregelmäßig: nur wenn alle Fenstersemester leer sind.
        later = bool(w) and any(n > 0 for t, n in cnt.items() if tkey(t) >= tkey(w[-1]))
        flag = bool(w) and not later and (len(miss) == len(w) if tu == 'U' else True)
        if flag and not set(m.get('brackets') or []) & NEVER_DEP:
            seen = [t for t in sorted(cnt, key=tkey) if cnt[t] > 0]
            m['dep'] = {'miss': miss, 'last': seen[-1] if seen else rec.get('old') or '', 'at': today}
        else: m.pop('dep', None)
        if c not in rep['neu'] and c not in rep['zusatz'] and isinstance(rec.get('f'), dict):    # v55: Beschreibung füllen und aktualisieren (wie updApply im Planer)
            f = rec['f']; fill, upd = [], []
            for k in DESC_KEYS:
                nv = f.get(k)
                if not nv or ' '.join(str(nv).split()) == ' '.join(str(m.get(k) or '').split()): continue   # nur Leerraum anders: alten Text lassen
                (upd if (m.get(k) or '').strip() else fill).append(k); m[k] = nv
            if f.get('h0') or f.get('h1') or f.get('h2'):
                hh = [f.get('h0') or '', f.get('h1') or '', f.get('h2') or '']
                if hh != m.get('h'): (upd if m.get('h') else fill).append('h'); m['h'] = hh
            wf, we = f.get('whF') == 'Ja', f.get('whE') == 'Ja'
            if wf or we:
                w2 = 'im Folgesemester und am Semesterende' if wf and we else 'im Folgesemester' if wf else 'am Semesterende'
                if w2 != m.get('wh'): (upd if m.get('wh') else fill).append('wh'); m['wh'] = w2
            if rec.get('dept') and rec['dept'] != m.get('dept'): m['dept'] = rec['dept']
            if any(k in ('lern', 'inhalt') for k in fill + upd):
                if rec.get('dl'): m['dl'] = rec['dl']
                else: m.pop('dl', None)
            if fill: rep['beschr'].append(f"{c} ({', '.join(fill)}{'; ' + rec['dl'] if rec.get('dl') else ''})")
            if upd: rep['beschr_upd'].append(f"{c} ({', '.join(upd)})")
        if c not in rep['neu'] and c not in rep['zusatz']:
            for key, new, label in (('name', (rec.get('n') or '').strip(), 'Name'), ('turnus', rec.get('tt'), 'Turnus'), ('sprache', rec.get('sp'), 'Sprache')):
                if key == 'sprache' and new == 'Unterrichtete Sprache': continue   # TUMonline-Platzhalter, keine Sprache
                if new and m.get(key) != new: rep['geaendert'].append(f"{c} {label}: {m.get(key) or '-'} -> {new}"); m[key] = new
            if c in pos and pos[c][0][2]:
                e = int(float(str(pos[c][0][2]).replace(',', '.')))
                if e != m.get('ects'):
                    rep['geaendert'].append(f"{c} ECTS: {m.get('ects')} -> {e}"); m['ects'] = e
                    if c in T['nodes']: T['nodes'][c]['ects'] = e
            elif m.get('ext') and rec.get('cr') is not None:   # Zusatzmodule: ECTS aus den Moduldetails
                e = int(float(str(rec['cr']).replace(',', '.')) or 0)
                if e and e != m.get('ects'):
                    rep['geaendert'].append(f"{c} ECTS: {m.get('ects')} -> {e}"); m['ects'] = e
                    if c in T['nodes']: T['nodes'][c]['ects'] = e
    for c in gone:
        M[c].setdefault('dep', {'miss': [], 'last': '', 'at': today}); M[c]['dep']['stp'] = False; M[c]['dep']['at'] = today
    for c, m in M.items():   # Thesis und Forschungspraxis nie als eingestellt (auch Markierungen älterer Werkzeuge entfernen)
        if set(m.get('brackets') or []) & NEVER_DEP and m.pop('dep', None) is not None: rep['ausgenommen'].append(c)
    for c, m in M.items():   # alte Markierung "neu" nach einiger Zeit entfernen
        if m.get('neu') and m['neu'] < (datetime.date.fromisoformat(today) - datetime.timedelta(days=a.new_days)).isoformat(): del m['neu']

    lim_out = None
    if R.get('rp') is not None and R.get('limAt'):
        checked = [int(k) for k, r in recs.items() if isinstance(r, dict)]
        lim_out = apply_limits(M, R, code_of, checked)
    D['terms'] = {'pub': pub, 'need': need, 'at': today, 'start': job.get('start')}
    if lim_out: D['terms']['lim'] = R['limAt'][:10]
    out, code_note = ensure_code(planner_html(h, i, end, D))
    open(a.out, 'w', encoding='utf-8').write(out)

    # Bericht
    deps = [c for c, m in M.items() if m.get('dep')]
    print(f"Baum: {sum(1 for v in tree.values() if v[1] == 'C')} Kategorien, {sum(len(p) for p in pos.values())} Modulpositionen, "
          f"{len(pos)} Module{'' if tree_ok else ' | UNVOLLSTÄNDIG, keine Prüfung auf entfernte Module'}{', Baumfehler ' + str(R.get('treeErr')) if R.get('treeErr') else ''}")
    print(f"Semester: veröffentlicht {' '.join(pub)} | Planungssemester " + ', '.join(
          f"{p} {'echt' if p in pub else ('Vorjahr ' + next((t for t in reversed(pub) if t[4] == p[4] and t < p), '-'))}" for p in job['P']))
    print(f"Module: abgerufen {len(recs)}, Fehler {len(rep['fehler'])} (unverändert), Termine aktualisiert {len(rep['termine'])}, "
          f"Termine unvollständig (unverändert) {len(rep['termine_fehlen'])}")
    print(f"Angebot: möglicherweise eingestellt {len(deps)} (vorher {dep_before}; davon nicht mehr im Studienplan {len(gone)}); "
          f"Fenster W {'/'.join(win['W'])}, S {'/'.join(win['S'])}, beide {'/'.join(win['B'])}; "
          f"Thesis/Forschungspraxis ausgenommen{' (alte Markierung entfernt: ' + ', '.join(rep['ausgenommen']) + ')' if rep['ausgenommen'] else ''}")
    nodesc = [c for c, m in M.items() if not (m.get('lern') or '').strip() and not (m.get('inhalt') or '').strip()]
    print(f"Beschreibungen: aktualisiert {len(rep['beschr_upd'])} Module")
    print(f"Beschreibungen: nachgeladen {len(rep['beschr'])}" + (' (' + '; '.join(rep['beschr'][:20]) + (' …' if len(rep['beschr']) > 20 else '') + ')' if rep['beschr'] else '')
          + f", weiterhin ohne Beschreibung {len(nodesc)} (Module ohne Lernergebnisse und Inhalt in allen Sprachen und Fassungen)")
    print(f"Neu: {len(rep['neu'])}" + (': ' + '; '.join(f"{c} {M[c]['name'][:40]} [{', '.join(M[c]['brackets']) or 'Bereich unbekannt'}]" for c in rep['neu'][:30]) if rep['neu'] else ''))
    if rep['neu_fehler']: print('NEU, ABER OHNE DATEN (Fehler):', ', '.join(rep['neu_fehler'][:30]))
    if rep['zusatz'] or rep['zusatz_fehler'] or rep['zusatz_doppelt']:
        print(f"Zusatzmodule (außerhalb des Studiengangs): neu {len(rep['zusatz'])}" + (': ' + '; '.join(f"{c} {M[c]['name'][:40]}" for c in rep['zusatz']) if rep['zusatz'] else '')
              + (' | nicht gefunden (TUMonline-ID): ' + ', '.join(rep['zusatz_fehler']) if rep['zusatz_fehler'] else '') + (' | schon im Studiengang: ' + ', '.join(rep['zusatz_doppelt']) if rep['zusatz_doppelt'] else ''))
    if gone: print('NICHT MEHR IM STUDIENPLAN:', '; '.join(f"{c} {M[c]['name'][:40]}" for c in sorted(gone)[:30]))
    if rep['geaendert']: print(f"GEÄNDERT ({len(rep['geaendert'])}):", '; '.join(rep['geaendert'][:25]) + (' …' if len(rep['geaendert']) > 25 else ''))
    if rep['fehler']: print('FEHLER (unverändert):', ', '.join(rep['fehler'][:40]))
    if review: print(f'PRÜFEN ({len(review)}, mehrere LVs gleichen Typs, alle als Pflicht übernommen):'); [print('  ' + r[:160]) for r in review[:15]]
    print(code_note)
    if a.plan:
        plan = [c for c in dict.fromkeys(re.findall(r'\b([A-Z]{2,5}\d{3,6}[A-Z]?)\b', open(a.plan, encoding='utf-8').read())) if c in M]
        print('PLAN-MODULE mit Änderungen:')
        n = 0
        for c in plan:
            m = M[c]; notes = []
            o = json.loads(old.get(c, '{}'))
            ch = [t for t in need if lv_sig((m.get('lvt') or {}).get(t)) != lv_sig(o.get(t))]
            if ch: notes.append('Termine geändert ' + '; '.join(f"{t}: {lv_summary((m.get('lvt') or {}).get(t), 6)}" for t in ch[:2]))
            dnow = json.dumps({k: v for k, v in (m.get('dep') or {}).items() if k != 'at'}, sort_keys=True)
            if dnow != old_dep.get(c, '{}'):
                d = m.get('dep')
                notes.append(('eingestellt? ' + ('nicht mehr im Studienplan ' if d.get('stp') is False else '')
                              + ('fehlt ' + ', '.join(d['miss']) + ', zuletzt ' + (d['last'] or 'unbekannt') if d.get('miss') else '')) if d else 'Markierung "eingestellt?" entfernt')
            notes += [x.split(' ', 1)[1] for x in rep['geaendert'] if x.startswith(c + ' ')]
            if notes: print(f'  {c}: ' + ' | '.join(notes)); n += 1
        if not n: print('  keine')
        dl = [c for c in plan if M[c].get('dep')]
        print('PLAN-MODULE "eingestellt?":', ', '.join(f"{c} (fehlt {', '.join(M[c]['dep'].get('miss') or ['Studienplan'])})" for c in dl) or 'keine')
    if lim_out: lim_report(M, lim_out[0], lim_out[1], sum(1 for r in recs.values() if isinstance(r, dict)), len(rep['fehler']), a.plan, LIM_MARK in out)
    else: print('Teilnehmerbegrenzung: nicht im Lauf enthalten (Browser-Teil vor v33), vorhandene Angaben bleiben')
    if a.check: check(a.out)

def check(path):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('CHECK übersprungen (playwright fehlt)'); return
    import os
    errs = []
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + os.path.abspath(path)); pg.wait_for_timeout(1500)
        n = pg.evaluate('Object.keys(M).length'); b.close()
    print('CHECK: Module', n, '| JS-Fehler:', errs or 'keine')

def cmd_show(a):
    _, _, _, D = load_planner(a.planner); M = D['modules']
    for c in a.codes.split(','):
        if c not in M: print(c, 'nicht im Planer'); continue
        m = M[c]; d = m.get('dep')
        print(f"{c} {m['name'][:50]} | {m.get('turnus') or '-'} | {m.get('ects')} ECTS | " + ' | '.join(f"{t}: {lv_summary(v)}" for t, v in sorted((m.get('lvt') or {}).items(), key=lambda x: tkey(x[0])))
              + (f" | eingestellt? {json.dumps(d, ensure_ascii=False)}" if d else '') + (' | neu' if m.get('neu') else '')
              + (f" | BEGRENZT {lim_text(m['lim'])}" if m.get('lim') else ''))

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest='cmd', required=True)
    p = sp.add_parser('prep'); p.add_argument('--planner', required=True); p.add_argument('--out', required=True)
    p.add_argument('--plan', help='Modulplan.txt (liefert das Startsemester, z. B. "Startsemester: WiSe 2026")')
    p.add_argument('--start', help='Startsemester, z. B. 2026W (sonst aus --plan oder dem Planer)')
    p.add_argument('--cv', type=int, default=5451, help='Studienplan-Version (pStpStpNr)')
    p.add_argument('--root', type=int, default=4878472, help='Wurzelknoten des Studienplans (SPO-Version)')
    p.add_argument('--sj', type=int, help='Studienjahr (pSJNr), Standard: aus den Modul-Links')
    p.add_argument('--check', default=CHECK_DEFAULT)
    p.add_argument('--extra', help='TUMonline-IDs von Zusatzmodulen außerhalb des Studiengangs, kommagetrennt (Modul-Link …/detail/light/<ID>/…)')
    p = sp.add_parser('apply')
    for k in ('planner', 'data', 'out'): p.add_argument('--' + k, required=True)
    p.add_argument('--plan'); p.add_argument('--check', action='store_true'); p.add_argument('--new-days', type=int, default=120)
    p = sp.add_parser('show'); p.add_argument('--planner', required=True); p.add_argument('--codes', required=True)
    a = ap.parse_args(); {'prep': cmd_prep, 'apply': cmd_apply, 'show': cmd_show}[a.cmd](a)
