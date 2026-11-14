#!/usr/bin/env python3
"""Week view: the typical week shows only what repeats, single dates are listed, calendar weeks show everything."""
import sys
from playwright.sync_api import sync_playwright
from helpers import check, open_planner, import_plan

with sync_playwright() as p:
    br, pg = open_planner(p, "desktop")
    # a module with weekly lectures and single extra dates in the same course type
    code = pg.evaluate("""() => Object.keys(M).find(c => { const L = (M[c].lvt || {})['2026S'] || [];
      return L.some(e => e.one && e.d && e.v) && L.some(e => !e.one && e.d && e.v && /–/.test(e.nt || '') && e.t === L.find(x => x.one).t); })""")
    check(bool(code), f"module with single dates next to a series ({code})")
    import_plan(pg, "Startsemester: WiSe 2026\n\n=== Semesterplan ===\n2. Semester\n  5 ECTS   " + code + "\n")
    W = pg.evaluate("c => { const W = PL.week(2, 'sem'); return { reg: W.days.flatMap(d => d.items).filter(i => i.code === c).length, sg: W.singles.filter(o => o.code === c), weeks: W.weeks.length }; }", code)
    check(W["reg"] >= 1 and len(W["sg"]) >= 1, f"typical week: {W['reg']} regular block(s), {len(W['sg'])} single date(s) in the list")
    check(W["weeks"] >= 14, f"{W['weeks']} calendar weeks to pick")
    one = W["sg"][0]
    K = pg.evaluate("([m, c, d]) => { const W = PL.week(2, m); const D = W.days.find(x => x.date === d); return { mode: W.mode, has: !!D && D.items.some(i => i.code === c), singles: W.singles.length }; }", [one["mon"], code, one["date"]])
    check(K["mode"] == one["mon"] and K["has"] and K["singles"] == 0, "calendar week of the single date shows it on its day")
    pg.evaluate("uiNav('woche/2')"); pg.wait_for_selector(".ui-wk-singles")
    check(pg.locator(".ui-wk-mode option").first.inner_text() == "Typische Woche", "picker starts with 'Typische Woche'")
    opts_typ = pg.locator(".ui-wk-mode option").all_inner_texts()
    check(pg.locator(".ui-tg-head .ui-wk-sgl").count() >= 1, "day header shows '+N einzeln'")
    pg.locator(".ui-sgl-row").first.click(); pg.wait_for_timeout(600)
    check(pg.locator(".ui-wk-mode").evaluate("s => s.value") == str(one["mon"]), "clicking a single date opens its calendar week")
    check(pg.locator(".ui-tg-head", has_text=one["date"][8:10] + "." + one["date"][5:7] + ".").count() >= 1, "day headers show the dates")
    check(pg.locator(".ui-wk-singles").count() == 0, "no single-date list inside a calendar week")
    opts_week = pg.locator(".ui-wk-mode option").all_inner_texts()
    pg.locator(".ui-wk-mode").select_option(str(one["mon"] + 7)); pg.wait_for_timeout(400)
    check(pg.locator(".ui-wk-mode").evaluate("s => s.value") == str(one["mon"] + 7), "picking the next week")
    check(pg.locator(".ui-wk-mode option").all_inner_texts() == opts_week == opts_typ, "picker has the same entries in every week")
    pg.locator(".ui-wk-mode").select_option("sem"); pg.wait_for_timeout(400)
    check(pg.locator(".ui-wk-singles").count() == 1, "back to the typical week")
    check(not pg.errs, "no page errors " + "; ".join(pg.errs[:2]))
    br.close()
    br, pg = open_planner(p, "phone")
    import_plan(pg, "Startsemester: WiSe 2026\n\n=== Semesterplan ===\n2. Semester\n  5 ECTS   " + code + "\n")
    pg.evaluate("uiNav('woche/2')"); pg.wait_for_selector(".ui-wk-singles")
    check(pg.evaluate("document.documentElement.scrollWidth") <= 390, "phone: no horizontal scroll with the list")
    br.close()
print("FAILED" if check.failed else "ALL OK"); sys.exit(1 if check.failed else 0)
