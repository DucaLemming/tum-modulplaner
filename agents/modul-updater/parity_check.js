/* Prüft, ob der Planer (JavaScript, updApply) und tum_update.py apply dasselbe Ergebnis liefern.
   node parity_check.js <Planer-alt.html> <tum_update_JJJJ-MM-TT.json> <Ergebnis-von-tum_update.py.html> [<Planer mit Code, ab v54>]
   Erwartung: "IDENTISCH". Die Funktionen werden aus einer Planer-Datei ab v54 gelesen (Script-Block mit function updApply):
   aus dem 4. Argument, sonst aus der alten Planer-Datei selbst. */
const fs = require('fs'), [, , base, data, pyOut, codeFile] = process.argv;
if (!pyOut) { console.log('Aufruf: node parity_check.js <Planer-alt.html> <update.json> <python-ergebnis.html>'); process.exit(2); }
const h = fs.readFileSync(base, 'utf8');
const blk = [...fs.readFileSync(codeFile || base, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('function updApply('));
if (!blk) { console.log('updApply nicht in der Planer-Datei gefunden (Planer älter als v54?)'); process.exit(2); }
const code = blk.slice(0, blk.indexOf('/* ---------- Dialog'));          /* nur die reinen Funktionen, ohne Dialog */
const api = new Function(code + '; return {updApply, updDataSpan};')();
const res = api.updApply(h, JSON.parse(fs.readFileSync(data, 'utf8')), {});
const py = fs.readFileSync(pyOut, 'utf8');
if (res.html === py) { console.log('IDENTISCH (Datei Byte für Byte gleich)'); process.exit(0); }
const A = JSON.parse(res.html.slice(...api.updDataSpan(res.html))), B = JSON.parse(py.slice(...api.updDataSpan(py)));
let n = 0; const diff = (a, b, p) => { if (n > 30) return;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) { n++; console.log('Typ', p); return; }
  if (a && typeof a === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (!(k in a) || !(k in b)) { n++; console.log('fehlt', p + '.' + k); } else diff(a[k], b[k], p + '.' + k); } return; }
  if (a !== b) { n++; console.log('Wert', p, JSON.stringify(a).slice(0, 80), '|', JSON.stringify(b).slice(0, 80)); } };
diff(A, B, 'DATA'); console.log(n ? n + ' Unterschiede (siehe oben)' : 'Daten gleich, nur Reihenfolge oder Formatierung anders'); process.exit(n ? 1 : 0);
