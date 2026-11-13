#!/usr/bin/env python3
"""PL read models and actions, checked against the old UI (oracle) and the stored tum_* keys.

Usage: python tests/test_api.py
"""
import json, pathlib, sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from helpers import check, finish, open_planner, example_plan, import_plan, personal_plan, reload

ALL_READS = """() => { const r = {}; r.totals = PL.totals(); r.brackets = PL.brackets(); r.rules = PL.rules(); r.issues = PL.issues();
  r.checks = PL.checks(); r.modules = PL.modules(); r.semesters = PL.semesters(); r.settings = PL.settings();
  r.weeks = [1,2,3,4].map(s => PL.week(s, 'sem')); r.exams = [1,2,3,4].map(s => PL.exams(s));
  r.module = PL.module(Object.keys(M)[0]); return r; }"""


def oracle(pg, label):
    print(f"-- oracle checks ({label})")
    pg.evaluate("uiSetMode('old')")
    T = pg.evaluate("PL.totals()")
    tot = pg.evaluate("+document.querySelector('#legacy #plan .total b').textContent")
    check(T["sure"] == tot, f"totals.sure {T['sure']} = Fortschritt {tot}")
    hyp = pg.evaluate("(() => { const e = document.querySelector('#legacy #plan .hyptot b'); return e ? +e.textContent : null; })()")
    if hyp is not None:
        check(T["sure"] + T["seatOpen"] == hyp, f"sure + seatOpen = falls Plätze klappen ({hyp})")
    B = pg.evaluate("PL.brackets()")
    meters = pg.evaluate("""[...document.querySelectorAll('#legacy #plan .meter')].filter(m => m.querySelector('.lab'))
      .map(m => [m.querySelector('.lab').textContent, parseInt(m.querySelector('.val').textContent)])""")
    ok = all(any(lab.startswith(r["label"]) and v == r["sure"] for lab, v in meters) for r in B["rows"])
    check(ok, "every bracket row equals its meter in the old plan panel")
    R = pg.evaluate("PL.rules()")
    txt = pg.inner_text("#legacy #plan")
    check(all(s in txt for s in R["bad"] + R["open"]), f"{len(R['bad']) + len(R['open'])} rule strings appear in the old panel")
    for s in (1, 2, 3, 4):
        a = sorted(pg.evaluate(f"PL.issues().filter(i => i.sem === {s} && i.kind).map(i => i.full)"))
        b = sorted(pg.evaluate(f"computeConflicts()[{s}].filter(w => w.k !== 'EO').map(w => w.txt)"))
        check(a == b, f"conflict issues sem {s}: {len(a)}")
    pg.evaluate("openSem && openSem()")
    pg.wait_for_timeout(200)
    for s in (1, 2, 3, 4):
        chip = pg.evaluate(f"(() => {{ const e = document.querySelector('#legacy #sem .semgrp[data-sg=\"{s}\"] .ech.es'); return e ? parseInt(e.textContent) : null; }})()")
        es = pg.evaluate(f"PL.semesters()[{s}].E.s")
        check(chip is None and es == 0 or chip == es, f"semester {s}: E.s {es} = chip {chip}")
    for s in (1, 2, 3):
        pg.evaluate(f"openWeek({s})")
        pg.wait_for_timeout(200)
        W = pg.evaluate(f"PL.week({s}, 'sem')")
        n_old = pg.evaluate("document.querySelectorAll('#wkDlg .wkev:not(.wkjob)').length")
        n_new = sum(1 for d in W["days"] for i in d["items"] if i["kind"] == "ev" and not i["hiddenByDefault"])
        check(n_old == n_new, f"week {s}: {n_new} event blocks = old {n_old}")
        ects = pg.evaluate("document.querySelector('#wkDlg .wkects b').textContent")
        check(ects.startswith(f"{W['figures']['ects']} ECTS"), f"week {s}: ECTS figure {W['figures']['ects']} = '{ects}'")
        dh = pg.evaluate("[...document.querySelectorAll('#wkDlg .wkdh')].map(e => e.textContent)")
        check(len(dh) == len(W["days"]) and all(d["summary"] in t for d, t in zip(W["days"], dh)), f"week {s}: day summaries in the day headers")
    pg.evaluate("closeWeek()")
    for s in (1, 2, 3):
        pg.evaluate(f"openExam({s})")
        pg.wait_for_timeout(150)
        n_old = pg.evaluate("document.querySelectorAll('#exDlg .extab tr[data-xo]').length")
        X = pg.evaluate(f"PL.exams({s})")
        n_new = sum(len(w["rows"]) for w in X["weeks"])
        check(n_old == n_new, f"exams {s}: {n_new} dated rows = old table {n_old}")
    pg.evaluate("closeExam()")
    pg.evaluate("uiSetMode('new')")


def main():
    with sync_playwright() as p:
        print("1. empty plan (Review focus 1)")
        br, pg = open_planner(p, "desktop")
        r = pg.evaluate(f"(() => {{ try {{ return JSON.stringify(({ALL_READS})()).length; }} catch (e) {{ return 'ERR ' + e.message; }} }})()")
        check(isinstance(r, int), f"every read model returns on an empty plan ({r if not isinstance(r, int) else 'ok'})")
        check(pg.evaluate("PL.totals().sure") == 0, "totals.sure = 0")

        print("2. example plan")
        import_plan(pg, example_plan(pg))
        check(pg.evaluate("Object.keys(marked).length") == 12, "12 modules imported")
        oracle(pg, "example")

        print("3. unknown code in the plan (Review focus 2)")
        r = pg.evaluate(f"""(() => {{ marked['XX0000'] = 'kern'; sem['XX0000'] = 1;
          try {{ const s = JSON.stringify(({ALL_READS})()); return s.includes('XX0000') ? 'present' : 'ok'; }}
          catch (e) {{ return 'ERR ' + e.message; }} finally {{ delete marked['XX0000']; delete sem['XX0000']; }} }})()""")
        check(r == "ok", f"read models skip XX0000 ({r})")

        pp = personal_plan()
        if pp:
            print("4. personal plan")
            import_plan(pg, pp)
            oracle(pg, "personal")
        check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
