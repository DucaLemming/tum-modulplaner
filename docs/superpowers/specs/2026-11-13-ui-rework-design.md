# TUM Modulplaner: UI rework (design)

Status: **approved 13.11.2026.** This is the basis for the task-by-task implementation plan in `docs/superpowers/plans/`.

Date: 13.11.2026. Planner version at the time of writing: v86 (`planner/TUM_Modulplaner.html`).

---

## 1. Intent

The planner grew over 86 versions by appending features. Every feature added its own box, button, badge and explanation text. The logic is good and verified against the real plan; the surface is not. The owner's words: super complicated, a lot of redundancies, very confusing.

The rework replaces the whole surface with a small number of clear screens that work on a desktop and on a phone, without changing what the planner calculates.

### Goals

1. One place for each thing. Every number, status and warning has exactly one home.
2. Five screens instead of eight header buttons, three permanent panels and four overlays.
3. Usable on a phone (390 px wide) and on a desktop (up to 1920 px) from the same file.
4. No explanation paragraphs on screen. Labels are self-explaining; details sit behind a "?" help popover.
5. Same results as today: ECTS totals, SPO check, conflicts, warnings and the text export stay identical for the same plan.

### Non-goals

- No change to the calculation rules (SPO, conflicts, effort, travel, places).
- No change to the stored plan format (`tum_*` keys, `plan.json`, `Modulplan.txt`). Old plans load without migration.
- No change to the updater (`tumuScript`, `updJob`, `updApply`) or the nightly workflow.
- No framework, no build tooling beyond a Python script, no external runtime dependency. The planner stays one self-contained HTML file.
- No dark mode in this rework (colours are CSS variables, so it can follow later).

### Anti-goals (would make it a failure even if it works)

- A number that differs from the current planner for the same plan.
- A feature that silently disappears. Everything is either kept, merged or listed as removed in section 8.
- A phone layout that is just the desktop layout squeezed.
- New explanation paragraphs replacing the old ones.

---

## 2. What is wrong today (audit, 13.11.2026, real plan, 1920 x 1080)

| # | Finding | Evidence |
|---|---|---|
| 1 | Three permanent panels compete: plan panel (430 px), dependency graph, semester plan (705 px). The graph gets the remaining 780 px and shows 1,195 nodes at unreadable size. | main view |
| 2 | The ECTS total is shown three times with different wording: "Fortschritt" (plan panel), summary card (semester plan), week view header. | plan panel, semester plan, week view |
| 3 | Limited places appear in seven places: red box at the top of the plan panel, red header button, red box in the module panel, "Platz" select in the module panel, a second "Platz" select under "Planung" in the same panel, badges in the semester plan, badges in the week view. | module panel MW0305 |
| 4 | "Does this module count?" is spread over six independent controls: Optional, Frei, Abgeschlossen, Platz status, option rank ①②③, either-or rank. The semester plan then needs five row types and a legend to explain the result. | module panel, semester plan |
| 5 | Warnings live in five lists: plan panel "Warnungen", semester headers, week view clash list, "Entscheidungen" overlay, "Kollisionen" switch. Each warning is one long sentence with room numbers and date ranges. | plan panel |
| 6 | Header has eight buttons of four different kinds: views (Wochenansicht, Prüfungen), an overlay (Entscheidungen), a setting (Kollisionen), a jump link (begrenzt), a dialog (Sync), help (Kürzel), and a hidden one (Semesterplan). | header |
| 7 | Permanent explanation text: 10 lines above the semester plan, 5 lines in the plan panel, 3 lines plus a 9-item legend above the week grid. On a 1080 px screen the week grid starts at y = 430. | semester plan, week view |
| 8 | The week view holds unrelated settings below the grid: travel-time matrix (10 fields), work-hours target, own appointments form. | week view |
| 9 | Phone: fixed 430 px + 705 px panels, no breakpoints. The page is 1,135 px wide plus the graph; unusable at 390 px. | 390 x 844 |
| 10 | The yellow disclaimer takes 360 px of the header permanently. | header |

---

## 3. Approaches considered

