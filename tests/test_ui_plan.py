#!/usr/bin/env python3
"""Plan board: columns, numbers, card count, move via menu, drag and drop, phone segmented control, 15 cards.

Usage: python tests/test_ui_plan.py [--shots DIR]
"""
import pathlib, sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from helpers import check, finish, open_planner, example_plan, import_plan, no_hscroll, shot


def main():
    with sync_playwright() as p:
        br = p.chromium.launch()
        print("-- desktop")
        _, pg = open_planner(p, "desktop", browser=br, hash="#/plan")
        import_plan(pg, example_plan(pg))
        cols = pg.locator("#ui .ui-pcol")
        check(cols.count() == 4, "4 columns")
        S = pg.evaluate("PL.semesters()")
        for i in range(4):
            col = cols.nth(i)
            check(col.locator(".ui-pcol-big").inner_text() == str(S[i + 1]["E"]["s"]) and col.locator(".ui-pcard").count() == len(S[i + 1]["cards"]),
                  f"column {i + 1}: big number E.s and card count")
        code = S[1]["cards"][0]["code"]
        pg.locator(f'#ui .ui-pcard[data-code="{code}"] .ui-pcard-more').click()
        pg.locator(".ui-sheet-root .ui-menu-item", has_text="Verschieben nach 3.").click(); pg.wait_for_timeout(150)
        check(pg.evaluate("c => PL.module(c).state.sem", code) == 3, "menu Verschieben nach 3. moves the card")
        code2 = pg.evaluate("PL.semesters()[1].cards[0].code")
        a = pg.locator(f'#ui .ui-pcard[data-code="{code2}"] .ui-pcard-name').bounding_box()
        b = cols.nth(1).locator(".ui-pcol-l").bounding_box()
        pg.mouse.move(a["x"] + 20, a["y"] + 5); pg.mouse.down()
        pg.mouse.move(a["x"] + 60, a["y"] + 40, steps=5); pg.mouse.move(b["x"] + 40, b["y"] + 20, steps=10); pg.mouse.up(); pg.wait_for_timeout(150)
        check(pg.evaluate("c => PL.module(c).state.sem", code2) == 2, "drag from column 1 to 2 moves the card")
        check(not pg.locator("#ui .ui-modul").is_visible(), "drag does not open the panel")
        pg.evaluate("c => PL.setSemester(c, 0)", code2); pg.wait_for_timeout(100)
        check(cols.count() == 5, "5 columns when a module has no semester")
        pg.locator(f'#ui .ui-pcard[data-code="{code}"] .ui-pcard-main').click(); pg.wait_for_timeout(150)
        check(pg.locator("#ui .ui-modul").is_visible(), "card tap opens the module panel")
        lim = pg.evaluate("Object.keys(M).find(c => !marked[c] && isLimMod(c) && M[c].ects > 0)")
        pg.evaluate("c => { PL.setInPlan(c, true); PL.setSemester(c, 1); }", lim); pg.wait_for_timeout(150)
        pg.mouse.move(5, 5); pg.locator(f'#ui .ui-pcard[data-code="{lim}"] .ui-seat').hover(); pg.wait_for_timeout(100)
        tip = pg.locator(".ui-sheet-root .ui-tip")
        check(tip.count() == 1 and tip.inner_text() != "Teilnehmerzahl begrenzt", "hover on a seat tag explains the seat state")
        pg.mouse.move(5, 5)
        shot(pg, "plan_desktop")
        check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
        pg.context.close()

        print("-- phone")
        _, pg = open_planner(p, "phone", browser=br, hash="#/plan")
        import_plan(pg, example_plan(pg))
        check(pg.locator("#ui .ui-pcol").count() == 1, "phone: one column")
        pg.locator("#ui .ui-plan-seg button", has_text="2.").click(); pg.wait_for_timeout(100)
        check(pg.locator("#ui .ui-pcol").get_attribute("data-sem") == "2", "segmented control switches to 2.")
        pg.evaluate("""() => { Object.keys(M).filter(c => M[c].ects > 0 && !marked[c]).slice(0, 15).forEach(c => { PL.setInPlan(c, true); PL.setSemester(c, 2); });
          const c = PL.semesters()[2].cards[0].code; M[c].name = 'Ein sehr langer Modulname '.repeat(5).slice(0, 120); uiRender(true); }""")
        check(pg.locator("#ui .ui-pcol .ui-pcard").count() >= 15 and no_hscroll(pg), "15+ cards in one column, page width stays 390 (Review focus 5)")
        h = pg.evaluate("document.querySelector('#ui .ui-screen').scrollHeight > document.querySelector('#ui .ui-screen').clientHeight")
        check(h, "the column scrolls vertically inside the screen")
        shot(pg, "plan_phone")
        check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
