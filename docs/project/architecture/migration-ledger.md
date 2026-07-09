Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Current architecture migration position, in-flight work,
area status, harness status, and close-out notes for the roadmap in
`docs/project/architecture/architecture-migration-roadmap.md`.

# Architecture Migration Ledger

## Purpose

This ledger is the single source of truth for the architecture migration state.
It records the active milestone, the current work item, area status, merge
commit state, and harness status. Chat plans and pass logs may describe work,
but they do not advance the migration unless this ledger advances too.

## State Rules

- At most one roadmap work item may be `In Flight`.
- Area rows stay `Pending` until their per-area cycle starts.
- `Merge Commit` records the commit that reaches the integration branch after
  PR merge. Local branch commits are recorded in the step log until merged.
- Harness status is `M1.1 Pending` until the parity-oracle inventory closes it.
- Data layer code is excluded from per-area migration unless a migrated area's
  slimmer boundary requires a gateway signature adaptation.

## Current Position

| Field | Value |
| --- | --- |
| Branch | `codex/architecture-migration-m0-charter` |
| Milestone | M0 - Migration Constitution and Doctrine Removal |
| Work item | M0.5 - Doctrine doc and skill removal |
| Cycle step | Milestone step; per-area cycle not active yet |
| In-flight area | None |
| Required next proof | `./gradlew checkDocumentationEnforcement --console=plain` for doctrine doc and skill removal; full proof if M0.5 touches build or production verification code |
| Last status note | `2026-07-09 M0.4 form-enforcement-removal` |

## M0 Step Ledger

