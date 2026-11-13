#!/usr/bin/env python3
"""Build pipeline and boot: idempotent build, engine untouched, old/new switch, sync link survives boot.

Usage: python tests/test_build.py
"""
import pathlib, re, shutil, sys, tempfile

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))
from helpers import PLANNER, check, finish, open_planner, reload
import build


def engine_part(h):
    h = build.strip(h)
    i = [x for x in (h.find('<script id="tumQr">'), h.find('<style id="uiCss">')) if x >= 0]
    return h[:min(i)] if i else h[:h.rfind('</body>')]


def main():
    tmp = pathlib.Path(tempfile.mkdtemp())
    a, b, n = tmp / "a.html", tmp / "b.html", tmp / "n.html"
    for f in (a, b, n):
        shutil.copy(PLANNER, f)
    print("1. build is idempotent, engine untouched")
    build.main(a, quiet=True); build.main(a, quiet=True); build.main(b, quiet=True)
    check(a.read_bytes() == b.read_bytes(), "two builds give the same file")
    build.main(n, ui=False, quiet=True)
    ha, hn, h0 = a.read_text(encoding="utf-8"), n.read_text(encoding="utf-8"), PLANNER.read_text(encoding="utf-8")
    check(engine_part(ha) == engine_part(hn) == engine_part(build.strip(ha)) == engine_part(h0), "engine part byte-identical (full, --no-ui, original)")
    check('id="uiCss"' not in hn and 'id="uiApp"' not in hn and 'id="tumSync"' in hn, "--no-ui keeps only tumQr and tumSync")
    ids = re.findall(r'<(?:script|style) id="(uiCss|tumQr|tumSync|uiApi|uiApp)">', ha)
    check(ids == [i for i in build.IDS if i in ids] and "uiApp" in ids and "uiCss" in ids, "block order " + ",".join(ids))

    with sync_playwright() as p:
        print("2. boot: legacy wrapper and new container")
        br, pg = open_planner(p, "desktop", built=a)
        check(pg.evaluate("getComputedStyle(document.body, '::before').content") in ("none", "normal", ""), "loading text gone after boot")
        check(pg.evaluate("['plan','sem','garea'].every(i => document.querySelector('#legacy #' + i))"), "#legacy contains #plan, #sem, #garea")
        check(pg.evaluate("!!document.getElementById('ui')"), "#ui exists")
        check(pg.evaluate("document.body.dataset.ui") == "new" and not pg.locator("#legacy").is_visible(), "default mode new, #legacy hidden")
        print("3. the old view is no longer reachable")
        pg.evaluate("localStorage.setItem('tum-ui-mode', 'old')")
        reload(pg)
        check(pg.evaluate("document.body.dataset.ui") == "new" and pg.locator("#ui").is_visible() and not pg.locator("#legacy").is_visible(), "a stored old mode is ignored, #legacy stays hidden")
        pg.evaluate("uiNav('einstellungen')"); pg.wait_for_timeout(150)
        check(pg.locator(".ui-backbtn").count() == 0 and "Alte Ansicht" not in pg.locator("#ui").inner_text(), "no switch to the old view")
        check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
        print("4. sync connect link still reaches sync.js")
        br2, pg2 = open_planner(p, "desktop", built=a, hash="#/connect/a%2Fb/tok", browser=br)
        check("a/b" in (pg2.evaluate("localStorage.getItem('tum-sync')") or ""), "tum-sync holds the repo from the link")
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
