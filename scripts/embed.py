#!/usr/bin/env python3
"""Embeds the scripts from planner/src/ into planner/TUM_Modulplaner.html.

Each source file becomes one <script id="..."> block right before </body>. An existing block
with the same id is replaced, so the command can be repeated. The module data (const DATA=...)
and every other part of the planner stay untouched.

Usage: python scripts/embed.py [planner/TUM_Modulplaner.html]
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BLOCKS = [("tumQr", "planner/src/qrcode.js"), ("tumSync", "planner/src/sync.js")]   # order matters


def main(path):
    h = path.read_text(encoding="utf-8")
    for bid, src in BLOCKS:
        js = (ROOT / src).read_text(encoding="utf-8")
        assert "</script" not in js.lower(), f"{src} contains </script"
        block = f'<script id="{bid}">\n{js.rstrip()}\n</script>\n'
        pat = re.compile(r'<script id="%s">.*?</script>\n?' % re.escape(bid), re.S)
        n = len(pat.findall(h))
        assert n <= 1, f"{bid}: {n} blocks"
        if n:
            h = pat.sub(lambda m: block, h, count=1)
        else:
            assert h.count("</body>") == 1, "expected exactly one </body>"
            h = h.replace("</body>", block + "</body>")
        print(f"{bid}: {'replaced' if n else 'added'} ({len(js):,} chars from {src})")
    path.write_text(h, encoding="utf-8")


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "planner" / "TUM_Modulplaner.html")
