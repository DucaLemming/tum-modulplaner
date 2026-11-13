#!/usr/bin/env python3
"""Kopiert tum_update.js in den Planer (Block <script type="text/plain" id="tumuScript">), damit „Skript kopieren“ die aktuelle Fassung liefert.

  python3 sync_updater.py                      # Standard: ../../TUM_Modulplaner.html und tum_update.js aus diesem Ordner
  python3 sync_updater.py --planner X.html --script tum_update.js
  python3 sync_updater.py --check              # nur prüfen, ob beide gleich sind (Exit-Code 1, wenn nicht)
Siehe HOW_TO_UPDATE.md, Abschnitt „Modifying“."""
import argparse, os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--planner', default=os.path.join(here, '..', '..', 'TUM_Modulplaner.html'))
ap.add_argument('--script', default=os.path.join(here, 'tum_update.js'))
ap.add_argument('--check', action='store_true')
a = ap.parse_args()
h = open(a.planner, encoding='utf-8').read(); js = open(a.script, encoding='utf-8').read().strip('\n')
if '</script' in js.lower() or '<!--' in js:
    sys.exit('ABBRUCH: Das Skript enthält "</script" oder "<!--" und kann so nicht in die HTML-Datei (bitte im Skript umschreiben, z. B. "<\\/script").')
m = re.search(r'(<script type="text/plain" id="tumuScript">\n)(.*?)(\n</script>)', h, re.S)
if not m: sys.exit('ABBRUCH: Block id="tumuScript" nicht gefunden (Planer älter als v54?).')
if a.check:
    same = m.group(2) == js
    print('gleich' if same else 'UNTERSCHIEDLICH: python3 sync_updater.py ausführen'); sys.exit(0 if same else 1)
h = h[:m.start(2)] + js + h[m.end(2):]
open(a.planner, 'w', encoding='utf-8').write(h)
print(f'OK: {os.path.basename(a.script)} ({len(js)} Zeichen) in {os.path.basename(a.planner)} übernommen.')
