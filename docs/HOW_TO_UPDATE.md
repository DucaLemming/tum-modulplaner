# How to update the module data (TUMonline)

The planner (`TUM_Modulplaner.html`) carries all module data inside the file. This guide explains how anyone can refresh that data from TUMonline **without an AI and without installing anything**, how the update works internally, the exact data formats that are handed over, and how to change the updater later.

> No warranty: TUMonline data can be incomplete or change at any time, and the updater interprets it automatically. Always check important details (dates, places, regulations) in TUMonline and the SPO yourself.

Contents

1. [Quick start (for users)](#1-quick-start-for-users)
2. [What happens, step by step](#2-what-happens-step-by-step)
3. [Requirements, limits and safety](#3-requirements-limits-and-safety)
4. [Troubleshooting](#4-troubleshooting)
5. [Files and where the code lives](#5-files-and-where-the-code-lives)
6. [Data handover formats](#6-data-handover-formats)
7. [How the result is applied (rules)](#7-how-the-result-is-applied-rules)
8. [Modifying the updater](#8-modifying-the-updater)

---

## 1. Quick start (for users)

You need: the planner HTML file, a desktop browser (Chrome, Edge or Firefox), and a TUM login.

1. **Planner:** open `TUM_Modulplaner.html`, left panel, button **⟳ Moduldaten aktualisieren**. A dialog with three steps opens.
2. **Step 1, "Skript kopieren":** click **Skript kopieren**. The update script plus your personal job (which modules, which semesters) is now in the clipboard. If copying fails, use **Als Datei speichern**, open the saved `tum_update_mit_auftrag.js` in a text editor, select all, copy.
3. **Step 2, TUMonline:**
   1. Open [campus.tum.de](https://campus.tum.de/tumonline/ee/ui/ca2/app/desktop/) in a new tab and log in.
   2. Press `F12` (or `Ctrl+Shift+J`) and open the **Console** tab.
   3. Paste (`Ctrl+V`) and press `Enter`. If the browser refuses to paste, type the phrase it asks for (Chrome, Edge: `allow pasting`; Firefox shows its own phrase), press `Enter`, then paste again.
   4. A window **TUM Modul-Updater** appears at the bottom right with two buttons.
   5. Click **▶ Ausführen**. Keep the tab open until the window says **Fertig** (about 10 minutes, roughly 1,200 modules and 1,600 courses). Failed requests are retried automatically at the end of the run.
   6. Click **⤓ Herunterladen**. This saves `tum_update_YYYY-MM-DD.json` to your downloads.
4. **Step 3, back in the planner ("Ergebnis einlesen"):** choose the downloaded JSON as **Update-Datei** and the planner HTML file you have open as **Planer-Datei**, click **Übernehmen**. A report appears.
5. Click **⤓ Neue Planer-Datei herunterladen**, replace your old planner file with it (same name, same folder) and open it again.

Your own plan is stored in the browser, not in the HTML file, so it stays. To be safe, export it first with **Plan als Textdatei**.

Every run starts from scratch; nothing is resumed. If the tab was reloaded or closed during the run, paste the script again and click **▶ Ausführen**. Pasting again in the same tab stops a run that is still going.

---

## 2. What happens, step by step

```
Planner (your file)                     TUMonline tab (campus.tum.de, your login)            Planner
┌──────────────────────────┐   job +    ┌──────────────────────────────────────┐   JSON    ┌──────────────────────────────┐
│ updJob(DATA, start)      │──script──▶│ tum_update.js (window.TUMU)           │──file───▶│ updApply(plannerHTML, JSON)  │
│ = which modules/semesters│ clipboard  │ T tree → M modules → G dates/groups   │ download  │ → new planner HTML (download)│
└──────────────────────────┘            │ → R registration procedures → done    │           └──────────────────────────────┘
                                        └──────────────────────────────────────┘
```

1. **Job (planner).** `updJob()` reads the module data embedded in the planner (`const DATA=...`) and your start semester. It lists all known module IDs (taken from the TUMonline links of the modules), their turnus, the four planning semesters, the semesters to count, and modules that still lack a description.
2. **Run (TUMonline tab).** The pasted text starts with `window.TUMU_JOB = {...};` followed by the script. The script runs inside the TUMonline page so it can use your session. It works in phases; the state is kept only in the memory of the tab (since v5 nothing is stored in `localStorage`):
   - **T (tree):** reads the study plan tree (categories and module positions) of the SPO version, page by page. New modules are found here.
   - **M (modules):** for each module: available semesters, courses per semester, details (name, credits, turnus, language; the full description for every module; text is taken in German first, then English, then other languages, and modules without learning outcomes or content fall back to older versions).
   - Then it decides which semesters are **published** (at least 70 % as many modules with courses as the strongest semester of the same kind) and which are **needed** (each planning semester if published, otherwise the latest published semester of the same kind before it, i.e. last year's times).
   - **G (groups):** for each course in a needed semester: groups, series and single dates, places (`maxNumberOfParticipants`, `confirmedPlaces`).
   - **R (registration):** for each of these courses: registration procedures (period, status) and their details (allocation date, ranking, total places).
   - **Automatic retry:** if the tree is incomplete, it is loaded once more right away. After phase R, everything that failed (modules, dates, procedures) is fetched once more (M, G, R again, only the failed parts).
   - **done:** the result can be downloaded.
3. **Apply (planner).** `updApply()` takes the text of your planner file and the JSON, rebuilds the dates per semester, flags modules that might be discontinued, adds new modules, fills missing and updates changed descriptions, updates names, credits, turnus, language and participant limits, and writes a new planner file with the new `DATA`. Nothing else in the file changes. The rules are in section 7.

The apply step in the planner is a line-by-line port of `agents/modul-updater/tum_update.py apply` (the Python version the agent uses). Both produce byte-identical files from the same input; see section 8.4.

---

## 3. Requirements, limits and safety

| Topic | Details |
|---|---|
| Login | A normal TUM student login. The script only works on `campus.tum.de` and uses the session of that tab. |
| Read-only | The script only sends **GET** requests: module detail pages, dates and groups, registration procedures (view only) and the study plan tree. It never registers, never submits a course wish, never changes a preference. |
| Load on TUMonline | 3 parallel requests at a time, with retries and pauses on errors. Do not run it more often than needed (e.g. at the start of a semester and when registrations open). |
| Duration | Depends on TUMonline and your connection; the run covers roughly 1,200 modules and 1,600 courses. A run cannot be paused; reloading the tab cancels it. |
| Browser | Chrome, Edge, Firefox (desktop). The planner needs to read two local files in step 3; this works in all three. |
| Study programme | Configured for M.Sc. Maschinenwesen, SPO 2023 (study plan version 5451, root node 4878472). Other programmes need a different configuration (section 8.2). |
| Language | The TUMonline interface language does not matter (since script v4): German texts are used when TUMonline has them, and the tree is recognised in German and English. |
| Empty runs | If the run returns no data (not logged in, wrong page), the window shows **ACHTUNG: keine Daten erhalten** and the planner refuses to apply the file. Nothing is overwritten. |
| Incomplete tree | If the study plan tree cannot be read, the window shows a **Hinweis** and the report a **HINWEIS**. Dates, places and descriptions are still applied; only new modules and "no longer in the study plan" are skipped. The tree is retried once automatically; if it still fails, run again later. |
| Errors | Failed requests are retried once automatically at the end. What still fails is counted in the window; those modules stay unchanged in the planner. |

---

## 4. Troubleshooting

| Problem | Cause and fix |
|---|---|
| Pasting into the console does nothing / a warning about pasting | Browser protection against scams. Type the phrase the console asks for (Chrome, Edge: `allow pasting`), press Enter, paste again. Only paste code you got from your own planner. |
| Window says "Fertig" almost immediately with 0 modules (script v5 only) | The page was an older TUMonline page (e.g. the personal calendar) whose Prototype.js library broke the script. Fixed in v6; copy the script again from a planner v57 or later. |
| Alert "Bitte in einem eingeloggten TUMonline-Tab auf campus.tum.de ausführen" | The script was pasted on another page. Open campus.tum.de, log in, paste there. |
| Window shows "ACHTUNG: keine Daten erhalten" | Session expired or not logged in. Reload campus.tum.de, log in, paste again, **▶ Ausführen**. |
| Window says "Abrufe auch nach automatischer Wiederholung fehlgeschlagen" | Usually the session expired during the run. You can download and apply anyway (affected modules stay unchanged), or log in again, paste again and **▶ Ausführen**. |
| "Skript kopieren" says copying is not possible | Use **Als Datei speichern**, open the file in a text editor, copy everything. |
| Planner: "Die Update-Datei ist kein gültiges JSON" | Wrong file chosen as Update-Datei (it must be `tum_update_YYYY-MM-DD.json`). |
| Planner: "Das ist keine Planer-Datei" / "zu alt" | Wrong file chosen as Planer-Datei, or a planner before v21. Choose your current `TUM_Modulplaner.html`. |
| Planner: "passt nicht zu dieser Version" | The JSON comes from a different script version. Copy the script again from this planner and rerun. |
| Planner: "Die Update-Datei enthält keine Daten" | The run was empty or stopped very early. Repeat the run. |
| After replacing the file the plan is empty | The plan is stored in the browser; depending on browser and file location it may not be visible to the new file. Import your saved **Plan als Textdatei**. |
| Window shows "Studienplanbaum auch nach Wiederholung unvollständig" | The tree pages could not be read twice. Run again later. If it stays empty, the page format changed (section 8.1). |
| Report says "Lauf nicht fertig" | The JSON was downloaded before **Fertig**. Only finished modules were applied; you can finish the run and apply again. |

---

## 5. Files and where the code lives

| File | Role |
|---|---|
| `TUM_Modulplaner.html` | The planner. Contains, near the end: (a) `<script type="text/plain" id="tumuScript">`, an **unexecuted copy** of `tum_update.js` that "Skript kopieren" reads; (b) a `<script>` block with `UPD_CFG`, `updJob()`, `updApply()` and helpers (port of `tum_update.py`), followed by the dialog code `openUpdate()`. The button **⟳ Moduldaten aktualisieren** is created in `renderPlan()`. |
| `agents/modul-updater/tum_update.js` | **Source** of the browser script (the separate file). Edit this one, then sync it into the planner (section 8.1). |
| `agents/modul-updater/tum_update.py` | Python version of job and apply, usable from the command line. Must stay equivalent to `updJob`/`updApply`. |
| `agents/modul-updater/sync_updater.py` | Copies `tum_update.js` into the planner block `tumuScript`; `--check` only compares. |
| `agents/modul-updater/parity_check.js` | Checks that the planner's `updApply` and `tum_update.py apply` give identical results. |
| `agents/modul-updater/runs/` | Optional: keep a planner backup and a downloaded JSON here as test input (section 8.4). |
| `HOW_TO_UPDATE.md` | This guide. |

---

## 6. Data handover formats

### 6.1 Job (planner → script)

Created by `updJob(DATA, start)` (Python: `tum_update.py prep`). Handed over as the first line of the copied text: `window.TUMU_JOB = {...};`. The script keeps it in memory.

| Field | Type | Meaning |
|---|---|---|
| `v` | number | Job format version, currently `2`. |
| `cv` | number | Study plan version (`pStpStpNr`), `5451` for M.Sc. Maschinenwesen SPO 2023. |
| `sj` | number | Study year (`pSJNr`) for links and the tree; most common value in the module links, default `1623`. |
| `root` | number | Root node of the study plan tree (SPO version), `4878472`. |
| `start` | string | Start semester, e.g. `2026W` (year + `W`/`S`). From the planner's "Erstes Semester". |
| `P` | string[4] | The four planning semesters from `start`, e.g. `["2026W","2027S","2027W","2028S"]`. |
| `F` | string[7] | Semesters that are counted: 3 before `start` up to the last planning semester. |
| `back` | string[6] | Older semesters (4 to 9 before `start`), only to find the last semester with courses (`old`). |
| `ids` | string | All known module IDs, ascending, delta-encoded in base 36, comma-separated (`decode`: running sum of `parseInt(x,36)`). |
| `nd` | string | Module IDs without description (no learning outcomes and no content), same encoding. For these the full description is fetched. |
| `tu` | string | One letter per entry of `ids` (same order): `W` winter, `S` summer, `B` both, `U` unknown (from the module's turnus). |
| `xid` | string | Optional (v57): TUMonline IDs of extra modules outside the programme that are not in the planner yet (button **＋ Zusatzmodul**), same encoding as `ids`. The script fetches them like new modules (full description). |
| `chk` | object | `{code: moduleId}` check modules for `TUMU.check()` (console only, for development; from `UPD_CFG.check`). |

The script adds `tuOf` (`{moduleId: letter}`) internally; it is removed again in the download.

### 6.2 Result of a full run (script → planner): `tum_update_YYYY-MM-DD.json`

Written by `TUMU.download()`.

| Field | Type | Meaning |
|---|---|---|
| `v` | number | Result format, `2`. |
| `sv`, `lang` | number, string | Script version (`4`) and text language rule (`de-en`: German, else English). |
| `job` | object | The job (without `ids`, `tu`, `tuOf`, `chk`). `updApply` requires `job.v === 2`. |
| `started`, `finished` | ISO date-time | Start and end of the run. `finished` (or `started`) sets the "as of" date. |
| `phase` | string | `T`, `M`, `G`, `R` or `done`. Anything but `done` gives a warning; only fetched modules are applied. |
| `treeErr` | number | Number of failed tree pages. If > 0 (or < 90 % of the known modules found in the tree), no module is marked "no longer in the study plan". |
| `pub` | string[] | Published semesters (see section 2). |
| `need` | string[] | Semesters whose dates were fetched. |
| `nTerm` | object | Count of modules with courses per semester in `F`. |
| `tree` | object | `{nodeId: [parentId, kind, code, name, moduleId, ects]}`; `kind` `M` module position, `C` category. |
| `m` | object | `{moduleId: record}` or `"err"`; record see 6.3. |
| `c` | object | `{courseId: [group]}`; group see 6.4. |
| `rp` | object | `{courseId: [procedureId]}` registration procedures per course. |
| `pr` | object | `{procedureId: procedure}`; see 6.5. |
| `limAt` | ISO date-time | When places and procedures were loaded; required for applying participant limits. |
| `err` | string[] | Last 300 error messages (information only). |

### 6.3 Module record (`m[moduleId]`)

| Field | Meaning |
|---|---|
| `tu` | Turnus letter (`W`/`S`/`B`/`U`) from the details, else from the job. |
| `cnt` | `{semester: number of courses}` for every semester in `F`; `-1` = module not selectable in that semester. |
| `L` | `{semester: [[element, courseId, type, sws, lecturers]]}`, only needed semesters are kept. `element` is the course grouping name, `type` e.g. `VO`, `UE`, `PR`, `SE`; `lecturers` like `"Name V [L], Name2 W"` (`[L]` = lead). |
| `old` | Last semester in `back` with courses, if none in `F`. |
| `code`, `n`, `cr`, `tt`, `sp` | Module code, name, credits, turnus text, language. |
| `f` | Description fields (all modules since v4): `turnus, sprache, dauer, kuerzel, vora, lern, inhalt, lehr, medien, lit, verantw, pruef, h0, h1, h2, whF, whE`. |
| `dept`, `dl` | Organisation name; `dl` = language the description was taken from if not the session language (`en`, `de`, …). |

### 6.4 Course groups (`c[courseId][i]`)

| Field | Meaning |
|---|---|
| `n` | Group name, e.g. `Standardgruppe`, `Gruppe 2`, `Online-Gruppe`. |
| `s` | Series: `[seriesId, weekdays, from, to, begin, end, room, count, shortDates]`. `weekdays` = JS `getDay()` values joined by `/` (`1/3`), times `HH:MM`, dates `YYYY-MM-DD`; `shortDates` (list of dates) only for series shorter than 4 weeks (block), else `null`. |
| `o` | Single dates outside a series: `[startDateTime "YYYY-MM-DDTHH:MM", endTime, room, eventTypeKey]`. |
| `mx`, `cf` | Only for limited groups: places and confirmed places. |

### 6.5 Registration procedures (`pr[procedureId]`)

| Field | Meaning |
|---|---|
| `n` | Name. |
| `b`, `e`, `de` | Registration begin, end, deregistration end (date-time strings). |
| `z` | Allocation date. |
| `r` | Ranking criteria, `; `-separated. |
| `i`, `st` | Registration info text and status (e.g. `LV-Anmeldung möglich`). |
| `mx`, `minw`, `maxp`, `auto` | Total places, minimum wishes, maximum places per student, automatic allocation. |
| `ok` | Details were loaded. |

### 6.6 Places only (older scripts)

Scripts up to v4 could produce a compact places-only result (`kind:"lim"`, `TUMU.limitsText()`). v5 dropped it; the planner and `tum_update.py` still accept such files.

### 6.7 What ends up in the planner (`DATA`)

| Field in `DATA.modules[code]` | Written by the update |
|---|---|
| `lvt` | `{semester: [event]}` for every needed semester. Event: `t` type, `n` name, `sws`, `doz`, `o` room, `d` first date, `v`/`b` from/to, `nt` note (`laut TUMonline 14.10.2026–03.02.2027, …`), optional `one` (single date), `grp`/`gk`/`gdef` (choosable group, group key, default group). |
| `dep` | Possibly discontinued: `{miss: [semesters without courses], last, at, stp:false if no longer in the study plan}`; removed when offered again. |
| `lim` | `{semester: {g: [[type, group, places, confirmed]], p: [[procedure, regFrom, regTo, allocation, ranking, status, totalPlaces, deregTo]]}}`. |
| `neu` | Date the module was found (shown as "neu" for 120 days). |
| `name`, `ects`, `turnus`, `sprache` | Updated if TUMonline differs. |
| `lern`, `inhalt`, `lehr`, … , `h`, `wh`, `dl` | Filled when empty, replaced when TUMonline has a different non-empty text (empty TUMonline fields never delete existing text). Listed in the report as "Beschreibungen neu gefüllt" / "aktualisiert". |
| `DATA.terms` | `{pub, need, at, start, lim}` (shown in the update dialog). |
| `DATA.tree` | New modules get a node (`lane`, `ects`, `ord`) and prerequisite edges. Extra modules get lane `zusatz`. |
| `ext`, `brackets: ["zusatz"]` | Extra module outside the programme (v57). Never counts for ECTS or SPO rules, never marked "no longer in the study plan". |

---

## 7. How the result is applied (rules)

| Step | Rule |
|---|---|
| Dates per semester | For each needed semester: courses from `L`, groups from `c`. Series become weekly events (first date on that weekday); single dates matching a series move its first date; 3 or more single dates in the same slot become one event "n Einzeltermine"; fewer stay single events. Duplicate slots are dropped. |
| Groups | One group: plain events. Several groups (or a group with both on-site and online dates in the same slot, split into "(vor Ort)" / "(online)"): every event gets `grp` and group key `gk` (type, numbered if a type occurs twice); a previously marked default group (`gdef`) is kept. |
| Missing data | If a course of a needed semester has no group data, or a semester with courses has no course list, the module's dates stay unchanged ("Termine unvollständig"). Modules with `"err"` stay unchanged. |
| Discontinued? | Window = last 2 published winter semesters (`W`), last 2 summer (`S`), last 3 published (`B`), last 4 (`U`). Flagged if no window semester has courses and nothing later has either (for `U`: all window semesters empty). Master's thesis and research practice are never flagged. |
| New modules | Module positions in the tree that are not in the planner. The area (bracket) is predicted from tree categories where at least 80 % of known modules share one area; prerequisites are taken from module codes in the prerequisites text. |
| No longer in the study plan | Only if the tree is complete: known modules whose ID does not appear anymore get `dep.stp = false`. |
| Changed master data | Name, turnus and language from the details; credits from the tree. Listed in the report. |
| Descriptions | Every description field from TUMonline that is non-empty and differs replaces the old one; empty fields are kept. Organisation (`dept`) too. |
| Participant limits | Only courses with a limited group or a procedure with a place count. For every successfully fetched module an old limit is removed if none remains. |
| Extra modules (v57) | For every ID in `job.xid` with a fetched record that is not in the planner yet: a new module with bracket and lane `zusatz`, `ext: true`, path "Zusatzmodul (außerhalb des Studiengangs)", no "neu" mark. ECTS come from the module details. Already known codes are reported as "schon im Studiengang". Afterwards it is updated like every other module. |
| Safety | A result without published semesters or without any courses is refused. A missing tree alone is not refused (warning instead). |
| Report | Tree, semesters, modules, discontinued, descriptions, new, removed, changed, errors, and **your plan modules with changes** (dates, discontinued, master data) and with participant limits. |

### 7.1 Your choices after an update (automatic carry-over)

Switched-off events (`tum_evoff`), switched-on events (`tum_evon`) and chosen groups (`tum_groups`) are stored by a key made of type, name, weekday, time and group name. When TUMonline changes a time or a group name, or you move a module to another semester, such a key no longer matches. Since v55 the planner checks this on every redraw:

| Case | What happens |
|---|---|
| Group renamed (`Group 3` → `Gruppe 3`, `Gruppe Online` → `Online-Gruppe`) | Matched by name ignoring case, punctuation, word order and "Gruppe/Group", else by the number in the name if unique. The choice is carried over. |
| Event moved (other time, weekday or room) | Matched to the event of the same type, name and group; if several, the one with the same weekday/time. The switch-off is carried over. |
| Carried over | A green box **Auswahl automatisch angepasst** at the top of the plan lists every change until you click **OK**. |
| No match | An orange warning per entry (e.g. "passt zu keinem Termin, die Abwahl wirkt gerade nicht"). A group choice without a match falls back to the default group. **verwerfen** deletes the stale entry. |

Old keys are kept as long as they match another semester's data, so moving a module back restores the old choice.

### 7.2 Extra modules outside the programme (v57)

Some modules you attend are not part of M.Sc. Maschinenwesen (e.g. Fluidmechanik 2 as a refresher). In the planner: **＋ Zusatzmodul** (left panel, or "＋ hinzufügen" in the lane header "Zusatzmodule" in the tree), paste the module's TUMonline link (`…/slc.cm.reg/student/modules/detail/light/<ID>/…`) or just the ID. The ID waits in the browser (`localStorage["tum_extra"]`, also written to "Plan als Textdatei" and read back on import) until the next update, which fetches the module and adds it to the lane "Zusatzmodule". From then on it works like any module (semester plan, week view, conflicts, places, descriptions), but it is always "optional": it never counts for the 120 ECTS or the SPO checks.

Finding the link: open the module in TUMonline (module handbook search, or from a course: "Curriculum positions" → the module), the address contains `detail/light/<ID>`.

---

## 8. Modifying the updater

### 8.1 Changing the browser script

1. Edit `agents/modul-updater/tum_update.js`. Keep it free of `</script` and `<!--` (it is embedded in HTML).
2. Check syntax: `node --check tum_update.js`.
3. Copy it into the planner: `python3 sync_updater.py` (or `--planner path/to/TUM_Modulplaner.html`). `python3 sync_updater.py --check` tells whether they differ.
4. If you change the result format, bump `v` and update `updApply` and `tum_update.py` (section 8.3) and this guide (section 6).

Console API (v6): `TUMU.start(job?, {only:[moduleIds]}?)` (always a new run), `TUMU.status()`, `TUMU.download(name?)`, `TUMU.errors(n)`, `TUMU.check(job?)` (check modules only, for development), `TUMU.reset()`, `TUMU.panel()`. Without a job argument the embedded job is used.

TUMonline endpoints used (all GET, relative to `https://campus.tum.de`):

| Purpose | Path |
|---|---|
| Study plan tree | `/tumonline/wbStpCs.cbSpoTree?…&pStpStpNr={cv}&pSJNr={sj}&pStpKnotenNr={node}` (HTML fragment) |
| Semesters of a module | `/tumonline/ee/rest/slc.cm.reg/student/modules/detail/{mid}/availableSemesters` |
| Module details | `…/modules/detail/{mid}/{termId}` |
| Courses of a module | `…/modules/detail/{mid}/{termId}/courseGroupings/courses` and `…/courses/{groupingId}` |
| Groups and dates | `/tumonline/ee/rest/slc.tm.cp/student/courseGroups/firstGroups/{cid}` and `remainingGroups/{cid}` |
| Registration procedures | `/tumonline/ee/rest/slc.tm.cp/student/courses/{cid}/registrationProcedures` and `…/registrationProcedures/{pid}` |

### 8.2 Another study programme or SPO version

Change `UPD_CFG` at the top of the update block in the planner (`cv`, `root`, `sjDefault`, `check`) and the same defaults in `tum_update.py` (`--cv`, `--root`, `--sj`, `CHECK_DEFAULT`). The values are visible in TUMonline URLs of the study plan (`pStpStpNr`, `pSJNr`, node number of the SPO version). The planner's SPO rules (areas, minimum credits) are separate and live in the main planner code (`BR`, `ORDER`, `renderPlan()`); see `README.md`.

### 8.3 Changing how data is applied

`updApply()` in the planner and `cmd_apply()` in `tum_update.py` implement the same rules (function names match: `updGroupEntries` = `group_entries`, `updVariants` = `variants`, `updBuild` = `build`, `updCoursesOf` = `courses_of`, `updTreeIndex` = `tree_index`, `updBracketModel` = `bracket_model`, `updNewModule` = `new_module`, `updLimitsFull`/`updLimitsText`/`updApplyLimits` = `limits_from_full`/`limits_from_text`/`apply_limits`). Change both, or decide that one of them is the only one in use and say so in `README.md`. The only intended difference: the planner refuses empty results (section 3), the Python script does not.

### 8.4 Testing a change

1. Take a planner backup and a downloaded result, e.g. copy them to `agents/modul-updater/runs/` as `TUM_Modulplaner_vor_<date>.html` and `tum_update_<date>.json`.
2. Python: `python3 tum_update.py apply --planner runs/TUM_Modulplaner_vor_<date>.html --data runs/tum_update_<date>.json --out /tmp/py.html`
3. Compare: `node parity_check.js runs/TUM_Modulplaner_vor_<date>.html runs/tum_update_<date>.json /tmp/py.html ../../TUM_Modulplaner.html` → expected `IDENTISCH`. (The last argument is the planner that contains the current `updApply`.)
4. In the browser: open the planner, run step 3 with the same two files, download, compare with `/tmp/py.html` (identical).
5. For script changes: open the new planner, **Skript kopieren**, run it in TUMonline (for a quick test: `TUMU.start(null,{only:[<a few module IDs>]})` in the console), then a full run.

At the time of writing (planner v57), steps 3 and 4 gave byte-identical files for the 2026-10-09 run (1,182 modules).
