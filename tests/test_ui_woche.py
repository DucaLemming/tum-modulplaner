#!/usr/bin/env python3
"""Woche: day columns, event blocks and their position, event sheet, own appointment, semester switch, phone day switch,
Vorjahr tag, conflict list.

Usage: python tests/test_ui_woche.py [--shots DIR]
"""
import pathlib, sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from helpers import check, finish, open_planner, example_plan, import_plan, no_hscroll, shot

EV = "#ui .ui-tg .ui-ev:not(.ui-ev-own):not(.ui-ev-travel)"
SWIPE = """(dx) => { const el = document.querySelector('#ui .ui-wk-grid'); const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 100;
  const t = (cx) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: y });
  el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(x)], changedTouches: [t(x)], bubbles: true }));
  el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(x + dx)], bubbles: true })); }"""



def main():
    with sync_playwright() as p:
        br = p.chromium.launch()
        print("-- desktop")
        _, pg = open_planner(p, "desktop", browser=br)
        import_plan(pg, example_plan(pg))
        s = pg.evaluate("[1, 2, 3].find(s => PL.week(s, 'sem').days.some(d => d.items.some(i => i.kind === 'ev')))") or 2
        pg.evaluate(f"uiNav('woche/{s}')"); pg.wait_for_timeout(200)
        check(pg.locator("#ui .ui-tg-col").count() == len(pg.evaluate(f"PL.week({s}, 'sem').days")) >= 5, "desktop grid has 5 day columns (6 with Saturday)")
        n = pg.evaluate(f"PL.week({s}, 'sem').days.reduce((a, d) => a + d.items.filter(i => i.kind === 'ev' && !i.hiddenByDefault).length, 0)")
        check(pg.locator(EV).count() == n and n > 0, f"{n} event blocks = shown items of PL.week({s})")
        geo = pg.locator(EV).first.evaluate("""e => { const b = e.parentElement.getBoundingClientRect(), r = e.getBoundingClientRect();
          const lo = Math.min(7 * 60, ...[...document.querySelectorAll('#ui .ui-tg [data-a]')].map(x => Math.floor(+x.dataset.a / 60) * 60));
          return [r.top - b.top, r.height, (+e.dataset.a - lo) / 60 * 56, (+e.dataset.b - +e.dataset.a) / 60 * 56]; }""")
        check(abs(geo[0] - geo[2]) <= 1 and abs(geo[1] - geo[3]) <= 1.5, f"block top/height match a and b ({geo[0]:.0f}/{geo[2]:.0f}, {geo[1]:.0f}/{geo[3]:.0f})")
        blk = pg.locator(EV).first
        code, key = blk.get_attribute("data-code"), blk.get_attribute("data-key")
        blk.click(); pg.wait_for_timeout(150)
        pg.locator(".ui-sheet-root .ui-att button", has_text="Online").click(); pg.wait_for_timeout(150)
        st = pg.evaluate("([c, k]) => PL.module(c).events.find(e => e.key === k).status", [code, key])
        check(st == "onl" and pg.locator(f'{EV}[data-key="{key}"]').first.get_attribute("class").count("ui-ev-online") == 1, "Online: status onl, block gets ui-ev-online")
        pg.locator(".ui-sheet-root .ui-att button", has_text="Online").click(); pg.wait_for_timeout(150)
        st2 = pg.evaluate("([c, k]) => { const e = PL.module(c).events.find(e => e.key === k); return e.status === e.def; }", [code, key])
        check(st2, "tapping the active option again resets to the default")
        pg.keyboard.press("Escape")
        work0 = pg.locator("#ui .ui-wk-work").inner_text()
        pg.locator("#ui .ui-btn", has_text="＋ Termin").click()
        f = pg.locator(".ui-sheet-root .ui-blockform")
        f.locator('input[aria-label="Bezeichnung"]').fill("Arbeit"); f.locator('select[aria-label="Tag"]').select_option("1")
        f.locator('input[aria-label="von"]').fill("08:00"); f.locator('input[aria-label="bis"]').fill("12:00")
        f.locator(".ui-block-save").click(); pg.wait_for_timeout(200)
        check(pg.evaluate("PL.settings().blocks.length") == 1 and pg.locator("#ui .ui-wk-work").inner_text() != work0, f"＋ Termin Arbeit: own block added, Arbeit {work0} -> {pg.locator('#ui .ui-wk-work').inner_text()}")
        pg.locator("#ui .ui-wk-sem").select_option("2"); pg.wait_for_timeout(150)
        check(pg.evaluate("location.hash") == "#/woche/2", "semester select changes the hash to #/woche/2")
        cf = pg.evaluate("PL.issues().filter(i => i.sem === 2 && !i.hidden && (i.type === 'Überschneidung' || i.type === 'Weg')).length")
        check(pg.locator("#ui .ui-wk-cf .ui-issue").count() == cf, f"conflict list: {cf} cards")
        pg.evaluate("c => { PL.setInPlan(c, true); PL.setSemester(c, 4); }", pg.evaluate("Object.keys(M).find(c => M[c].ects > 0 && !marked[c] && (M[c].lv || []).some(e => e.d && e.v) && (M[c].turnus || '').includes('Sommer'))"))
        pg.evaluate("uiNav('woche/4')"); pg.wait_for_timeout(150)
        check(pg.locator("#ui .ui-wk-head .ui-tag", has_text="Zeiten: Vorjahr").count() == 1, "unpublished semester: tag Zeiten: Vorjahr (Review focus 3)")
        un = pg.evaluate("PL.week(4, 'sem').untimed")
        if un:
            check(un[0]["name"] in pg.locator("#ui .ui-wk-untimed").inner_text(), "Ohne Zeit shows code and name")
        check(no_hscroll(pg), "no horizontal scroll")
        pg.evaluate(f"uiNav('woche/{s}')"); pg.wait_for_timeout(150)
        pg.locator(EV).first.hover(); pg.wait_for_timeout(100)
        check(pg.locator(".ui-sheet-root .ui-tip").count() == 1 and "Antippen" in pg.locator(".ui-sheet-root .ui-tip").inner_text(), "hover on an event block shows a tooltip")
        pg.mouse.move(5, 5)
        pg.locator("#ui .ui-top-help").click(); pg.wait_for_timeout(100)
        hd = pg.locator(".ui-sheet-root .ui-sheet-title").inner_text()
        check(hd == "Zeichen: Woche" and pg.locator(".ui-sheet-root .ui-legend").count() == 1, f"? on Woche shows only the week legend ({hd})")
        pg.locator(".ui-sheet-root .ui-linkbtn", has_text="Alle Zeichen anzeigen").click(); pg.wait_for_timeout(50)
        check(pg.locator(".ui-sheet-root .ui-legend").count() == 7, "Alle Zeichen anzeigen shows every section")
        pg.keyboard.press("Escape")
        shot(pg, "woche_desktop")
        check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
        pg.context.close()

        print("-- phone")
        _, pg = open_planner(p, "phone", browser=br)
        import_plan(pg, example_plan(pg))
        pg.evaluate(f"uiNav('woche/{s}')"); pg.wait_for_timeout(200)
        check(pg.locator("#ui .ui-tg-col").count() == 1, "phone shows one day")
        pg.locator("#ui .ui-wk-days button", has_text="Mi").click(); pg.wait_for_timeout(100)
        check(pg.locator("#ui .ui-tg-body").get_attribute("data-wd") == "3", "day switch shows Mi")
        pg.evaluate(SWIPE, -120); pg.wait_for_timeout(150)
        check(pg.locator("#ui .ui-tg-body").get_attribute("data-wd") == "4", "swipe left: next day (Do)")
        pg.evaluate(SWIPE, 120); pg.wait_for_timeout(150)
        check(pg.locator("#ui .ui-tg-body").get_attribute("data-wd") == "3", "swipe right: previous day (Mi)")
        check(no_hscroll(pg), "no horizontal scroll")
        shot(pg, "woche_phone")
        check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
