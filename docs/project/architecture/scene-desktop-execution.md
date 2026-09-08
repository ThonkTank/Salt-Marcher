# Scene desktop roadmap execution

Canonical scope: [unchanged user roadmap](scene-desktop-roadmap.md).
Execution follows the explicitly requested Roadmap Executor skill. This log is
append-only for plans, audit results and corrective rounds. Phase completion
includes remote checks, exact-SHA app handoff and green promotion to main.

## Status

| Phase | Status | Evidence |
| --- | --- | --- |
| 1 — Window desktop and persistence | Complete | e254a04a2; candidate, exact-SHA handoff and main evidence below |
| 2 — Reference windows | In progress | Context refresh and concrete plan below |
| 3 — Travel and combat | Not started | Depends on completed phases 1–2 |
| 4 — Character catalog | Not started | Depends on completed phases 1–3 |
| 5 — Membership, XP, rest | Not started | Depends on completed phase 4 |
| 6 — Default and cleanup | Not started | Depends on all previous phases |

## 2026-09-08 — Initial state verification

- User supplied the canonical roadmap in the conversation and explicitly
  authorized its implementation, including candidate delivery and promotion.
- Base: `origin/main` at `20307199bdb9e236b6cb3af2934052eab03ea4a5`.
- Implementation worktree: `/home/aaron/Dokumente/ChatGPT/SaltMarcher-scene-desktop`,
  branch `codex/scene-desktop-phase-1`.
- Original checkout contains unrelated campaign-screen and E2E changes. None
  are copied, reset or staged by this work.
- No previous roadmap implementation or execution log existed at discovery.
- The interrupted preceding turn had no implementation evidence; this turn
  establishes the verified starting point and canonical execution records.

## Phase 1 — Plan before implementation

Outcome: opt-in production preview of a persistent per-scene desktop. The old
scene workspace stays default and fully usable. Only a read-only overview is
introduced as content in this phase; later feature windows are not placeholder
buttons or silently treated as implemented.

Implementation sequence:

1. Inspect installation schema/versioning, IPC operation registry, capability
   composition, installation preferences and existing scene workspace tests.
2. Add strict shared contracts for scene desktop windows, geometry, snapshots,
   and revisions-protected read/write with explicit Campaign/Scene identity.
   Add a separately revisioned installation-owned store and additive schema
   migration. Preserve closed-empty vs never-initialized distinction.
3. Add default-off preview preference through the established installation
   preferences envelope, and expose an explicitly labeled UI setting.
4. Implement renderer-only geometry/reducer/window shell. Handle drag, resize,
   preview snapping, adjacent edges, keyboard arrangement, focus, z-order,
   minimize/maximize/restore and preferred-vs-fitted geometry.
5. Connect a scoped state owner whose writes remain bound to their original
   Campaign/Scene on navigation. Save gestures on completion; restore desktop
   on restart. Load errors must not overwrite persisted data with defaults.
6. Mount the preview in the existing Session route with live read-only scene
   data and existing scene-focus command. Keep catalog navigation, old layout
   and ongoing domain state intact.
7. Add unit/integration/E2E coverage for all phase acceptance criteria. Update
   architecture/migration progress and only relevant visual/size baselines.
8. Run required checks, perform separate plan and roadmap audits, document
   correction plans before fixes, then deliver exact checked SHA via canonical
   handoff and green main promotion before starting phase 2.

Validation and acceptance:

- Contract validation rejects invalid geometry/identity and stale writes.
- Independent Campaign/Scene revisions and reopen persistence are proven using
  actual SQLite; migration preserves existing installation preferences.
- Reducer/component tests exercise focus, geometry fitting without preference
  destruction, maximize/restore, minimize/reopen, empty desktop, edge and
  adjacent snapping and keyboard alternatives.
- Real app E2E proves two-scene independence across scene/catalog navigation and
  renderer/app restart, and that old layout remains default outside preview.
- Failures, delayed writes and scene switching cannot overwrite a different
  scope or persisted desktop with a default.
- Phase stays incomplete until mandated checks, handoff and main promotion pass.

## Phase 1 — Validation and correction round 1

- Offline frozen dependency installation passed.
- Initial typecheck failed: readonly Zod object exposes no `.shape`; downstream
  store and projection types therefore lost their specific fields.
- Fix plan: share the unwrapped scope field shape before readonly wrapping,
  rerun typecheck, then continue the planned persistence and interaction tests.

