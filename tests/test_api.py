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



ACTIONS = r"""() => {
  const cs = Object.keys(M).filter(c => M[c].ects > 0), plan = Object.keys(marked);
  const free = cs.find(c => !marked[c] && !isLimMod(c) && (M[c].brackets || []).length > 1 && (M[c].lv || []).some(e => e.d && e.v)) || cs.find(c => !marked[c]);
  const lim = Object.keys(M).find(c => !marked[c] && isLimMod(c) && M[c].ects > 0);
  const out = []; let n = 0; const off = PL.on(() => n++);
  const t = (name, f, cond, key) => { n = 0; const before = key ? localStorage.getItem(key) : null; let err = '';
    try { f(); } catch (e) { err = e.message; }
    let ok = false; try { ok = !!cond(); } catch (e) { err = err || e.message; }
    const kch = key ? localStorage.getItem(key) !== before : true;
    out.push([name, ok && kch && n === 1 && !err, `cond=${ok} key=${kch} events=${n} ${err}`]); };
  t('setInPlan on', () => PL.setInPlan(free, true), () => PL.module(free).state.inPlan, 'tum_plan');
  const b2 = M[free].brackets.find(b => b !== marked[free]);
  if (b2) t('setBracket', () => PL.setBracket(free, b2), () => PL.module(free).state.bracket === b2, 'tum_plan');
  t('setSemester', () => PL.setSemester(free, 2), () => PL.module(free).state.sem === 2, 'tum_sem');
  t('setStatus optional', () => PL.setStatus(free, 'optional'), () => PL.module(free).state.result === 'Zählt nicht (optional).', 'tum_opt');
  t('setStatus done', () => PL.setStatus(free, 'done'), () => PL.module(free).state.status === 'done', 'tum_pst');
  t('setStatus count', () => PL.setStatus(free, 'count'), () => PL.module(free).state.result === 'Zählt mit ' + M[free].ects + ' ECTS.', 'tum_pst');
  t('setEasy', () => PL.setEasy(free, true), () => PL.module(free).state.easy, 'tum_free');
  const ev = PL.module(free).events.find(e => e.wd);
  if (ev) {
    t('setAttendance onl', () => PL.setAttendance(free, ev.key, 'onl'), () => PL.module(free).events.find(e => e.key === ev.key).status === 'onl', 'tum_att');
    t('setAttendance reset', () => PL.setAttendance(free, ev.key, null), () => PL.module(free).events.find(e => e.key === ev.key).status === ev.def, 'tum_att');
    t('toggleMandatory', () => PL.toggleMandatory(free, ev.key), () => PL.module(free).events.find(e => e.key === ev.key).mand, 'tum_mand');
    t('setOverride', () => PL.setOverride(free, ev.key, { v: '07:00', b: '08:00' }), () => PL.module(free).events.find(e => e.key === ev.key).ovr, 'tum_ovr');
    t('setOverride reset', () => PL.setOverride(free, PL.module(free).events.find(e => e.ovr).key, null), () => !PL.module(free).events.some(e => e.ovr), 'tum_ovr');
  }
  t('exclude', () => PL.exclude(cs[40], true, 'Test'), () => PL.module(cs[40]).state.nogo, 'tum_nogo');
  t('exclude off', () => PL.exclude(cs[40], false), () => !PL.module(cs[40]).state.nogo, 'tum_nogo');
  t('linkAlternative', () => PL.linkAlternative(plan[4], plan[5]), () => PL.issues().some(i => i.type === 'Entscheidung'), 'tum_either');
  t('rankAlternative', () => PL.rankAlternative(PL.module(plan[4]).alt.codes[1], -1), () => PL.module(plan[4]).alt.rank === 1 || PL.module(plan[5]).alt.rank === 1, 'tum_either');
  t('unlinkAlternative', () => PL.unlinkAlternative(plan[4]), () => !PL.issues().some(i => i.type === 'Entscheidung'), 'tum_either');
  const w = PL.issues().find(i => i.kind);
  if (w) { t('hideIssue', () => PL.hideIssue(w.id, true), () => PL.issues().find(i => i.id === w.id).hidden, 'tum_hidew');
           t('hideIssue off', () => PL.hideIssue(w.id, false), () => !PL.issues().find(i => i.id === w.id).hidden, 'tum_hidew'); }
  t('setCheck off', () => PL.setCheck(4, false), () => PL.checks()[3] === false, 'tum_colloff');
  t('setCheck on', () => PL.setCheck(4, true), () => PL.checks()[3] === true, 'tum_colloff');
  t('addBlock', () => PL.addBlock({ l: 'Arbeit', wd: 1, v: '08:00', b: '12:00' }), () => PL.settings().blocks.length === 1, 'tum_blocks');
  t('editBlock', () => PL.editBlock(0, { l: 'Arbeit', wd: 2, v: '08:00', b: '12:00' }), () => PL.settings().blocks[0].wd === 2, 'tum_blocks');
  t('removeBlock', () => PL.removeBlock(0), () => PL.settings().blocks.length === 0, 'tum_blocks');
  const tp = PL.settings().travel[0];
  t('setTravel', () => PL.setTravel(tp.a, tp.b, 33), () => PL.settings().travel[0].min === 33, 'tum_travel');
  t('setWorkGoal', () => PL.setWorkGoal(15), () => PL.settings().workGoal === 15, 'tum_workgoal');
  t('setStart', () => PL.setStart('S', 2027), () => PL.settings().startSem === 'S' && PL.settings().startYear === 2027, 'tum_start');
  t('setStart back', () => PL.setStart('W', 2026), () => PL.settings().startSem === 'W', 'tum_start');
  if (lim) {
    t('limited module in plan', () => { PL.setInPlan(lim, true); }, () => PL.module(lim).state.seat === 'open', 'tum_plan');
    t('setSeat got', () => PL.setSeat(lim, 'got'), () => PL.module(lim).state.seat === 'got' && PL.module(lim).state.result.startsWith('Zählt mit'), 'tum_pst');
    t('setSeat open', () => PL.setSeat(lim, 'open'), () => PL.module(lim).state.seat === 'open', 'tum_pst');
  }
  t('setInPlan off', () => PL.setInPlan(free, false), () => !PL.module(free).state.inPlan, 'tum_plan');
  off(); return out; }"""


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
        # the old view draws single dates into the typical week; the new one lists them below the grid
        # (old merges or repeats a single date that shares its slot with a regular block, so only bounds are exact)
        n_sgl = sum(1 for o in W["singles"] if not o["hiddenByDefault"])
        check(n_new <= n_old <= n_new + n_sgl, f"week {s}: {n_new} regular blocks <= old {n_old} <= plus {n_sgl} single dates")
        ects = pg.evaluate("document.querySelector('#wkDlg .wkects b').textContent")
        check(ects.startswith(f"{W['figures']['ects']} ECTS"), f"week {s}: ECTS figure {W['figures']['ects']} = '{ects}'")
        dh = pg.evaluate("[...document.querySelectorAll('#wkDlg .wkdh')].map(e => e.textContent)")
        check(len(dh) == len(W["days"]) and all(d["summary"] in t for d, t in zip(W["days"], dh) if not d["singles"]), f"week {s}: day summaries in the day headers (days without single dates)")
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

        print("4. actions: read model, stored key and one change event each")
        for name, ok, info in pg.evaluate(ACTIONS):
            check(ok, f"{name} ({info})")
        pp = personal_plan()
        if pp:
            print("5. personal plan")
            import_plan(pg, pp)
            oracle(pg, "personal")
        check(not pg.errs, "no page errors " + "; ".join(pg.errs[:3]))
        br.close()
    return finish()


if __name__ == "__main__":
    sys.exit(main())
