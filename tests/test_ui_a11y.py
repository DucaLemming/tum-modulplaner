#!/usr/bin/env python3
"""Phone and accessibility pass: no horizontal scroll, 44 px touch targets, labels on icon buttons, tab order,
reduced motion, contrast of the tokens.

Usage: python tests/test_ui_a11y.py [--shots DIR]
"""
import pathlib, re, sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from helpers import ROOT, check, finish, open_planner, example_plan, import_plan, no_hscroll, shot

ROUTES = ["uebersicht", "module", "plan", "woche/2", "pruefungen/3", "plan/m/{code}"]

SMALL = """() => [...document.querySelectorAll('#ui button, #ui a, #ui select, #ui input, #ui [role=button]')].filter(e => {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden') return false;
    if (e.closest('p')) return false;
    return r.width < 43.5 || r.height < 43.5; }).map(e => (e.className || e.tagName) + ' ' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20) + ' ' +
      Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))"""
NOLABEL = """() => [...document.querySelectorAll('#ui button, .ui-sheet-root button')].filter(b => b.getBoundingClientRect().width && !b.textContent.trim() && !b.getAttribute('aria-label')).map(b => b.className)"""


def lum(hexc):
    c = [int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def main():
    tok = (ROOT / "planner" / "src" / "css" / "tokens.css").read_text(encoding="utf-8")
    T = dict(re.findall(r"--([a-z-]+):\s*(#[0-9a-fA-F]{6})", tok))
    c1, c2 = contrast(T["muted"], T["surface"]), contrast(T["ink"], T["bg"])
    check(c1 >= 4.5 and c2 >= 4.5, f"contrast --muted on --surface {c1:.2f}, --ink on --bg {c2:.2f} (>= 4.5)")
    with sync_playwright() as p:
        br = p.chromium.launch()
        _, pg = open_planner(p, "phone", browser=br, reduced_motion="reduce")
        import_plan(pg, example_plan(pg))
        pg.locator("#ui .ui-disc .ui-btn").click()
        code = pg.evaluate("Object.keys(marked)[0]")
        for r in ROUTES:
            r = r.format(code=code)
            pg.evaluate("r => uiNav(r)", r); pg.wait_for_timeout(250)
            check(no_hscroll(pg), f"#/{r}: scrollWidth <= 390")
            small = pg.evaluate(SMALL)
            check(not small, f"#/{r}: touch targets >= 44 x 44" + (": " + "; ".join(small[:6]) if small else ""))
            nl = pg.evaluate(NOLABEL)
            check(not nl, f"#/{r}: buttons without text have aria-label" + (": " + ", ".join(nl[:5]) if nl else ""))
            shot(pg, "a11y_" + r.replace("/", "_"))
            if "/m/" in r:
                pg.evaluate("uiCloseModule()"); pg.wait_for_timeout(150)
        pg.evaluate("uiNav('plan')"); pg.wait_for_timeout(100)
        pg.evaluate("document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0)")
        pg.keyboard.press("Tab")
        first = pg.evaluate("document.activeElement.dataset.nav || document.activeElement.className")
        check(first == "uebersicht", f"first Tab reaches the first navigation entry ({first})")
        inside = False
        for _ in range(20):
            pg.keyboard.press("Tab")
            if pg.evaluate("!!document.activeElement.closest('#ui .ui-screen')"):
                inside = True; break
        check(inside, "Tab then reaches the screen content")
        long = pg.evaluate("""() => [...document.querySelectorAll('#ui *')].map(e => getComputedStyle(e)).filter(cs => cs.transitionDuration.split(',').some(d => parseFloat(d) * (d.includes('ms') ? 1 : 1000) > 1)).length""")
        check(long == 0, f"prefers-reduced-motion: no transition longer than 1 ms ({long})")
        check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