## Phase 1 — Validation and correction round 2

- Typecheck passed after correction round 1.
- First targeted validation: 12 tests passed across geometry/contracts,
  asynchronous projection and real SQLite restart/conflict coverage.
- Interaction audit found gaps: pointer listeners outlive an unmounted window;
  a click without movement can save fitted instead of preferred geometry;
  keyboard changes can exceed contract bounds; neighboring-edge snapping only
  covers horizontal adjacency; scene-switch keys do not isolate gestures.
- Fix plan: cancel gestures on unmount/lost capture, commit only moved gestures,
  clamp keyboard bounds, add vertical adjacency, key windows by scene, and
  cover these behaviors with component tests before broader validation.

## Phase 1 — Validation and correction round 3

- Pointer/keyboard component tests passed (3 tests).
- Migration tests: 15 passed, one still expected schema 40 after upgrading.
  Fix plan: update that current-schema expectation and add a focused 40→41
  migration test proving preference/revision preservation. Keep historical
  fixture versions unchanged.
- Overview audit: existing full workspace controller unnecessarily starts loot
  reads; clock formatting lacks day rollover. Use the existing focused-scene
  mutation controller directly and show explicit day/time from scene seconds.

## Phase 1 — Validation and correction round 4

- Expanded validation: 104 tests passed; architecture ownership check rejected
  `scene_desktop` because its existing prefix rule assumes every `scene_*`
  table belongs to campaign Scene truth.
- Fix plan: register this exact table with its installation-owned desktop
  aggregate before the broad Scene rule. Retain ownership enforcement for all
  other Scene tables. Then run architecture, lint/typecheck and app build.

## Phase 1 — Validation and correction round 5

- Typecheck passed including new end-to-end acceptance suite.
- Targeted lint found redundant unknown/null union, a mapped pointer-handler
  ref analysis violation, and a test promise marked async unnecessarily.
- Fix plan: represent error as unknown, bind one resize event handler outside
  the render loop using an edge data attribute, and return the test promise
  explicitly. Verify lint and rerun gesture tests.

## Phase 1 — Default-layout audit correction

- The draft preview checkbox consumes a permanent row in the legacy scene
  layout. This is unnecessary for an opt-in setting and changes existing
  cockpit geometry before the user enables the preview.
- Fix plan: move the labeled preview checkbox into the existing application
  menu, pass the preference through the shell, and keep the legacy Session
  root unchanged. Update the acceptance test to use the menu setting.

## Phase 1 — Validation and correction round 6

- Real app reached the desktop, but existing v5 fixture has only one scene per
  campaign. Two-scene acceptance cannot be demonstrated with that fixture.
- Fix plan: add a dedicated v6 two-scene fixture (small campaign, one character
  and group per scene), seeded in the fixture tool before runtime launch.
  No new production scene-creation command belongs to this phase.
- Shell typecheck also caught preview props accidentally passed to PartyDropdown;
  remove that unrelated pass-through.
- Build passed; total reachable renderer graph grew 17,849 bytes, exceeding the
  16 KiB ratchet. Lazy-load the opt-in desktop so legacy users do not load its
  window code/styles, then record measured growth with explicit no-new-dependency
  and chunk rationale before updating the baseline.

## Phase 1 — Fixture correction round 7

- Fixture integration test caught a required `archived` field missing from the
  direct test group insert. Use the existing SceneStore group command to seed
  empty groups, retaining direct fixture SQL only for the second scene, for
  which phase 1 deliberately has no creation command. Rerun fixture integration
  before the next real-app attempt.

## Phase 1 — Visual correction round 8

- Fixture integration now passes (4 tests).
- Inspecting the actual Electron screenshot exposed that the desktop wrapper
  shrinks to its toolbar width inside the existing flex cockpit. This leaves
  most of the usable scene area empty outside the desktop.
- Fix plan: give the wrapper flex growth and zero minimum width, remove its
  obsolete legacy-child selector, and add E2E assertions that the desktop spans
  its work area. Verify screenshot and both-theme accessibility before delivery.

## Phase 1 — Accessibility correction round 9

- Real app passed wrapper width, keyboard position, maximize/restore,
  minimize/reopen, independent closed second scene and catalog-return checks.
- Both-theme accessibility stopped on a heading-order violation: overview
  subsections use h3 while the window title is a plain span.
