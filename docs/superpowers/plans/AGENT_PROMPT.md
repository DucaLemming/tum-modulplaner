# Prompt for the implementing agent

Copy everything below the line into a new agent session that has push access to `DucaLemming/tum-modulplaner`.

---

You are implementing the UI rework of the TUM Modulplaner, a single-file web app (German UI) for planning a master's degree. Work in the repo `DucaLemming/tum-modulplaner` on branch `main`.

## Read first, in this order

1. `README.md` (what the repo does, hosting, nightly update, device sync)
2. `docs/superpowers/specs/2026-11-13-ui-rework-design.md` (the approved design: screens, labels, colours, feature map)
3. `docs/superpowers/plans/2026-11-13-ui-rework.md` (your task list: Global Constraints, engine reference, Tasks 1 to 12)
4. `docs/PROJECT_GUIDE.md` sections 4 and 10 only when a task needs engine details

## Your job

Carry out Tasks 1 to 12 of the plan, in order, one commit per task. Do not start Task 13.

## Rules that must not be broken

- `planner/TUM_Modulplaner.html` is 7 MB and is rewritten every night by a GitHub Action with fresh module data. Never open it whole, never edit it by hand, never commit an older copy over a newer one. New code goes into `planner/src/` and reaches the HTML only through `python scripts/build.py`. Before every commit: `git pull --rebase origin main`, build, run all tests.
- Do not change the existing planner logic (the "engine") or the stored plan format. Results (ECTS, rule check, warnings, text export) must stay identical; `tests/test_parity.py` proves it.
- The repo is public. Commit nothing personal: no plan export, no access token, no names, no e-mail addresses. The folder `plan/` is git-ignored on purpose. All tests must pass without it.
- UI text is German, exactly as written in the design. Never use em dashes in UI text, comments, docs or commit messages.
- No frameworks, no libraries, no external requests. It must work when opened as a local file and at https://ducalemming.github.io/tum-modulplaner/.
- It must work on a phone (390 px wide, touch) and on a desktop (1440 px and wider). Check both for every screen.
- Never use force-push, never rewrite history, never delete branches.
- TUMonline is read-only for this project: never add code that sends anything but GET requests to campus.tum.de, never touch the updater.

## How to work

- For each task: write the test first, see it fail, implement, see every test file pass (`python tests/test_build.py`, `test_sync.py`, `test_parity.py`, `test_api.py`, `test_ui_*.py`; each prints `ALL OK`), look at screenshots at both sizes, commit, push.
- Tests use Playwright with headless Chromium (`pip install playwright && python -m playwright install chromium` if missing). `tests/test_sync.py` shows the style: plain Python scripts, a `check(cond, msg)` helper, exit code 1 on failure.
- When the plan names an engine function, read that function in the built file with a short Python slice before using it. If the plan and the code disagree, the code wins: follow the code, and write one line about the difference in your final report.
- If something is unclear or a test cannot pass without changing the engine, stop that task, leave the repo in a passing state, and report the problem. Do not guess and do not weaken a test to make it pass.
- Keep the old UI working behind the menu entry `Alte Ansicht` until told otherwise.

## Hosting (already set up, only verify)

The planner is served by GitHub Pages from `main` (root). `index.html` forwards to `planner/TUM_Modulplaner.html`. After your last push, open https://ducalemming.github.io/tum-modulplaner/ and confirm the new UI loads and that `…/#/plan` survives a reload. If the page returns 404, Pages is not enabled yet: say so in the report, do not try to enable it.

Device sync stores the plan in the private repo `DucaLemming/tum-modulplaner-data` (`plan.json`). You do not need access to it and must not ask for a token. `tests/test_sync.py` uses a mocked GitHub API.

## Final report

When Task 12 is done, report: tasks completed, test results, any deviation from the plan with the reason, anything you could not verify (for example the live page), and open questions for the owner.

## Not part of this job (do not start, list in the report only if you noticed something relevant)

- Removing the old UI from the HTML (Task 13).
- Notifications when a planned module changes in TUMonline.
- Splitting the module data out of the HTML to speed up loading on phones.
- Dark mode.
- Changing the schedule or the logic of the nightly update.
