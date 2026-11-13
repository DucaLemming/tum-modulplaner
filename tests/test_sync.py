#!/usr/bin/env python3
"""Headless test of the device sync (planner/src/sync.js) against a mocked GitHub API.

Each browser context is one device. The planner is served on a fake https origin and
api.github.com is answered by an in-memory repo, so no token and no network are needed.

Usage: python tests/test_sync.py [--shots DIR]
"""
import base64, hashlib, json, pathlib, re, sys, urllib.parse

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLANNER = (ROOT / "planner" / "TUM_Modulplaner.html").read_bytes()
_P = ROOT / "plan" / "Modulplan.txt"   # personal plan (git-ignored); without it a small generated plan is used
PLAN = _P.read_text(encoding="utf-8") if _P.exists() else None
URL = "https://planner.test/TUM_Modulplaner.html"
TOKEN = "github_pat_TEST"
SHOTS = pathlib.Path(sys.argv[sys.argv.index("--shots") + 1]) if "--shots" in sys.argv else None


class Repo:
    def __init__(self):
        self.branches, self.file, self.sha, self.log, self.conflict_once = {"main"}, None, None, [], False

    def handle(self, route):
        rq = route.request
        H = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"}
        def out(st, body=None):
            self.log.append((rq.method, urllib.parse.urlparse(rq.url).path, st))
            route.fulfill(status=st, headers=H, content_type="application/json", body=json.dumps(body or {}))
        if rq.method == "OPTIONS":
            return route.fulfill(status=204, headers=H)
        if rq.headers.get("authorization") != "Bearer " + TOKEN:
            return out(401, {"message": "Bad credentials"})
        u = urllib.parse.urlparse(rq.url)
        path, q = u.path, urllib.parse.parse_qs(u.query)
        base = "/repos/DucaLemming/tum-modulplaner-data"
        if not path.startswith(base):
            return out(404, {"message": "Not Found"})
        rest = path[len(base):]
        if rest == "":
            return out(200, {"default_branch": "main"})
        if rest == "/branches/main":
            return out(200 if "main" in self.branches else 404, {"name": "main"})
        if rest == "/git/ref/heads/main":
            return out(200, {"object": {"sha": "a" * 40}})
        if rest == "/git/refs" and rq.method == "POST":
            self.branches.add(json.loads(rq.post_data)["ref"].split("/")[-1])
            return out(201)
        if rest == "/contents/plan.json":
            if rq.method == "GET":
                if q.get("ref") != ["main"] or "main" not in self.branches or self.file is None:
                    return out(404, {"message": "Not Found"})
                return out(200, {"sha": self.sha, "content": base64.encodebytes(self.file).decode()})
            if rq.method == "PUT":
                b = json.loads(rq.post_data)
                if b.get("branch") not in self.branches:
                    return out(404, {"message": "Branch not found"})
                if self.conflict_once or (self.file is not None and b.get("sha") != self.sha):
                    self.conflict_once = False
                    return out(409, {"message": "plan.json does not match " + str(b.get("sha"))})
                self.file = base64.b64decode(b["content"])
                self.sha = hashlib.sha1(self.file).hexdigest()
                return out(200 if b.get("sha") else 201, {"content": {"sha": self.sha}})
        return out(404, {"message": "Not Found"})

    def doc(self):
        return json.loads(self.file.decode("utf-8"))


def device(browser, repo, name):
    ctx = browser.new_context(viewport={"width": 1700, "height": 1000}, locale="de-DE")
    ctx.route("https://planner.test/**", lambda r: r.fulfill(status=200, content_type="text/html; charset=utf-8", body=PLANNER))
    ctx.route("https://api.github.com/**", repo.handle)
    ctx.add_init_script("try { localStorage.setItem('tum-ui-mode', 'old'); } catch (e) {}")   # the dialog is tested through the old header button
    pg = ctx.new_page()
    pg.errs = []
    pg.on("pageerror", lambda e: pg.errs.append(f"{name}: {e}"))
    return pg


def wait_status(pg, want, ms=15000):
    pg.wait_for_function("w => window.TUMSYNC && w.includes(TUMSYNC.status())", arg=want if isinstance(want, list) else [want], timeout=ms)