| | A. Restyle in place | B. New surface on the existing engine (chosen) | C. Rewrite from scratch |
|---|---|---|---|
| What | Keep the render functions, change CSS and reorder blocks | Keep data, rules and storage untouched. Put a thin, tested API on top. Build new screens that only talk to that API. Hide, then delete the old screens. | New app, new data model, new rules code |
| Fixes the structure | No. Render functions build HTML and logic together; the redundancies are in the code. | Yes | Yes |
| Risk to the numbers | Low | Low: the rules code is not edited, and a golden test compares the text export before and after every task | High: 250 KB of rules tuned over 86 versions and checked by hand against TUMonline |
| Work for weaker models | Hard: every change is a regex edit inside a 500 KB file | Good: small new files, a fixed API, one screen per task | Very hard |
| Phone layout | Fights the fixed-panel layout | Designed in from the start | Designed in |

**Choice: B.** It is the only one that fixes the structure without putting the verified logic at risk, and it splits into small tasks with a clear test for each.

---

## 4. The new structure

### 4.1 Five screens

| Screen | Answers | Replaces |
|---|---|---|
| **Übersicht** | Am I on track? What do I have to do next? | Fortschritt, Pflichtbereiche, Mastermodule, red limit box, Warnungen list, Entscheidungen overlay, Kollisionen switch, header button "begrenzt" |
| **Module** | What can I take? | Dependency graph, filter toolbar, search results, Zusatzmodul |
| **Plan** | Which module in which semester? | Semester plan panel |
| **Woche** | What does my week look like? | Week view |
| **Prüfungen** | When are my exams? | Exam view |

Plus two things that are not screens:

- **Modul** (detail): one panel for one module, opened from anywhere.
- **Menü** (⋯): Sync, Import, Export, Moduldaten aktualisieren, Einstellungen (start semester, travel times, work-hours target), Hilfe (Kürzel, legend, disclaimer).

### 4.2 Navigation and layout per screen size

| Width | Name | Navigation | Module detail |
|---|---|---|---|
| < 720 px | phone | Bottom bar with 5 icons + labels, 56 px high. Top bar 48 px: screen title, search icon, ⋯. | Full-screen sheet sliding up, close with ✕ or back gesture (history entry) |
| 720 to 1199 px | tablet | Top bar 56 px with 5 text tabs, search field, ⋯ | Overlay from the right, 440 px, dims the rest |
| ≥ 1200 px | desktop | Left rail 208 px (icon + label per screen, sync status at the bottom), top bar with search and ⋯ | Docked right column 460 px; the screen keeps its place next to it |

Routing by URL hash so back/forward and reload work: `#/uebersicht`, `#/module`, `#/plan`, `#/woche/2`, `#/pruefungen/1`, and `?m=MW0305` style suffix for an open module (`#/plan/m/MW0305`). The sync connect link `#/connect/...` keeps working.

### 4.3 Wireframes

Desktop, Übersicht:

```
┌────────────┬──────────────────────────────────────────────────────────────┐
│ Modulplaner│  [ Modul, Inhalt, Lehrveranstaltung suchen …           ]  ⋯ │
│            ├──────────────────────────────────────────────────────────────┤
│ ▣ Übersicht│  128 / 120 ECTS sicher        +8 Platz offen   +21 optional  │
│ ☰ Module   │  ████████████████████████████████▒▒░░░░   (one bar)          │
│ ▦ Plan     │                                                              │
│ ▤ Woche    │  Offene Punkte (9)                    Bereiche               │
│ ✎ Prüfungen│  ┌───────────────────────────────┐    Thesis        30/30 ✓  │
│            │  │ ⇄ Entscheidung                │    Forschungspr. 11/11 ✓  │
│            │  │ MW0620 oder MW1978        ›   │    Praktika       0/8  ⚠  │
│            │  ├───────────────────────────────┤    Internat.      6/6  ✓  │
│            │  │ 🔒 Anmeldung                  │    Überfachlich   9/5  ✓  │
│            │  │ MW0305 · 2. Sem · ab 01.03.   │    ─ Mastermodule 72/60 ✓ │
│            │  │ [Platz erhalten]          ›   │    Grundlagen    25/20 ✓  │
│            │  ├───────────────────────────────┤    Kernfächer    36/40    │
│            │  │ ⚡ Überschneidung · 1. Sem     │    Angrenzend     0/15    │
│            │  │ SOT53200 SE ↔ MW0007 UE       │    Flexibil.     11/15    │
│            │  │ Fr 30.10. · einmalig      ›   │                           │
│ ☁ synchron │  └───────────────────────────────┘                           │
└────────────┴──────────────────────────────────────────────────────────────┘
```

Phone, Woche (one day at a time):

