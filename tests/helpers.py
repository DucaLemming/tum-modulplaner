"""Shared Playwright helpers for the UI rework tests (plain scripts, no test framework)."""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLANNER = ROOT / "planner" / "TUM_Modulplaner.html"
SIZES = {"phone": (390, 844), "desktop": (1440, 900)}
URL = "https://planner.test/TUM_Modulplaner.html"
SHOTS = pathlib.Path(sys.argv[sys.argv.index("--shots") + 1]) if "--shots" in sys.argv else None


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        check.failed += 1
    return cond
check.failed = 0


def finish():
    print("FAILED" if check.failed else "ALL OK")
    return 1 if check.failed else 0


def open_planner(playwright, size="desktop", built=None, hash="", browser=None, reduced_motion=None):
    """New browser (or a new context in `browser`) with a fresh localStorage. Returns (browser, page)."""
    body = pathlib.Path(built).read_bytes() if built else PLANNER.read_bytes()
    br = browser or playwright.chromium.launch()
    w, hgt = SIZES.get(size, size) if isinstance(size, str) else size
    opts = {"viewport": {"width": w, "height": hgt}, "locale": "de-DE", "accept_downloads": True}
    if reduced_motion:
        opts["reduced_motion"] = reduced_motion
    if w < 720:
        opts.update(has_touch=True, is_mobile=True)
    ctx = br.new_context(**opts)
    ctx.route("https://planner.test/**", lambda r: r.fulfill(status=200, content_type="text/html; charset=utf-8", body=body))
    ctx.route("https://api.github.com/**", lambda r: r.fulfill(status=404, content_type="application/json", body='{"message":"Not Found"}'))
    pg = ctx.new_page()
    pg.errs = []
    pg.on("pageerror", lambda e: pg.errs.append(str(e)))
    pg.goto(URL + hash)
    wait_ready(pg)
    return br, pg


def wait_ready(pg):
    pg.wait_for_function("typeof marked === 'object' && document.readyState === 'complete'", timeout=60000)
    pg.wait_for_timeout(300)


def reload(pg):
    pg.reload()
    wait_ready(pg)


def example_codes(pg):
    return pg.evaluate("Object.keys(M).filter(c => M[c].ects > 0).slice(0, 12)")


def example_plan(pg):
    """Plan text with 12 modules (first 12 codes of M with ects > 0), four per semester 1 to 3."""
    return pg.evaluate("""() => { const cs = Object.keys(M).filter(c => M[c].ects > 0).slice(0, 12);
      let t = 'Startsemester: WiSe 2026\\n\\n=== Semesterplan ===\\n';
      [1, 2, 3].forEach(s => { t += s + '. Semester\\n'; cs.slice((s - 1) * 4, s * 4).forEach(c => t += '  ' + M[c].ects + ' ECTS   ' + c + ' ' + M[c].name + '\\n'); });
      return t; }""")


def import_plan(pg, text):
    pg.evaluate("t => applyImport(parsePlanText(t), 'replace')", text)
    reload(pg)


def personal_plan():
    p = ROOT / "plan" / "Modulplan.txt"
    return p.read_text(encoding="utf-8") if p.exists() else None


def export_text(pg):
    t = pg.evaluate("""() => new Promise(res => { const oc = URL.createObjectURL;
      URL.createObjectURL = b => { URL.createObjectURL = oc; b.text().then(res); return 'blob:none'; };
      const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { HTMLAnchorElement.prototype.click = ck; };
      exportPlan(); })""")
    return "\n".join(l for l in t.splitlines() if not l.startswith("Erstellt:"))


def shot(pg, name):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        pg.screenshot(path=str(SHOTS / f"{name}.png"))


def no_hscroll(pg):
    return pg.evaluate("document.documentElement.scrollWidth") <= pg.viewport_size["width"]
