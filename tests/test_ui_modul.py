#!/usr/bin/env python3
"""Modul panel: switch, semester, status, seat, events, Vorjahr tag, description, confirm on switch off.

Usage: python tests/test_ui_modul.py [--shots DIR]
"""
import pathlib, sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from helpers import check, finish, open_planner, example_plan, import_plan, no_hscroll, shot

P = "#ui .ui-modul"


def result(pg):
    return pg.locator(P + " .ui-result").inner_text()


def open_mod(pg, c):
    pg.evaluate("c => uiOpenModule(c)", c); pg.wait_for_timeout(150)


def main():
    with sync_playwright() as p:
        br = p.chromium.launch()
        for size in ("desktop", "phone"):
            print(f"-- {size}")
            _, pg = open_planner(p, size, browser=br)
            import_plan(pg, example_plan(pg))
            pg.evaluate("uiNav('plan')")
            c = pg.evaluate("Object.keys(M).find(c => M[c].ects > 0 && !marked[c] && !isLimMod(c) && M[c].inhalt && (M[c].lv || []).some(e => e.d && e.v) && (M[c].turnus || '').includes('Sommer'))")
            n = pg.evaluate("c => M[c].ects", c)
            open_mod(pg, c)
            sw = pg.locator(P + ' .ui-switch[aria-label="Im Plan"]')
            check(sw.get_attribute("aria-checked") == "false" and result(pg) == "Nicht im Plan.", "not in plan: switch off, Nicht im Plan.")
            sw.click(); pg.wait_for_timeout(150)
            pg.locator(P + " .ui-seg-sem button", has_text="2").click(); pg.wait_for_timeout(150)
            check(pg.evaluate("c => PL.module(c).state.sem", c) == 2 and result(pg) == f"Zählt mit {n} ECTS.", f"switch on, semester 2: Zählt mit {n} ECTS.")
            pg.locator(P + " .ui-sel-status").select_option("optional"); pg.wait_for_timeout(150)
            check(result(pg) == "Zählt nicht (optional).", "Status Optional: Zählt nicht (optional).")
            pg.locator(P + " .ui-sel-status").select_option("count"); pg.wait_for_timeout(150)
            ev = pg.evaluate("c => PL.module(c).events.length", c)
            check(pg.locator(P + " .ui-evrow").count() == ev, f"{ev} event rows = PL.module().events")
            pg.locator(P + ' .ui-sec[data-sec="beschreibung"] > summary').click()
            pg.locator(P + ' .ui-sec[data-sec="beschreibung"] .ui-acc summary').get_by_text("Inhalt", exact=True).click()
            inh = pg.evaluate("c => M[c].inhalt", c)
            check(inh[:40] in pg.locator(P + ' .ui-sec[data-sec="beschreibung"]').inner_text(), "Beschreibung shows the Inhalt text")
            check(no_hscroll(pg), "no horizontal scroll")
            shot(pg, f"modul_{size}")
            key = pg.evaluate("c => PL.module(c).events.find(e => e.wd).key", c)
            pg.evaluate("([c, k]) => PL.setAttendance(c, k, 'rec')", [c, key]); pg.wait_for_timeout(100)
            pg.locator(P + ' .ui-switch[aria-label="Im Plan"]').click(); pg.wait_for_timeout(150)
            check(pg.locator(".ui-sheet-root .ui-confirm").is_visible(), "switch off with an attendance override asks to confirm")
            pg.locator(".ui-sheet-root .ui-btn", has_text="Abbrechen").click(); pg.wait_for_timeout(100)
            check(pg.evaluate("c => PL.module(c).state.inPlan", c), "Abbrechen keeps the module")
            lim = pg.evaluate("Object.keys(M).find(c => !marked[c] && isLimMod(c) && M[c].ects > 0)")
            pg.evaluate("c => { PL.setInPlan(c, true); PL.setSemester(c, 1); }", lim); open_mod(pg, lim)
            seat = pg.locator(P + " .ui-seg-seat")
            check(seat.count() == 1 and "Platz hast" in result(pg), "limited module: Platz control, result waits for the seat")
            seat.locator("button", has_text="erhalten").click(); pg.wait_for_timeout(150)
            check(result(pg) == f"Zählt mit {pg.evaluate('c => M[c].ects', lim)} ECTS.", "Platz erhalten: Zählt mit N ECTS.")
            c4 = pg.evaluate("Object.keys(M).find(c => M[c].ects > 0 && !marked[c] && (M[c].lv || []).some(e => e.d && e.v) && (M[c].turnus || '').includes('Sommer'))")
            pg.evaluate("c => { PL.setInPlan(c, true); PL.setSemester(c, 4); }", c4); open_mod(pg, c4)
            check(pg.evaluate("c => PL.module(c).vj", c4) and pg.locator(P + " .ui-tag", has_text="Vorjahr").count() > 0, "semester 4 (unpublished): tag Vorjahr (Review focus 3)")
            check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
            pg.context.close()
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
