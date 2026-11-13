#!/usr/bin/env python3
"""Prüfungen: rows, order, Ohne Termin, tags, row tap, phone without calendar, empty semester.

Usage: python tests/test_ui_pruefungen.py [--shots DIR]
"""
import pathlib, sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from helpers import check, finish, open_planner, example_plan, import_plan, no_hscroll, shot

ROWS = "#ui .ui-exl .ui-exl-row"


def main():
    with sync_playwright() as p:
        br = p.chromium.launch()
        for size in ("desktop", "phone"):
            print(f"-- {size}")
            _, pg = open_planner(p, size, browser=br)
            import_plan(pg, example_plan(pg))
            s = pg.evaluate("[1, 2, 3].find(s => PL.exams(s).weeks.length) || 1")
            pg.evaluate(f"uiNav('pruefungen/{s}')"); pg.wait_for_timeout(200)
            X = pg.evaluate(f"PL.exams({s})")
            n = sum(len(w["rows"]) for w in X["weeks"])
            check(pg.locator(ROWS).count() == n and n > 0, f"semester {s}: {n} rows = dated exams")
            dates = pg.locator(ROWS).evaluate_all("L => L.map(e => e.dataset.date)")
            check(dates == sorted(dates), "rows in date order")
            und = pg.locator("#ui .ui-ex-undated .ui-exl-row").count()
            check(und == len(X["undated"]), f"Ohne Termin lists {und} undated")
            pg.locator(ROWS).first.click(); pg.wait_for_timeout(150)
            check(pg.locator("#ui .ui-modul").is_visible() and pg.locator('#ui .ui-modul .ui-sec[data-sec="pruefung"]').get_attribute("open") is not None, "row tap opens the module panel at Prüfung")
            pg.evaluate("uiCloseModule()"); pg.wait_for_timeout(100)
            check((pg.locator("#ui .ui-ex-view").count() == 1) == (size == "desktop"), "Kalender toggle only on desktop")
            if size == "desktop":
                pg.locator("#ui .ui-ex-view button", has_text="Kalender").click(); pg.wait_for_timeout(150)
                check(pg.locator("#ui .ui-tg .ui-ev").count() >= 1, "Kalender shows the exam week grid")
                pg.locator("#ui .ui-ex-view button", has_text="Liste").click(); pg.wait_for_timeout(100)
            pg.evaluate("""() => { window._ex = PL.exams; PL.exams = s => ({ s, term: '', label: 'Test', weeks: [{ kw: 7, from: '2027-02-15', rows: [
              { code: 'A1', name: 'Test A', date: '2027-02-15', wd: 1, v: '08:00', b: '09:30', room: '', est: true, retake: false, clash: false, sameDay: false },
              { code: 'B2', name: 'Test B', date: '2027-02-16', wd: 2, v: '10:00', b: '', room: 'MW 2001', est: false, retake: true, clash: true, sameDay: true }] }], undated: [] }); uiRender(true); }""")
            t = pg.locator("#ui .ui-exl").inner_text()
            check("geschätzt" in t and "Wiederholung" in t and "gleicher Tag" in t, "tags geschätzt, Wiederholung, gleicher Tag shown")
            pg.evaluate("PL.exams = s => ({ s, term: '', label: 'Test', weeks: [], undated: [] }); uiRender(true)")
            check("Keine Prüfungstermine bekannt." in pg.locator("#ui .ui-s-pruefungen").inner_text(), "empty semester: Keine Prüfungstermine bekannt.")
            pg.evaluate("PL.exams = window._ex; uiRender(true)")
            check(no_hscroll(pg), "no horizontal scroll")
            shot(pg, f"pruefungen_{size}")
            check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
            pg.context.close()
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