def n_marked(pg):
    return pg.evaluate("Object.keys(marked).length")


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        check.failed += 1
check.failed = 0


def main():
    repo = Repo()
    with sync_playwright() as p:
        br = p.chromium.launch()

        print("1. no token: no request to GitHub, button shown")
        A = device(br, repo, "A")
        A.goto(URL); A.wait_for_timeout(1500)
        check(A.evaluate("TUMSYNC.status()") == "off" and not repo.log, "status off, 0 API calls")
        check(A.locator("#syncBtn").inner_text() == "☁ Sync", "header button present")

        print("2. device A: import the real plan, connect through the dialog, first upload")
        plan = PLAN or "Startsemester: WiSe 2026\n" + "\n".join(A.evaluate("Object.keys(M).filter(c => M[c].ects > 0).slice(0, 12)"))
        A.evaluate("t => { const R = parsePlanText(t); applyImport(R, 'replace'); }", plan)
        nA = n_marked(A)
        check(nA >= 10, f"plan imported ({nA} modules)")
        A.locator("#syncBtn").click()
        A.locator("#syTok").fill("wrong")
        A.locator("#syConn").click(); wait_status(A, "err")
        check("401" in A.locator("#syDlg .syerr").inner_text() and A.evaluate("localStorage.getItem('tum-sync')") is None, "wrong token: error shown, token not kept")
        A.locator("#syTok").fill(TOKEN)
        A.locator("#syConn").click(); wait_status(A, "ok")
        d = repo.doc()
        check(d["app"] == "tum-modulplaner", "plan.json written to the data repo")
        check(len(json.loads(d["keys"]["tum_plan"])) == nA, "plan.json holds all modules")
        check(TOKEN not in repo.file.decode() and not any(k.startswith("tum-sync") for k in d["keys"]), "token is not in plan.json")
        check(not any(k in d["keys"] for k in ("tum_wksem", "tum_wkmax", "tum_exsem", "tum_wkf")), "view-only keys are not synced")
        if SHOTS: A.screenshot(path=str(SHOTS / "1_connected.png"))

        print("3. connect link with QR code")
        A.locator("#syAdd").click()
        link = A.locator("#syL").inner_text()
        check(link == URL + "#/connect/DucaLemming%2Ftum-modulplaner-data/" + TOKEN, "link has the Hydro Garden form")
        A.locator("#syDlg .syqr svg").screenshot(path="/tmp/qr.png")
        try:
            import cv2
            img = cv2.imread("/tmp/qr.png"); img = cv2.resize(img, None, fx=3, fy=3, interpolation=cv2.INTER_NEAREST)
            txt = cv2.QRCodeDetector().detectAndDecode(img)[0]
            check(txt == link, "QR code decodes to the link")
        except ImportError:
            print("  skip QR decode (no cv2)")
        if SHOTS: A.screenshot(path=str(SHOTS / "2_link.png"))
        A.locator("#syX").click()

        print("4. device B (empty): opens the link, gets the plan")
        B = device(br, repo, "B")
        B.goto(link)
        B.wait_for_function("window.TUMSYNC && TUMSYNC.ready() && TUMSYNC.status()==='ok' && Object.keys(marked).length>0", timeout=20000)
        check(n_marked(B) == nA, f"B has the plan ({n_marked(B)} modules)")
        check("#" not in B.url and TOKEN not in B.url, "token removed from the address bar")
        check(B.evaluate("JSON.stringify(TUMSYNC.snapshot())") == json.dumps(d["keys"], ensure_ascii=False, separators=(",", ":")), "B's state equals plan.json exactly")
        if SHOTS: B.screenshot(path=str(SHOTS / "3_deviceB.png"))

        print("5. B changes the plan -> saved after 1.5 s -> A picks it up")
        code = B.evaluate("Object.keys(marked)[0]")
        puts = sum(1 for m, _, _ in repo.log if m == "PUT")
        B.evaluate("c => { unmark(c); }", code)
        B.wait_for_function("TUMSYNC.status()==='ok' && !TUMSYNC.meta().dirty", timeout=10000)
        check(sum(1 for m, _, _ in repo.log if m == "PUT") == puts + 1, "exactly one write")
        check(code not in json.loads(repo.doc()["keys"]["tum_plan"]), f"{code} removed in plan.json")
        A.evaluate("TUMSYNC.sync('test')")
        A.wait_for_function("c => window.TUMSYNC && typeof marked==='object' && !(c in marked) && TUMSYNC.status()==='ok'", arg=code, timeout=20000); A.wait_for_function("TUMSYNC.ready()")
        check(n_marked(A) == nA - 1, "A reloaded with B's change")
        check(A.locator("#syToast").count() == 1, "A shows the note 'Plan von ... geladen'")

        print("6. loading alone never writes (no ping-pong)")
        puts = sum(1 for m, _, _ in repo.log if m == "PUT")
        A.reload(); A.wait_for_function("window.TUMSYNC && TUMSYNC.ready()"); A.wait_for_timeout(3000)
        B.reload(); B.wait_for_function("window.TUMSYNC && TUMSYNC.ready()"); B.wait_for_timeout(3000)
        check(not A.evaluate("TUMSYNC.meta().dirty") and not B.evaluate("TUMSYNC.meta().dirty"), "nothing marked as changed by loading")
        check(sum(1 for m, _, _ in repo.log if m == "PUT") == puts, "two reloads, 0 writes")

        print("7. both change: the newer state wins as a whole")
        c2 = A.evaluate("Object.keys(marked)[1]"); c3 = A.evaluate("Object.keys(marked)[2]")
        A.evaluate("c => unmark(c)", c2)                                   # A first
        A.wait_for_function("TUMSYNC.status()==='ok' && !TUMSYNC.meta().dirty", timeout=10000)
        repo.conflict_once = True                                          # simulate a write racing with another device
        B.evaluate("c => unmark(c)", c3)                                   # B later -> 409 -> re-read -> B newer -> write
        B.wait_for_function("TUMSYNC.status()==='ok' && !TUMSYNC.meta().dirty", timeout=10000)
        rp = json.loads(repo.doc()["keys"]["tum_plan"])
        check(any(st == 409 for _, _, st in repo.log), "rejected write (409) was retried after re-reading")
        check(c3 not in rp and c2 in rp, "plan.json = B's state (newer), A's older change dropped")
        A.evaluate("TUMSYNC.sync('test')")
        A.wait_for_function("c => window.TUMSYNC && typeof marked==='object' && !(c in marked) && TUMSYNC.status()==='ok'", arg=c3, timeout=20000); A.wait_for_function("TUMSYNC.ready()")
        check(A.evaluate("JSON.stringify(TUMSYNC.snapshot())") == B.evaluate("JSON.stringify(TUMSYNC.snapshot())"), "A and B identical again")

        print("8. device C already has a different plan: asks which one to keep")
        C = device(br, repo, "C")
        C.goto(URL); C.wait_for_timeout(1200)
        C.evaluate("() => { mark(Object.keys(M)[5], M[Object.keys(M)[5]].primary); }")
        C.locator("#syncBtn").click(); C.locator("#syTok").fill(TOKEN); C.locator("#syConn").click()
        wait_status(C, "choose")
        puts = sum(1 for m, _, _ in repo.log if m == "PUT")
        check(C.locator("#syUseR").count() == 1 and C.locator("#syUseL").count() == 1, "choice dialog shown, nothing overwritten yet")
        if SHOTS: C.screenshot(path=str(SHOTS / "4_choice.png"))
        C.locator("#syUseR").click()
        C.wait_for_function("window.TUMSYNC && TUMSYNC.ready() && TUMSYNC.status()==='ok' && Object.keys(marked).length>5", timeout=20000)
        check(n_marked(C) == n_marked(B) and sum(1 for m, _, _ in repo.log if m == "PUT") == puts, "C took the GitHub plan, no write")

        print("9. disconnect")
        C.locator("#syncBtn").click(); C.locator("#syOff").click()
        check(C.evaluate("localStorage.getItem('tum-sync')") is None and C.evaluate("TUMSYNC.status()") == "off", "token removed from the device")

        errs = [e for pg in (A, B, C) for e in pg.errs]
        check(not errs, "no page errors" + (": " + "; ".join(errs[:3]) if errs else ""))
        br.close()
    print("FAILED" if check.failed else "ALL OK")
    return 1 if check.failed else 0


if __name__ == "__main__":
    sys.exit(main())