- Fix plan: make the existing window title an h2 with the same compact visual
  styling. No new visible heading or extra copy. Repeat accessibility and the
  remaining restart/minimum-size acceptance.

## Phase 1 — Acceptance test strengthening

- Scene-switch assertions should observe committed scene identity, not merely a
  still-visible window from the preceding scene while focus is pending.
- Add a data scene identity to the desktop root and wait for that identity plus
  completed desktop load after every scene selection. Add a preference-hook
  test for default-off and persistence. These strengthen existing acceptance;
  no new product scope is introduced.

## Phase 1 — Validation formatting correction

- Preference persistence test passed. Broad `check:fast` stopped at formatting
  of that newly extended test file. Apply the repository formatter to the file
  and restart the required fast check; no behavioral change is needed.

## Phase 1 — E2E selector correction round 10

- Both-theme accessibility and actual Electron process restart passed, including
  restored preview preference, geometry and the closed second scene.
- Last reopening step failed because the test combined CSS and WebDriver text
  selector syntax into one invalid selector.
- Fix plan: scope the text selector through the toolbar element, then rerun the
  final complete scenario. No app behavior needs changing for this failure.

## Phase 1 — Minimum-size correction round 11

- Complete E2E reached the final minimum-size check but failed strict containment.
  Screenshot confirms the window remains visible; the stage can have fractional
  flex dimensions while clientHeight rounds up to a full pixel. The generic
  resize helper also does not wait for this new desktop's ResizeObserver.
- Fix plan: measure the stage's actual rectangle and floor display dimensions,
  and wait for desktop containment after resize. Keep preferred stored bounds
  unchanged. Rerun the scenario and retain strict containment as acceptance.

## Phase 1 — Version expectation correction round 12

- Broad validation passed format, full lint, typecheck, 91 architecture tests and
  886 unit tests. One unit test still hard-coded installation version/path 40.
- Fix plan: update the version-truth expectation to 41 and the full migration
  path, rerun that test and execute the remaining integration/artifact checks.
  Preserve historical fixtures and independently versioned Campaign schema 34.

## Phase 1 — Containment diagnostic round 13

- The rectangle measurement/wait change did not resolve strict containment; the
  earlier rounding hypothesis is not yet sufficient evidence of the cause.
- Plan: emit the actual frame/stage rectangles and computed frame dimensions in
  the failing acceptance step before making another geometry change. Keep the
  assertion intact. All 245 integration tests and artifact checks now pass;
  bundle budget and built-app smoke also pass.

## Phase 1 — Containment correction round 14

- Diagnostic evidence: stage is 654×380 but rendered frame still has y=20,
  height=420 after resize. The owner has not received a timely size update;
  this is not a fractional-pixel failure.
- Fix plan: make browser CSS constrain normal window position/size directly to
  its containing stage, using the preserved preferred rectangle. Use percentage
  layout for snapped/maximized windows. Keep JS measurements for gestures and
  add a window-resize measurement fallback with cleanup. This guarantees
  containment even before observer delivery, without persisting fitted bounds.
- Retain the actual min-size E2E assertion and diagnostic output until it passes.

## Phase 1 — Local validation and separate audits

Validation evidence:

- Format, full lint and typecheck passed before final containment changes; the
  final window/projection tests (13) and focused lint passed afterward.
- Architecture suite: 91 passing tests. Full unit suite: 886/887 passed; the
  sole obsolete version expectation was corrected and both version-truth tests
  then passed. No other unit failure remains.
- All 32 integration files passed (245 tests), including installation migration,
  persistence restart, revision conflicts, corrupt-data preservation and fixture.
- Reference catalog, generation catalog, version truth and render qualification
  artifacts passed. Production build, built Electron smoke and bundle budgets
  passed. Lazy loading leaves the legacy Session graph only 446 bytes larger;
  no dependency was added.
- Complete real Electron E2E passed (80 seconds):
  `.tmp/e2e-runs/functional-1788872388353-202757/summary.json`.
  It proves two scene arrangements, intentional closure, keyboard controls,
  maximize/restore/minimize, catalog return, both-theme accessibility, process
  restart, persisted preview preference, strict minimum-size containment and
  return to the classic layout. Diagnostic evidence shows preferred height 420
  retained while rendered height fits a 380-pixel stage.

Audit against recorded phase plan:

- Strict bridge contracts, installation-owned SQL and migration, independently
  revisioned scopes, default-off menu setting, gesture completion saves, keyboard
  alternatives, scoped projection lifetime and explicit error recovery are present.
- Actual app frame/theme are reused. Classic Session root remains unchanged.
  Domain state and top-bar actions remain on existing owners; desktop read/write
  has no travel-command reconciliation effect.
- Unit/component, real SQLite and actual Electron acceptance cover the planned
  scope. No unresolved product discrepancy remains from corrective rounds.

Audit against canonical roadmap, phase 1:

- The opt-in desktop opens a compact read-only overview for the current scene;
  launcher and taskbar preserve explicit closed/minimized state.
- Geometry, snap/maximize restoration and back-to-front ordering are modeled;
  phase 1 exposes only the overview singleton. Multiple content-window
  interactions become observable with phase 2 reference windows.
- Desktop state survives scene/catalog navigation and restart and remains
  reachable at minimum viewport size without overwriting preferred bounds.
- Later reference, map/combat and character feature changes have not been pulled
  into this phase. Original roadmap remains unchanged.

Delivery audit is still pending: final static check, clean candidate commit,
remote complete Check set, exact-SHA handoff, fast-forward and green main.
Phase 1 remains in progress until those delivery requirements pass.

## Phase 1 — Candidate base refresh

Final typecheck and formatting passed. Before creating the candidate, fetching
main found two newly promoted campaign-screen follow-ups, ending at
`d7e52a51d`. They remove unused workspace styles, ratchet the bundle baseline,
and strengthen campaign E2E readiness checks. Plan: commit the isolated phase 1
work, rebase onto this main, preserve those upstream changes, remeasure the
bundle if its baseline conflicts, and verify affected app flows before pushing
this final candidate. The unrelated original checkout remains untouched.

## Phase 1 — Rebase resolution and candidate submission

- Rebased onto `d7e52a51d`; only bundle-baseline metadata conflicted. Upstream
  workspace-style removal and all campaign readiness tests were preserved.
- Fresh build passed. Remeasured graph: shell 420394, common workspace 517090,
  classic Session 169410, reachable renderer 1559470 bytes. Recorded rationale
  explains the new lazy desktop and unchanged dependencies.
- The complete desktop E2E is already green before the base refresh; focused
  classic-workspace and desktop E2E are also being rerun on the refreshed base.
- Candidate submission starts the mandatory remote checks. Pending validation
  evidence remains in local test artifacts until candidate delivery completes;
  no phase or handoff is declared complete at submission.

## Phase 1 — Completed delivery and closing audit

