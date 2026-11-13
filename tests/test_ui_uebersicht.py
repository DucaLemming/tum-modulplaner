#!/usr/bin/env python3
"""Übersicht: progress number, Bereiche, Offene Punkte (hide, seat, collision check, expand), empty state, 40 issues.

Usage: python tests/test_ui_uebersicht.py [--shots DIR]
"""
import pathlib, sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from helpers import check, finish, open_planner, example_plan, import_plan, no_hscroll, shot

CARDS = "#ui .ui-s-uebersicht .ui-issue"


def chip_alle(pg):
    pg.locator("#ui .ui-inbox .ui-chips .ui-chip").first.click(); pg.wait_for_timeout(50)


def main():
    with sync_playwright() as p:
        br = p.chromium.launch()
        for size in ("desktop", "phone"):
            print(f"-- {size}")
            _, pg = open_planner(p, size, browser=br, hash="#/uebersicht")
            check(pg.locator("#ui .ui-emptycard").is_visible() and "Noch keine Module im Plan." in pg.locator("#ui .ui-emptycard").inner_text(), "empty plan: empty state (Review focus 1)")
            pg.locator("#ui .ui-emptycard .ui-btn").click(); pg.wait_for_timeout(100)
            check(pg.evaluate("location.hash") == "#/module", "Module ansehen opens Module")
            import_plan(pg, example_plan(pg))
            pg.evaluate("uiNav('uebersicht')"); pg.wait_for_timeout(100)
            check(pg.locator("#ui .ui-big-n").inner_text() == str(pg.evaluate("PL.totals().sure")), "big number = PL.totals().sure")
            rows = pg.locator("#ui .ui-bracket-row")
            B = pg.evaluate("PL.brackets().rows")
            check(rows.count() == len(B) and all(f"{r['sure']} / {r['req']}" in rows.nth(i).inner_text() for i, r in enumerate(
                [x for x in B if not x["master"]] + [x for x in B if x["master"]])), f"{len(B)} bracket rows with x / y")
            chip_alle(pg)
            n = pg.evaluate("PL.issues().filter(i => !i.hidden).length")
            check(pg.locator(CARDS).count() == n and n > 0, f"{n} issue cards = unhidden issues")
            check(pg.locator("#ui .ui-badge").inner_text() == str(n), "badge shows the number of open points")
            pg.locator(CARDS).first.locator(".ui-issue-more").click()
            pg.locator(".ui-sheet-root .ui-menu-item", has_text="Ausblenden").click(); pg.wait_for_timeout(100)
            check(pg.locator(CARDS).count() == n - 1, "Ausblenden removes one card")
            check("1 ausgeblendet · anzeigen" in pg.locator("#ui .ui-hidden-link").inner_text(), "footer: 1 ausgeblendet · anzeigen")
            first = pg.locator(CARDS).first.locator("button.ui-issue-detail")
            if first.count():
                short = first.inner_text(); first.click(); pg.wait_for_timeout(50)
                check(len(pg.locator(CARDS).first.locator(".ui-issue-detail").inner_text()) > len(short), "tap on the detail line shows the full text")
            lim = pg.evaluate("Object.keys(M).find(c => !marked[c] && isLimMod(c) && M[c].ects > 0)")
            pg.evaluate("c => PL.setInPlan(c, true)", lim); pg.wait_for_timeout(100); chip_alle(pg)
            card = pg.locator(CARDS + '[data-type="Anmeldung"]', has_text=lim)
            check(card.count() == 1, f"limited module {lim}: Anmeldung card")
            card.locator(".ui-issue-act .ui-btn").click(); pg.wait_for_timeout(100)
            check(pg.locator(CARDS + '[data-type="Anmeldung"]', has_text=lim).count() == 0, "Platz erhalten removes the card")
            pg.locator('#ui .ui-checks .ui-seg button[aria-label="4. Semester prüfen"]').click(); pg.wait_for_timeout(100)
            check("Überschneidungen im 4. Sem. nicht geprüft" in pg.locator("#ui .ui-s-uebersicht").inner_text(), "semester 4 check off: muted card")
            check(no_hscroll(pg), "no horizontal scroll")
            shot(pg, f"uebersicht_{size}")
            print("  40 synthetic issues (Review focus 5)")
            pg.evaluate("""() => { const real = PL.issues; PL.issues = () => Array.from({ length: 40 }, (_, i) => ({ id: 'x' + i, type: ['Regel', 'Überschneidung', 'Anmeldung', 'Weg'][i % 4], sem: i % 4 + 1,
              title: 'Sehr langer Titel ' + 'X'.repeat(120), detail: 'D'.repeat(90), full: 'F'.repeat(400), soft: false, hidden: false, codes: [], action: i % 4 === 2 ? 'seat' : null }));
              uiRender(true); window._realIssues = real; }""")
            chip_alle(pg)
            check(pg.locator(CARDS).count() == 40 and no_hscroll(pg), "40 cards, no horizontal scroll")
            pg.evaluate("PL.issues = window._realIssues; uiRender(true)")
            check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
            pg.context.close()
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
