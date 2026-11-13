# TUM Modulplaner: automatic daily update

This repository keeps the module data in `planner/TUM_Modulplaner.html` up to date without any manual step. Once a day, GitHub Actions fetches all modules, lecture dates and times, groups, exam dates, registration periods and place limits for M.Sc. Maschinenwesen (SPO 2023) from TUMonline, writes them into the planner and commits the new file here.

It is the same update as the button **⟳ Moduldaten aktualisieren** in the planner, only automated. It even uses the planner's own code for it: the job and the browser script come from the planner file (as with **Skript kopieren**), and the new file is built by the planner's own apply function (as with **Übernehmen**). So whenever you upload a newer planner, the updater is automatically the matching version.

Your own plan (marked modules, semesters, choices, statuses) is **not** in this file. It lives in your browser (localStorage) and is never touched by the update.

**Open the planner:** https://ducalemming.github.io/tum-modulplaner/ (GitHub Pages, served from `main`; every push and every nightly update redeploys it within a minute or two). This repo is public and holds only the planner and the public module data. Personal data (the synced plan, plan exports, notes) lives in the private repo `tum-modulplaner-data`.

---

## 1. How it works

```
GitHub Actions, daily 03:17 UTC (or "Run workflow")
│
│  scripts/run_update.py, all in headless Chromium:
├─ 1 job     opens the planner, takes job + browser script (updRunText, = "Skript kopieren")
├─ 2 fetch   empty page on campus.tum.de, runs the script, TUMU.start(), waits for "done"
│            (~1,200 modules, ~1,600 courses, about 24 min, GET only, no login)
├─ 3 apply   back in the planner: updApply(file, result) (= "Übernehmen")  →  new planner HTML + report
├─ 4 check   scripts/check_planner.py       module count, dates present, file complete
└─ 5 commit  only if the file changed:      planner/TUM_Modulplaner.html, reports/latest.md, reports/history.md
             the raw run (job, result JSON, report) is kept 30 days as an artifact of the run
```

