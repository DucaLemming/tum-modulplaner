# Auto-update: access tests

Goal: find out whether the TUMonline data (modules, dates, groups, places, registration, study plan tree) can be fetched **without a login** and **from GitHub's cloud**. That decides whether the auto-update can run on GitHub or has to run on the homelab.

All tests are read-only. They send 7 GET requests each, never register, never change anything. Run each test once; there is no need to repeat them.

| Test | Where | Login | Tool | Answers the question |
|---|---|---|---|---|
| A | Browser, normal window | yes | `test_tumonline_console.js` | Does the test script itself work? (baseline) |
| B | Browser, private window | **no** | `test_tumonline_console.js` | Is the data public at all? |
| C | Your PC, command line | no | `test_tumonline.py` | Does it work without a browser (plain HTTP)? |
| D | GitHub Actions | no | `test_tumonline.py` + workflow | Does it work from GitHub's cloud servers? |
| E | TUMonline + Google Calendar | yes, once | by hand | Can the personal calendar be subscribed in Google? |

Each test prints a line like `1:200+ 2:200+ 3:200+ 4:200+ 5:200+ 6:200+ 7:200+`. Copy that line into the chat. `+` means data received, `-` means not. The number is the HTTP status (200 ok, 401/403 login needed or blocked, 404 not found, ERR no connection).

---

## Test A and B: browser console

1. **A (logged in):** open <https://campus.tum.de/tumonline/ee/ui/ca2/app/desktop/> and log in as usual.
2. Press `F12`, open **Console**. Open `test_tumonline_console.js` in a text editor, copy everything, paste into the console, press `Enter`. (If the browser blocks pasting, type `allow pasting`, `Enter`, then paste again.)
3. Wait a few seconds. A table and the result line appear. Copy the result line.
4. **B (not logged in):** open a private window (`Ctrl+Shift+N` in Chrome/Edge, `Ctrl+Shift+P` in Firefox), open the same address, **do not log in**, and repeat steps 2 and 3.

If A is not 7 of 7, stop and send me the result: then the test script needs fixing first.

## Test C: your PC without a browser

Needs Python 3 (you have it for VS Code). No extra packages.

1. Open a terminal in the folder with `test_tumonline.py` (in Explorer: right-click the folder > *Open in Terminal*).
2. Run: `python test_tumonline.py`
3. Copy the result line. Details of each answer are in the new folder `results`.

## Test D: GitHub Actions

You need a GitHub account (free). Git itself is not needed for this test; everything goes through the website.

1. Create an account on <https://github.com> if you don't have one.
2. Top right **+** > **New repository**. Name: `tum-modulplaner`. Choose **Private**. Tick *Add a README file*. **Create repository**.
3. In the new repository: **Add file > Upload files**. Drag in `test_tumonline.py`. **Commit changes**.
4. Again **Add file > Create new file**. As file name type exactly `.github/workflows/tum-test.yml` (the slashes create the folders). Paste the content of `tum-test.yml`. **Commit changes**.
5. Tab **Actions** > on the left **TUMonline access test** > button **Run workflow** > **Run workflow**.
6. After about a minute, click the run, then the job **test**, then the step **Run the test**. Copy the result line from the log. The step before it shows where the GitHub server is located (usually USA).
7. Optional: at the bottom of the run page, **Artifacts > tum-test-results** contains the raw answers.

The workflow only runs when you start it by hand. It costs nothing (private repos have 2,000 free minutes per month; this test needs about 1).

## Test E: calendar subscription (no code)

1. In TUMonline, open your personal calendar (*Kalender* on the start page).
2. Look for an export or subscription option (*Export*, *Abonnieren*, *iCal*). If there is one, copy the link it shows.
3. Open that link in a **private** window. If a file or text starting with `BEGIN:VCALENDAR` comes back, the link works without a login.
4. Google Calendar in the browser: left **Other calendars > + > From URL**, paste the link. **Add calendar**. After a while (Google refreshes subscribed calendars only every few hours), your TUMonline dates appear as a separate calendar.
5. Tell me: is there such a link, does it work in the private window, and which events does it contain (only registered courses, or also exams)?

Don't post the link itself anywhere: it is a personal key to your calendar.

---

## What the results mean

| A | B | C | D | Meaning | Next step |
|---|---|---|---|---|---|
| ok | ok | ok | ok | Public data, works from the cloud | Build the auto-update on GitHub Actions |
| ok | ok | ok | blocked | Public, but TUM blocks cloud servers | Run on the homelab (or your PC) |
| ok | ok | blocked | – | Only works in a real browser | Headless browser (Playwright) on GitHub, test again |
| ok | blocked | – | – | Login needed | Homelab with a browser profile that stays logged in |
| not ok | – | – | – | Test script wrong | Send me the result |

Partial results matter too: if for example 1 to 5 and 7 work but 6 (registration procedures) needs a login, the dates can be updated automatically and only the place information needs the manual run.
