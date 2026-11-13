#!/usr/bin/env python3
"""Kept for old instructions: same as python scripts/build.py [path]."""
import pathlib, sys; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); import build
if __name__ == "__main__": build.main(sys.argv[1] if len(sys.argv) > 1 else None)
