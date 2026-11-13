#!/usr/bin/env python3
"""Module: count, search, filters, add to plan, reset, row tap, long names.

Usage: python tests/test_ui_module.py [--shots DIR]
"""
import pathlib, re, sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from helpers import check, finish, open_planner, example_plan, import_plan, no_hscroll, shot


def count(pg):
    return int(re.match(r"\d+", pg.locator("#ui .ui-module-count").inner_text()).group(0))


def main():
    with sync_playwright() as p:
        br = p.chromium.launch()
        for size in ("desktop", "phone"):
            print(f"-- {size}")
            _, pg = open_planner(p, size, browser=br)
            import_plan(pg, example_plan(pg))
            pg.evaluate("uiNav('module')"); pg.wait_for_timeout(200)
            total = pg.evaluate("PL.modules().length")
            check(count(pg) == total, f"unfiltered count {count(pg)} = PL.modules().length")
            code = pg.evaluate("Object.keys(M).find(c => M[c].ects > 0 && !marked[c] && /^MW/.test(c))")
            pg.locator("#ui .ui-module-q").fill(code); pg.wait_for_timeout(400)
            check(pg.locator("#ui .ui-mrow").first.get_attribute("data-code") == code, f"search {code}: row first")
            pg.locator("#ui .ui-module-q").fill(""); pg.wait_for_timeout(400)
            pg.locator("#ui .ui-fchips .ui-chip", has_text="Bereich").first.click()
            pg.locator(".ui-sheet-root .ui-fopt", has_text=pg.evaluate("BR.kern.label")).click(); pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
            brs = set(pg.locator("#ui .ui-mrow").evaluate_all("L => L.map(e => e.dataset.br)"))
            check(brs == {"kern"}, f"Bereich kern: only kern rows ({len(brs)} bracket)")
            pg.locator("#ui .ui-chip-reset").click(); pg.wait_for_timeout(150)
            pg.locator("#ui .ui-fchips .ui-chip", has_text="Im Plan").first.click()
            pg.locator(".ui-sheet-root .ui-fopt", has_text="nur im Plan").click(); pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
            rows = set(pg.locator("#ui .ui-mrow").evaluate_all("L => L.map(e => e.dataset.code)"))
            check(rows == set(pg.evaluate("Object.keys(marked)")), f"nur im Plan: exactly the {len(rows)} plan modules")
            pg.locator("#ui .ui-chip-reset").click(); pg.wait_for_timeout(150)
            check(count(pg) == total, "Zurücksetzen restores the full count")
            row = pg.locator(f'#ui .ui-mrow[data-code="{code}"]')
            row.scroll_into_view_if_needed(); row.hover()
            row.locator("button.ui-mrow-add").click(); pg.wait_for_timeout(150)
            check(pg.evaluate("c => PL.module(c).state.inPlan", code) and pg.locator(f'#ui .ui-mrow[data-code="{code}"] .ui-planmark').count() == 1, "+ adds to the plan, row shows the in-plan dot")
            pg.locator(f'#ui .ui-mrow[data-code="{code}"] .ui-mrow-main').click(); pg.wait_for_timeout(150)
            check(pg.evaluate("location.hash").endswith("/m/" + code) and pg.locator("#ui .ui-modul").is_visible(), "row tap opens the module panel")
            pg.evaluate("uiCloseModule()"); pg.wait_for_timeout(150)
            pg.evaluate("c => { M[c].name = 'Sehr langer Modulname '.repeat(6).slice(0, 120); uiRender(true); }", code); pg.wait_for_timeout(150)
            check(no_hscroll(pg), "120-character name: no horizontal scroll (Review focus 5)")
            pg.evaluate("uiModuleFilterSet({ q: 'Strömung' })"); pg.wait_for_timeout(200)
            check(0 < count(pg) < total, f"search Strömung: {count(pg)} hits")
            shot(pg, f"module_{size}")
            check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
            pg.context.close()
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