```
┌──────────────────────────┐
│ Woche · 1. Sem  ▾     ⋯  │
│ Mo  Di  Mi [Do] Fr       │
│ 40 ECTS · 20 h Arbeit    │
├──────────────────────────┤
│ 08:30 ┌────────────────┐ │
│       │ MW0850  VO     │ │
│ 09:45 │ Nichtlin. Kont.│ │
│       └────────────────┘ │
│ 10:15 ┌────────────────┐ │
│       │ MW0007  VO     │ │
│ 11:45 │ Aerodynamik 1  │ │
│       └────────────────┘ │
│ 14:00 ┌───────────── ⚡┐ │
│       │ MW0142  UE     │ │
│ 16:00 └────────────────┘ │
├──────────────────────────┤
│ ▣    ☰    ▦   [▤]   ✎   │
└──────────────────────────┘
```

Desktop, Plan with a module open:

```
┌────────┬───────────────────────────────────────────┬─────────────────────┐
│  rail  │ 1. Sem WiSe 26/27   2. Sem SoSe 27   3. … │ MW0305          ✕   │
│        │ 40 ECTS  ▮▮▮▮▮▯     37 +8 ◐  ▮▮▮▮▯▯       │ Experimentelle      │
│        │ ┌───────────────┐  ┌───────────────┐      │ Strömungsmechanik   │
│        │ │MW0142   5     │  │MW1628   5     │      │ 4 ECTS · Praktika   │
│        │ │Aerodyn. bod.  │  │Angewandte CFD │      │ ─────────────────── │
│        │ └───────────────┘  └───────────────┘      │ Im Plan: 2. Sem  ▾  │
│        │ ┌───────────────┐  ┌───────────────┐      │ Status: Platz offen▾│
│        │ │MW0612   5     │  │MW0305 4 ◐ 🔒  │      │ ─────────────────── │
│        │ │Finite Elemente│  │Exp. Strömungs.│      │ ▸ Termine (5)       │
│        │ └───────────────┘  └───────────────┘      │ ▸ Platz & Anmeldung │
│        │  …                  …                     │ ▸ Prüfung           │
│        │                                           │ ▸ Beschreibung      │
└────────┴───────────────────────────────────────────┴─────────────────────┘
```

---

## 5. Screens in detail

All UI text is German. Text in `code font` below is the exact label.

### 5.1 Übersicht

Three blocks. Desktop: progress on top across the full width, then two columns (Offene Punkte 60 %, Bereiche 40 %). Phone: stacked in the order progress, Offene Punkte, Bereiche.

**Progress.** One line and one bar, the only place the total lives:

- Big number: sure ECTS, then `/ 120 ECTS sicher`.
- Up to three chips, each only if not zero: `+N Platz offen`, `+N optional`, `N abgeschlossen`.
- One stacked bar 0 to max(120, total with everything): solid = sure, striped = seat open, outline = optional, marker line at 120.

**Bereiche.** One row per bracket: name, `x / y`, state icon (✓ fulfilled, ⚠ violated, nothing while open), thin meter in the bracket colour. The four Mastermodule brackets sit under a sub-heading row `Mastermodule 72 / 60`. Tap a row opens **Module** filtered to that bracket with "nur im Plan" on. Ethics sub-rule shows as a second line under Überfachliche Ergänzung: `davon Ethik 3 / 3`.

**Offene Punkte.** The single inbox for everything that needs a decision or attention. One card per item: icon, type label, one short title line, one short detail line, at most one primary action button, chevron to the place where it is fixed.

| Type | Icon | Source in the engine | Title / detail | Primary action | Tap opens |
|---|---|---|---|---|---|
| `Regel` | ⚠ | SPO violations and open requirements (lists `bad`, `open` of `renderPlan`) | bracket name / "noch 8 ECTS" | none | Module filtered to the bracket |
| `Entscheidung` | ⇄ | open either-or groups (`eoList`) | "MW0620 oder MW1978" / ECTS and semester of each | `Vergleichen` | comparison sheet |
| `Anmeldung` | 🔒 | planned limited modules without a secured place (`limPlan`) | code, name / semester, registration period, "voll" state | `Platz erhalten` | Modul, section Platz |
| `Überschneidung` | ⚡ | conflict kinds LV, PF, PFK, LF, PR, PT, PB of `computeConflicts()` | "CODE TYP ↔ CODE TYP" / weekday, time, "einmalig am …" or "wöchentlich" | none | Woche of that semester, both events highlighted |
| `Weg` | 🚆 | kind WG | "Garching → Arbeit" / day, minutes missing | none | Woche, that day |
| `Reihenfolge` | ↕ | kinds RF, T | "MW0305 vor MW0595" / one short reason | none | Plan, both modules highlighted |
| `Angebot` | ⓘ | kind DEP, modules no longer in the curriculum | code, name / "seit SoSe 2025 ohne Termine" | none | Modul |
| `Datenupdate` | ↻ | reconcile notes (`recNotes`, unmatched choices) | what changed | `OK` | Modul |

