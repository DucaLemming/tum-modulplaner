#!/usr/bin/env python3
"""One-off scrape of past semesters from TUMonline (read-only, no login).

For every module of the planner: the three most recent semesters that actually list courses
(decided from the course lists, not from the Turnus field), with type, groups and time slots.
Past semesters do not change, so this runs once; the nightly update is not involved.

Usage: python scripts/history_scrape.py --planner planner/TUM_Modulplaner.html --out data/history.json [--limit N]
"""
import argparse, json, pathlib, re, sys, time
from playwright.sync_api import sync_playwright

ORIGIN = "https://campus.tum.de"
BLANK = ORIGIN + "/__modulplaner_runner__"   # answered locally, never sent to TUMonline
WANT, MAXBACK = 3, 9                          # semesters with courses per module; how many semesters to look back at most

JS = r"""
async ([mods, newest, WANT, MAXBACK]) => {
  const REST = '/tumonline/ee/rest/', MOD = REST + 'slc.cm.reg/student/modules/detail/', GRP = REST + 'slc.tm.cp/student/courseGroups/';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const val = x => (x && typeof x === 'object' && 'value' in x) ? x.value : x;
  const tx = x => { if (x == null) return ''; if (typeof x !== 'object') return String(x);
    const tr = (x.translations && x.translations.translation) || [];
    const de = tr.find(t => t.lang === 'de' && t.value), en = tr.find(t => t.lang === 'en' && t.value);
    return String((de && de.value) || x.value || (en && en.value) || ''); };
  let nreq = 0;
  async function get(url) { let last = '';
    for (let k = 0; k < 4; k++) { try { nreq++; const r = await fetch(url, { headers: { Accept: 'application/json' } });
        if (r.ok) return r.json(); if (r.status === 404) return null; last = 'HTTP ' + r.status; if (r.status === 401 || r.status === 403) break;
      } catch (e) { last = e.message; } await sleep(800 * (k + 1)); }
    throw new Error(last + ' ' + url.slice(-70)); }
  async function groups(cid) {
    const a = await get(GRP + 'firstGroups/' + cid); let gs = (a && a.courseGroupDtos) || [];
    if (a && (a.totalCount || 0) > gs.length) { try { const b = await get(GRP + 'remainingGroups/' + cid); gs = gs.concat((b && b.courseGroupDtos) || []); } catch (e) {} }
    return gs.map(g => { const ap = (g.appointmentDtos || []).filter(p => p.appointmentStatusType === 'CONFIRMED');
      const ser = (g.appointmentSeriesDtos || []).map(s => { const own = ap.filter(p => p.appointmentSeriesId === s.id).map(p => p.timestampFrom.value.slice(0, 10)).sort();
        const wds = [...new Set(own.map(d => new Date(d + 'T12:00:00').getDay()))].join('/');
        return [s.id, wds, s.seriesBeginTime, s.seriesEndTime, s.seriesBegin.value.slice(0, 10), s.seriesEnd.value.slice(0, 10), s.resourceName || '', own.length]; }).filter(s => s[7] > 0);
      const ids = new Set(ser.map(s => s[0]));
      const one = ap.filter(p => !ids.has(p.appointmentSeriesId)).map(p => [p.timestampFrom.value.slice(0, 16), p.timestampTo.value.slice(11, 16), p.resourceName || '']);
      return { n: (g.name || '').trim(), s: ser.map(s => s.slice(1)), o: one }; });
  }
  async function one(mid) {
    const j = await get(MOD + mid + '/availableSemesters'), t = {};
    for (const r of (j && j.resource) || []) { const s = r.content.selectableSemesterLibDto; t[val(s.optionText)] = s.id; }
    const keys = Object.keys(t).filter(k => /^\d{4}[WS]$/.test(k) && k <= newest).sort().reverse().slice(0, MAXBACK);
    const out = { avail: Object.keys(t).sort(), terms: {}, empty: [] };
    for (const k of keys) {
      if (Object.keys(out.terms).length >= WANT) break;
      const l = await get(MOD + mid + '/' + t[k] + '/courseGroupings/courses'), cs = [];
      for (const g of ((l && l.resource) || []).map(r => r.content.cmNodeListItemDto)) {
        const c = await get(MOD + mid + '/' + t[k] + '/courseGroupings/courses/' + g.id);
        for (const r of (c && c.resource) || []) { const d = r.content.coPersonalCourseDetailsDto; if (!d) continue;
          cs.push({ el: tx(g.name), id: d.id, t: tx(d.courseTypeShortName), title: tx(d.courseTitle || d.title), sws: d.duration == null ? '' : String(d.duration) }); }
      }
      if (!cs.length) { out.empty.push(k); continue; }
      for (const c of cs) { try { c.g = await groups(c.id); } catch (e) { c.err = e.message; } }
      out.terms[k] = cs;
    }
    return out;
  }
  const res = {}, q = mods.slice();
  const worker = async () => { while (q.length) { const [code, mid] = q.shift(); try { res[code] = await one(mid); } catch (e) { res[code] = { err: e.message }; } } };
  await Promise.all([worker(), worker(), worker()]);
  return { res, nreq };
}
"""

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--planner", required=True); ap.add_argument("--out", required=True); ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    out = pathlib.Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
    done = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {"modules": {}}
    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context(bypass_csp=True, locale="de-DE", user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 TUM-Modulplaner-History")
        pl = ctx.new_page(); pl.goto(pathlib.Path(a.planner).resolve().as_uri()); pl.wait_for_function("typeof updModuleIds === 'function'")
        info = pl.evaluate("() => ({ids: updModuleIds(DATA.modules), pub: DATA.terms.pub, tu: Object.fromEntries(Object.entries(DATA.modules).map(([c, m]) => [c, m.turnus || '']))})")
        pl.close()
        newest = sorted(info["pub"])[-1]
        mods = [[c, i] for c, i in sorted(info["ids"].items()) if c not in done["modules"] or "err" in done["modules"][c]]
        if a.limit: mods = mods[:: max(1, len(mods) // a.limit)][: a.limit]
        print(f"newest published {newest}; modules to fetch {len(mods)} (already stored {len(done['modules'])})", flush=True)
        page = ctx.new_page(); page.route(BLANK, lambda r: r.fulfill(status=200, content_type="text/html", body="<!doctype html><title>runner</title>")); page.goto(BLANK)
        t0, nreq = time.time(), 0
        for i in range(0, len(mods), 30):
            r = page.evaluate(JS, [mods[i:i + 30], newest, WANT, MAXBACK]); nreq += r["nreq"]
            for c, v in r["res"].items(): v["turnus"] = info["tu"].get(c, ""); done["modules"][c] = v
            done.update(at=time.strftime("%Y-%m-%d"), newest=newest)
            out.write_text(json.dumps(done, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            errs = sum(1 for v in done["modules"].values() if "err" in v)
            print(f"{min(i + 30, len(mods))}/{len(mods)} modules, {nreq} requests, {errs} errors, {int(time.time() - t0)} s", flush=True)
        br.close()
    errs = [c for c, v in done["modules"].items() if "err" in v]
    print("errors:", errs[:20])
    return 0

if __name__ == "__main__":
    sys.exit(main())
