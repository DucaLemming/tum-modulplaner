# TUM Modulplaner: project guide

> Note (13.11.2026): this guide was written when the project lived in a Drive folder. Paths like `README.md`, `Modulplan.txt`, `DOSSIER…`, `KALENDER_SYNC.md` and `agents/…/PROMPT.md` refer to that folder. Today this file is `docs/PROJECT_GUIDE.md`, the planner is hosted at https://ducalemming.github.io/tum-modulplaner/, and personal files (plan export, dossier, calendar rules, handover) are in the private repo `tum-modulplaner-data`. Sections 3 to 10 still describe the planner code correctly.

This folder holds Luca's planning toolkit for the TUM M.Sc. Maschinenwesen (120 ECTS). The main piece is `TUM_Modulplaner.html`, a single-file web app to pick modules, check them against the examination regulations (SPO), lay them out across semesters and check the weekly timetable including a student job.

This file is the single entry point for people and agents:

1. [Agents](#1-agents): ready-made tasks with the message to start them
2. [Files and folders](#2-files-and-folders)
3. [Working on the planner](#3-working-on-the-planner)
4. [App architecture](#4-app-architecture)
5. [Features](#5-features-already-working)
6. [SPO rules](#6-spo-rules)
7. [Edit recipes](#7-edit-recipes)
8. [Data pipeline: TUMonline](#8-data-pipeline-tumonline)
9. [Known limitations](#9-known-limitations)
10. [Plan file format (import/export)](#10-plan-file-format-importexport)

---

## 1. Agents

An agent is a separate Claude task that does one recurring job on this folder. To start one: open a new task in Cowork with this folder connected (and, where noted, TUMonline open in the built-in browser), pick the model below and paste the launcher message.

### 1.1 Available agents

| Agent | What it does | Needs | Model | Runtime |
|---|---|---|---|---|
| Modul-Updater | Updates the planner from TUMonline: course times for every plan semester, offer check ("eingestellt?"), new modules, modules removed from the curriculum, changed name/ECTS/turnus/language, participant limits ("🔒 begrenzt", places, registration period). Can run at any time of the year. | TUMonline login in the built-in browser | Sonnet, medium effort | about 30 to 45 minutes |

**Launcher message: Modul-Updater**

```
Read README.md in my connected folder Studienplanung (sections 1.3 and 8), then follow agents/modul-updater/PROMPT.md exactly.
```

### 1.2 Adding an agent

- Create `agents/<name>/` with a `PROMPT.md` (the full instructions) plus the agent's own tools and a `runs/` subfolder for data and backups. Tools of one agent never live in another agent's folder.
- Add a row to the table in 1.1 and a launcher message block. The launcher message stays short: it points to this README and to the prompt.
- Structure of `PROMPT.md`: goal (what changes in which file), setup (files, browser, inputs), numbered steps, checks with expected values, write-back, report, rules. Copy `agents/modul-updater/PROMPT.md` as a template.
- Prefer scripts for everything mechanical; the agent only runs them, reads short outputs and decides.
- Update section 2 when files are added or retired.

### 1.3 Rules for all agents

- Token efficiency: never read or print the planner HTML (~6 MB) or large data files; let scripts read them and print short summaries. Wait with `sleep` in bash, not with screenshots.
- Never extract login tokens or cookies. Browser scripts only use requests from the logged-in page.
- Ask before downloads (file name, source, size).
- TUMonline is read only: never register for a course, never click "Belegwunsch erfassen", "Präferenz bearbeiten" or any confirm button, never confirm participation. The browser scripts only send GET requests.
- Committing to the folder: copy the result to a new file name under `/mnt/user-data/outputs/`, commit with `expectedMtimeMs` from the staging, stage it again and compare with `cmp`. The commit tool can deliver cached old content, so the check is required.
- Back up a file before replacing it with generated content (into the agent's `runs/` folder).
- Don't change `Modulplan.txt` (the user's plan) and don't delete files unless the user asks.
- Don't trust times from nav.tum.de fetched through a summarizing web tool; such data proved wrong. Use TUMonline or times the user confirms.
- Replies: brief, comparisons as tables, no em dashes.

---

## 2. Files and folders

| File / folder | What it is |
|---|---|
| `README.md` | This file: agents, documentation, plan file format. |
| `HOW_TO_UPDATE.md` | v54/v55: how anyone updates the module data from TUMonline without AI (button **⟳ Moduldaten aktualisieren**), how it works, data formats, how to modify it. |
| `TUM_Modulplaner.html` | The planner app (~6 MB, data embedded), v21 and later with times per semester. The deliverable that gets edited. |
| `Modulplan.txt` | The user's current plan (export from the planner, re-importable). |
| `DOSSIER_Modulplanung_FEM_CFD_Aero.md` | Planning brief: goals, bachelor background, SPO rules, candidates. |
| `SPO.pdf` | TUM FPSO (examination and study regulations). Source of the rules in section 6. |
| `TUM_Maschinenwesen_Master_Module.xlsx` | Module list as a spreadsheet. Built once from the original data; not updated by the agents. |
| `agents/modul-updater/` | Modul-Updater: `PROMPT.md`, `tum_update.js` (browser part, readable; source of the copy embedded in the planner), `tum_update.min.js` (same, for pasting), `tum_update.py` (planner part for agents), `sync_updater.py` (embeds `tum_update.js` into the planner), `parity_check.js` (planner apply vs. Python apply), `runs/` (downloaded data, backups). |

**Legacy files, to be removed later** (kept for now; the Modul-Updater replaces all of them):

| Legacy | Replaced by |
|---|---|
| `HANDOVER_Modulplaner.md`, `Modulplan_Format.md` | this README (sections 3 to 10) |
| `PROMPT_TUMonline_Termine.md`, `tools/collect_tumonline.js`, `tools/tumonline_merge.py`, `tools/elements.txt`, `tools/tumonline_termine.json` | Modul-Updater (course times) |
| `PROMPT_TUMonline_Angebot.md`, `tools/check_offered.js`, `tools/check_offered.py`, `tools/module_ids.txt`, `tools/offered.json` | Modul-Updater (offer check) |
| `Studienplan_expanded.html` (19 MB curriculum export), `modulplaner_daten.json` (raw module data) | Modul-Updater reads the curriculum tree and module data directly from TUMonline |
| `TUM_Modulplaner_alt.html` | backups in `agents/modul-updater/runs/` |

When removing them, also update the file list at the end of the DOSSIER, which still names `HANDOVER_Modulplaner.md` and `Modulplan_Format.md`.

---

## 3. Working on the planner

`TUM_Modulplaner.html` is one file with CSS, HTML and JS inline plus a large embedded `const DATA={…}` JSON blob holding every module. No server, no build step, no external runtime dependency; it opens by double-click. The HTML is the source of truth: there is no separate build script.

**The file is large because the module data is embedded.** Never hand-edit the whole file or the DATA blob. Edit the JS/CSS/HTML around the data with targeted string or regex replacements in a short Python script. Data changes go through a script that parses DATA, changes it and writes it back (recipe E, or `tum_update.py`).

### 3.1 The reliable edit loop

1. Stage the current `TUM_Modulplaner.html` and copy it to a working path, e.g. `base.html`.
2. Write a Python script that reads `base.html`, applies `str.replace` / `re.sub` edits (assert each pattern matches exactly once) and writes the new file.
3. Syntax-check the JS (3.3).
4. Headless-test with Playwright (3.4): render, click, check for errors, screenshot.
5. Commit as described in 1.3.

### 3.2 Gotchas

- `re.sub` eats backslashes in the replacement string. The JS contains `\r\n`, `⤓`, template literals `${…}` and backticks. Always pass a lambda: `re.sub(pattern, lambda m: NEW, html, count=1, flags=re.S)`.
- The data can contain `};` inside strings, so a naive `.*?};` match of the DATA literal is unreliable. Parse it with `json.JSONDecoder().raw_decode(h[i:])` starting right after `const DATA=` (as `tum_update.py` does), or match `const DATA=.*?const M=DATA\.modules`.
- Insert code changes after the data has been written back, or recompute positions: an edit in the CSS before `const DATA=` shifts every index.
- Match function bodies by their boundaries, not by brace counting, e.g. `re.sub(r'function renderPlan\(\)\{.*?function mark\(', lambda m: NEW, html, 1, flags=re.S)` where `NEW` ends with `function mark(`.
- Each agent session starts from a clean sandbox. Always start from the current file in the folder, never from an older copy.
- A local file named like a Python module (e.g. `inspect.py`) in the working folder shadows the standard library and breaks Playwright. Keep scratch scripts named distinctly.

### 3.3 Syntax check

```python
import re
html = open("TUM_Modulplaner.html", encoding="utf-8").read()
js = re.search(r'<script>(.*)</script>', html, re.S).group(1)
js = re.sub(r'const DATA=.*?const M=DATA\.modules',
            lambda m: 'const DATA={modules:{},brackets:{},tree:{nodes:{},edges:[],lanes:[]},ects_values:[]};const M=DATA.modules',
            js, 1, flags=re.S)
open("_check.js", "w").write(js)
# then: node --check _check.js
```

### 3.4 Headless test (Playwright is installed in the cloud workspace)

```python
import asyncio
from playwright.async_api import async_playwright
async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1600, "height": 1000})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///abs/path/TUM_Modulplaner.html")
        await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(800)
        # import the user's plan through the UI:
        async with pg.expect_file_chooser() as fc: await pg.locator('#impPlan').click()
        await (await fc.value).set_files("/abs/path/Modulplan.txt")
        await pg.wait_for_selector('#impDlg'); await pg.locator('#impDlg button', has_text='Importieren').first.click()
        print(await pg.evaluate("Object.values(computeConflicts()).flat().map(w=>w.k+': '+w.txt).slice(0,5)"))
        print("errors:", errs or "none")
        await pg.screenshot(path="shot.png"); await b.close()
asyncio.run(run())
```

Top-level JS objects and functions (`M`, `BR`, `mark()`, `setSem()`, `renderPlan()`, `openDrawer()`, `computeConflicts()`, `exportPlan()`, …) are reachable from `pg.evaluate`. `localStorage.clear()` resets saved state between runs.

---

## 4. App architecture

### 4.1 Document layout (in order inside the file)

> Describes the old UI (before v87). Since v87 `scripts/build.py` adds the blocks `uiCss`, `uiApi` and `uiApp` before `</body>`, and at runtime the old markup is moved into `<div id="legacy">` next to the new `<div id="ui">`. See repo `README.md` section 10.

- `<style>`: all CSS. Design tokens are CSS vars in `:root` (`--ink, --muted, --line, --bg, --panel, --head, --accent, --warn`).
- `<body>`:
  - `<header>`: title, buttons (`#catBtn` Katalog, `#wkBtn` Wochenansicht, `#semBtn` Semesterplan, hidden because the planner stays open), search box (`#q`, results `#results`).
  - `<main>`: left sidebar `#plan` (plan panel) and `#garea` (graph toolbar `#gtool` and `#gwrap` with the `#svg` graph and `#viewport`).
  - `#drawer`: module detail panel (slides in from the right).
  - `#cat`: catalog panel (`#catInner` is re-rendered).
  - `#sem`: semester planner panel (705 px wide, docked permanently on the right, no shadow on its left edge), with the week view per semester.
  - `#wkDlg`: week view, created by `renderWeek()` inside `#garea` (absolute, covers graph toolbar and graph), so it sits where the graph sits, between `#plan` and `#sem`.
- `<script>`: `const DATA={…};const M=DATA.modules;` then all JS.

### 4.2 DATA schema

Top-level keys: `modules`, `brackets`, `tree`, `ects_values`, `terms`. `DATA.terms = {pub: [published semesters], need: [semesters stored in lvt], at: date of the update, start: "2026W", lim: date of the participant-limit check}` (written by the Modul-Updater; `start` is the default start semester; without `lim` the planner shows no limits).

`DATA.modules` is `M`, keyed by module code. Each `M[code]`:

| Field | Meaning | Source |
|---|---|---|
| `name` | module title | TUMonline module page |
| `ects` | credits (integer) | curriculum tree (ECTS column) |
| `brackets` | bracket ids the module may count toward | curriculum position |
| `primary` | default bracket (lane placement, default count) | first curriculum position |
| `pfad` | curriculum path, e.g. `Mastermodule > Ingenieurwissenschaftliche Grundlagen` | curriculum tree |
| `turnus` | `Wintersemester`, `Sommersemester`, `Wintersemester/Sommersemester`, `Unregelmäßig`, `Einmalig` | module page |
| `sprache` | `Deutsch`, `Englisch`, `Deutsch/Englisch` | module page |
| `dauer` | `Einsemestrig`, … | module page |
| `h` | hours `[total, presence, self-study]` as strings (`"67,5"`) | module page |
| `wh` | exam retake: `im Folgesemester`, `am Semesterende`, both | module page |
| `kuerzel` | Modulkürzel (only some modules) | module page |
| `dept`, `verantw` | responsible chair, responsible person | module page |
| `vora`, `pruef`, `lern`, `inhalt`, `lehr`, `medien`, `lit` | prerequisites, exam, learning outcomes, content, teaching methods, media, literature (free text) | module page |
| `link` | public module page `…/modules/detail/light/<moduleId>/study-year/<sj>`; the `moduleId` is the key for all TUMonline lookups | |
| `prereqs` | module codes matched from `vora` (drive graph edges and order warnings) | derived |
| `lvt` | course events per TUMonline semester, `{"2026W": [...], "2026S": [...]}`; holds the semesters the plan needs (see 4.4 "Semesters") | Modul-Updater |
| `lv` | not stored: a getter that returns the events for the semester the module is planned in (from `lvt`, see 4.4) | planner |
| `ex`, `exs` | exam dates `[{d, v, b, o: [rooms], p, a (registration), ab (deregistration), n}]`, `exs` status text | original data; not updated by the agents |
| `dep` | optional, possibly discontinued: `{miss: ["2025W", …], last: "2024W" or "", at: "YYYY-MM-DD", stp: false}`; `stp: false` = no longer in the curriculum | Modul-Updater |
| `neu` | optional, date the module was first found in the curriculum (badge "neu", cleared after 120 days) | Modul-Updater |
| `lim` | optional, participant limit per TUMonline semester (only semesters with a limited course): `{"2026W": {g: [[type, group, places, confirmed], …], p: [[procedure, registration from, to, allocation date, ranking, TUMonline status text, places of the whole procedure, deregistration until], …]}}`. `group` is empty when the course has one group; `type` can be `VO+UE` when one procedure limit covers several courses; `confirmed` is `null` when only the procedure has a limit. Dates `YYYY-MM-DD`. | Modul-Updater (phase R) |

Event entries (in `lvt` and `lv`): `t` type (VO, UE, PR, SE, VI, …), `n` name (curriculum element, plus type if needed), `sws`, `doz` (lecturers, `[L]` = lead), `o` room, `d` first date, `v`/`b` start/end time, `nt` note ("laut TUMonline 15.10.2026–04.02.2027", single dates, "noch ohne Termine"), `one: true` single appointment, `grp`/`gk`/`gdef` group alternatives (see 4.4), `vj` (only at runtime) = source semester when last year's times stand in. Entries without `d`/`v` have no time yet.

`DATA.brackets` is `BR`, keyed by bracket id: `label`, `full`, `color`, `req`, `limit` (`min`, `max`, `fixed`, `none`). `limit` is the rules engine's core switch.

`DATA.tree` = `{nodes, edges, lanes}`: `nodes[code] = {lane, ord, ects}` (lane = bracket, `ord` = order within the lane), `edges = [[prereqCode, moduleCode], …]`, `lanes` = left-to-right lane order. Layout is computed in JS (`layout()`).

### 4.3 JS function map

> Describes the engine and the old UI (before v87). The new screens use these functions only through `PL` in `planner/src/api.js`.

| Function | Role |
|---|---|
| `renderPlan()` | left plan panel: progress, per-bracket meters with rule tags, red "SPO-Regel verletzt" box, amber "Noch zu erfüllen" box, marked list, export and semester buttons. The rules engine lives here. |
| `exportPlan()` | builds `Modulplan.txt`: SPO check, credit overview, modules by bracket, semester plan, warnings, own appointments, travel times, group choice. |
| `mark(code, bracket)` / `unmark(code)` | add/remove a module; `afterChange()` re-renders what is affected. |
| `openSem/closeSem/renderSem/setSem/renderSemIfOpen` | semester planner (`sem` maps code to 1..4). |
| `renderWeek()` | week view per semester with own appointments, travel, "ohne Zeit" row, group choice, semester navigation (`.wknav`, arrow keys), work hours badge (`workHours(s)`, `WORK_GOAL`), ECTS badge, free time badge, markers for partial and out-of-lecture-period events (`evMark`), legend (`.wkleg`). |
| `computeConflicts()` | warnings per semester: order (RF), turnus (T), time clashes, travel (WG), offer (DEP). |
| `computeProposal()` | automatic semester suggestion (load balancing, order, turnus, blocks). |
| `buildTree()` / `layout()` / `edgeD()` | dependency graph. |
| `openDrawer(code)` | detail panel: all fields, mark button, "Zählt für", prerequisites, events with group selection, offer banner. |
| `openCat/renderCat/closeCat` | catalog. |
| `buildTool()`, `focusNode(code)` | graph toolbar, search-to-zoom. |
| `depTxt(c)`, `depBadge(c)` | offer text and badges ("eingestellt?", "neu"); `depBadge` starts with `limBadge(c)`, so every module row shows the limit too. |
| `limInfo(c, s)`, `limShort`, `limReg`, `limTip`, `limBadge`, `limBox`, `limPlan`, `wkLimNb`, `wkLimBadge` | participant limits (marker `/*tumlim:1*/`, see 4.4 "Participant limits"). |
| `setWkMax(v)` | week view and exam view maximised (full width) or normal. |
| `openExam(s)`, `renderExam()`, `closeExam()`, `exItems(s)`, `exWindow(t)`, `exTermOf(d)`, `isoWeek(n)` | exam view (v34, see 4.4 "Exam view"). |
| `termOf(s)`, `termLabel(t)`, `termPub(t)`, `wantTerm(c)`, `lvFor(c, t)` | semester mapping and event selection (4.4 "Semesters"). |
| `clashEventsT(c, t)` | events of a module in a given semester, used by `computeProposal()`. |
| helpers | `tint`, `bColor`, `esc`, `cssesc`, `primaryBracket`, `fmtD`, `lvStr`, `noteLines`. |

### 4.4 State and persistence (localStorage)

| Key | Variable | Content |
|---|---|---|
| `tum_plan` | `marked` | `{code: bracketId}` modules in the plan |
| `tum_sem` | `sem` | `{code: 1..4}` semester |
| `tum_opt` | `opt` | optional modules (interest only, not counted toward 120) |
| `tum_lock` | `lock` | modules locked to their semester |
| `tum_start` | `startSem` | start semester type (`W`/`S`) |
| `tum_startyear` | `startYear` | year of the first semester (default from `DATA.terms.start`) |
| `tum_free` | `frei` | low-effort modules |
| `tum_attend` | `attend` | "besuchen" flag for optional and free modules |
| `tum_nolec` | `nolec` | "nicht besuchen" flag: lectures not attended; together with "frei" no event of the module is attended (`skipAll`) |
| `tum_hidew` | `hideW` | warnings hidden in the left bar, key `semester|kind|text` (still shown, faded, in the semester planner and week view) |
| `tum_blocks` | `blocks` | own fixed appointments `[{l, wd (1=Mo..6=Sa), v, b, sems, loc, from?, to?}]`; `from`/`to` (ISO date, v50) limit the appointment to a date range, e.g. a job starting 01.12. |
| `tum_travel` | `travel` | travel times `{pairs: {"A|B": min}, other}` |
| `tum_wksem` | `wkLast` | semester last shown in the week view; the header button `#wkBtn` opens it |
| `tum_wkmax` | `wkMax` | week view and exam view maximised (`1`) or normal (`0`) |
| `tum_exsem` | `exLast` | semester last shown in the exam view (header button `#exBtn`) |
| `tum_groups` | `grpSel` | chosen groups per `"CODE|gk"` (arrays; old single strings are read) |
| `tum_evoff` | `evOff` | switched-off single courses per module (key `ekey(e)`) |
| `tum_pst` | `pst`, `cand`, `done` | v50: `{pst:{code:'u'|'z'}, cand:{code:[2,3]}, done:{code:1}}`; place status of limited modules (`u` = beworben / Restplatz, unsicher; `z` = Platz erhalten; missing = geplant, counts as sure), candidate semesters (only used while `u`), modules marked as completed. An old value `a` (abgelehnt, v49) is read as `u`. |
| `tum_workgoal` | `WORK_GOAL` | v51: weekly work hours target (default 20); `0` hides the work tile in the week view. Set in the week view under "Eigene feste Termine". |
| `tum_nogo` | `nogo` | v50: `{code: reason}` modules marked "auf keinen Fall" (reason may be empty); also for modules not in the plan |

Behaviour notes:

- Semesters: `termOf(s)` maps plan semester 1..4 to a TUMonline semester (start 2026W: 2026W, 2027S, 2027W, 2028S). `M[c].lv` is a getter: `lvFor(c)` takes the semester the module is planned in (unplanned: the first plan semester that fits its turnus) and returns `lvt[that semester]`; if it is missing (not published yet), the latest stored semester of the same kind before it, with each entry copied and marked `vj`. Results are cached in `LVC`. Week view, conflicts (all four semesters), proposal, drawer and export use this; `vj` entries show a dotted outline and "[Vorjahr: SoSe 2026]" in texts. An empty list in `lvt` means: published, no courses.

- Free modules (`frei`): count fully toward the ECTS. `clashEvents()` drops their pure lecture events (`FREE_SKIP` = VO, RE, VI) unless attended; exercises, practicals etc. stay. `effort()` weights them with `FREE_EFF` (0.3). Recommended predecessors are skipped.
- Optional modules (`opt`): not counted toward 120. `skipOpt(c)` = optional and not attended: all events faded and ignored. `effortAll()` includes optional modules ("mit optionalen"); `attend` never changes the effort.
- "Nicht besuchen" (`nolec`): for required modules (not optional, not free). Like a free module, its pure lectures (`FREE_SKIP` = VO, RE, VI; VI = lecture with integrated exercise) are faded and ignored for clashes and travel; exercises, practicals, seminars and exams still count. Effort and recommended predecessors stay unchanged. `skipLec(c)` combines both cases (free and not attended, or `nolec`). Checkbox `.nolck` in the semester planner, `#nolCk` in the drawer.
- "Frei" plus "nicht besuchen" (`skipAll(c)`): no event of the module counts (all types: lectures, exercises, labs, seminars), for clashes, travel and work time. Ticking the second box opens a notice (`noteAllSkip`, `showNotice`) asking to check the attendance rules manually; exams stay. The checkbox "nicht besuchen" is only disabled for optional modules.
- Week view blocks wrap their text; hovering a block expands it to show everything (`--h` keeps the original height as minimum).
- Week view navigation: the row `.wknav` under the title switches between semesters 1 to 4 (‹ / › and one button per semester with its term name); the arrow keys left/right do the same while no input field has focus. Switching resets `wkEdit`.
- Header button `#wkBtn` ("🗓 Wochenansicht"): opens the week view with the semester shown last (`wkLast`, saved in `tum_wksem` by `renderWeek()`), or closes it when open; class `.btn.on` while open (`wkBtnState()`, called in `renderWeek()` and `closeWeek()`).
- Week view placement: `openWeek(s)` closes the module detail (`#drawer`) and the catalog (`closeCat()`), calls `layoutPanels()` and renders `#wkDlg` inside `#garea`: it covers the graph area between the plan panel and the semester planner, scrolls on its own and has a minimum width of 660 px (narrower windows scroll sideways). × or Escape closes it (`closeWeek()`), the graph is underneath. Because semester planner and week view are visible together, `renderSem()` re-renders the week view at its end when it is open. Clicking an event opens the module detail (`openDrawer`) next to it; the week view stays open (since v33) and the drawer lies over its right part until closed.
- Week view maximised (v33): the button `#wkMax` in the title row ("⤢ Maximieren" / "⤡ Minimieren") calls `setWkMax(v)`. Maximised, `body.wk-max` makes `#wkDlg` fixed below the header over the full width (over plan panel and semester planner, z-index 46); catalog (47) and module detail (48) still open on top of it, and `layoutPanels()` then ignores the hidden semester planner, so the drawer sits at the right edge. The state is kept in `tum_wkmax`, so the week view reopens maximised. Escape first returns to the normal view, a second Escape closes the week view. The header button "🔒 … begrenzt" and `openSem()` return to the normal view too. The button sits in the title row (not at the top right) so an open module detail never covers it.
- Week view header (`.wkhead`): title, semester navigation, source line and lecture period on the left; badges on the right (`.wkbadges`, top to bottom): `.wkects`, `.wkwork`, `.wkfree`. `.wkects` shows the ECTS load exactly as in the semester header of the semester planner: counting ECTS (optional modules excluded) against the guide value ~30, effort (free modules at 30 %) and effort including optional modules; red (`.over`) with the same limits as the planner (34 for counting/effort, 36 including optional). The tooltip lists counting ECTS, number and ECTS of optional modules and the effort values.
- Week view source line: for unpublished semesters it names the semesters the times actually come from (`e.vj` of the shown events, e.g. SoSe 2026 for semester 4 = SoSe 2028), then the lecture period of the planned semester (`lectPeriod(termOf(s))`, "(TUM)" or "(geschätzt nach den Vorjahren)") and, if times come from another semester, that semester's lecture period, which the markers use.
- Lecture periods: `LECT` holds the official TUM lecture periods (Vorlesungszeit) from the circulars "Termine und Feiertage": WiSe 2022/23 17.10.2022 to 10.02.2023, SoSe 2023 17.04. to 21.07.2023, WiSe 2023/24 16.10.2023 to 09.02.2024, SoSe 2024 15.04. to 19.07.2024, WiSe 2024/25 14.10.2024 to 07.02.2025, SoSe 2025 23.04. to 25.07.2025, WiSe 2025/26 13.10.2025 to 06.02.2026, SoSe 2026 13.04. to 17.07.2026, WiSe 2026/27 12.10.2026 to 05.02.2027, SoSe 2027 12.04. to 16.07.2027. `lectPeriod(t)` returns these, otherwise the rule that reproduces all ten: WiSe starts on the first Monday on or after 12 October and ends on the Friday of the 17th week; SoSe starts on the first Monday on or after 12 April and ends on the Friday of the 14th week, and if the Easter break (until Easter Tuesday, `easterUTC`) reaches into that first week, it starts on the Wednesday after Easter (as in 2025). Add new years to `LECT` when TUM publishes them.
- Event markers in the week view: `evSpan(e)` reads the date range and single dates from `nt` ("laut TUMonline A–B", "…, 5 Einzeltermine: 22.10., …", "…, Einzeltermin"); `evMark(e,tm)` compares them with the lecture period of the semester the times come from (`e.vj`, else the shown semester). `part` (class `wkpart`, amber bar on the left, badge `.nb.np` "Einzeltermin 05.10.", "5 Termine 22.10.–26.11." or "nur 12.10.–21.12."): a single date, a range shorter than 70 % of the lecture period, or listed dates covering less than 70 % of the weeks in their range (WiSe minus two Christmas weeks). `out` (class `wkout`, purple bar, badge `.nb.no` "außerhalb Vorlesungszeit" or "teils außerhalb Vorlesungszeit"): all or some dates before the start or after the end of the lecture period. Both together give a split bar. The tooltip adds all dates and the lecture period. The legend has both samples. Events without range or date (only a first date, "noch ohne Termine") are not marked.
- Week view badges: the badge `.wkwork` at the top right shows the net work hours of the week (`workHours(s)`): own appointments at the place Arbeit, Monday to Saturday, minus the breaks required by the Arbeitszeitgesetz (`netWorkDay`: more than 6 h work needs 30 min, more than 9 h needs 45 min, no more than 6 h in a row without a break, at most 10 h per day; gaps of at least 15 min between two work blocks count as break). Green between `WORK_GOAL` (20 h) and `WORK_MAX` (20 h, Werkstudent limit), red below with the missing time (in minutes under 1 h, otherwise h:mm), amber above; the tooltip lists presence, work and break per day, and each day header shows "Arbeit h:mm (Pause …)". Below it a second badge (`.wkfree`, `freeDay`, constants `FREE_LO`/`FREE_HI` = 07:00 and 20:00, `FREE_MIN` = 30) shows the free time of the week between 07:00 and 20:00: for each shown day the part not covered by attended events, own appointments (work) or travel (trips from and to home and between locations), added up over the days. Gaps shorter than 30 min are ignored; one-off events (workshop, excursion, colloquium) and events that are not attended do not count. The tooltip lists the free time per day. Below the navigation: one line about the source of the times, a legend with small samples (`.wkleg`) and one hint line (`.wkhint`).
- Work blocks in the week view show their own work hours in the title ("Arbeit · 5:30 h") and the break below ("30 min Pause" or "ohne Pause"), from `blockWork(s)`: the day's break from `netWorkDay` goes 15 min to each block longer than 6 h first, the rest to the longest block. Overlapping work blocks count only once (`netWorkDay` merges them; the later block is marked "überlappt").
- Unattended events in the week view: everything that does not count (lecture of a free module, optional module without "besuchen", "nicht besuchen", frei plus nicht besuchen) is drawn grey, hatched and dashed with the badge "nicht besucht". Events of groups that are switched off completely (group "keine") or single courses switched off (`evOff`) are added as hints with the badge "abgewählt" (`ghost`); they never count for clashes, travel or work time.
- Hiding warnings: each warning in the semester planner and in the week view has a checkbox "ausblenden" (`wRow`, `bindWHide`). Hidden warnings disappear from the left bar, which then shows "N Warnungen ausgeblendet · alle wieder einblenden" (`#whShow`). The export still lists all warnings.
- Travel drawing around online appointments: online appointments can be attended where you are (also at work). If the commute from home or between two places would run through an online appointment, it is drawn before that appointment (home commute) or right before the next place (between places). Only the drawing changes; travel checks (`travelIssues`) are unchanged.
- Own appointments: edited in the week view (add, delete, edit in place via `wkEdit`). The row "ohne Zeit" lists modules without timed events and events without date.
- Drawing own appointments: in the week view, press the mouse on an empty spot of a day and drag up or down (`bindDraw`, pointer events, 15-min grid). A dashed preview shows start, end and duration. On release a block "Arbeit" at the place Arbeit is created for the semester shown (`blocks`), and the edit form below opens with the label selected, so you can rename it, change place or time, or delete it with ×. A click without dragging and a drag that starts on an event (opens the module) create nothing.
- Parallel predecessors: `PAR` (Set of `"pred|module"`) from the `vora` text ("parallel/gleichzeitig/zeitgleich/concurrent/simultan" within 45 characters of the predecessor). `parOK(c,p)` allows the same semester.
- Groups: `lv` entries with `grp` (group name) and `gk` (group key, usually the course type) are alternatives; only chosen groups count (`grpOK()`, `allEvents()`), several can be chosen. Default: `gdef: true`, else the first group. Hybrid groups are split into "(vor Ort)" and "(online)". Courses without groups can be switched off (`evOff`, `toggleEv(c,e)`). Drawer rows `.evsel`, week view chips `.gchip`.
- `missingSlots(c)` flags course types whose SWS exceed the captured minutes ("Vermutlich weitere Termine").
- Clashes: `semItems(s)` merges all dated events with the blocks; `itemsClash()` is the single clash rule: same weekday, overlapping times and at least one common date. Checked in every semester that has times (real or last year's).
- Date-aware checks: each event item carries `oc = evOcc(e, termOf(s))`, its dates as day numbers (`dayNum`, UTC): `{lo, hi, set}` with `set` for single dates or listed "Einzeltermine", otherwise a weekly series from `lo` to `hi` (from `evSpan`). Times from another semester (`e.vj`) are shifted into the planned semester by the whole weeks between the Mondays of both lecture starts (`monNum(lectPeriod(...).a)`), so the weekday stays. `occMeet(P, Q)` is true if the ranges overlap and, where single dates exist, one of them lies in the other range or set. `null` (dates unknown) and own appointments (blocks, no `oc`) meet everything, so work blocks clash in every week, also outside the lecture period. Cached per event object in `OCC` (WeakMap). Used by `itemsClash()` (warnings LV, red ring in the week view), `travelIssues()` and `computeProposal()` (pair scoring via `clashEventsT` items with `oc`). Exam clashes compare their dates as before.
- Travel per date: `travelIssues()` looks, for each event, at all earlier events of the day that meet it by date; every one that is the latest-ending event on at least one common date is a predecessor (ties: the earlier one). The latest-ending predecessor is the main trip; the others get `alt: true`: they count for warnings (WG) but are drawn only if their time is too short, and do not count for the day's travel time (`.wkdh small`) or free time (`freeDay`).
- Campus: `BLD` maps 4-digit building codes to a campus; `MCAMP[code] = [campus, src, note]` (src `r` room, `l` chair majority, `p` exam room). `evLoc()`, `modLoc()`, `travelMin()`, `travelIssues()` (warning WG). Blocks carry `loc` (`Arbeit`, campus, `Online`, `Fahrt`).
- Timing of courses (v38): `phaseOf(e,tm)` places the dates of an event (from `evOcc`, so last year's dates are shifted into the planned semester) relative to the lecture period of the planned semester (3 days tolerance): `vor` (before), `in` (during, semesterbegleitend), `nach` (after); a block of at most 3 weeks gets one phase by its midpoint. `labOptions(c,tm)`: every selectable group is a variant (also several courses of the same type, e.g. MW1846 "PR1" block course and "PR2" weekly course), events without a group belong to every variant; a variant spanning at most 3 weeks is one block. `labTiming(c,s)` returns the variants and the chosen ones. Shown as badge `.rtag.ttag` "⏱ vor VL-Zeit", "⏱ während VL-Zeit", "⏱ nach VL-Zeit" (several variants joined with " / ", the planned module shows only the chosen groups) for every Hochschulpraktikum and every other module with dates before or after the lecture period, as field "Zeitlage" in the module detail (all variants with dates, ✔ = chosen), and in the catalog the Hochschulpraktika are split into "Block vor der Vorlesungszeit", "Während der Vorlesungszeit (semesterbegleitend)", "Block nach der Vorlesungszeit" and "Noch ohne Termine" (a module with variants appears in each matching section; `syncCat` updates all copies of a checkbox).
- Date-aware across semesters (v38): own appointments (work blocks) now carry `oc = semSpan(termOf(s))`, i.e. they apply from the Monday of the semester's lecture start to the day before the Monday of the next lecture start, not on every date. `dateCross(out)` (end of `computeConflicts()`) checks all attended items of all four semesters by absolute date: items of different semesters that meet on a date (e.g. a block lab before the summer lectures in March vs. winter work or another winter block) give warning `LV` "Termin über die Semestergrenze (datumsgenau)", and every exam (`exItems`, real or estimated) is checked against events and work on its exact day: warning `PB` "Prüfung … überschneidet sich mit …". The exam view shows the events of the shown week from all semesters (faded, hatched, class `.exlv`) and work blocks only where they hit an exam; exams hit by them get the red ring. The automatic semester proposal still compares weekly patterns only.
- Work is shiftable (v39): `isBlkEv(e,tm)` marks block events (at most 3 weeks, or entirely before/after the lecture period). Own appointments (work, `bl`) never clash with block events (`blk`) or with exams (`PB` no longer reported against work, also not in the exam view or `dateCross`/`limFirstClashes`). `computeProposal()` (semester suggestion) now uses date-aware pair costs per module and semester (`B[c][s]`, `pairCost`, `workCost`): meeting weekly slots 30, exams at the same time 40, same day 12, exam vs event 30, first event of a limited course vs event 30, work vs weekly events 30; work vs exams and blocks costs nothing.
- Attendance (v41): the checkboxes "besuchen" and "nicht besuchen" were removed (functions `skipOpt`, `skipLec`, `skipAll`, `attend`, `nolec` are gone). Attending is the default for every module, also optional ones. In the week view every event has a small button in its upper right corner (⊘ = nicht besuchen, ✓ = wieder besuchen), for all event types (VO, UE, VI, SE, PR, WS, ...) and for single events of a group. Skipped events are shown faded and hatched and do not count for conflicts, travel, working hours and the first-event check of limited courses. Storage: `evOff[CODE]` (key `ekeyG` = type, name, weekday, times and group; `tum_evoff`); for modules marked "frei" the lectures (VO, RE, VI) are skipped by default, `evOn[CODE]` (`tum_evon`) switches single ones back on. `toggleAttend(c,key)` handles both. The old flags `tum_attend` and `tum_nolec` are converted once into single events and removed. Plan text file: section "Gruppenwahl" now has the lines `CODE aus: VO Mo 10:00-11:30 [Gruppe]` (skipped) and `CODE ein: ...` (frei lecture switched on); the old tags `[besuchen]` and `[nicht besuchen]` are no longer written and ignored on import.
- Tree (v41): sort selector removed; the catalog ("Katalog & Markieren") was removed, modules are marked in the module detail (the category is chosen with "Zählt für", preselected by the lane that was clicked). Nodes are 282 x 60 px (1.5x wider, twice as high), names wrap at word boundaries over two rows and are cut with "…" after the second row (`wrapName`, canvas text measurement).
- Descriptions in the other language (v41): TUMonline stores every description text in all languages (`translations`), the session language value is empty or "Siehe englische Beschreibungsversion" for some modules. The updater (`pickTxt`) now takes the English (then German, French, Italian) text in that case, and modules without description (job field `nd`, from `tum_update.py prep`) are reloaded with all their fields, also from older module versions. `tum_update.py apply` fills missing fields only and reports "Beschreibungen: nachgeladen ..., weiterhin ohne Beschreibung ...". `M[c].dl` = language of the description (shown in the module detail). One-off on 2026-10-08: 15 of 57 modules got a description (English); 42 remain without (language courses SZ*, Individuelles Mastermodul, Anerkannte ... and some without text in TUMonline).
- Tree filters (v40): header rows now have Ethics (`ethOnly`, only inside the lane "Überfachl. Ergänzung", `isEth`; it also switches that lane on), Participant limit (`limFilter`: ausblenden / nur begrenzte, via `limInfo`), Time slot (`phFilter`: Block vor VL / während VL / Block nach VL / ohne Termine, via `labTiming` and `phSet`, same classification as the catalog split of the Hochschulpraktika). All "alle" buttons were removed (ECTS, Angebot, Eingestellt, Bereiche); the button "Filter zurücksetzen" (`#fltClear`) resets all filters and the lane selection to the default view. `passEcts` combines ECTS, Angebot, eingestellt, Teilnehmerbegrenzung and Zeitlage.
- Modules in every category (v40): a module with several brackets (`brackets`, currently 7: MGT001410, MW0837, SOT86701, ED170020, ED170021, WI000813, SOT86608; the tree positions of the 2026-10-08 run give the same result) appears as one node per lane (`ALT`, keys `code|lane`, dashed outline) and as a row in each catalog group. Clicking a node or a catalog row opens the module with that category preselected ("Zählt für", `drawBr`); ticking a module in a catalog group marks it for that group. Edges are drawn between the main nodes only.
- Search (v40): shows all hits (no 60 limit; the list scrolls) and searches module name, number, short name, Lernergebnisse, Inhalt and the names of the courses (Lehrveranstaltungen, all terms). Terms are folded (umlauts, ß) and expanded German <-> English with a built-in glossary (`GL`, about 150 pairs of word stems, plus ics/ik and plural forms); the header of the result list shows which translations were used. Module names exist in one language only, so the glossary is what finds the other language.
- "Reihenfolge vorschlagen" (v40): button, explanatory text, preview box and the "fest" lock checkbox were removed from the semester plan. `computeProposal()` remains in the code but is not used.
- Info button (v40): header button "ℹ Kürzel" opens a dialog (`openInfo`, table `EVT`) explaining VO, UE, VI, SE, PR, WS, PT, PS, HS, KO, EX, RE, TT and what the planner does with them; PT, PS, TT are described from their examples in the data.
- Missing descriptions (v40): modules without Lernergebnisse and Inhalt show a note in the module detail. Status 2026-10-08: 57 of 1189 modules have neither (30 of them language courses SZ*, 6 "Individuelles Mastermodul"/"Anerkanntes ...", the rest regular modules such as ED150047/48, ME25666, PH2160).
- Mandatory first event (v36): for a course with limited places the first event is compulsory, otherwise the place is lost. `limFirst(c,s,it)` finds, per limited course type of a module planned in semester s, the earliest date of its attended events (`oc.lo`, last year's dates shifted as everywhere); `limFirstClashes(s,it)` checks every other attended event and every own appointment (work) for an overlap on exactly that date (`occMeet` with that single day). Results: warning `LF` "Pflichttermin: Der erste Termin von … überschneidet sich mit …" (plan panel, semester planner, export), a thick red ring and the badge "1. Termin … Pflicht · Konflikt" / "Konflikt mit Pflichttermin …" in the week view, and in the limit box of the plan panel the line "1. Termin (Anwesenheitspflicht): …" with the conflicts in red. Modules marked as not attended (optional without "besuchen", frei plus nicht besuchen) are not checked.
- Exam view (v34): header button `#exBtn` "📝 Prüfungen" (and a button in the week view title, back via "🗓 Wochenansicht") opens `#exDlg` in the same place as the week view (`openExam(s)`; week and exam view close each other). Semester buttons like the week view; below them one button per calendar week of the exam period ("KW 6 · 08.02." with the number of exams), ‹ › and the arrow keys switch weeks; the first week with an exam is shown first (`exWkSel` per semester, not saved). Exam period (assumption, `exWindow(t)`): from the Monday of the second-to-last lecture week to the day before the next semester's lectures start (`lectPeriod`), days still in the lecture period shaded, lecture end marked. Exams (`exItems(s)`): every `M[c].ex` entry with date and time of the modules planned in semester s; inside the period = TUMonline date; otherwise a date of the same season (WiSe/SoSe) from another year (`exTermOf`) is shifted by the whole weeks between the two lecture ends, keeping weekday and time = "geschätzt" (dashed, hatched, badge); otherwise listed under "Ohne Termin" with the known dates (a WiSe date of a summer module is usually its retake and is not used). Clashes (same day, overlapping time) get the red ring. Since v35 several exams on the same day are flagged as well (orange ring, day header "⚠ 2 Prüfungen am selben Tag", orange count on the week button, header badge, table status "gleicher Tag"), because the date of an exam is fixed once set but its time can still move. `computeConflicts()` uses `exItems(s)` for exams: warning `PR` for overlapping times, `PT` for the same day (also for estimated dates, marked as such); both appear in the plan panel, semester planner and export. Below the grid a table of all exams of the semester (click jumps to the week and opens the module). Maximise, Escape and drawer behave as in the week view. Exam dates (`ex`) currently exist only for the exam period WiSe 2026/27 (Jan to Apr 2027); summer semesters therefore show no dates yet.
- Offer: `dep` drives the badge "eingestellt?" (plan panel, semester planner, catalog, search), the drawer banner `.depw`, warning kind `DEP` and the export note. `neu` drives the badge "neu".
- Participant limits (v33, `lim`): `limInfo(c, s)` picks the data for the planned semester `s` (or `wantTerm(c)`): the semester `lvFor` uses (real, or last year's with `vj`), else the latest other semester with a limit (`other`, same season preferred). It returns the groups, procedures, total places (`tot`), confirmed (`occ`) and `full` (all groups full, or a group whose name starts with "Standard" is full, because extra groups are often reserved, e.g. EMJM) and `part` (some groups full). Texts from `limShort(i)`: current semester "VOLL 30/30", "Standardgruppe VOLL", "begrenzt · teils voll", "begrenzt · 36 Plätze"; last year's data "begrenzt (Vorjahr)" or "begrenzt · Vorjahr voll". `limReg(i)` compares the registration period with today: "Anmeldung ab …", "Anmeldung läuft bis …", "Anmeldung war …", plus allocation date; for last year's data "im Vorjahr: Anmeldung …".
  Where it shows: red badge `.rtag.ltag` (dark red `.full` when full now, orange `.vj` for last year's or another semester's data) in the plan list, semester planner rows, catalog rows (all via `depBadge`); "· 🔒 begrenzt" in search results; red 🔒 pill on graph nodes (`.limpill`, name shortened to 22 characters); red box `.limw` in the module detail with a table of groups (places, confirmed, "voll"), each registration procedure with period (red highlight while it runs), allocation, places, deregistration deadline, ranking and TUMonline status, a line for other semesters and the date of the check; at the top of the plan panel the red box `#limBox` (`limPlan()`): every planned module with a limit, sorted by semester, with badge and registration period, click opens the module; header button `#limBtn` "🔒 N begrenzt" (hidden when N = 0) scrolls to that box and flashes it; week view: badge `.nb.nl` "🔒 VOLL" / "🔒 begrenzt" on events whose course type is limited (`wkLimNb`), and a red header badge `.wklim` with the count and names for the semester (`wkLimBadge`); export section "=== Teilnehmerbegrenzung … ===".
- UI-only state: `view` (pan/zoom), `treeSort`, `ectsFilter`, `hiddenLanes`, `catSort`, `catEcts`, `catCollapsed`, `catQuery`, `curDrawer`.
- Hardcoded consts: `ORDER` (bracket ids), `MMG` (the four Mastermodule brackets), `LANE_REQ`, `LANE_LAB`.

---

## 5. Features (already working)

- Dependency graph: lanes per bracket, pan/zoom (mouse and touch), ECTS filter, lane toggles, sort, search-to-zoom, edge highlighting.
- Catalog: modules grouped by bracket, sort, ECTS filter, "Info" opens the drawer.
- Detail drawer: all module fields, mark/unmark, "Zählt für", prerequisites, events with click selection of groups and courses, optional/besuchen/frei checkboxes, offer banner, link to TUMonline.
- Plan panel: total /120 (and with optional modules), bracket meters, rule violations, open items, export and import.
- Semester planner: semesters 1 to 4 with real semester names (start semester and year), ECTS and effort per semester, automatic suggestion, locks, warnings (order, turnus, clashes, travel, offer), week view with own appointments and travel times. Each semester uses its own TUMonline times, or last year's while not yet published.
- Participant limits from TUMonline (v33): very visible red markers everywhere a module appears, a box at the top of the plan panel and a header button with the count of planned modules with limited places; registration period and status in the module detail.
- Week view: maximise to full width and back; opening a module from the week view keeps it open.
- Course timing (before / during / after the lecture period) with catalog split for Hochschulpraktika, and date-aware checks across semesters and against exams (v38).
- Work can be shifted for exams and block seminars; the semester suggestion is date-aware (v39).
- v41: attendance per event in the week view, catalog and tree sorting removed, bigger tree nodes with wrapped names, descriptions from the other language.
- v40: tree filters (ethics, participant limit, time slot), clear-all button, modules in every category, full bilingual search, suggestion button removed.
- Mandatory first event of limited courses checked for clashes (v36).
- Exam view (v34): exam period per semester as week pages with TUMonline or estimated exam dates.
- Text export and import (section 10).
- v42 to v47: Kürzel dialog restored, wider gaps between tree groups, München travel pairs instead of "sonstige Wechsel", equal time slots of one module merged into one week bubble, collapsible semesters (collapsed by default, warning icon in the header when a warning is not hidden), two-line module labels in the left panel, group choice kept visible for skipped courses.
- v48: group-choice modules without a chosen group get a ✓ in the week view; no "nur im Sommersemester/Wintersemester" warning when TUMonline has dates in exactly that semester.
- v54: module data update without AI: button **⟳ Moduldaten aktualisieren** (job + script to clipboard, run in the TUMonline console with a progress window, result applied in the planner, new planner file to download). See `HOW_TO_UPDATE.md`.
- v55: updater script v4 works with TUMonline in any interface language (an English session gave an empty tree and an unusable file), always uses German texts when available, and the update now refreshes all module descriptions (filled when empty, replaced when changed). Tree problems show a warning in the TUMonline window and the report instead of failing silently. New: switched-off events and group choices are carried over automatically when TUMonline renames groups or moves times, or when a module moves semester; changes are listed in a green box at the top of the plan, unmatched entries in an orange warning with **verwerfen** (HOW_TO_UPDATE.md, 7.1).
- v56: updater script v5: the TUMonline window has only **▶ Ausführen** (always a fresh run) and **⤓ Herunterladen**; Probelauf, Fehler erneut and resuming are gone. Failed requests and an incomplete study plan tree are retried once automatically; what still fails is reported in the window.
- v57: extra modules outside the programme (e.g. Fluidmechanik 2): button **＋ Zusatzmodul** (or "＋ hinzufügen" in the new tree lane "Zusatzmodule") takes a TUMonline module link or ID; the next update fetches it (script v6, job field `xid`). Extra modules appear in the semester plan, week view and conflict checks but never count for ECTS or SPO rules. Pending IDs are part of the plan export/import (section "Zusatzmodule"). Fix: the script fetched no modules on older TUMonline pages (e.g. the personal calendar), because those pages load Prototype.js, which replaces `Array.from`; the script no longer uses it.
- v58: recorded lectures: 🎥 next to each timed event (module panel, and in the week view on hover) marks it as recorded and uploaded. Recorded events get a green border in the week view, also when they are switched off (⊘), so you can skip them and still see they are available. Purely informative (no effect on conflicts or workload); saved in the browser (`tum_rec`), in "Plan als Textdatei" (`CODE aufz: …` under Gruppenwahl) and carried over by the automatic choice reconciliation.
- v59: confirming a place in a limited module: button **✓ Platz erhalten** next to each entry in the red box "Teilnehmerzahl begrenzt" (same as status "Platz erhalten"). Modules with a secured place (or completed) move to a green line "✓ Platz sicher", no longer count in the red header button, show "🔒 Platz ✓" instead of VOLL in the week view, a green lock in the tree, and no first-session clash warning.
- v60: either-or modules: in the module panel "⇄ Entweder-oder mit …" links two or more marked modules you will decide between later. Until you decide, only one counts for the ECTS (by default the one with fewer ECTS, the other is set optional automatically; "zählen" switches it); timetable, conflicts and workload still show all. Tag "⇄ oder …" in the plan list, semester plan and week view, warning "Entscheidung offen". "✓ dafür entscheiden" keeps that module and removes the others after a confirmation. Saved in `tum_either` and in the export (section "Entweder-oder").
- v60: mandatory attendance: ❗ next to each timed event (module panel, week view on hover) marks the whole series or a single event as mandatory; "📅 Termine" in the module panel lists the dates of a series to mark single dates (holidays and the Christmas break are shown dashed). Mandatory events get a red left bar and a "❗ Pflicht" badge; warnings when a mandatory event is switched off or clashes with something (on the exact dates for date-only marks). Saved in `tum_mand`, in the export (`CODE pflicht: … @ dates` under Gruppenwahl) and carried over by the choice reconciliation.
- v61: week view, list "Eigene Termine" below the grid: shows only the custom events of the active semester (and those valid in its date range); a link "N Termine aus anderen Semestern anzeigen" shows the rest greyed out.
- v62: attending online: 💻 next to each event with a fixed room (module panel, week view on hover) marks it as attended online. The event then counts as location "Online": no travel, no travel-time warnings, and it can sit inside your travel home or to another campus; time clashes with other events still count. Dashed border and a "💻 online" badge in the week view; saved in `tum_online`, in the export (`CODE online: …` under Gruppenwahl) and carried over by the choice reconciliation.
- v63: events that take place only online (per TUMonline) show the "💻 online" badge and dashed border by default (module panel: fixed "💻 online" tag).
- v63: choosing a variant: when a module offers the same course type both as a block course (only single dates, e.g. the week before lectures start) and as a weekly course (e.g. MW1846 in the summer semester), the module panel shows "⇆ Block oder semesterbegleitend" with the dates of both and the choice beides / Block / semesterbegleitend. The chosen variant is used for times, conflicts, travel and the candidate semesters; the other one appears greyed as "andere Variante". Tag in the plan list, semester plan and the limited-places box; saved in `tum_variant` and in the export (`CODE variante: PR=Block`).
- v64: recorded events (🎥) no longer cause clashes, since you can watch them any time. Exception: an event that is also marked as mandatory attendance (❗) still clashes. Location, travel and display stay unchanged.
- v65: simplified planning (replaces the separate ⊘ / 🎥 / 💻 marks, the hover buttons in the week view and the separate either-or and variant boxes):
  - Attendance: one status per event: 📍 Vor Ort, 💻 Online, 🎥 Aufzeichnung, ⊘ Nicht besuchen (module panel and click on an event in the week view). Only Vor Ort and Online count for clashes and workload; travel only for Vor Ort. Defaults: lectures of "frei" modules = Nicht besuchen, online-only events = Online. ❗ Pflicht (series or single dates) stays; a whole-series Pflicht blocks Aufzeichnung / Nicht besuchen. Stored in `tum_att` (+ `tum_recav` for "Aufzeichnung verfügbar"); old marks are converted on first load and on import (Aufzeichnung > nicht besuchen > online > vor Ort). Export keeps the lines `aus / ein / aufz / online` (+ `aufzv`).
  - Clashes: one list per semester in the week view, sorted by day; red = certain, orange = uncertain (times from last year or location guessed); quick fixes (online, Aufzeichnung, andere Gruppe, nächste Option).
  - Week view: fill colour = area, border = attendance (solid / dashed online / dotted faded Aufzeichnung), red/orange outline = clash, ❗ = Pflicht. Filters: nur Überschneidungen, Alternativen, Ausgeblendete. Click on an event opens a small window (status, Pflicht, group).
  - Planning per module ("📌 Planung" in the module panel): ranked options ① ② ③ (semester + Block/semesterbegleitend), place status (geplant / beworben / ✓ erhalten, "abgelehnt → nächste Option"), alternative modules (either-or, ① counts). Stored in `tum_opts`, export `CODE optionen: 2 Block > 3`.
  - Result check against v64 with the plan of 12.10.: ECTS, workload and all clash warnings identical. Differences: recorded events (status Aufzeichnung) no longer count as time away from home or travel (e.g. Thu in semester 1 starts at 09:30), and alternatives no longer shift the departure time.
- v66: week view buttons "⏮ Block vorher" and "Block nachher ⏭" next to the semester buttons switch the grid to the actual week before lectures start / after lectures end that contains block courses (dates shown in the day headers; only events that take place in that week; clashes checked for those dates; own fixed events of the semester whose period covers that week). Greyed out when the semester has no block course in that period. "Semesterwoche" returns to the normal week. Fix (v66b): only single dates or short periods (under 3 weeks) count as block courses, and the lecture period boundary is taken week-wise; before, weekly lectures of a future semester could show up as a "block" because its lecture period is only estimated.
- v67: own times, rooms and locations: "✎ Zeit/Raum" next to each event in the module panel (or "✎ Zeit/Raum ändern" in the week-view click window) overrides weekday (series only), start/end, room and campus when a lecture does not follow TUMonline. The event keeps its TUMonline key, so attendance, Pflicht and group stay attached; clashes, travel and the week view use the own values; the original is shown as "TUMonline: …". Saved in `tum_ovr`, export `CODE zeit: VO Do 08:15-09:45 => Mi 08:30-10:00 @ Garching # MW 1801` (attendance lines keep the TUMonline times).
- v68: attendance status "✓ Erledigt" for events that are over (module panel, week-view click window, and a quick fix "✓ … erledigt" in the clash list for past single events). Done events are hidden in the week view (filter "Ausgeblendete" shows them) and count for nothing: no clashes, no travel, no Pflicht warnings. Export `CODE erledigt: …`.
- v69: clicking the active attendance status again resets the event to its default (e.g. undo an accidental "✓ Erledigt", also when the other buttons are locked by online-only or Pflicht). Tooltip names the default.
- v70: single events can be marked as cancelled ("🚫 Ausfall" per event row in the module panel with a date list; in the week-view click window "🚫 fällt aus am …" for single events and block weeks, otherwise "einzelne Termine…"). Cancelled dates drop out of clashes, travel and Pflicht (Pflicht chip on that date is struck out); if all dates are cancelled the event is hidden like "nicht besuchen". Week view shows "🚫 nicht am …". Export `CODE ausfall: VO Mo 15:30-18:00 @ 26.10.2026`.
- v71: the normal semester week no longer shows block events whose dates all lie before lecture start or after lecture end (e.g. ED160015 block week before WiSe). They appear under "⏮ Block vorher" / "Block nachher ⏭". Blocks reaching into the lecture period still show on those days.
- v72: exams editable per module ("Prüfungstermine" in the module panel): "✎ Datum/Zeit/Ort" overrides date, time and room of a TUMonline exam, "＋ Prüfungstermin" adds an own exam, "↻ als Wiederholung markieren" flags a retake. Retakes are shown (exam view badge "↻ Wiederholung") but ignored for exam clashes, same-day warnings, exam-vs-lecture clashes and the proposal. Default: retake if the name says so or an earlier exam of the same module lies in the same exam period ("vermutet", can be switched off). Export `CODE prüfung: 22.02.2027 08:00 => 23.02.2027 10:00-11:30 # Raum (Wiederholung)`, own exams `neu => …`.
- v73: either-or groups with any number of modules: the "Alternativ-Module" box in "Planung" has "＋ weiteres Alternativ-Modul". Picking a module that is already in another group merges both groups. Only ① counts; ↑ makes another one count; "Verknüpfung lösen" removes just that module.
- v74: choice view. New button "⇄ Entscheidungen" (top bar, badge = number of open either-or groups) lists every group with its modules, ECTS and planned semester. Click a pair (or "alle vergleichen" for groups with more than two) to compare the modules side by side (semester, ECTS, bracket, turnus, lectures, exam form and dates, workload, prerequisites, learning outcomes, content). In the comparison: "Details" opens the drawer, "zählt vorerst" and "✔ dieses behalten" work like in the Planung box. Code: choice.js.
- v75: (1) Either-or: only one module per group counts, also after import or on load (the others are forced to optional), and "mit optionalen Modulen" counts only one module per group. Fixes ED170006 being counted next to MW2318. (2) Button "⚡ Kollisionen": switch the collision checks (appointments, mandatory dates, travel, first-date warnings, week view marks) off per semester; "aus, wo Termine fehlen" switches off all semesters without published dates. Exam same-day warnings and all other notes stay on. Stored in localStorage `tum_colloff` (not part of the plan text). (3) Priority: the linked-modules box has ↑ and ↓ per module (one rank at a time; rank ① counts for now). The choice view lists each group in that rank order.
- v76: semester plan numbers. ECTS per semester were already counted once per module (checked: 40 + 37 + 21 + 30 = 128 = total). Backup rows ("↪ Kandidaten", options in a later semester) now show their ECTS in brackets and greyed, as they do not count there. "mit optionalen ~N" (effort) no longer includes the module that loses an either-or decision. Semester plan is re-rendered on load so stale numbers are gone.
- v77: place-limited modules (TUMonline Teilnehmerbegrenzung) count as sure only with status "Platz erhalten" (or completed). The default status "geplant" now behaves like "unsicher" (counts only in "falls Plätze klappen"). Export prints [Platz unsicher] for them.
- v78: effort ("Aufwand") ignores modules whose events all lie wholly before or after the lecture period (block seminars). Their ECTS still count. `blkOut(c)` in choice.js; the Aufwand figure now also shows when such a module exists.
- v79: "Aufwand" in the semester plan, week view header and export counts only sure modules (no uncertain places, no optional); "mit optionalen" counts everything. `effortS(c)` in choice.js (display only, the proposal engine still uses `effort`).
- v80: new ECTS display in the semester plan (`semDecor()` in choice.js, runs after every renderSem). Top card: sure ECTS / 120, buffer, +uncertain, +optional, +optional only if seat, stacked bar with 120 line. Per semester: chips in the header, stacked bar (sure solid, seat open striped, optional dashed, optional+seat striped outline) with 30 guideline, effort gauge (green to 30, yellow to 36, red above; dark = sure, faint = with everything), and a row per category listing the modules (click opens drawer). Categories via `semCat(c)`: s, u, o, ou, x (loses decision). Week view header unchanged.
- v81: week view marks optional modules: class `wkopt2` (dashed thick border, light hatch) and a grey badge at the top of the block: "optional", "optional · Platz offen" or "⇄ Alternative" (loses an either-or decision).
- v82: week view and exam view show the module shorthand (`kuerzel` from the module handbook, otherwise the module code) as a small bold label at the top of each block (class `wkk`, no wrapping, cut with … when narrow).
- v83: the label in week and exam view is now always the module code (e.g. MW2318); the TUMonline shorthand only appears in the tooltip.
- v84: block modules whose block reaches into the first or last lecture week (span at most 21 days, starting before or ending after the lecture period, e.g. MW1846 06.04.-13.04.2027) count as blocks outside the lectures: no weekly effort, not shown in the normal semester week (`blkMod(c)`, wraps `blkOut` and `wkOutside`). Clash checks stay date-exact. Semester plan rows: seat-open modules show their fallback semesters ("sonst 3/4."), and each semester lists the fallback candidates from other semesters in a "↪ Ersatz" row (not counted).
- v85: the "ohne Zeit" row in the week view uses the same marks as the grid: module code label, grey badge "optional" / "optional · Platz offen" / "⇄ Alternative", dashed hatched style for optional modules.
- v86 (13.11.2026): device sync through GitHub (header button "☁ Sync"), see repo `README.md` section 8. First feature kept as a source file: `planner/src/sync.js`, embedded with `scripts/embed.py` as `<script id="tumSync">` before `</body>` (plus `tumQr`). It hooks `Storage.prototype.setItem/removeItem` for the `tum_*` keys, so no save function of the planner had to change. Own keys: `tum-sync` (repo, branch, path, token), `tum-sync-meta` (updatedAt, baseAt, sha, dirty).
- v87 (13.11.2026): new UI with five screens (Übersicht, Module, Plan, Woche, Prüfungen), module detail panel and menu, for phone and desktop; design in `docs/superpowers/specs/2026-11-13-ui-rework-design.md`. The engine is unchanged: the new screens talk only to the facade `PL` (`planner/src/api.js`), built in with `scripts/build.py` (replaces `embed.py`). Old view under Menü > `Alte Ansicht` (key `tum-ui-mode`). New device-only keys: `tum-ui-mode`, `tum-ui-woche`, `tum-ui-disc`, `tum-ui-sem-woche`, `tum-ui-sem-pruefungen`, `tum-ui-mgroups` (collapsed groups in Module). Einstellungen is its own screen (`#/einstellungen`) with the QR code and link to connect another device.
- v51: weekly work hours target adjustable in the week view (0 = tile off), stored in the plan file as `Arbeitsziel:`.
- v50: place status for limited modules (geplant / beworben, unsicher / Platz erhalten) with "falls Plätze klappen" ECTS in the overview, candidate semesters ("auch möglich in") shown in the semester plan, week view and export, modules can be ticked off as completed (always count as sure), "auf keinen Fall" marker for modules you heard badly about (tree, search, plan, export), own appointments with a date range, compact key-figure row in the week view, disclaimer in the header. The alternative groups and the status "abgelehnt" from v49 were removed again: after a rejection you simply apply again in a later semester (candidate chips).

---

## 6. SPO rules

Source: TUM FPSO Maschinenwesen (`SPO.pdf`), Anlage 1 (Prüfungsmodule), §37 (Modularisierung), §43 (Umfang der Masterprüfung), §45 (Studienleistungen). Total at least 120 credits; at least 74 credits in Wahlmodulen.

### 6.1 Category rules

| Bracket id | Bereich | Rule | Credits |
|---|---|---|---|
| `grund` | Wahlbereich 1, Ingenieurwiss. Grundlagen | minimum | ≥ 20 |
| `kern` | Wahlbereich 2, Kernfächer des Maschinenwesens | maximum | ≤ 40 |
| `angr` | Wahlbereich 3, Angrenzende Fachgebiete | maximum | ≤ 15 |
| `flex` | Wahlbereich 4, Ingenieurwiss. Flexibilisierung | maximum | ≤ 15 |
| (the four together) | Mastermodule gesamt | minimum | ≥ 60 |
| `hoch` | Hochschulpraktika | minimum | ≥ 8 |
| `ueber` | Überfachliche Ergänzung (Studienleistung, §45) | minimum | ≥ 5 |
| (within `ueber`) | Ethik des menschzentrierten Ingenieurwesens (hard SPO rule, v37) | minimum | ≥ 3 |
| `intl` | International Experience / Interdisziplinär | minimum | ≥ 6 |
| `forsch` | Forschungspraxis | exactly one module | = 11 |
| `thesis` | Master's Thesis | fixed | = 30 |
| | Gesamt | minimum | ≥ 120 |

Keep `BR.kern = {req: 40, limit: "max"}` if data is ever rebuilt.

Ethics rule (v37): SPO Anlage, Wahlmodule Überfachliche Ergänzung: "Mindestens 3 Credits sind aus dem Bereich Ethik des menschzentrierten Ingenieurwesens zu erbringen." A module counts if its curriculum path (`pfad`) contains "Ethik des menschzentrierten Ingenieurwesens" (`isEth(c)`, 12 modules in the tree on 08.10.2026), it counts toward `ueber` and is not optional (`ethEcts()`). Missing credits appear under "Noch zu erfüllen", the `ueber` meter shows "davon Ethik x/3" and gets its ✓ only when both rules are met, the export SPO check has the line `davon Ethik >= 3`, and these modules carry the purple badge "Ethik" in plan list, semester planner and catalog.

### 6.2 Overflow / indivisibility

Credits count per whole module and cannot be split (§43 Abs. 2 with §8 Abs. 2 APSO):

- Minimum category: exceeding it is fine (a 6-credit module in a ≥ 5 category counts fully).
- Maximum category: a module that would push the category over its cap must count elsewhere or does not count toward the degree.

### 6.3 Implementation (`renderPlan()` and `exportPlan()`)

- Credits are summed per bracket (`t[id]`) and for the Mastermodule group (`MMG`).
- Meters follow `BR[id].limit`: `min` (green at ≥ req, never a violation), `max` (violation when over), `fixed` (green at exactly req), `none`.
- Lists `bad` (red box) and `open` (amber box); `forsch` also checks for exactly one 11-credit module. The export repeats the checks as `[OK]` / `[!!]` lines.
- To change a rule, change `BR[id].req` / `.limit` in DATA (recipe E).

---

## 7. Edit recipes

All recipes: read `base.html`, apply, write a new file, syntax-check, headless-test.

- **A. Add a field to the detail drawer.** In `openDrawer`, fields use the helper `f("Label", m.field)`; add a line at the right spot. Make sure the field exists in `M`.
- **B. Default visible graph lanes.** Edit the initializer `hiddenLanes=new Set([...])`.
- **C. Wording.** Precise `html.replace(old, new)` on a unique string; assert the count.
- **D. Warning or rule behaviour.** Edit `renderPlan()` (`bad`, `open`, `meter`) and mirror it in `exportPlan()`; time and order warnings live in `computeConflicts()`.
- **E. Change data.** Parse, edit, write back:
  ```python
  import json
  h = open("base.html", encoding="utf-8").read()
  i = h.index("const DATA=") + len("const DATA=")
  D, end = json.JSONDecoder().raw_decode(h[i:])
  D["brackets"]["kern"].update(req=40, limit="max")   # example
  new = json.dumps(D, ensure_ascii=False, separators=(",", ":"))
  assert "</script" not in new.lower()
  open("new.html", "w", encoding="utf-8").write(h[:i] + new + h[i + end:])
  ```
  The compact `json.dumps` round-trips the embedded data exactly.
- **F. New panel or button.** Mirror the catalog/semester pattern: header `<button>`, container `<div>`, CSS, an open/close/render trio, re-render from `afterChange` if it shows plan state.

---

## 8. Data pipeline: TUMonline

All module data comes from TUMonline (campus.tum.de). The cloud workspace cannot reach it; the browser part of an agent runs in the logged-in TUMonline tab of the built-in browser and only reads.

**Since v54 no agent is needed:** the planner button **⟳ Moduldaten aktualisieren** copies `tum_update.js` with the job, the user runs it in the TUMonline console (a small window with Start, progress and download appears) and reads the result back into the planner, which writes a new planner file. The planner's `updJob()`/`updApply()` are a port of `tum_update.py prep/apply` and give byte-identical results. Full guide: [HOW_TO_UPDATE.md](HOW_TO_UPDATE.md). The agent route below still works.

### 8.1 Identifiers (curriculum of the user's SPO version)

| Value | Current | Meaning |
|---|---|---|
| `cv` | 5451 | curriculum version (`pStpStpNr`), SPO version [20261] Maschinenwesen |
| `root` | 4878472 | root node of the curriculum tree (node type "SPO-Version") |
| `sj` | 1623 | study year (`pSJNr`, also in the module links `study-year/1623`) |
| `moduleId` | from `M[code].link` | key for the module APIs |
| term ids | 196 = 2022S … 207 = 2026W, 209 = 2027W | not contiguous; read per module from `availableSemesters` |

`tum_update.py prep` takes `--cv`, `--root`, `--sj` (defaults above, `sj` from the links). If the SPO version changes, find the new values on the TUMonline curriculum page (Studienplan) and pass them.

### 8.2 Endpoints

| Purpose | Request | Notes |
|---|---|---|
| curriculum tree | `/tumonline/wbStpCs.cbSpoTree?pStpStpNr=<cv>&pSJNr=<sj>&pStpKnotenNr=<node>&pId=kn<node>&pAction=0&pIsStudSicht=FALSE&pShowErg=J&pHideInactive=TRUE&pStStudiumNr=&pStPersonNr=&pCaller=` | XML with the child rows of one node; module rows contain `[CODE] Name`, ECTS and the `detail/light/<moduleId>/` link. Categories are "Regelknoten", modules "Modulknoten". |
| semesters of a module | `/tumonline/ee/rest/slc.cm.reg/student/modules/detail/<moduleId>/availableSemesters` | term label to term id |
| module data | `…/detail/<moduleId>/<termId>` | name, credits, organisation, description fields (Turnus, Sprache, Moduldauer, hours, exam, retake, Voraussetzungen, Lernergebnisse, Inhalt, Lehr- und Lernmethode, Medienformen, Literatur, Name(n)) |
| course elements | `…/detail/<moduleId>/<termId>/courseGroupings/courses` | the "red triangles" of the module in that semester |
| courses of an element | `…/courseGroupings/courses/<groupingId>` | course id, type, SWS (`duration`), lecturers; empty = no course |
| groups and dates | `/tumonline/ee/rest/slc.tm.cp/student/courseGroups/firstGroups/<courseId>` (and `remainingGroups`) | groups with series and single appointments (confirmed only); per group `maxNumberOfParticipants` (missing = unlimited) and `confirmedPlaces` |
| registration procedures of a course | `/tumonline/ee/rest/slc.tm.cp/student/courses/<courseId>/registrationProcedures` | `resource[].content.cpCourseRegProcRelationsDto.registrationProcedureDto`: `id`, `name`, `registrationBegin/End`, `deregistrationEnd`, `registrationInfo` ("LV-Anmeldung möglich", "Anmeldung abgelaufen", "Registration possible from …"), `registrationInfoStatus` (RUNNING, NONE, FUTURE), `isAutomaticAllocationEnabled`, `cpCourseGroupDtos` (same limits as above). Also works for past semesters. |
| procedure details | `/tumonline/ee/rest/slc.tm.cp/student/registrationProcedures/<procedureId>` | `resource[0].content.rpRegistrationToRegProcDto`: `allocationDate`, `rankingOptions[].name` (e.g. "Studium: Master vor Bachelor", "Fachsemester", "Los"), `maxNumberOfParticipants` (whole procedure, rare), `minRequestsForPlacesPerStudent`, `maxConfirmedPlacesPerStudent`. |

Only these GET endpoints are used. The registration page itself ("Zur LV-Anmeldung", buttons "Belegwunsch erfassen", "Präferenz bearbeiten") is never clicked by an agent.

The legacy page `wbstpcs.showSpoTree` (source of the old 19 MB export) returned 404 when fetched from the SPA tab; the tree callback above works.

### 8.3 What the Modul-Updater does

Semesters (all derived from the start semester, e.g. 2026W, read from `Modulplan.txt` or `DATA.terms.start`):

| Set | Start 2026W | Use |
|---|---|---|
| `P` plan semesters | 2026W, 2027S, 2027W, 2028S | which times the planner needs |
| `F` counted semesters | 2025S to 2028S | course counts per module (offer check, published check) |
| `back` | 2024W to 2022S | only for modules without any course in `F`: last semester with courses |
| `pub` published | from the counts | a semester with at least 70 % as many modules with courses as the strongest semester of the same kind in `F` |
| `need` stored | from `P` and `pub` | each published plan semester, otherwise the latest published semester of the same kind before it |

Browser part (`TUMU` in `tum_update.js`):

1. Phase T: walks the curriculum tree from `root` (about 60 categories, 1200 module positions).
2. Phase M: for every planner module and every module found in the tree: semesters, module data (full texts only for new modules), course lists for all `F` semesters. Then `pub` and `need` are computed.
3. Phase G: groups and dates for all courses in the `need` semesters (each limited group with `mx` places and `cf` confirmed); course lists of other semesters are dropped. Three requests in parallel, state in localStorage `tumu` (resumable), job in `tumu_job`.
4. Phase R (participant limits, v33): for every course of the `need` semesters its registration procedures (`rp`: course to procedure ids) and every procedure once with its details (`pr`: name, period, deregistration, status, allocation date, ranking, places of the procedure). About 2700 GET requests, 1 to 2 minutes. `limAt` = time of the check.
5. `TUMU.download()` writes everything to one JSON file (tree, per-module records, groups per course, `rp`, `pr`, `limAt`, `pub`, `need`).
6. Limits only, without a new full run: on a finished state `TUMU.limits()` reloads groups and procedures (phases G and R, about 2 minutes; times are refreshed too), then either `TUMU.download()` or `TUMU.limitsText()`, which returns a compact JSON text (about 140 KB, `kind: "lim"`: only limited courses as ready rows, procedures by id, ranking texts by index in `rk`, all checked module ids in `ids`). `tum_update.py apply --data <that text saved as a file>` then changes only `lim` and `DATA.terms.lim`.

Planner part (`tum_update.py apply`):

- `lvt` is rebuilt for the `need` semesters with the same rules as before: weekly series per weekday, short series (< 28 days) and loose dates as single appointments (three or more on the same slot are merged into one entry with a date list), several groups or hybrid room/online selectable, group defaults (`gdef`) kept. A published semester without courses is stored as an empty list. Old `lv`/`lvS`/`lvSTerm` fields are removed.
- Offer windows from `pub`: winter-only = last two published winter semesters, summer-only = last two published summer semesters, both = last three published, irregular = last four (flagged only if all are empty). Flagged = the newest window semester has no courses and no later semester has any (a module with courses in the current semester is never flagged, so new modules and modules with a gap in older semesters stay unmarked; the missing semesters are still listed); `last` = latest semester in `F` with courses, else the result of the `back` search. A course without dates counts as offered.
- Master's Thesis and Forschungspraxis (`thesis`, `forsch`) are never marked; existing marks on them are removed.
- New modules (code in the tree, not in the planner): bracket learned from the curriculum position (the nearest category whose existing modules are at least 80 % in one bracket; this reproduces all existing brackets exactly), lane and graph node added, prerequisites from module codes in `vora`, badge "neu".
- Modules with a TUMonline link that are no longer in the tree get `dep.stp = false` ("nicht mehr im Studienplan"), but only when the tree loaded completely.
- Name, ECTS (from the tree), turnus and language are updated and reported.
- Modules with errors or incomplete course data keep their old `lvt`. `apply` refuses planners without semester support (marker `/*tumterm:1*/`, planner v21 and later) and data from an older browser part; it adds the display code for "neu" and "nicht mehr im Studienplan" if missing (marker `/*tumupd:1*/`).
- `DATA.terms` is set to the run's `pub`, `need`, date and start semester.
- Participant limits (`apply_limits`): for every checked module and `need` semester, each course with a limited group gives one row per limited group (`[type, group (only if the course has several groups), places, confirmed]`); a course without group limits whose procedure has a total gives one row per procedure (types joined with `+`). The same course under two elements counts once. Procedure rows are deduplicated. Modules without any limit lose an old `lim`. The report prints `Teilnehmerbegrenzung: geprüft … | begrenzt … Module, davon voll … | Begrenzung entfernt …` and the block `PLAN-MODULE mit Teilnehmerbegrenzung` (per semester: places per type, VOLL, registration period, allocation). A planner without the marker `/*tumlim:1*/` (before v33) gets the data but a warning that it does not show it. Data from a browser part before v33 (no `rp`) leaves existing limits unchanged.

Verified on 08.10.2026 (limits): 1594 courses, 1100 procedures, 789 limited courses in 454 modules (140 full), no errors; the full download and `TUMU.limitsText()` give identical `lim` for all modules; the plan modules match the registration pages checked by hand (MW1846 15/15 and 15/15, MW1277 Standardgruppe 20/20, MW0305 Standardgruppe 16/16, MW0142 six exercise groups of 6, MW2134 24/24, MW0285 21/21). Verified on 07.10.2026: probe modules match TUMonline; removing MW2435 from a copy and re-adding it as a new module reproduced bracket, path, ECTS, link, turnus, language, hours, retake, responsible person and chair of the original entry; a simulated run with summer 2027 published switched plan semester 2 to real times and 4 to "Vorjahr 2027S".

### 8.4 Over time

Nothing needs to be changed between runs: the windows follow the published semesters. Run it whenever new times are expected (shortly before a semester, or when TUMonline has published the next one). Check `cv`/`root`/`sj` only if the SPO version or study year changes. Update the probe table in `agents/modul-updater/PROMPT.md` after a successful run if TUMonline changed.

### 8.5 Edge cases seen

- MW1982 (2026W): a course exists but has no dates yet; counted as offered, `lv` says "noch ohne Termine". 2025W had dated events.
- Several courses of the same type in one module (language versions, block plus weekly course) are all kept as required and listed under `PRÜFEN`.
- Curriculum rows without a code or without a module link exist (thesis, a few placeholders); they are skipped.
- Limits: confirmed places can exceed the limit (MW0305 SoSe 2026: 17/16). Extra groups next to the Standardgruppe are often reserved (MW1277 "Group EMJM" 0/6) or sub-groups (MW0305 "Gruppe 1" to "Gruppe 4" 0/4), therefore a full Standardgruppe counts as full. Central lab courses ("Zentrale Hochschulpraktika") share one procedure with ranking "Master vor Bachelor, Fachsemester, Los" and no fixed allocation date. A group with 0 places exists in a few courses.

---

## 9. Known limitations

- Last year's times are only a guide: rooms and times can change, and courses that are new in the coming semester are missing until it is published.
- Exam dates (`ex`, `exs`) come from the original data (winter 2026/27) and are not refreshed or split by semester.
- Prerequisite edges are keyword-derived from `vora`; prose prerequisites are missed. The full text is always in the drawer.
- `TUM_Maschinenwesen_Master_Module.xlsx` is not updated by the agents.
- The file is large (~6 MB) because of the embedded texts.

---

## 10. Plan file format (import/export)

The planner button **Plan importieren** (left panel, below "Plan als Textdatei") reads a plain text file. Two kinds of files work:

1. **An exported plan** (`Modulplan.txt` from "Plan als Textdatei"). Export and import are a round trip: importing your own export restores modules, brackets, optional/besuchen/frei flags, semesters, locks, start semester, own appointments, travel times and group choice.
2. **A hand-written file** in the short format below: the same format, with everything except the module codes optional.

Encoding UTF-8 (a BOM is fine), Windows or Unix line endings, any file name (`.txt` and `.md` are offered in the dialog).

### 10.1 Minimal example

```
Startsemester: WiSe 2026

[Ing. Grundlagen]
  MW1628
  MW0612
[Hochschulpraktika]
  MW0847
[Forschungspraxis]
  ED100042
[Master's Thesis]
  ED100039

1. Semester (WiSe)
  MW1628 [fest]
  MW0847
2. Semester (SoSe)
  MW0612
  MW0142 [optional]
3. Semester (WiSe)
  ED100042
4. Semester (SoSe)
  ED100039
```

You can also write only the bracket blocks, only the semester blocks, or just a list of module codes.

### 10.2 Lines

| Line | Meaning | Required |
|---|---|---|
| `Startsemester: WiSe 2026` or `Startsemester: SoSe 2027` | type and year of semester 1 (also `W`, `S`, `Winter`, `Sommer`; the year is optional); else the type is derived from `1. Semester (WiSe)`; else unchanged. The export writes the year. | no |
| `[Bracket name]` at the start of a line | starts a bracket block | no |
| `1. Semester` to `4. Semester`, optionally `(WiSe)`/`(SoSe)` and `(30 ECTS)` | starts a semester block | no |
| `Nicht zugeordnet` | modules in the plan without a semester | no |
| `Arbeitsziel: 20 h/Woche` | v51: weekly work hours target; `0` hides the work tile (export writes it after the start semester) | no |
| module line, e.g. `MW1628` | one module; the code comes first (up to 6 spaces indentation), the rest is ignored except tags; `5 ECTS MW1628 Name` (export style) also works | yes |

### 10.3 Tags on a module line

| Tag | Effect | Where |
|---|---|---|
| `[optional]` | interest only, not counted toward the 120 ECTS; totals with optional modules are shown separately | any block |
| `[besuchen]` | with `[optional]`: attended, all appointments count for clashes and travel; with `[frei]`: lectures count too. Never changes the effort. | any block |
| `[frei]` | low effort: counts fully, pure lectures (VO, RE, VI) ignored for clashes, 30 % effort, predecessors not enforced (also `[free]`, `[leicht]`, `[easy]`) | any block |
| `[nicht besuchen]` | lectures (VO, RE, VI) are not attended: ignored for clashes and travel; effort and predecessors unchanged. Together with `[frei]`: no event of the module is attended. Ignored for optional modules (also `[keine Vorlesung]`, `[ohne Vorlesung]`) | any block |
| `[fest]` | locked to the semester of its block (also `[fix]`, `[lock]`, `[locked]`) | semester blocks |
| `[b:kern]` | forces the bracket (id or name; also `[bracket:...]`, `[zählt für:...]`) | any block |

Tags are case-insensitive. A module in several blocks is merged.

| `[Platz unsicher]` | v50: limited module applied for or waiting for a vacant place. Counts only under "falls Plätze klappen", not in the sure numbers (also `[unsicher]`, `[beworben]`, `[Restplatz]`; the old `[abgelehnt]` is read as unsicher) | any block |
| `[Platz erhalten]` | v50: place confirmed; counts as sure (also `[Zusage]`) | any block |
| `[auch möglich: 2, 4]` | v50: with `[Platz unsicher]`: further semesters in which you would try again (candidates) | any block |
| `[abgeschlossen]` | v50: module completed (passed); always counts as sure, also with `[Platz unsicher]` (also `[erledigt]`, `[bestanden]`) | any block |
| `[auf keinen Fall]` | v50: marks the module as "auf keinen Fall" (no reason); the reason is kept in the section `=== Auf keinen Fall ===` | any block |

### 10.4 Bracket names

Headers and `[b:...]` accept the id, the short name or the full name (case-insensitive, a unique beginning is enough).

| Id | Short name | Full name in export | Rule |
|---|---|---|---|
| `thesis` | Master's Thesis | Master‘s Thesis | exactly 30 |
| `forsch` | Forschungspraxis | Forschungspraxis | exactly 11 |
| `hoch` | Hochschulpraktika | Hochschulpraktika | min 8 |
| `intl` | International Exp. | International Experience | min 6 |
| `ueber` | Überfachl. Ergänzung | Überfachliche Ergänzung | min 5 |
| `grund` | Ing. Grundlagen | Ingenieurwissenschaftliche Grundlagen | min 20 |
| `kern` | Kernfächer | Kernfächer des Maschinenwesens | max 40 counted |
| `angr` | Angrenzende Fachgebiete | Angrenzende Fachgebiete (bis maximal 15 Credits) | max 15 counted |
| `flex` | Ing. Flexibilisierung | Ingenieurwissenschaftliche Flexibilisierung (bis maximal 15 Credits) | max 15 counted |
| `extern` | Nur im Modulhandbuch | Nur im Modulhandbuch | modules without an SPO bracket |

A module can only count toward its own brackets; an invalid request keeps the default bracket and shows a note. Without a bracket the default is used.

### 10.5 Sections (what the parser reads)

- In an export, only `=== Markierte Module ... ===`, `=== Semesterplan ... ===`, `=== Eigene Termine ===`, `=== Fahrzeiten (Minuten) ===`, `=== Gruppenwahl ===` and `=== Auf keinen Fall ... ===` are read. Other sections (SPO check, ECTS overview, warnings, participant limits, exam dates) are skipped, so exam lines never add modules.
- A hand-written file without `===` banners is read in "auto" mode: headers and module lines anywhere, the latest header above a line decides.
- Inside a semester block, lines indented by more than 6 spaces (export notes: Angebot, Vorher empfohlen, Termine) are ignored.
- Unknown codes are skipped and listed in the import preview.

### 10.6 Own fixed appointments, travel times, group choice

```
[Eigene Termine]
  Di 08:00-12:00 Werkstudent (Semester: 1,3)
  Do 14:00-18:00 Werkstudent
```

Weekday Mo to Sa, start and end, label, optional date range `ab 2026-12-01` and/or `bis 2027-02-05` (also `ab 01.12.2026`; v50, before the semester list), optional place after `@` (`@Arbeit`, `@Garching`, `@Ottobrunn`, `@München`, `@Online`; default `Arbeit`, or `Fahrt` if the label starts with "Fahrt"), optional semesters (default: all).

```
[Fahrzeiten]
  Zuhause-Garching: 60
  Zuhause-Ottobrunn: 60
  Zuhause-Arbeit: 60
  Garching-Arbeit: 60
  Ottobrunn-Arbeit: 60
  Garching-Ottobrunn: 90
  Sonstige Standortwechsel: 60
```

Pairs of places and minutes (separator `-`, `–`, `/` or `↔`). Places: Zuhause, Garching, Ottobrunn, Arbeit, München; `Campus` stands for Garching and Ottobrunn. Unlisted pairs use `Sonstige`. Each day starts and ends at home; the planner inserts travel between appointments at different places and warns ("Wegezeit") when the gap is too short. Online appointments need no travel.

```
[Gruppenwahl]
  MW0142 UE: Gruppe 5, Gruppe 6
  MW1846 PR: Online-Gruppe
  MW0850 aus: VO Do 13:00-14:00
```

Code, course type, colon, one or more group names (as in TUMonline, or `keine`). `CODE aus: …` lists switched-off courses without groups (type, weekday, time; several separated by `;`). Without this section the default group and all courses are used.

### 10.7 What happens on import

1. A preview opens: modules, counted ECTS, ECTS per semester, locks, start semester, notes.
2. Empty plan: **Importieren**. Otherwise **Aktuellen Plan ersetzen** (everything replaced, including own appointments) or **Zusammenführen** (modules from the file overwrite their entries, the rest stays; appointments are added).
3. The start semester from the file replaces the current one if present.
4. Nothing changes before you confirm; rule checks run as usual afterwards.

### 10.8 Warnings in the export

`=== Warnungen: Reihenfolge, Terminkonflikte, Turnus, Angebot ===` is output only. Lines starting with `Angebot:` mark modules that are possibly no longer offered or no longer in the curriculum; such modules stay in the plan.

`=== Teilnehmerbegrenzung (TUMonline, Stand …) ===` (v33) is output only: one `[!!]` line per planned module with a limit (semester, code, name, short status), then its groups (places, confirmed) and the registration period. `[OK]` if none; a note if the planner has no limit data yet.

### 10.9 Limited places, candidates, completed, "auf keinen Fall" (v50)

Module lines carry the tags from 10.3. Example (export style):

```
  MW0305     4 ECTS    Experimentelle Strömungsmechanik  [Platz unsicher]  [auch möglich: 2, 3, 4]
  SOT53200   3 ECTS    Verantwortung im Ingenieurberuf  [abgeschlossen]
  MW1277     4 ECTS    Simulation of Thermofluids with Open Source Tools  [Platz erhalten]
```

Hand-written list of modules to avoid (also in an export, section `=== Auf keinen Fall (markiert, …) ===`; `[im Plan]` is information only):

```
[Auf keinen Fall]
  MW0007   Aerodynamik des Flugzeugs 1  · Grund: soll sehr aufwendig sein
  MW1420
```

The export also writes, as output only (skipped on import):

| Where | Content |
|---|---|
| first lines | disclaimer "Ohne Gewähr", total with `sicher`, `falls die unsicheren Plätze klappen` and `davon abgeschlossen` |
| `=== Falls die unsicheren Plätze klappen … ===` | per area: sure ECTS → ECTS if the places work out, with the unsure modules |
| `=== Teilnehmerbegrenzung … ===` | per limited module an extra line `Platz: …` (status) and `auch möglich in: …` |
| semester blocks, `Kandidaten (…):` | per candidate module: `Kandidat CODE Name (… geplant im n. Semester)`, its dates in that semester and `Überschneidung falls Platz: …` or `keine Überschneidung falls Platz`. These lines are indented by more than 6 spaces, so they never add modules on import |
| semester headers | `(31 ECTS +11 unsicher, …)` |

Counting rules: optional modules never count. Sure = no status, `Platz erhalten` or `abgeschlossen`. `Platz unsicher` counts only in the "falls Plätze klappen" numbers. A candidate's dates in another semester use the planned group choice if that group exists there, otherwise the default group; switched-off single courses only apply in the planned semester.

### 10.10 Writing a plan with another tool or model

Ask for exactly this format (the minimal example is enough). Each module needs only its code. Codes can be looked up in the planner (code at the top of the detail panel) or in `TUM_Maschinenwesen_Master_Module.xlsx`; unknown codes are dropped on import.