Rules:

- Sort order: Regel, Entscheidung, Anmeldung (running registration first, then by date), Überschneidung (by semester, then weekday), Weg, Reihenfolge, Angebot, Datenupdate.
- Filter chips above the list: `Alle`, one chip per semester `1.` to `4.`, and one chip per type that has items. Counts on the chips.
- Each card has a "⋯" with `Ausblenden` (uses the existing hidden-warnings store `tum_hidew`). Footer link `N ausgeblendet · anzeigen`.
- `Überschneidungen prüfen`: a row of four toggles (semesters 1 to 4) at the bottom of the list, replacing the header button "Kollisionen" (store `tum_colloff`). A semester that is switched off shows one muted card "Überschneidungen im 3. Sem. nicht geprüft".
- Uncertain items (times taken from last year) carry a small grey tag `Vorjahr` instead of a second colour scheme.
- The long sentence of each warning stays available: tap the detail line to expand the full original text.
- Bottom-bar and rail badge on Übersicht: number of items that are not hidden.

### 5.2 Module

A searchable, filterable list of all modules. Replaces the dependency graph.

- Search field on top (the global search field focuses this screen). Searches name, code, shorthand, Lernergebnisse, Inhalt and course names with the existing German/English glossary. Result count next to it.
- Filter row, horizontally scrollable chips; each opens a small popover with options: `Bereich` (multi), `ECTS` (multi), `Semester` (Winter, Sommer), `Im Plan` (nur im Plan, nur nicht im Plan), `Mehr` (begrenzte ausblenden / nur begrenzte, eingestellte ausblenden, Zeitlage: Block vor / während / nach / ohne Termine, nur Ethik, Sprache). Active filters are filled chips with ✕. `Zurücksetzen` at the end.
- List grouped by bracket with a sticky group header (bracket colour dot, name, count). Rows are 56 px: code, name (one line, ellipsis), ECTS, turnus letter (W, S, W+S), and state icons: in plan (filled dot in bracket colour + semester number), 🔒 limited, `neu`, `eingestellt?`, ⛔ excluded.
- Row tap opens Modul. Row "+" button (desktop: on hover; phone: always) adds to the plan with the default bracket; turns into ✓.
- List is virtualised or rendered in chunks of 100 per group (1,195 rows).
- `＋ Zusatzmodul` at the end of the list (same dialog as today).
- Prerequisites, which were the edges of the graph, move into Modul (section "Voraussetzungen"): two short lists, `Vorher empfohlen` and `Wird empfohlen für`, each entry a link to that module with a ✓ if it is in the plan in an earlier semester.

### 5.3 Modul (detail)

One panel, the same content on every screen size. Order from top:

1. **Head.** Code, name, chips: ECTS, bracket (colour), turnus, language, campus. Link `TUMonline ↗`. Offer banner if `dep` is set.
2. **Im Plan.** The only place where a module's state is edited:

| Row | Control | Notes |
|---|---|---|
| `Im Plan` | switch | off = not marked. Turning off asks for confirmation only if the module has own settings (attendance, exams). |
| `Zählt für` | select of the module's brackets | hidden if the module has one bracket |
| `Semester` | segmented 1 2 3 4 + `offen` | writes `sem` |
| `Status` | select: `Zählt`, `Optional`, `Abgeschlossen` | writes `opt`, `done` |
| `Platz` (only limited modules) | segmented `offen` / `erhalten` | `erhalten` writes `pst = z`; `offen` removes it. Today's "geplant" and "beworben" count identically since v77 and are merged. |
| `Wenig Aufwand` | switch with "?" | writes `frei` |

   Directly below, one grey result line that says what the combination means, so no legend is needed: for example "Zählt mit 4 ECTS, sobald du den Platz hast." or "Zählt nicht (optional)." or "Zählt nicht: MW0620 hat Vorrang (Entscheidung offen)."