Safety rules (same as the planner's own dialog):

| Situation | What happens |
|---|---|
| Run not finished or no data | Stops at step 2, planner unchanged, run marked as failed |
| More than 20 % of modules failed | Stops at step 2, planner unchanged |
| New file has far fewer modules or almost no dates | Stops at step 4, planner unchanged |
| Nothing changed | No commit |

When a run fails, GitHub sends you an e-mail (default notification setting for workflows you own).

Why no login: tested on 12.11.2026, every endpoint the updater uses (semesters, module details, course groupings, courses, dates and groups, registration procedures with place limits, study plan tree) answers without a TUMonline session, also from GitHub's servers in the USA. If TUM ever changes that, step 2 fails with HTTP 401/403 and nothing is overwritten (see section 6).

## 2. Files

| Path | What it is |
|---|---|
| `planner/TUM_Modulplaner.html` | The planner. Updated by the workflow. Download this one. |
| `planner/src/` | Sources injected into the planner by `scripts/build.py`: `api.js` (facade `PL`), `ui/*.js` (screens of the new UI), `css/*.css`, `sync.js`, `qrcode.js`. See section 10. |
| `scripts/build.py` | Injects the sources from `planner/src/` into the planner (`scripts/embed.py` is a wrapper kept for old instructions). |
| `tests/` | Playwright tests (plain scripts, each prints `ALL OK`). See section 10. |
| `scripts/run_update.py` | Opens the planner and an empty TUMonline page in headless Chromium, runs the planner's own updater (job, fetch, apply) and writes the new file and the report. |
| `scripts/check_planner.py` | Sanity check before the new file replaces the old one. |
| `.github/workflows/update.yml` | The schedule and the steps above. |
| `reports/latest.md` | Report of the last update that changed something (what changed, plan modules affected). |
| `reports/history.md` | One line per update. |
| `docs/PROJECT_GUIDE.md` | Full project guide (was `README.md` in the Drive folder): planner architecture, DATA schema, function map, localStorage keys, SPO rules, plan file format, changelog. |
| `docs/HOW_TO_UPDATE.md` | Manual data update from the planner (button **⟳ Moduldaten aktualisieren**), data formats. |
| `docs/SPO.pdf`, `docs/ASPO.pdf` | Examination regulations. |
| `index.html` | Landing page of the hosted planner, forwards to `planner/TUM_Modulplaner.html`. |
| `plan/` (git-ignored) | Optional local copy of your exported plan (`Modulplan.txt`) for the report lines and the tests. Your plan itself is never stored in this repo. |
| `agents/modul-updater/` | Updater sources: `tum_update.js` (browser part, embedded in the planner), `tum_update.py`, `parity_check.js`, `sync_updater.py`. |
| `autoupdate-test/` | TUMonline access tests from 12.11.2026 and their results. |

## 3. Daily use

Open https://ducalemming.github.io/tum-modulplaner/ on any device. The page always has the data of the last nightly update; nothing to download. What changed: `reports/latest.md`.

Your plan follows you through the device sync (section 8). Without sync it stays in the browser of that device.

## 4. Run it by hand

Tab **Actions** → **Modulplaner auto-update** → **Run workflow** → **Run workflow**. A run takes about 25 minutes (1 min setup, about 24 min TUMonline). The first run on 12.11.2026 took 24:59 and fetched 1,188 modules and 1,611 courses without a single error. Click the run to watch the log: step "Fetch TUMonline data and apply" prints the progress every 20 s.

## 5. Changing things

| What | Where |
|---|---|
| Time or frequency | `.github/workflows/update.yml`, line `cron: "17 3 * * *"` (minute hour day month weekday, in UTC). Weekly on Mondays: `"17 3 * * 1"`. |
| Pause the automatic runs | Actions → Modulplaner auto-update → **⋯** → **Disable workflow** (enable again the same way). |
| New planner version | Change the sources in `planner/src/` and run `python scripts/build.py` (section 10). Only a new engine or updater means uploading a new `TUM_Modulplaner.html` to `planner/`; the next run fills in fresh data. |
| Start semester | Comes from `plan/Modulplan.txt` ("Startsemester: WiSe 2026") or from the planner itself. |

Load on TUMonline: one run sends roughly 6,000 GET requests, 3 at a time, with pauses and retries on errors. Daily is fine; outside registration periods weekly would be enough.

## 6. When something fails

| Symptom in the log | Meaning | What to do |
|---|---|---|
| `planner/TUM_Modulplaner.html fehlt` | Planner not uploaded | Upload it (section 5) |
| Many `HTTP 401` / `HTTP 403` | TUMonline now requires a login or blocks GitHub | Run the manual update in the planner for now; long term move the run to the homelab (a logged-in browser profile at home) |
| `Failed to fetch` for everything | TUMonline down or maintenance (often at night) | Nothing, next day's run usually works; or change the time |
| `Studienplanbaum … unvollständig` | Tree could not be read | Dates and places are still applied, only new modules are missing; next run usually fine |
| `zu viele fehlgeschlagene Module` | TUMonline slow or partly down | Nothing; planner unchanged |
| `updRunText is not defined` or `updApply is not defined` | The uploaded planner is older than the updater dialog (before v57) | Upload a current planner |

The raw data of every run (job, result JSON, report) is attached to the run for 30 days: run page → **Artifacts**.

## 7. Calendar

Your registered courses come into Google Calendar through the TUMonline iCal subscription (TUMonline personal calendar → export/subscribe link → Google Calendar → Other calendars → From URL). Google refreshes it every few hours; all events share one colour. This repository does not touch your calendar. Keep the iCal link private: it gives access to your calendar without a password.

## 8. Device sync (v86)

The planner keeps your plan in the browser (localStorage). With **☁ Sync** in the header the same plan is shared between devices, the same way as in Hydro Garden, with the data in a separate private repo.

| Part | Detail |
|---|---|
| Shared copy | One file, `plan.json`, on the default branch of the private repo `DucaLemming/tum-modulplaner-data`. Saving the plan never touches this repo, so it neither redeploys the site nor collides with the nightly update. |
| Token | Fine-grained personal access token, **only the data repo**, **Contents: Read and write**. Stored only in the browser (localStorage `tum-sync`), never in `plan.json`. A token limited to the data repo cannot change the site. |
| Write | 1.5 s after the last change (PUT with the file's current sha). |
| Read | On page load, when the tab becomes visible again, every 60 s. A newer plan from another device is written to localStorage and the page reloads. |
| Conflict | The whole state with the newer `updatedAt` wins. If a write is rejected because the sha changed, it re-reads and applies the same rule once. |
| First connect | Empty device: takes the plan from GitHub. Device with its own, different plan: asks which one to keep. |
| More devices | "Weiteres Gerät verbinden" shows a QR code and a link `…#/connect/<owner%2Frepo>/<token>`. The link contains the token: open it only on your own devices. |
| What is synced | All `tum_*` keys except view state (`tum_wksem`, `tum_wkmax`, `tum_exsem`, `tum_wkf`, `tum_recnotes`). |

Code: `planner/src/sync.js` (and `planner/src/qrcode.js`, MIT, Kazuhiko Arase), embedded into the planner with `python scripts/build.py`. Test with a mocked GitHub API and simulated devices: `python tests/test_sync.py`.

## 9. What this repository never does

- No login, no stored passwords or tokens for TUMonline.
- Only GET requests. It never registers for anything, never sends a course wish (Belegwunsch) and never changes a preference.
- The update workflow does not read or change your plan in the browser, your Google Drive or your calendar. (Your plan reaches this repo only through the device sync you switch on yourself, section 8.)

## 10. Development

The planner is one HTML file. Its old part (module data `DATA`, the planner logic called "the engine", the updater) is never edited by hand: the nightly workflow rewrites the file with fresh data every day. New code lives in `planner/src/` and reaches the file only through the build:

```
git pull --rebase origin main      # always first: the workflow commits a new planner every night
python scripts/build.py            # injects uiCss, tumQr, tumSync, uiApi, uiApp before </body>
python tests/test_build.py         # and every other test file below; each prints ALL OK
```

| Where | What |
|---|---|
| `planner/src/api.js` | `window.PL`: read models (`PL.totals()`, `PL.issues()`, `PL.week(s)`, ...) and actions (`PL.setInPlan()`, `PL.setSemester()`, ...). The only file that touches engine globals; every action calls the same engine functions as the old handler. |
| `planner/src/ui/` | `h.js` (DOM helper), `boot.js` (wraps the old page in `#legacy`, creates `#ui`), `router.js` (hash routes `#/uebersicht`, `#/module`, `#/plan`, `#/woche/2`, `#/pruefungen/3`, each with optional `/m/<CODE>`), `sheet.js`, `nav.js`, one file per screen, `menu.js`, `help.js`. Screens call only `PL`. |
| `planner/src/css/` | `tokens.css` (colours, sizes), `base.css`, one file per screen. All selectors under `#ui` or `.ui-sheet-root`. |
| `tests/test_parity.py` | The text export must be identical with and without the new UI, also after the same changes done through `PL` and through the engine. |
| `tests/test_api.py` | `PL` against the old UI (oracle) and the stored `tum_*` keys. |
| `tests/test_ui_*.py` | One per screen, phone (390 px) and desktop (1440 px); `--shots DIR` saves screenshots. |

Rules: the stored plan format (`tum_*` keys) does not change; device-only settings of the new UI use keys starting with `tum-ui` (not synced). The old view stays reachable through Menü > `Alte Ansicht` until it is removed on request. Tests need Playwright with Chromium (`pip install playwright && python -m playwright install chromium`) and pass without `plan/Modulplan.txt`.

