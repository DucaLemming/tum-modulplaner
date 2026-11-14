#!/usr/bin/env python3
"""Stability tags from past semesters: classification rules (scripts/history_summary.py) and their display."""
import datetime as dt, sys
sys.path.insert(0, __import__("pathlib").Path(__file__).resolve().parent.parent.joinpath("scripts").as_posix())
import history_summary as HS
from playwright.sync_api import sync_playwright
from helpers import check, open_planner, import_plan

print("1. rules")
L = HS.lect_table(); lp = HS.lect_period("2026W", L)
check(lp == (dt.date(2026, 10, 12), dt.date(2027, 2, 5)), "lecture period from the planner table")
check(HS.lect_period("2021S", L) == (dt.date(2021, 4, 12), dt.date(2021, 7, 16)), "estimated lecture period like lectPeriod()")
pre = [{"t": "SE", "g": [{"s": [["1", "09:00", "17:00", "2026-10-05", "2026-10-09", "", 5]], "o": []}]}]
mid = [{"t": "SE", "g": [{"s": [], "o": [["2026-11-20T09:00", "17:00", ""]]}]}]
post = [{"t": "SE", "g": [{"s": [], "o": [["2027-02-20T09:00", "17:00", ""]]}]}]
check(HS.signature(pre, "SE", lp)[1] == {"vor"}, "block week before the lecture period = vor")
check(HS.signature(mid, "SE", lp)[1] == {"in"} and HS.signature(post, "SE", lp)[1] == {"nach"}, "single dates during / after = in / nach")
wk = lambda wd, v, y=2026: [{"t": "VO", "g": [{"s": [[wd, v, "11:45", f"{y}-10-20", f"{y + 1}-01-30", "", 15]], "o": []}]}]
check(HS.signature(wk("2/4", "10:15"), "VO", lp)[0] == {(2, "10:15"), (4, "10:15")}, "weekly series split by weekday")
check(HS.same(HS.signature(wk("2", "10:15"), "VO", lp), HS.signature(wk("2", "10:15"), "VO", lp)) and
      not HS.same(HS.signature(wk("2", "10:15"), "VO", lp), HS.signature(wk("3", "10:15"), "VO", lp)), "same slot / other weekday")
g8 = lambda n: frozenset((1, f"{8 + i:02d}:00") for i in range(n))
check(HS.same((g8(10), frozenset()), (g8(9), frozenset())) and not HS.same((g8(3), frozenset()), (g8(2), frozenset())), "practical groups: 70 % overlap counts as same")
def tag_of(sems):
    hist = {"modules": {"X": {"terms": {k: c for k, c in sems}}}}
    return HS.summarize(hist, L)["X"][sems[0][0][-1]]["t"]["VO"][:3]
check(tag_of([("2026W", wk("2", "10:15")), ("2025W", wk("2", "10:15", 2025)), ("2024W", wk("2", "10:15", 2024))]) == ["stabil", 3, 3], "3 equal winters = stabil 3/3")
check(tag_of([("2026W", wk("2", "10:15")), ("2025W", wk("3", "10:15", 2025)), ("2024W", wk("2", "10:15", 2024))]) == ["meist", 2, 3], "newest repeats once = meist 2/3")
check(tag_of([("2026W", wk("2", "10:15")), ("2025W", wk("3", "10:15", 2025))]) == ["wechselt", 1, 2], "newest differs = wechselt")
ss = [{"t": "VO", "g": [{"s": [["5", "08:00", "09:30", "2026-04-20", "2026-07-10", "", 12]], "o": []}]}]
mix = HS.summarize({"modules": {"X": {"terms": {"2026W": wk("2", "10:15"), "2026S": ss, "2025W": wk("2", "10:15", 2025)}}}}, L)["X"]
check(mix["W"]["t"]["VO"][:3] == ["stabil", 2, 2] and mix["S"]["t"]["VO"][0] == "neu", "seasons compared separately")

