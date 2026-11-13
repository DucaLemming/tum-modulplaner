#!/usr/bin/env python3
"""Headless update of the TUM Modulplaner (used by .github/workflows/update.yml).

Everything runs with the planner's own code, so the updater always matches the planner version:
  1. job:   opens the planner in headless Chromium and takes job + browser script exactly as
            "Skript kopieren" would (updRunText(): window.TUMU_JOB = {...}; + tum_update.js)
  2. fetch: opens an empty page on campus.tum.de (no login), runs that text, TUMU.start(), waits
            until the run is done. Only GET requests, exactly like the manual run in the console.
  3. apply: back in the planner page, updApply(plannerHTML, result, {plan}) builds the new planner,
            exactly like "Ergebnis einlesen" > "Übernehmen".

Usage: python scripts/run_update.py --planner planner/TUM_Modulplaner.html --out work [--plan plan/Modulplan.txt]
Writes work/TUM_Modulplaner.html, work/report.txt and work/tum_update_<date>.json.
Exit code 0 = new planner written, 1 = run failed or returned no data (nothing written).
"""
import argparse, datetime, json, os, pathlib, re, sys, time

from playwright.sync_api import sync_playwright

ORIGIN = "https://campus.tum.de"
BLANK = ORIGIN + "/__modulplaner_runner__"   # never sent to TUMonline: answered locally by page.route below
POLL_S = 20
MAX_MIN = 75


def log(*a):
    print(datetime.datetime.now().strftime("%H:%M:%S"), *a, flush=True)


def plan_codes(path):
    """Module codes of the exported plan (section 'Markierte Module'), only for the report."""
    if not path or not os.path.exists(path):
        return None
    t = open(path, encoding="utf-8").read()
    i = t.find("=== Markierte Module")
    j = t.find("\n===", i + 5) if i >= 0 else -1
    sec = t[i:j] if i >= 0 else ""
    return sorted(set(re.findall(r"^\s{2}([A-Z]{2,5}\d{3,6}[A-Za-z]?)\s+\d+ ECTS", sec, re.M))) or None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--planner", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--plan")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    planner_url = pathlib.Path(a.planner).resolve().as_uri()
    html = open(a.planner, encoding="utf-8").read()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(bypass_csp=True, locale="de-DE",
                                  user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
                                             "Chrome/130.0 Safari/537.36 TUM-Modulplaner-Autoupdate")

        # 1. job and script from the planner itself
        pl = ctx.new_page()
        pl.goto(planner_url)
        pl.wait_for_timeout(2000)
        run = pl.evaluate("() => updRunText()")
        j = run["job"]
        log(f"Job: Planungssemester {' '.join(j.get('P') or [])}, Studienplan {j.get('cv')} (Studienjahr {j.get('sj')})")

        # 2. run on an empty campus.tum.de page
        page = ctx.new_page()
        page.route(BLANK, lambda r: r.fulfill(status=200, content_type="text/html",
                                               body="<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>"))
        page.goto(BLANK)
        ready = page.evaluate("txt => { (0, eval)(txt); return window.TUMU ? TUMU.status() : 'TUMU fehlt'; }", run["text"])
        log("Skript:", ready)
        log(page.evaluate("() => TUMU.start()"))

        t0, last, phase = time.time(), "", ""
        while time.time() - t0 < MAX_MIN * 60:
            time.sleep(POLL_S)
            st = page.evaluate("() => TUMU.status()")
            phase = page.evaluate("() => (TUMU._state() || {}).phase")
            if st != last:
                log(st)
                last = st
            if phase in ("done", "abort"):
                break
        else:
            log(f"ABBRUCH: nach {MAX_MIN} min nicht fertig")

        errs = page.evaluate("() => TUMU.errors(20)")
        if errs:
            log("Letzte Fehler:\n  " + "\n  ".join(errs))

        # same JSON as the "Herunterladen" button: catch the blob instead of saving a file
        data = page.evaluate("""async () => {
            let blob = null; const orig = URL.createObjectURL;
            URL.createObjectURL = b => { blob = b; return 'blob:none'; };
            const a = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
            try { TUMU.download(); } finally { URL.createObjectURL = orig; HTMLAnchorElement.prototype.click = a; }
            return blob ? await blob.text() : null; }""")
        if not data:
            log("FEHLER: kein Ergebnis")
            return 1
        R = json.loads(data)
        day = (R.get("started") or datetime.date.today().isoformat())[:10]
        open(os.path.join(a.out, f"tum_update_{day}.json"), "w", encoding="utf-8").write(data)
        m = R.get("m") or {}
        ok_mod = sum(1 for v in m.values() if isinstance(v, dict) and v.get("L"))
        n_err = sum(1 for v in m.values() if v == "err")
        log(f"Ergebnis: Phase {R.get('phase')}, Module {len(m)} (mit LV {ok_mod}, Fehler {n_err}), "
            f"Kurse {len(R.get('c') or {})}, veröffentlicht {' '.join(R.get('pub') or [])}")
        # same safety rule as the planner: never apply an empty or unfinished run
        if R.get("phase") != "done" or not R.get("pub") or ok_mod == 0:
            log("FEHLER: Lauf unvollständig oder leer, Planer bleibt unverändert")
            return 1
        if len(m) and n_err / len(m) > 0.2:
            log(f"FEHLER: zu viele fehlgeschlagene Module ({n_err} von {len(m)}), Planer bleibt unverändert")
            return 1

        # 3. apply with the planner's own code
        res = pl.evaluate("([h, R, plan]) => { const r = updApply(h, R, { plan }); return { html: r.html, rep: r.rep }; }",
                          [html, R, plan_codes(a.plan)])
        browser.close()

    open(os.path.join(a.out, "TUM_Modulplaner.html"), "w", encoding="utf-8").write(res["html"])
    rep = "\n".join(res["rep"])
    open(os.path.join(a.out, "report.txt"), "w", encoding="utf-8").write(rep + "\n")
    print(rep)
    return 0


if __name__ == "__main__":
    sys.exit(main())
