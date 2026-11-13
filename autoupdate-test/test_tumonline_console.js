/* TUMonline access test (read-only, GET only).
   Paste into the browser console (F12 > Console) on a campus.tum.de page.
   Run it twice: once logged in (baseline), once in a private window WITHOUT logging in.
   It sends 7 GET requests, nothing else. It never registers or changes anything. */
(async () => {
  const MID = 3554696;            // module id from the planner link (MW0007 Aerodynamik des Flugzeugs 1)
  const SPO = 5451, SJ = 1623, ROOT = 4878472;   // study plan version, study year, root node (from HOW_TO_UPDATE.md)
  const REST = '/tumonline/ee/rest/', MOD = REST + 'slc.cm.reg/student/modules/detail/';
  const GRP = REST + 'slc.tm.cp/student/courseGroups/', CP = REST + 'slc.tm.cp/student/';
  const TREE = '/tumonline/wbStpCs.cbSpoTree?pStStudiumNr=&pStPersonNr=&pIsStudSicht=FALSE&pShowErg=J&pHideInactive=TRUE&pCaller=&pAction=0';
  const rows = [];
  async function get(name, url, text) {
    const t0 = performance.now();
    try {
      const r = await fetch(url, { headers: text ? {} : { Accept: 'application/json' }, cache: 'no-store' });
      const body = await r.text(); let json = null;
      if (!text) { try { json = JSON.parse(body); } catch (e) {} }
      const ok = r.ok && (text ? body.length > 200 : !!json);
      rows.push({ test: name, status: r.status, ok, bytes: body.length, ms: Math.round(performance.now() - t0), sample: body.slice(0, 80).replace(/\s+/g, ' ') });
      return json || body;
    } catch (e) { rows.push({ test: name, status: 'ERR', ok: false, bytes: 0, ms: 0, sample: e.message }); return null; }
  }
  const s = await get('1 semesters', MOD + MID + '/availableSemesters');
  const terms = ((s && s.resource) || []).map(r => r.content && r.content.selectableSemesterLibDto).filter(Boolean);
  const term = terms.find(t => /2026/.test(JSON.stringify(t.optionText))) || terms[0];
  if (term) {
    const tid = term.id;
    await get('2 module detail', MOD + MID + '/' + tid);
    const l = await get('3 course groupings', MOD + MID + '/' + tid + '/courseGroupings/courses');
    const g = ((l && l.resource) || []).map(r => r.content && r.content.cmNodeListItemDto).filter(Boolean)[0];
    let cid = null;
    if (g) {
      const c = await get('4 courses', MOD + MID + '/' + tid + '/courseGroupings/courses/' + g.id);
      const d = ((c && c.resource) || []).map(r => r.content && r.content.coPersonalCourseDetailsDto).filter(Boolean)[0];
      cid = d && d.id;
    }
    if (cid) {
      await get('5 dates and groups', GRP + 'firstGroups/' + cid);
      await get('6 registration', CP + 'courses/' + cid + '/registrationProcedures');
    } else rows.push({ test: '5/6 skipped', status: '-', ok: false, bytes: 0, ms: 0, sample: 'no course id from step 4' });
  } else rows.push({ test: '2-6 skipped', status: '-', ok: false, bytes: 0, ms: 0, sample: 'no semester id from step 1' });
  await get('7 study plan tree', TREE + '&pStpStpNr=' + SPO + '&pSJNr=' + SJ + '&pStpKnotenNr=' + ROOT + '&pId=kn' + ROOT, true);
  console.table(rows);
  const n = rows.filter(r => r.ok).length;
  console.log('%cRESULT: ' + n + ' of ' + rows.length + ' OK', 'font-weight:bold;font-size:14px');
  console.log('Copy this line into the chat:\n' + rows.map(r => r.test.split(' ')[0] + ':' + r.status + (r.ok ? '+' : '-')).join(' '));
})();