3. **Termine.** Events of the planned semester (or the first fitting semester if not planned), grouped by course type. Each event row: type, weekday, time, room, attendance chip. Tap opens the event sheet (5.6). Groups are a radio list inside the type block; block/weekly variants are a segmented control. Last-year times carry the tag `Vorjahr`.
4. **Platz & Anmeldung** (only limited): table of groups (places, confirmed, voll), registration period with state, allocation and ranking as one line, date of the check. The status control is not repeated here; a link `Status ändern ↑` scrolls to block 2.
5. **Prüfung.** Exam dates with edit, add, retake flag (as today).
6. **Alternativen & Ausweichsemester** (collapsed by default, badge if used): either-or group members with rank and ↑ ↓, `Vergleichen`, `Dafür entscheiden`; fallback semesters as chips (`sonst 3.`, `sonst 4.`). This is the former "Planung" box and the former either-or box, minus the status selects.
7. **Voraussetzungen.** See 5.2.
8. **Beschreibung** (collapsed): Lernergebnisse, Inhalt, Prüfungsform, Lehrmethoden, Medien, Literatur, Stunden, Verantwortlich. Each as an accordion row.
9. **Ausschließen.** For modules not in the plan: `⛔ Nicht für mich` with an optional reason (store `tum_nogo`).

### 5.4 Plan

Semester board.

- Desktop and tablet: four columns side by side plus a narrow fifth column `Ohne Semester` (only if not empty). Phone: one column at a time with a segmented control `1. 2. 3. 4.` on top and swipe left/right; `Ohne Semester` is a fifth segment when not empty.
- Column header: `1. Semester`, term name (`WiSe 2026/27`), number of sure ECTS large, chips `+N Platz offen`, `+N optional` if not zero, ⚠ count if the semester has open points (tap filters Übersicht to that semester), button `Woche`.
- Under the header two thin meters with a tick at 30: ECTS (same segments as the progress bar) and `Aufwand`. Colours: green up to 30, amber to 36, red above. No numbers except at the end of the bar.
- Module card (min height 56 px): code, ECTS, name (two lines max), one state tag at most, chosen by priority: `abgeschlossen` ✓, `Alternative` ⇄ (loses a decision), `optional`, `Platz offen` ◐, none (counts). Small icons right: 🔒 limited, ⚠ has an open point, `Block` for block modules. Cards that do not count are drawn with a dashed border and muted text. Left border in the bracket colour.
- Sorting inside a column: counting modules first, then seat open, then optional, then alternatives; inside each by bracket order.
- Moving: desktop drag and drop between columns (pointer events, drop target highlights); every screen size: card "⋯" menu with `Verschieben nach 1. / 2. / 3. / 4. / ohne Semester`, `Optional`, `Aus Plan entfernen`. Phone uses the menu only.
- Fallback candidates ("↪ Ersatz" rows today) are a collapsed line at the bottom of a column: `2 Ausweichmodule aus anderen Semestern ▸`.
- Start semester and year move to Menü > Einstellungen.
- The footnote "noch nicht veröffentlicht, Zeiten des Vorjahres" becomes the tag `Zeiten: Vorjahr` in the column header.

### 5.5 Woche

- Header row: semester select (`1. Sem · WiSe 2026/27 ▾`), week select (`Semesterwoche ▾`, with `Blockwoche davor`, `Blockwoche danach` when they exist), three key figures as plain text (`40 ECTS`, `20,0 h Arbeit`, `21,8 h frei`), button `Anzeige ▾` (toggles: Alternativen zeigen, Ausgeblendete zeigen, nur Überschneidungen), button `＋ Termin`.
- Desktop and tablet: grid Mo to Fr (Sa only if it has events), 07:00 to 20:00, hour height 56 px. The grid starts directly under the header row; no legend, no hint text above it.
- Phone: one day at a time with a day switch `Mo Di Mi Do Fr`, swipe to change; a small dot under each day that has a conflict. Optional toggle `Liste` shows the day as an agenda list instead of a time grid.
- Day header: one line `07:30 bis 18:45 · Fahrt 2:00`; tap expands the details (work, break).
- Event block: line 1 code + type (`MW0850 VO`), line 2 name, line 3 time and room if there is space. Fill = bracket colour (light). Encoding kept deliberately small:

| Meaning | Look |
|---|---|
| attended on site | solid border |
| online | dashed border + 💻 |
| recording / not attended / done | faded, not counted; hidden unless "Ausgeblendete zeigen" |
| conflict | red outline + ⚡ |
| mandatory | ❗ |
| not counting (optional, alternative) | hatched fill + tag `optional` or `Alternative` |
| own appointment | grey fill |
| travel | thin hatched strip, no text except minutes |

