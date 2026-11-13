#!/usr/bin/env python3
"""Shell: navigation, routes, reload, module panel, back button, sheets, no horizontal scroll.

Usage: python tests/test_ui_shell.py [--shots DIR]
"""
import pathlib, sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from helpers import check, finish, open_planner, reload, example_plan, import_plan, no_hscroll, shot

NAV = [("uebersicht", "Übersicht"), ("module", "Module"), ("plan", "Plan"), ("woche", "Woche"), ("pruefungen", "Prüfungen"), ("einstellungen", "Einstellungen")]


def main():
    with sync_playwright() as p:
        br = p.chromium.launch()
        for size in ("desktop", "phone"):
            print(f"-- {size}")
            _, pg = open_planner(p, size, browser=br)
            import_plan(pg, example_plan(pg))
            items = pg.locator("#ui .ui-nav-item:visible")
            k = 6 if size == "desktop" else 5
            check(items.count() == k and [items.nth(i).inner_text().split("\n")[0].strip() for i in range(k)] == [l for _, l in NAV][:k], f"{k} navigation entries visible with the right labels")
            check((pg.locator("#ui .ui-top-settings").is_visible()) == (size == "phone"), "phone: Einstellungen in the top bar")
            for n, lab in NAV:
                pg.locator(f'#ui .ui-nav-item[data-nav="{n}"]' if size == "desktop" or n != "einstellungen" else "#ui .ui-top-settings").click()
                pg.wait_for_timeout(100)
                ok = pg.evaluate("location.hash").startswith("#/" + n) and pg.locator(f'[data-ui-screen="{n}"]').first.is_visible()
                check(ok, f"{lab}: hash and screen")
                check(no_hscroll(pg), f"{lab}: no horizontal scroll")
            pg.evaluate("uiNav('plan')"); pg.wait_for_timeout(100)
            reload(pg)
            check(pg.locator('[data-ui-screen="plan"]').first.is_visible(), "reload on #/plan shows Plan (Review focus 4)")
            code = pg.evaluate("Object.keys(marked)[0]")
            pg.evaluate("c => uiOpenModule(c)", code); pg.wait_for_timeout(150)
            check(pg.evaluate("location.hash").endswith("/m/" + code) and pg.locator("#ui .ui-modul").is_visible(), "uiOpenModule: hash ends /m/<code>, panel visible")
            shot(pg, f"shell_{size}_panel")
            check(no_hscroll(pg), "panel open: no horizontal scroll")
            pg.go_back(); pg.wait_for_timeout(200)
            check(not pg.locator("#ui .ui-modul").is_visible() and "/m/" not in pg.evaluate("location.hash"), "browser back closes the panel")
            pg.evaluate("c => uiOpenModule(c)", code); pg.wait_for_timeout(100)
            reload(pg)
            check(pg.locator("#ui .ui-modul").is_visible(), "panel restored after reload")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
            check(not pg.locator("#ui .ui-modul").is_visible(), "Escape closes the panel")
            pg.locator("#ui .ui-top-more").click(); pg.wait_for_timeout(100)
            check(pg.locator(".ui-sheet-root .ui-sheet").is_visible(), "⋯ opens a sheet")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
            check(pg.locator(".ui-sheet-root .ui-sheet").count() == 0, "Escape closes the sheet")
            res = pg.evaluate("(async () => { const p = uiConfirm('Wirklich?', 'Ja'); document.querySelector('.ui-confirm-ok').click(); return await p; })()")
            check(res is True, "uiConfirm resolves true on OK")
            pg.evaluate("uiNav('woche/2')"); pg.wait_for_timeout(100)
            check(pg.evaluate("location.hash") == "#/woche/2", "route #/woche/2")
            shot(pg, f"shell_{size}")
            check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
            pg.context.close()
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
