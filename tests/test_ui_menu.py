#!/usr/bin/env python3
"""Einstellungen (everything of the former ⋯ menu): sections, export, import through the file chooser, Arbeitsziel, Sync dialog, update dialog, disclaimer.

Usage: python tests/test_ui_menu.py [--shots DIR]
"""
import pathlib, sys, tempfile

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from helpers import check, finish, open_planner, reload, example_plan, import_plan, export_text, no_hscroll, shot

SECTIONS = ["Sync und weitere Geräte", "Plan als Datei", "Moduldaten", "Startsemester", "Arbeitsziel", "Fahrzeiten", "Eigene Termine", "Hilfe"]
BTN = {"Sync": ".ui-devlink .ui-btn", "Plan exportieren": ".ui-set-export", "Plan importieren": ".ui-set-import", "Moduldaten aktualisieren": ".ui-set-update", "Hilfe": ".ui-set-help"}


def menu(pg, entry=None):
    pg.evaluate("uiNav('einstellungen')"); pg.wait_for_timeout(150)
    if entry:
        pg.locator("#ui .ui-s-einstellungen " + BTN[entry]).first.click(); pg.wait_for_timeout(200)


def main():
    with sync_playwright() as p:
        br = p.chromium.launch()
        for size in ("desktop", "phone"):
            print(f"-- {size}")
            _, pg = open_planner(p, size, browser=br)
            check(pg.locator("#ui .ui-disc").is_visible(), "disclaimer bar on first open")
            pg.locator("#ui .ui-disc .ui-btn").click()
            reload(pg)
            check(pg.locator("#ui .ui-disc").count() == 0, "disclaimer not shown after dismiss and reload")
            text = example_plan(pg)
            menu(pg)
            labels = pg.locator("#ui .ui-settings > .ui-h3, #ui .ui-settings > .ui-devlink > .ui-h3").all_inner_texts()
            check(labels == SECTIONS, "Einstellungen sections in order: " + ", ".join(labels))
            check(pg.locator("#ui .ui-top-more").count() == 0, "no ⋯ menu")
            f = pathlib.Path(tempfile.mkdtemp()) / "Modulplan.txt"; f.write_text(text, encoding="utf-8")
            with pg.expect_file_chooser() as fc:
                menu(pg, "Plan importieren")
            fc.value.set_files(str(f)); pg.wait_for_timeout(300)
            check("12 Module" in pg.locator(".ui-sheet-root .ui-imp").inner_text(), "import preview: 12 Module")
            pg.locator(".ui-sheet-root .ui-imp .ui-btn", has_text="Importieren").click(); pg.wait_for_timeout(300)
            check(pg.evaluate("Object.keys(marked).length") == 12, "import into an empty browser: 12 modules")
            with pg.expect_download() as dl:
                menu(pg, "Plan exportieren")
            got = pathlib.Path(dl.value.path()).read_text(encoding="utf-8").replace("\r\n", "\n")
            got = "\n".join(l for l in got.splitlines() if not l.startswith("Erstellt:"))
            check(dl.value.suggested_filename == "Modulplan.txt" and got == export_text(pg), "export download = text export")
            pg.evaluate("uiNav('einstellungen')"); pg.wait_for_timeout(200)
            pg.locator("#ui .ui-workgoal").fill("15"); pg.locator("#ui .ui-workgoal").dispatch_event("change"); pg.wait_for_timeout(100)
            check(pg.evaluate("PL.settings().workGoal") == 15, "Arbeitsziel 15")
            check(pg.locator("#ui .ui-devlink .ui-btn", has_text="Sync einrichten").count() == 1, "Einstellungen: Sync einrichten while sync is off")
            check(no_hscroll(pg), "settings: no horizontal scroll")
            shot(pg, f"menu_settings_{size}")
            pg.keyboard.press("Escape")
            menu(pg, "Hilfe")
            check("Ohne Gewähr: Alle Angaben können falsch oder veraltet sein." in pg.locator(".ui-sheet-root .ui-helpdoc").inner_text() and pg.locator(".ui-sheet-root .ui-helpdoc dt", has_text="VO").count() >= 1, "Hilfe: Kürzel and disclaimer")
            pg.keyboard.press("Escape")
            menu(pg, "Sync")
            check(pg.locator("#syDlg").is_visible(), "Sync opens #syDlg")
            pg.evaluate("document.getElementById('syDlg') && document.getElementById('syDlg').remove()")
            menu(pg, "Moduldaten aktualisieren")
            check(pg.locator("#updDlg").is_visible(), "Moduldaten aktualisieren shows the update dialog")
            pg.evaluate("document.getElementById('updDlg').remove()")
            check(pg.locator("#ui .ui-sync:visible").count() == 1, "sync status icon visible")
            pg.evaluate("localStorage.setItem('tum-sync', JSON.stringify({ repo: 'a/b', token: 'tok', branch: 'main', path: 'plan.json' }))")
            reload(pg)
            pg.evaluate("uiNav('einstellungen')"); pg.wait_for_timeout(200)
            pg.locator("#ui .ui-devlink-more summary").click(); pg.wait_for_timeout(50)
            url = pg.locator("#ui .ui-devlink-url").inner_text()
            check(pg.locator("#ui .ui-qr svg").count() == 1 and "#/connect/a%2Fb/tok" in url, "Einstellungen: QR code and connect link")
            pg.keyboard.press("Escape")
            pg.evaluate("localStorage.removeItem('tum-sync')")
            check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
            pg.context.close()
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
