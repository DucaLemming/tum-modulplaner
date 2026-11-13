#!/usr/bin/env python3
"""Builds planner/TUM_Modulplaner.html: injects the sources from planner/src/ as blocks before </body>.

Blocks, in this fixed order:
  <style id="uiCss">    all files of planner/src/css/ (tokens, base, nav, sheets, screens)
  <script id="tumQr">   planner/src/qrcode.js
  <script id="tumSync"> planner/src/sync.js
  <script id="uiApi">   planner/src/api.js (the facade PL)
  <script id="uiApp">   planner/src/ui/*.js, then the line uiBoot();

Every existing block with one of these ids is removed first, so running the build twice gives the
same file. The module data (const DATA=...), the engine scripts and the updater stay untouched.

Usage: python scripts/build.py [path] [--no-ui]
  --no-ui  writes only tumQr and tumSync (removes uiCss, uiApi, uiApp); used by the parity tests.
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "planner" / "src"
CSS = ["tokens", "base", "nav", "sheets", "uebersicht", "module", "modul", "plan", "woche", "pruefungen"]
UI = ["h", "boot", "router", "sheet", "nav", "uebersicht", "module", "modul", "plan", "woche", "event-sheet",
      "pruefungen", "menu", "help"]
IDS = ["uiCss", "tumQr", "tumSync", "uiApi", "uiApp"]
BLOCK_RE = re.compile(r'<(script|style) id="(%s)">.*?</\1>\n?' % "|".join(IDS), re.S)


def _read(p):
    t = p.read_text(encoding="utf-8")
    low = t.lower()
    assert "</script" not in low and "</style" not in low, f"{p} contains a closing script/style tag"
    return t.rstrip()


def blocks(ui=True):
    out = []
    if ui:
        css = [SRC / "css" / f"{n}.css" for n in CSS if (SRC / "css" / f"{n}.css").exists()]
        out.append(("style", "uiCss", "\n".join(_read(p) for p in css)))
    out.append(("script", "tumQr", _read(SRC / "qrcode.js")))
    out.append(("script", "tumSync", _read(SRC / "sync.js")))
    if ui:
        if (SRC / "api.js").exists():
            out.append(("script", "uiApi", _read(SRC / "api.js")))
        js = [SRC / "ui" / f"{n}.js" for n in UI if (SRC / "ui" / f"{n}.js").exists()]
        out.append(("script", "uiApp", "\n".join(_read(p) for p in js) + "\nuiBoot();"))
    return out


def strip(h):
    return BLOCK_RE.sub("", h)


def main(path=None, ui=True, quiet=False):
    path = pathlib.Path(path) if path else ROOT / "planner" / "TUM_Modulplaner.html"
    h = strip(path.read_text(encoding="utf-8"))
    assert h.count("</body>") == 1, "expected exactly one </body>"
    add = "".join(f'<{tag} id="{bid}">\n{body}\n</{tag}>\n' for tag, bid, body in blocks(ui))
    h = h.replace("</body>", add + "</body>")
    path.write_text(h, encoding="utf-8")
    for tag, bid, body in ([] if quiet else blocks(ui)):
        print(f"{bid}: {len(body):,} chars")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    main(args[0] if args else None, ui="--no-ui" not in sys.argv)
