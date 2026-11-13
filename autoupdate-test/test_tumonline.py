"""TUMonline access test without a browser and without a login (read-only, GET only).

Runs the same 7 requests as test_tumonline_console.js with plain HTTP.
Use it on your PC (python test_tumonline.py) and on GitHub Actions (workflow tum-test.yml).
Only the Python standard library is needed. Results go to the folder given by --out.
"""
import argparse, json, os, time, urllib.error, urllib.request

BASE = "https://campus.tum.de"
REST = "/tumonline/ee/rest/"
MOD = REST + "slc.cm.reg/student/modules/detail/"
GRP = REST + "slc.tm.cp/student/courseGroups/"
CP = REST + "slc.tm.cp/student/"
TREE = ("/tumonline/wbStpCs.cbSpoTree?pStStudiumNr=&pStPersonNr=&pIsStudSicht=FALSE"
        "&pShowErg=J&pHideInactive=TRUE&pCaller=&pAction=0")
UA = "Mozilla/5.0 (X11; Linux x86_64) TUM-Modulplaner-Test/1.0"

rows = []


def get(name, path, text=False, out=None):
    url = BASE + path
    req = urllib.request.Request(url, headers={"User-Agent": UA, **({} if text else {"Accept": "application/json"})})
    t0 = time.time()
    status, body = "ERR", b""
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            status, body = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read() or b""
    except Exception as e:  # network error, timeout, TLS ...
        body = str(e).encode()
    txt = body.decode("utf-8", "replace")
    data = None
    if not text:
        try:
            data = json.loads(txt)
        except ValueError:
            pass
    ok = status == 200 and (len(txt) > 200 if text else data is not None)
    rows.append({"test": name, "status": status, "ok": ok, "bytes": len(body),
                 "ms": int((time.time() - t0) * 1000), "sample": " ".join(txt[:80].split())})
    if out:
        with open(os.path.join(out, name.split()[0] + ".txt"), "w", encoding="utf-8") as f:
            f.write(f"{url}\nHTTP {status}\n\n{txt[:4000]}")
    return data if data is not None else txt


def content(j, key):
    return [r.get("content", {}).get(key) for r in (j or {}).get("resource", []) if isinstance(r, dict)
            and r.get("content", {}).get(key)] if isinstance(j, dict) else []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mid", type=int, default=3554696, help="module id (default: MW0007)")
    ap.add_argument("--spo", type=int, default=5451)
    ap.add_argument("--sj", type=int, default=1623)
    ap.add_argument("--root", type=int, default=4878472)
    ap.add_argument("--out", default="results")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    s = get("1 semesters", f"{MOD}{a.mid}/availableSemesters", out=a.out)
    terms = content(s, "selectableSemesterLibDto")
    term = next((t for t in terms if "2026" in json.dumps(t.get("optionText"))), terms[0] if terms else None)
    if term:
        tid = term["id"]
        get("2 module detail", f"{MOD}{a.mid}/{tid}", out=a.out)
        l = get("3 course groupings", f"{MOD}{a.mid}/{tid}/courseGroupings/courses", out=a.out)
        g = (content(l, "cmNodeListItemDto") or [None])[0]
        cid = None
        if g:
            c = get("4 courses", f"{MOD}{a.mid}/{tid}/courseGroupings/courses/{g['id']}", out=a.out)
            d = (content(c, "coPersonalCourseDetailsDto") or [None])[0]
            cid = d and d.get("id")
        if cid:
            get("5 dates and groups", f"{GRP}firstGroups/{cid}", out=a.out)
            get("6 registration", f"{CP}courses/{cid}/registrationProcedures", out=a.out)
        else:
            rows.append({"test": "5/6 skipped", "status": "-", "ok": False, "bytes": 0, "ms": 0, "sample": "no course id"})
    else:
        rows.append({"test": "2-6 skipped", "status": "-", "ok": False, "bytes": 0, "ms": 0, "sample": "no semester id"})
    get("7 study plan tree", f"{TREE}&pStpStpNr={a.spo}&pSJNr={a.sj}&pStpKnotenNr={a.root}&pId=kn{a.root}", text=True, out=a.out)

    print(f"{'test':22} {'status':>6} {'ok':>3} {'bytes':>8} {'ms':>6}  sample")
    for r in rows:
        print(f"{r['test']:22} {str(r['status']):>6} {'+' if r['ok'] else '-':>3} {r['bytes']:>8} {r['ms']:>6}  {r['sample'][:60]}")
    n = sum(r["ok"] for r in rows)
    print(f"\nRESULT: {n} of {len(rows)} OK")
    print("Copy this line into the chat:")
    print(" ".join(f"{r['test'].split()[0]}:{r['status']}{'+' if r['ok'] else '-'}" for r in rows))
    with open(os.path.join(a.out, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=1)


if __name__ == "__main__":
    main()
