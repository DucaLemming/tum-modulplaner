#!/usr/bin/env python3
"""Sanity check before the new planner replaces the old one.

Usage: python scripts/check_planner.py OLD.html NEW.html
Prints "changed=true|false" for the workflow (also into $GITHUB_OUTPUT) and exits 1 if the new file looks broken.
"""
import json, os, sys


def data(path):
    h = open(path, encoding="utf-8").read()
    i = h.index("const DATA=") + len("const DATA=")
    return h, json.JSONDecoder().raw_decode(h[i:])[0]


def main(old_p, new_p):
    _, Do = data(old_p)
    h, Dn = data(new_p)
    n_old, n_new = len(Do["modules"]), len(Dn["modules"])
    n_lv = sum(1 for m in Dn["modules"].values() if m.get("lvt"))
    print(f"Module: vorher {n_old}, nachher {n_new}, mit Terminen {n_lv}")
    problems = []
    if n_new < 0.9 * n_old:
        problems.append(f"zu wenige Module ({n_new} statt etwa {n_old})")
    if n_lv < 0.3 * n_new:
        problems.append(f"zu wenige Module mit Terminen ({n_lv})")
    if "</html>" not in h[-200:].lower():
        problems.append("Datei endet nicht mit </html>")
    if problems:
        print("FEHLER: " + "; ".join(problems) + ". Planer bleibt unverändert.")
        return 1
    changed = open(old_p, "rb").read() != open(new_p, "rb").read()
    print(f"changed={'true' if changed else 'false'}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