- Legend: behind `?` in the header row, not on screen.
- Tap an event opens the event sheet (5.6). Tap an own appointment opens its edit form. Desktop only: drag on an empty spot draws an own appointment (as today).
- Below the grid one collapsible list `Überschneidungen in dieser Woche (N)`, the same cards as in Übersicht filtered to the semester, including the quick fixes (online, Aufzeichnung, andere Gruppe).
- Row `Ohne Zeit`: chips for modules without timed events, under the grid.
- Own appointments list, travel times and work-hours target are no longer on this screen: `＋ Termin` opens the form; the list of own appointments is at Menü > Einstellungen > Eigene Termine, travel times and work target next to it.

### 5.6 Event sheet (one event or series)

Small sheet (phone: bottom sheet; desktop: popover at the event).

- Title: code, type, weekday, time, room, `Details zum Modul ›`.
- `Teilnahme`: segmented control with four options: `Vor Ort`, `Online`, `Aufzeichnung`, `Nicht`. The default is marked with a dot; tapping the active one resets to the default.
- `Gruppe`: radio list, only if the course has groups.
- Row of secondary actions: `❗ Pflicht`, `🚫 Fällt aus …` (date list), `✎ Zeit/Raum`, `✓ Erledigt`.

### 5.7 Prüfungen

- Semester segmented control as in Plan.
- Default view on every size: chronological list grouped by calendar week. Row: date, weekday, time, code, name, room, tags `geschätzt`, `Wiederholung`, ⚡ (overlap), `gleicher Tag`.
- Block `Ohne Termin` at the end.
- Desktop toggle `Liste | Kalender`: the calendar is today's week grid of the exam period. Phone has the list only.
- Tap a row opens Modul at section Prüfung.

### 5.8 Menü (⋯)

| Entry | Content |
|---|---|
| `Sync` | the v86 dialog, unchanged in function; the status icon also sits at the bottom of the desktop rail |
| `Plan exportieren` | text file (as today) |
| `Plan importieren` | as today |
| `Moduldaten aktualisieren` | the update dialog, restyled only; shows `Stand: 13.11.2026` |
| `Einstellungen` | Startsemester and Jahr; Arbeitsziel h/Woche; Fahrzeiten (matrix); Eigene Termine (list with edit and delete) |
| `Hilfe` | Kürzel (VO, UE, …), legend of colours and icons, counting rules in short, disclaimer |

The disclaimer leaves the header. It is shown once per device as a dismissible bar on first open, stays in Hilfe and in the text export.

---

## 6. Visual design

Plain, calm, dense enough for a planning tool. One accent colour; colour otherwise only carries meaning (bracket, warning).

| Token | Value |
|---|---|
| `--bg` | `#f5f6f8` |
| `--surface` | `#ffffff` |
| `--ink` | `#16202a` |
| `--muted` | `#5d6b78` |
| `--line` | `#dfe4ea` |
| `--accent` | `#1f5fa8` |
| `--accent-weak` | `#e6eff9` |
| `--ok` | `#1f7a45` |
| `--warn` | `#b7791f` |
| `--bad` | `#c53030` |
| `--bad-weak` | `#fdecec` |
| bracket colours | from `DATA.brackets[id].color`, unchanged |
| font | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| sizes | 12 (meta), 14 (body), 16 (card title, inputs on phone), 20 (screen title), 28 (the one big number) |
| weights | 400, 600 |
| spacing scale | 4, 8, 12, 16, 24, 32 px |
| radius | 8 px cards and inputs, 999 px chips |
| elevation | `0 1px 2px rgba(16,24,40,.06)` cards; `0 12px 32px rgba(16,24,40,.18)` sheets |
| touch target | min 44 x 44 px on phone and tablet |
| focus | 2 px `--accent` outline, offset 2 px, on every interactive element |
| motion | sheets 180 ms ease-out; respect `prefers-reduced-motion` |

Rules:

- Red is only for conflicts and rule violations. Limited places use the 🔒 icon and neutral text, red only while a registration needs action.
- Emoji stay as icons only where listed in this document (⚡ 🔒 ⇄ ❗ 💻 🚫 ✓ ⚠ ☁). Navigation icons are inline SVG.
- No box inside a box inside a box: at most card on background.
- Help texts: max two sentences, only inside a `?` popover.
- Numbers use tabular figures (`font-variant-numeric: tabular-nums`).
- Accessibility: all controls reachable by keyboard, `aria-label` on icon buttons, sheets trap focus and close on Escape, contrast at least 4.5:1 for text.

---

