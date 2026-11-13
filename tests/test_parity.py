#!/usr/bin/env python3
"""Golden parity: the text export must be identical between the planner without the new blocks (--no-ui)
and with them, for the same plan, and after the same series of changes done through PL versus through the engine.

Usage: python tests/test_parity.py
"""
import pathlib, shutil, sys, tempfile

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))
from helpers import PLANNER, check, finish, open_planner, example_plan, import_plan, personal_plan, export_text
import build

# The same series twice: once through PL (full build), once through the engine calls named in the plan (--no-ui build).
SERIES_PL = """async () => {
  const cs = Object.keys(M).filter(c => M[c].ects > 0); const c13 = cs[12], c1 = cs[0], c2 = cs[1];
  PL.setInPlan(c13, true); PL.setSemester(c13, 2); PL.setStatus(c13, 'optional'); PL.setStatus(c13, 'count');
  const e = PL.module(c13).events[0]; if (e) PL.setAttendance(c13, e.key, 'onl');
  PL.linkAlternative(c1, c2); PL.rankAlternative(c2, -1);
  PL.addBlock({ l: 'Arbeit', wd: 1, v: '08:00', b: '12:00' });
  const w = PL.issues().find(i => i.kind); if (w) PL.hideIssue(w.id, true);
  PL.setCheck(4, false); }"""
SERIES_ENGINE = """async () => {
  const cs = Object.keys(M).filter(c => M[c].ects > 0); const c13 = cs[12], c1 = cs[0], c2 = cs[1];
  mark(c13); setSem(c13, 2);
  opt[c13] = 1; saveOpt(); savePst(); if (typeof eoEnforce === 'function') eoEnforce(); afterChange(c13);
  delete opt[c13]; delete done[c13]; saveOpt(); savePst(); if (typeof eoEnforce === 'function') eoEnforce(); afterChange(c13);
  const tm = sem[c13] ? termOf(sem[c13]) : wantTerm(c13), e = lvFor(c13, tm).list[0]; if (e) setStatus(c13, [ekeyG(e)], 'onl');
  eoLink(c1, c2); afterChange(c1); eoMove(c2, -1); afterChange(c2);
  blocks.push({ l: 'Arbeit', wd: 1, v: '08:00', b: '12:00' }); saveBlocks(); renderSem();
  const cf = computeConflicts(); let done1 = false;
  [1, 2, 3, 4].forEach(s => cf[s].forEach(w => { if (done1 || w.k === 'EO') return; hideW[wKey(s, w)] = 1; done1 = true; }));
  saveHideW(); renderPlan();
  collOff.add(4); saveColl(); collRefresh(); }"""


def main():
    tmp = pathlib.Path(tempfile.mkdtemp())
    full, bare = tmp / "full.html", tmp / "bare.html"
    shutil.copy(PLANNER, full); shutil.copy(PLANNER, bare)
    build.main(full, quiet=True); build.main(bare, ui=False, quiet=True)
    plans = [("example", None)] + ([("personal", personal_plan())] if personal_plan() else [])
    with sync_playwright() as p:
        br = p.chromium.launch()
        for name, text in plans:
            print(f"plan: {name}")
            _, A = open_planner(p, "desktop", built=full, browser=br)
            _, B = open_planner(p, "desktop", built=bare, browser=br)
            t = text or example_plan(A)
            import_plan(A, t); import_plan(B, t)
            ea, eb = export_text(A), export_text(B)
            check(ea == eb and len(ea) > 500, f"export identical after import ({len(ea)} chars)")
            if name == "personal":
                check("Gesamt: 128 / 120 ECTS sicher" in ea, "reference: Gesamt: 128 / 120 ECTS sicher")
            if A.evaluate("typeof PL.setInPlan") == "function":
                A.evaluate(SERIES_PL); B.evaluate(SERIES_ENGINE)
                A.wait_for_timeout(300); B.wait_for_timeout(300)
                ea, eb = export_text(A), export_text(B)
                check(ea == eb, "export identical after the series of changes (PL vs engine)")
                if ea != eb:
                    import difflib
                    print("\n".join(list(difflib.unified_diff(eb.splitlines(), ea.splitlines(), "engine", "PL", lineterm=""))[:30]))
                keys = "Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('tum_') && !['tum_wksem','tum_exsem','tum_wkf','tum_wkmax','tum_recnotes'].includes(k)).map(k => [k, localStorage.getItem(k)]))"
                ka, kb = A.evaluate(keys), B.evaluate(keys)
                diff = sorted(k for k in set(ka) | set(kb) if ka.get(k) != kb.get(k))
                check(not diff, "stored tum_* keys identical" + (": " + ", ".join(diff) if diff else ""))
            check(not A.errs and not B.errs, "no page errors " + "; ".join((A.errs + B.errs)[:3]))
            A.context.close(); B.context.close()
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