- Delivered SHA: `e254a04a2bc62b3605b3ca080be772eae72aecd6`.
- [PR 664](https://github.com/ThonkTank/Salt-Marcher/pull/664).
- [Complete candidate Check, attempt 1](https://github.com/ThonkTank/Salt-Marcher/actions/runs/34229830009): all 15 required jobs including exact-SHA aggregate passed. This includes both native platforms, full unit/integration suites, all functional E2E and all visual shards.
- Refreshed-base desktop acceptance passed again locally. An additional legacy
  geometry test timed out waiting for rAF on the occluded local display; that
  unchanged test passed in the exact-SHA CI campaign-workspaces shard. The local
  combined run is preserved as failed, not relabeled green.
- Canonical `pnpm handoff:app` completed successfully without resume/bypass.
  State ID `d11231f7-9777-4142-92a2-c645b3f7be3c`; original attempt
  `4624f7eb-73b2-480a-ad24-7d97a2707dc0`.
- Downloaded and installed artifact SHA-256:
  `bb151a48fe1673f7440360fb4d63e47f85aca17283ccf3d2e545138f146d02d1`.
  Installed runtime verification passed with two quick checks and four domain
  readbacks. A SQLite-consistent campaign backup was created before activation:
  `2026-09-08T13-19-32-601Z-7cb0e0499ea0-9ede40ed`.
- `pnpm delivery:promote` fast-forwarded the same SHA to main.
- [Green main attestation](https://github.com/ThonkTank/Salt-Marcher/actions/runs/34231353324)
  verified with `readSuccessfulPostPromotionEvidence`; origin/main matches the
  delivered SHA. Phase 1 plan and canonical roadmap audits now pass including
  delivery. No outstanding phase 1 product correction remains.

## Phase 2 — Context refresh

Started from the completed phase 1 main SHA on
`codex/scene-desktop-phase-2`. Re-read the original phase 2 roadmap and inspect
existing reference target contracts, index/detail caches, navigation, link and
hover rendering, and tests before recording the implementation plan. No phase 2
implementation edits precede that plan.

## Phase 2 — Concrete implementation plan

Outcome: a compact search window, a shared reader with back/forward history,
and independently retained reference windows within each scene desktop.

1. Extend the strict desktop contract to document version 2: overview, search,
   shared reader and separate reference windows, unique IDs, bounded history
   and scroll positions. Explicitly upcast stored version 1 documents on read;
   the SQLite table shape and revision ownership remain unchanged. Validate
   campaign reference scope. Existing geometry and deliberately empty desktops
   survive. Test old documents, invalid documents and revision conflicts.
2. Extend the pure desktop reducer for search, shared navigation, deduplicated
   separate references and per-entry scroll. Reuse the existing projection's
   serialized writes; debounce text/scroll writes in its scope-owned lifetime.
3. Expose searchable candidate aliases from already compiled reference indices.
   Reuse ReferenceProvider detail caches and invalidation. Add optional desktop
   routing for reference opening and pins, preserving legacy routing otherwise.
   Capture the originating scene for asynchronous routing. Desktop pins become
   separate readers, including actions from existing hover previews.
4. Generalize window titles and stacking. Keep DOM window order stable while
   changing z-order, so raising does not disturb pointer capture or inputs.
   Search stays compact; shared reader offers back/forward and separate opening.
   Existing full reference rendering, attribution and links remain intact.
   Guard delayed detail responses and restore scroll only after content loads.
5. Verify reducers, projection writes, document upgrade, reference routing and
   stale-load behavior. Extend desktop E2E with item/location readers, separate
   opening/deduplication, history, scene switches and restart. Check both themes,
   narrow viewport and existing reference workflows. Update requirements and
   measured bundle baseline where needed; do not change unrelated domain logic.
6. Audit against this plan and original phase 2, record corrective rounds before
   fixes, then deliver a clean candidate through complete remote Check,
   canonical exact-SHA handoff, same-SHA promotion and green main.

Acceptance: item and location descriptions remain independently readable next
 to one another; maximize/restore works; history, targets and scroll survive
scene switch/restart; delayed loads cannot replace a newer selection. No new
reference backend, map/combat work or character workflows enter this phase.

## Phase 2 — Validation round 1 and correction plan

Initial renderer typecheck found incomplete union narrowing for the two window
launcher actions and an explicitly undefined optional routing prop. Split the
launcher variants and omit the prop when routing is inactive. Update current
version test inputs to document version 2 while retaining explicit version 1
upgrade coverage. Before acceptance, verify scope rejection and scroll restoration
including history revisits and deferred rendering; these remain unverified.

## Phase 2 — Focused checks and correction plan 2

All 28 tests in six focused suites passed; full typecheck passed. ESLint found
five hook/export warnings. The reader review also found that revisiting the
same target at another history index needs an independent scroll restoration
identity. Extract keyed reader content, use stable loader dependencies, and
move the shared title formatter out of the component module. Verify this with
DOM-level delayed-load and history-scroll tests. Search scroll follows persisted
query resets. Resolve pin titles from the existing index and present desktop
pin actions as separate opening. No change to legacy pin behavior.

## Phase 2 — Checkpoint before app acceptance

Build, full typecheck and 96 focused/architecture tests passed. Additional
projection debounce coverage passed (6 projection tests). A test-only ESLint
error flags nested asymmetric matchers as unsafe any; replace that assertion
with direct typed scope and search-window checks. App E2E remains in progress.
The fixture now contains actual WorldLocation records and a long description
so reference restoration is tested against productive reference resolution.

## Phase 2 — App acceptance correction round 3

The existing complete desktop E2E passed. New reader E2E failed at initial
window resizing: WebDriver Browser.getWindowForTarget is unavailable for the
Electron target. Use the repository's setElectronWindowSize helper, which
verifies both main-process and renderer geometry, then rerun reader acceptance.
No reader acceptance is claimed from this failed run. Artifact run:
`.tmp/e2e-runs/functional-1788874927203-222968/summary.json`.

## Phase 2 — Formatting correction

The repository-wide format check found one new DOM test not yet formatted.
Apply the repository formatter to that file and repeat the format gate. Full
lint and typecheck are running separately; no product adjustment is involved.

## Phase 2 — Projection conflict audit and correction round 4

Code audit found that a delayed text/scroll timer could start persistence again
after an earlier in-flight save reported a conflicting remote state. Guard
persist against an existing projection error and cancel pending timers on
failure. Keep explicit reload as the only recovery. Add a delayed conflict test
proving that pending edits cannot overwrite the newly observed remote revision.

## Phase 2 — Reader acceptance harness correction round 5

The legacy desktop flow passed again. Reader setup then hit an invalid mixed
CSS/text WebDriver selector. Replace all mixed selectors with scoped element
lookups, and make reader acceptance independently runnable by reopening the
application before its setup. Run that focused case first, then the complete
suite after it passes. Preserve failed run evidence; no assertions are removed.

## Phase 2 — Search result audit and correction round 6

Full unit suite passed (211 files, 896 tests), integrations passed (32 files,
246 tests), and the added delayed-conflict test passed. Bundle measurement
keeps all budgets with 1,567,898 reachable renderer bytes and no dependencies.
Search review found that identically named item/action/NPC results need their
existing reference-kind label to remain distinguishable. Extract and reuse the
current label formatter, show one compact kind label per result, and give the
acceptance test an explicit item result selector. Preserve the full shared
index and existing reference labels rather than creating a second taxonomy.

## Phase 2 — Resize acceptance correction round 7

Focused reader setup resized the native window to 1440×1000 (failure screenshot
confirms those dimensions), but the helper timed out waiting for the legacy
layout to acknowledge geometry. This is the previously documented occluded
legacy layout behavior. Enable the desktop before resizing, so the unchanged
geometry helper checks the surface under acceptance. Keep the requested size
and geometry verification; do not weaken or relabel the failed run.

## Phase 2 — Visual acceptance correction round 8

Reader E2E now opens the item and location, snaps them side by side, and
navigates history. Scroll assertion failed because the 30-entry fixture fits
inside the 1000px window (screenshot confirms no scroll range). Expand the
fixture to 100 entries and assert that scrollable range exists before scrolling.

Screenshot review also found arrangement menus staying open after selection
and a previously requested taskbar focus arriving late via requestAnimationFrame,
raising search after opening the reader. Close arrangement menus on selection,
blur and Escape. Replace deferred taskbar/launcher focus with a commit-time
layout effect scoped to the scene, so a delayed frame cannot steal later focus.
Minimize search before checking the side-by-side reading arrangement. Preserve
all content/history/scroll assertions and rerun focused then full acceptance.

## Phase 2 — Reference invalidation audit and correction round 9

A loaded campaign document can be renamed through the existing catalog while
its reader remains saved. The reader currently reuses refreshed content but
keeps its old window title. Update only the matching active reference entry's
title from the loaded document, with target/index guards like scroll updates.
This also replaces generic pin fallback titles once resolution succeeds.
Verify late responses still cannot rename another selection and rerun reader
unit coverage. Geometry and reading position must remain untouched.

## Phase 2 — Title reducer correction

Typecheck caught the title update branch nested inside the query/scroll branch,
where its discriminant is impossible. Move that branch to reducer top level
before query/history/scroll handling. Add title-update assertions for matching
and stale targets, then repeat types and reference/window unit coverage.

## Phase 2 — Reader acceptance final selector correction round 10

The focused app run passed side-by-side documents, history scroll restoration,
both-theme accessibility, scene switching and actual restart restoration. Its
last deduplication action could not locate exact taskbar text "Nachschlagen"
because minimized buttons intentionally prefix the title. Match the title
within that button text and reacquire the search element after process restart.
Rerun the complete suite with the final title/focus code; this run remains failed
until the final deduplication assertion is also green.

## Phase 2 — Bundle boundary correction round 11

The final bundle gate found the reference-ui source entry had become an
anonymous shared chunk after the desktop imported it synchronously. Preserve
the existing lazy reference rendering boundary rather than relaxing the gate.
Use LazyReferenceDocument again and add an explicit content-ready callback so
scroll restoration occurs after the lazy body commits, never on its loading
placeholder. Repeat delayed-load/scroll tests, build, measured budget and app
acceptance. The failed measurement did not overwrite the recorded baseline.

## Phase 2 — Full acceptance warning correction round 12

Both complete app cases passed, including final separate-reader deduplication.
The canonical wrapper still rejects the run for two stale-element warnings.
A reader handle retained across scene unmount/remount is used in the return
assertion. Reacquire the reader's document from the current DOM instead of that
old parent handle. Keep warning enforcement unchanged and rerun the entire
suite with the restored lazy boundary. Lazy document/legacy reference tests
passed (8 tests). Previous app run is not recorded as green because its wrapper
failed: `.tmp/e2e-runs/functional-1788875719222-236995/summary.json`.

## Phase 2 — Lazy boundary validation

The restored source entry passes measured bundle gates: reachable renderer
1,569,535 bytes, shell 420,394, common workspace 518,918 and reference graph
39,763. Full typecheck passes. ESLint requests destructuring the content-ready
callback before the hook; apply that dependency-only cleanup and rerun lint.
No callback timing or content behavior changes in this cleanup.

## Phase 2 — Window bar stability audit and correction round 13

The window bodies keep stable DOM order, but the window bar still maps the
back-to-front array directly, causing buttons to move whenever a window is
raised. Render taskbar entries in stable identity order as well. Add acceptance
coverage comparing bar order before and after raising an existing separate
reader. This preserves geometry and saved stacking while preventing another
orientation shift during ordinary window switching.

## Phase 2 — Separate implementation-plan audit

- Version 2 documents include search, shared history, fixed separate targets
  and guarded per-entry scroll. Version 1 upgrade retains revision and geometry;
  strict scope validation rejects foreign campaign targets.
- Shared compiled aliases and ReferenceProvider caches resolve search results,
  full documents, inline links and hover previews. Desktop routing captures
  the originating scene before asynchronous projection loading; legacy routing
  remains available outside the preview.
- Separate targets deduplicate and restore their saved window; shared reader
  back/forward preserves per-entry scroll and trims abandoned forward history.
  Late loads and stale title/scroll events cannot replace another selection.
- Window bodies and bar retain stable identity order; stored array controls
  stacking only. Focus commits with the requested scene, and arrangement menus
  close after use. Saved scroll applies only after lazy content commits.
- Serialized writes coalesce frequent edits in the scope-owned projection and
  stop after conflicts. Closing a view cannot cancel its pending scoped write.
- Tests cover upgrade/revision ownership, conflict recovery, delayed rendering,
  navigation, target deduplication, title changes and existing reference routes.
  Source attribution and full document bodies remain available.

No unresolved implementation-plan discrepancy remains. Final taskbar-order
app assertion and delivery evidence are still pending; phase status stays open.

## Phase 2 — Separate canonical-roadmap audit

Phase 2's item/location side-by-side workflow, maximize/restore, independent
scene state, restart, history and scroll were exercised in the green full app
run `.tmp/e2e-runs/functional-1788875901838-240356/summary.json`. Both themes and
small desktop geometry pass. A final run includes stable taskbar order added
by the closing audit. Search and document windows use existing domain truth;
no map, combat, character or XP/rest phase has been pulled forward. Preview is
still opt-in and the original roadmap remains unchanged.

Validation to date: full unit suite 896 passed; full integration suite 246
passed; final affected suites 30 passed (plus 8 lazy-render/reference tests);
architecture required set 91 passed; full typecheck and lint passed before the
final dependency-only hook cleanup, whose targeted lint also passes. Reference,
version truth and generated artifacts pass. Final measured reachable renderer
is 1,569,581 bytes (shell unchanged at 420,394), with all budgets passing.
Canonical candidate checks, exact-SHA handoff and green main are required before
this phase can close.

## Phase 2 — Final local acceptance and candidate submission

The final complete sceneDesktop suite passes without warning regressions:
`.tmp/e2e-runs/functional-1788876070885-242855/summary.json` (two cases,
about 92 seconds including runner). This includes stable taskbar order while
raising a deduplicated reader, all restart/history/scroll assertions, both
 themes and minimum geometry. Built application smoke test exits 0. Full format,
typecheck, measured bundle gate and the final affected lint checks pass.
Implementation-plan and canonical phase 2 product audits pass with no remaining
functional discrepancy. Origin/main is still the completed phase 1 SHA.

Submit this isolated candidate for the complete required remote jobs, canonical
handoff and same-SHA main promotion. Delivery is not yet complete, and phase 2
remains in progress until that evidence is verified.