| Step | Status | Local branch commit | Merge commit | Proof | Notes |
| --- | --- | --- | --- | --- | --- |
| M0.1 Charter | Done | `0ff4c2f82` | Pending PR merge | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09 | Roadmap materialized under `docs/project/architecture/`. |
| M0.2 AGENTS.md amendment | Done | `0b8aa4637` | Pending PR merge | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09 | Rule 3, R3c, source-owner routing, and migration-regime pointer updated. |
| M0.3 Migration ledger | Done on branch | Pending current commit | Pending PR merge | `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09 | This ledger becomes the state source; next work item is M0.4. |
| M0.4 Global removal of form enforcement | Done on branch | Pending current commit | Pending PR merge | `tools/gradle/run-staged-verification.sh production-handoff` passed, 2026-07-09; `./gradlew architectureTest --console=plain` passed, 2026-07-09; `./gradlew checkDocumentationEnforcement --console=plain` passed, 2026-07-09; judge review Clean | Removed form-enforcing ErrorProne/build-harness doctrine gates and retained outcome gates, including package cycles, layer dependency direction, documentation basics, and behavior-harness gates. |
| M0.5 Doctrine doc and skill removal | In Flight | Pending | Pending PR merge | Pending | Delete doctrine documents and doctrine-teaching skills after M0.4. |

## Milestone Ledger

| Milestone | Status | Merge commit | Done-when evidence |
| --- | --- | --- | --- |
| M0 - Constitution and doctrine removal | In Flight | Pending | Gates green; removed checker/doc/skill grep clean; fresh-agent behavior check. |
| M1 - Parity oracle | Pending | Pending | Ledger lists harness status for every area; parity protocol committed; hex harness verified end to end. |
| M2 - Pilot hex | Pending | Pending | Binding targets met or justified; harness green with frozen scenarios; smoke checklist delivered; reference commit declared; retro journaled. |
| M3 - Rollout wave 1 | Pending | Pending | worldplanner, creatures, party, sessionplanner, encountertable, encounter all complete their cycles. |
| M4 - Dungeon | Pending | Pending | Five dungeon sub-slices complete full cycles with dungeon harness suite and required image snapshots. |
| M5 - Remaining view surfaces and shell seam | Pending | Pending | Remaining view surfaces and shell seams complete cycles; data layer exceptions only where gateway signatures require. |
| M6 - Completion | Pending | Pending | Old role family no longer taught or enforced; final measurement and German closing report complete. |

## Area Ledger

| Area | Standard | Status | Merge commit | Harness status |
| --- | --- | --- | --- | --- |
| `hex` | Legacy surrounding code until M2 design; then pilot reference commit | Pending | Pending | M1.1 Pending; current `src/view/leftbartabs/hexmap/**` route gap is P1 in `harness-gaps.md`. |
| `worldplanner` | Legacy surrounding code until M3 design; then pilot reference | Pending | Pending | M1.1 Pending; cross-context worldplanner to encounter route gap is P1. |
| `creatures` | Legacy surrounding code until M3 design; then pilot reference | Pending | Pending | M1.1 Pending; dedicated creature harness gap is P2. |
| `party` | Legacy surrounding code until M3 design; then pilot reference | Pending | Pending | M1.1 Pending; party dropdown production-route gap is P1. |
| `sessionplanner` | Legacy surrounding code until M3 design; then pilot reference | Pending | Pending | M1.1 Pending. |
| `encountertable` | Legacy surrounding code until M3 design; then pilot reference | Pending | Pending | M1.1 Pending; dedicated encounter-table harness gap is P2. |
| `encounter` | Legacy surrounding code until M3 design; then pilot reference | Pending | Pending | M1.1 Pending; encounter state-tab production-route gap is P1. |
| `dungeon-authored-core` | Legacy surrounding code until M4.1 design; then pilot reference plus approved dungeon design | Pending | Pending | M1.1 Pending; dungeon harness suite required. |
| `dungeon-editor-session-runtime` | Legacy surrounding code until M4.2 design; then pilot reference plus approved dungeon design | Pending | Pending | M1.1 Pending; dungeon harness suite required. |
| `dungeon-travel` | Legacy surrounding code until M4.3 design; then pilot reference plus approved dungeon design | Pending | Pending | M1.1 Pending; travel state-tab route gap is P1. |
| `dungeon-rendering-pipeline` | Legacy surrounding code until M4.4 design; then pilot reference plus approved dungeon design | Pending | Pending | M1.1 Pending; M1.5 image snapshot parity required before migration. |
| `dungeon-editor-view` | Legacy surrounding code until M4.5 design; then pilot reference plus approved dungeon design | Pending | Pending | M1.1 Pending; dungeon harness suite required. |
| `remaining-view-and-shell` | Legacy surrounding code until M5 design; then pilot reference | Pending | Pending | M1.1 Pending; view render/dropdown/statetab route gaps apply where touched. |

## Owner Status Notes

### 2026-07-09 M0.1 charter

Die Migrations-Roadmap ist als aktives Architektur-Dokument im Repo
eingetragen. Es gab keine Produktionscode-Aenderung; das Dokumentationsgate
war gruen.

### 2026-07-09 M0.2 agent-guide

`AGENTS.md` routet die Migration jetzt auf die Roadmap: Outcome-Gates bleiben
bindend, alte Form-Checks werden im M0-Pfad entfernt, und R3c blockiert die
Roadmap-Migration nicht.

### 2026-07-09 M0.3 ledger-start

Der Ledger ist angelegt und setzt M0.4 als naechsten In-Flight-Schritt. Noch
ist keine Produkt-Area gestartet; alle Area-Zeilen bleiben pending bis zur
M1/M2-Zyklusarbeit.

### 2026-07-09 M0.4 form-enforcement-removal

Die alten Form-Enforcement-Gates sind aus Build-Logic, Build-Harness,
Error-Prone, architecture-policy und jQAssistant entfernt. Die behaltenen
Outcome-Gates bleiben aktiv: Package-Zyklen, Layer-Dependency-Direction,
Dokumentationsgrundregeln und Behavior-Harness-Gates sind gruen; der
unabhaengige Judge hat die Nachpruefung ohne Must-Fix geschlossen.