## 7. Architecture

### 7.1 Layers

```
┌──────────────────────────────────────────────┐
│ ui/      screens, sheets, router, components │  new, small files
├──────────────────────────────────────────────┤
│ api.js   PL: read models + actions           │  new, the only bridge
├──────────────────────────────────────────────┤
│ engine   existing rules, storage, updater    │  unchanged code
├──────────────────────────────────────────────┤
│ DATA     module data (updated nightly)       │  unchanged
└──────────────────────────────────────────────┘
        sync.js hooks localStorage (v86), unchanged
```

- **Engine** = today's main script and tail scripts, moved verbatim into `planner/src/engine/legacy.js` (without `DATA`). Its render functions keep existing but draw into a hidden container, and the expensive ones (graph build, week render) are switched off once the matching new screen exists.
- **`PL`** (`planner/src/api.js`) is the contract. Screens never touch engine globals or `localStorage` directly. Read functions return plain objects ready to draw; actions change the plan through the existing engine functions and then emit one `change` event that screens re-render on.

  Read models (names fixed here, exact fields in the implementation plan after reading the engine code): `PL.totals()`, `PL.brackets()`, `PL.issues()`, `PL.modules(filter)`, `PL.module(code)`, `PL.semesters()`, `PL.week(sem, weekKind)`, `PL.exams(sem)`, `PL.settings()`.

  Actions: `PL.setInPlan`, `PL.setBracket`, `PL.setSemester`, `PL.setStatus`, `PL.setSeat`, `PL.setEasy`, `PL.setAttendance`, `PL.setGroup`, `PL.setVariant`, `PL.setMandatory`, `PL.setCancelled`, `PL.setOverride`, `PL.linkAlternative`, `PL.rankAlternative`, `PL.decide`, `PL.setFallbacks`, `PL.hideIssue`, `PL.setCollisionCheck`, `PL.addBlock`, `PL.editBlock`, `PL.removeBlock`, `PL.setTravel`, `PL.setWorkGoal`, `PL.setStart`, `PL.exclude`, `PL.editExam`, `PL.importText`, `PL.exportText`.

- **UI** uses no framework: each screen is a function `render(container, state)` that builds DOM with a tiny `h()` helper, plus one stylesheet per screen.

### 7.2 Files and build

```
planner/
  TUM_Modulplaner.html        built file, committed, the one users open; nightly update rewrites DATA in it
  src/
    shell.html                page skeleton (nav, containers), no data, no scripts
    css/  tokens.css base.css nav.css uebersicht.css module.css modul.css plan.css woche.css pruefungen.css sheets.css
    engine/legacy.js          today's code, verbatim
    api.js
    ui/   h.js router.js nav.js uebersicht.js module.js modul.js plan.js woche.js event-sheet.js pruefungen.js menu.js help.js
    sync.js qrcode.js         from v86
scripts/build.py              replaces embed.py: shell + css + DATA (taken from the current built file) + updater text + engine + api + ui + sync
tests/
  golden/                     export text and PL snapshots for a generated example plan (committed); the personal plan is checked locally only
  test_golden.py              export text identical to golden (ignoring the timestamp line)
  test_api.py                 PL read models and actions
  test_ui_<screen>.py         Playwright, at 390 x 844 and 1440 x 900
  test_sync.py                from v86
```

`build.py` must keep three things the updater relies on: the `const DATA=` literal, the `<script type="text/plain" id="tumuScript">` block, and the markers `/*tumterm:1*/`, `/*tumupd:1*/`, `/*tumlim:1*/`.

### 7.3 Migration path (old and new side by side)

The new surface is built screen by screen while the old one stays reachable, so the planner is usable after every task:

1. Foundation: sources extracted, `build.py`, golden test, shell with navigation. The old UI runs inside the shell as a sixth entry `Alte Ansicht`.
2. `PL` with tests.
3. Screens in this order: Übersicht, Module + Modul, Plan, Woche + event sheet, Prüfungen, Menü.
4. Phone pass and accessibility pass over all screens.
5. Removal: `Alte Ansicht`, old markup, old CSS and the old render functions are deleted; engine functions that only served rendering are removed. Golden test must still pass.

### 7.4 Testing