print("2. display")
with sync_playwright() as p:
    br, pg = open_planner(p, "desktop")
    code = pg.evaluate("() => Object.keys(window.TUMHIST.m).find(c => M[c] && TUMHIST.m[c].W && (TUMHIST.m[c].W.t.VO || [])[0] === 'stabil' && ((M[c].lvt || {})['2026W'] || []).some(e => e.t === 'VO' && e.d && e.v && !e.one))")
    check(bool(code), f"history loaded ({code})")
    import_plan(pg, "Startsemester: WiSe 2026\n\n=== Semesterplan ===\n3. Semester\n  5 ECTS   " + code + "\n")
    m = pg.evaluate("c => { const m = PL.module(c); return { vj: m.vj, st: (m.events.find(e => e.t === 'VO') || {}).stab, hist: m.hist }; }", code)
    check(m["st"] and m["st"]["label"].startswith("stabil") and m["hist"]["W"], "PL.module: stab for semester 3 (WiSe 27/28) and offer history")
    pg.evaluate("c => uiOpenModule(c)", code); pg.wait_for_selector(".ui-modul .ui-stab")
    check(pg.locator(".ui-modul .ui-stab").first.inner_text().startswith("stabil"), "module panel shows the tag")
    check("Bisher angeboten" in pg.locator(".ui-modul .ui-histline").inner_text(), "module panel shows where it was offered")
    pg.evaluate("uiCloseModule()"); pg.wait_for_timeout(800); pg.evaluate("uiNav('woche/3')"); pg.wait_for_timeout(1500)
    n = pg.evaluate("() => PL.week(3, 'sem').days.flatMap(d => d.items).filter(i => i.vj && i.stab).length")
    check(n >= 1 and pg.locator(".ui-ev .ui-stab").count() >= 1, f"week view: short tag on last-year events ({n} in PL.week)")
    print("3. where can a module go")
    r = pg.evaluate("""() => { const H = TUMHIST.m;
      const both = Object.keys(H).find(c => M[c] && H[c].W && H[c].S && M[c].turnus === 'Sommersemester' && +H[c].W.terms[0].slice(0, 4) >= 2025);
      const wOnly = Object.keys(H).find(c => M[c] && H[c].W && !H[c].S && !Object.keys(M[c].lvt || {}).some(k => k.endsWith('S') && M[c].lvt[k].length));
      const none = Object.keys(M).find(c => !H[c] && !Object.keys(M[c].lvt || {}).some(k => (M[c].lvt[k] || []).length) && M[c].turnus === 'Wintersemester');
      return { both, wOnly, a: PL.offer(both).map(o => o.level), w: PL.offer(wOnly).map(o => o.level), wy: PL.offer(wOnly).map(o => o.why), n: none && PL.offer(none).map(o => o.level) }; }""")
    check(r["a"] == ["ok"] * 4, f"labelled summer but runs in winter too ({r['both']}): all 4 semesters offered")
    check(r["w"] == ["ok", "no", "ok", "no"], f"winter-only module ({r['wOnly']}): 1. and 3. {r['w']} {r['wy'][0]}")
    check(r["n"] in (None, ["turnus", "no", "turnus", "no"]), "no course data: falls back to the Turnus")
    import_plan(pg, "Startsemester: WiSe 2026\n\n=== Semesterplan ===\n1. Semester\n  5 ECTS   " + r["wOnly"] + "\n")
    pg.evaluate("uiNav('plan')"); pg.wait_for_selector(".ui-pcard")
    check(pg.locator(".ui-pcard .ui-offer-d").count() == 4 and pg.locator(".ui-pcard .ui-offer-ok").count() == 2, "card shows 1 2 3 4 with two offered semesters")
    b = pg.locator(".ui-pcard-main").first.bounding_box(); pg.mouse.move(b["x"] + 30, b["y"] + 20); pg.mouse.down(); pg.mouse.move(b["x"] + 80, b["y"] + 60, steps=5)
    cls = pg.evaluate("() => [...document.querySelectorAll('.ui-pcol')].map(c => c.dataset.sem + ':' + [...c.classList].filter(x => x.startsWith('ui-drop-')).join(''))")
    check("2:ui-drop-no" in cls and "3:ui-drop-ok" in cls, "while dragging: semester 3 green, semester 2 grey " + str(cls))
    pg.mouse.up(); pg.wait_for_timeout(300)
    check(pg.locator(".ui-drop-hint").count() == 0, "marks removed after the drop")
    check(not pg.errs, "no page errors " + "; ".join(pg.errs[:2]))
    br.close()
print("FAILED" if check.failed else "ALL OK"); sys.exit(1 if check.failed else 0)
