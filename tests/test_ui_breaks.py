#!/usr/bin/env python3
"""Work blocks in the week view show the break required by law (ArbZG §4) and its length."""
import sys
from playwright.sync_api import sync_playwright
from helpers import check, open_planner, import_plan, example_plan

CASES = [("Mo", 1, "08:00", "13:00", 0), ("Di", 2, "08:00", "14:15", 15), ("Mi", 3, "08:00", "17:30", 30), ("Do", 4, "07:00", "17:00", 45)]
with sync_playwright() as p:
    br, pg = open_planner(p, "desktop")
    import_plan(pg, example_plan(pg))
    for _, wd, v, b, _ in CASES:
        pg.evaluate("([wd, v, b]) => PL.addBlock({ l: 'Arbeit', wd, v, b, sems: [1], loc: 'Arbeit' })", [wd, v, b])
    pg.evaluate("uiNav('woche/1')"); pg.wait_for_timeout(1200)
    W = pg.evaluate("() => Object.fromEntries(PL.week(1, 'sem').days.map(d => [d.wd, (d.items.find(i => i.kind === 'own') || {}).work]))")
    for name, wd, v, b, brk in CASES:
        check(W[str(wd)] and W[str(wd)]["brk"] == brk, f"{name} {v}-{b}: break {brk} min ({W[str(wd)]})")
    txt = pg.locator(".ui-ev-own").all_inner_texts()
    check(sum("Pause" in t for t in txt) == 3 and any("Pause 45 min" in t for t in txt), "blocks with a break show 'Pause N min'")
    pg.evaluate("PL.addBlock({ l: 'Arbeit', wd: 3, v: '12:30', b: '17:30', sems: [1], loc: 'Arbeit' }); PL.editBlock(PL.settings().blocks.find(x => x.wd === 3).i, { l: 'Arbeit', wd: 3, v: '08:00', b: '12:00', sems: [1], loc: 'Arbeit' })")
    pg.wait_for_timeout(500)
    w3 = pg.evaluate("() => PL.week(1, 'sem').days.find(d => d.wd === 3).items.filter(i => i.kind === 'own').map(i => i.work.brk)")
    check(w3 == [0, 0], f"30 min gap between two blocks counts as the break ({w3})")
    check(not pg.errs, "no page errors " + "; ".join(pg.errs[:2]))
    br.close()
print("FAILED" if check.failed else "ALL OK"); sys.exit(1 if check.failed else 0)