- **Golden master:** `exportPlan()` for `plan/Modulplan.txt` covers totals, SPO check, per-semester numbers, all warnings, limits, exams. It must stay byte-identical (except the timestamp) through the whole rework. Known reference values: 128 sure, 136 with open seats, 169 with optional; semesters 40 + 37 + 21 + 30.
- **API tests:** every `PL` action is followed by a check of the affected read model and of the stored `tum_*` key.
- **UI tests:** Playwright per screen at phone and desktop size: renders without page errors, no horizontal scroll at 390 px, key elements present, one main interaction works.
- **Sync test** keeps passing.

---

## 8. Feature map (nothing disappears silently)

| Today | New home | Change |
|---|---|---|
| Fortschritt, summary card, week ECTS badge | Übersicht progress; column headers in Plan; key figure in Woche | merged, one wording |
| Pflichtbereiche, Mastermodule meters | Übersicht > Bereiche | kept |
| Red box "Teilnehmerzahl begrenzt", header "begrenzt" | Übersicht > Offene Punkte, type Anmeldung | merged |
| Warnungen list, semester warning icons, week clash list | Offene Punkte (and the same cards filtered in Woche) | merged, short wording, full text on tap |
| Entscheidungen overlay | Offene Punkte type Entscheidung + comparison sheet | kept as sheet |
| Kollisionen switch | toggles at the bottom of Offene Punkte | moved |
| Warnung ausblenden | card menu `Ausblenden` | kept |
| Dependency graph | removed; prerequisites as lists in Modul | **removed** |
| Graph filter toolbar | filter chips in Module | kept |
| Search | global search field, results in Module | kept |
| Module panel | Modul | restructured |
| Optional, Abgeschlossen checkboxes | `Status` select | merged |
| Platz select (two of them), geplant / beworben / erhalten | `Platz` offen / erhalten | merged to two states |
| Frei checkbox | `Wenig Aufwand` switch | renamed |
| Planung: option ranks ① ② ③ | `Semester` + "Ausweichsemester" chips | simplified |
| "abgelehnt → nächste Option" | menu item in "Alternativen & Ausweichsemester" | moved |
| Either-or box, ranks | "Alternativen" in Modul | kept |
| Auf keinen Fall | `Nicht für mich` | renamed |
| Semester plan rows with five categories and legend | Plan cards with one state tag | simplified |
| "↪ Ersatz" rows | collapsed line per column | kept, collapsed |
| Week view | Woche | restructured |
| Block vorher / nachher buttons | week select | merged |
| Maximieren | not needed (the screen is the full area) | **removed** |
| Legend and hint lines above the grid | `?` popover | moved |
| Attendance popup, hover buttons | event sheet | merged |
| Erledigt as fifth attendance status | secondary action in the event sheet | moved |
| Own appointments list, travel matrix, work goal | Menü > Einstellungen; `＋ Termin` in Woche | moved |
| Draw an appointment by dragging | Woche, desktop only | kept |
| Exam view week pages | Prüfungen list; calendar toggle on desktop | list becomes default |
| Kürzel dialog | Menü > Hilfe | moved |
| Disclaimer in the header | once on first open, Hilfe, export | moved |
| Plan als Textdatei, importieren | Menü | moved |
| Moduldaten aktualisieren | Menü | moved |
| Zusatzmodul | end of the Module list | moved |
| Sync | Menü and rail status | kept |
| `computeProposal()` (unused since v40) | deleted in the removal step | **removed** |

---

## 9. Design calls (approved)

1. The dependency graph goes away (5.2). It is the largest screen element today and the hardest to use on a phone.
2. "geplant" and "beworben" become one state `Platz offen` (5.3). They already count identically.
3. Exams default to a list; the calendar grid stays as a desktop toggle (5.7).
4. Travel times, work goal and the list of own appointments move out of the week screen into Einstellungen (5.5).
5. Phone week view shows one day at a time (5.5).
6. The old UI stays reachable as `Alte Ansicht` until the last step (7.3).

## 10. Left to the implementation plan

- Exact field lists of every `PL` read model and the engine function behind each field.
- Exact engine calls behind every `PL` action.
- Task breakdown with tests, in the order of 7.3.
- Check before merging the two seat states: candidate semesters (`cand`) are only used while the status is `u`. If any behaviour differs between a missing status and `u`, `Platz offen` must write whichever keeps today's result for the golden plan.
- Hosting is settled: GitHub Pages from `main` at https://ducalemming.github.io/tum-modulplaner/ (`index.html` forwards to `planner/TUM_Modulplaner.html`). The repo is public, so nothing personal may be committed: the reference plan `plan/Modulplan.txt` is git-ignored and comes from the private repo `tum-modulplaner-data`; committed golden files must be built from a generated example plan, not from the personal one.
