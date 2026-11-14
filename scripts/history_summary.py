#!/usr/bin/env python3
"""Turns data/history.json into planner/src/history.js (window.TUMHIST), the stability tags of the planner.

Per module, season (W/S) and course type (VO, UE, PR, ...), the last three semesters of that season
with dates are compared with the newest one:
  weekly slots   series with at least 4 dates over at least 3 weeks inside the lecture period: (weekday, start)
  block dates    everything else (short series, single dates, series outside the lecture period),
                 classified as before (vor), during (in) or after (nach) the lecture period
Two semesters count as the same when the block phases are equal and the weekly slots are equal
(or, with 3 or more slots such as parallel practical groups, overlap by at least 70 %).

Tag: stabil (all n match the newest), meist (at least 2 of n), wechselt (only the newest), neu (one semester).
The planner (planner/src/api.js) shows it for the season of the semester a module is planned in.

Usage: python scripts/history_summary.py [data/history.json] [planner/src/history.js]
"""
import datetime as dt, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOL = dt.timedelta(days=3)
WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
PH_TXT = {"vor": "Block vor Vorlesungsbeginn", "in": "Einzeltermine in der Vorlesungszeit", "nach": "Block nach Vorlesungsende"}


def lect_table():
    h = (ROOT / "planner" / "TUM_Modulplaner.html").read_text(encoding="utf-8")
    i = h.index("const LECT={")
    body = h[i:h.index("};", i)]
    return {t: (a, b) for t, a, b in re.findall(r"'(\d{4}[WS])':\['([\d-]+)','([\d-]+)'\]", body)}


def easter(y):
    a, b, c = y % 19, y // 100, y % 100
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mo, dd = divmod(h + l - 7 * m + 114, 31)
    return dt.date(y, mo, dd + 1)


def lect_period(t, L):
    """Same rule as lectPeriod() in the planner: table first, else the estimate."""
    if t in L:
        return dt.date.fromisoformat(L[t][0]), dt.date.fromisoformat(L[t][1])
    y = int(t[:4])
    mon_on_after = lambda d: d + dt.timedelta(days=(7 - d.weekday()) % 7)
    if t[-1] == "W":
        s = mon_on_after(dt.date(y, 10, 12))
        return s, s + dt.timedelta(days=17 * 7 - 3)
    s = st = mon_on_after(dt.date(y, 4, 12))
    e = easter(y)
    if e + dt.timedelta(days=2) >= s:
        st, s = e + dt.timedelta(days=3), e + dt.timedelta(days=1)
    return st, s + dt.timedelta(days=14 * 7 - 3)


def phase(d, lp):
    return "vor" if d < lp[0] else "nach" if d > lp[1] else "in"


def signature(courses, typ, lp):
    slots, ph = set(), set()
    for c in courses:
        if c.get("t") != typ:
            continue
        for g in c.get("g") or []:
            for wds, v, b, a0, b0, room, n in g.get("s", []):
                a, z = dt.date.fromisoformat(a0), dt.date.fromisoformat(b0)
                if n >= 4 and (z - a).days >= 21 and not (z < lp[0] - TOL or a > lp[1] + TOL):
                    for w in str(wds).split("/"):
                        if w != "":
                            slots.add((int(w), v))
                else:
                    ph.add(phase(a, lp)); ph.add(phase(z, lp))
            for o in g.get("o", []):
                ph.add(phase(dt.date.fromisoformat(o[0][:10]), lp))
    return frozenset(slots), frozenset(ph)


def same(x, y):
    if x[1] != y[1]:
        return False
    a, b = x[0], y[0]
    if a == b:
        return True
    u = a | b
    return len(a) >= 3 and len(b) >= 3 and len(a & b) / len(u) >= 0.7


def describe(sig):
    sl = sorted(sig[0], key=lambda s: ((s[0] + 6) % 7, s[1]))
    parts = [WD[w] + " " + v for w, v in sl[:3]] + (["+" + str(len(sl) - 3)] if len(sl) > 3 else [])
    parts += [PH_TXT[p] for p in ("vor", "in", "nach") if p in sig[1]]
    return ", ".join(parts)


def summarize(hist, L):
    out = {}
    for code, rec in sorted(hist["modules"].items()):
        T = rec.get("terms") or {}
        if not T:
            continue
        m = {}
        for se in "WS":
            ks = sorted((k for k in T if k[-1] == se), reverse=True)[:3]
            if not ks:
                continue
            types = sorted({c.get("t") for k in ks for c in T[k] if c.get("t")})
            tt = {}
            for typ in types:
                rows = []
                for k in ks:
                    if not any(c.get("t") == typ for c in T[k]):
                        continue
                    sig = signature(T[k], typ, lect_period(k, L))
                    if sig[0] or sig[1]:
                        rows.append((k, sig))
                if not rows:
                    continue
                n, new = len(rows), rows[0][1]
                hit = [same(new, s) for _, s in rows]
                k_ = sum(hit)
                tag = "neu" if n < 2 else "stabil" if k_ == n else "meist" if k_ >= 2 else "wechselt"
                tt[typ] = [tag, k_, n, "".join(p[0] for p in ("vor", "in", "nach") if p in new[1]),
                           [[k, describe(s), int(h)] for (k, s), h in zip(rows, hit)]]
            m[se] = {"terms": ks, "t": tt}
        if m:
            out[code] = m
    return out


def main(src=None, dst=None):
    src = pathlib.Path(src or ROOT / "data" / "history.json")
    dst = pathlib.Path(dst or ROOT / "planner" / "src" / "history.js")
    hist = json.loads(src.read_text(encoding="utf-8"))
    S = summarize(hist, lect_table())
    js = json.dumps({"at": hist.get("at", ""), "m": S}, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    txt = ("/* Generated by scripts/history_summary.py from data/history.json. Do not edit. */\n"
           "window.TUMHIST=" + js + ";\n")
    if not dst.exists() or dst.read_text(encoding="utf-8") != txt:
        dst.write_text(txt, encoding="utf-8")
    from collections import Counter
    c = Counter(v[0] for m in S.values() for s in m.values() for v in s["t"].values())
    print(f"{len(S)} modules, tags {dict(c)}, {len(txt) // 1024} KB -> {dst}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
