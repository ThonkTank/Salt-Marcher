# Scene desktop roadmap execution

Canonical scope: [unchanged user roadmap](scene-desktop-roadmap.md).
Execution follows the explicitly requested Roadmap Executor skill. This log is
append-only for plans, audit results and corrective rounds. Phase completion
includes remote checks, exact-SHA app handoff and green promotion to main.

## Status

| Phase | Status | Evidence |
| --- | --- | --- |
| 1 — Window desktop and persistence | Complete | e254a04a2; candidate, exact-SHA handoff and main evidence below |
| 2 — Reference windows | Complete | 8cb1fbe7b; candidate, canonical handoff and main evidence below |
| 3 — Travel and combat | Complete | a8f679e2e; candidate, canonical handoff and main evidence below |
| 4 — Character catalog | Complete | 63b427900; candidate, canonical handoff and main evidence below |
| 5 — Membership, XP, rest | In progress | Plan below; 5A precedes 5B and 5C |
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

## Phase 2 — Candidate CI failure and correction round 14

Candidate `715ff9613f1ad0241c018b6c327c2ab6d9996042`, PR 665, Check
[34235903687](https://github.com/ThonkTank/Salt-Marcher/actions/runs/34235903687)
passed portable/static/unit/integration, all native jobs, packaging, all visual
shards and the other E2E shards. Campaign-workspaces failed at the new reader
case's requested 1440px outer width; exact-SHA aggregate consequently failed.
No handoff or promotion was attempted.

Downloaded failure evidence shows a correctly rendered desktop at 1280×1000:
the CI Xvfb screen constrains width to 1280. The unchanged geometry helper
correctly rejects a request for 1440. Change this acceptance viewport to
1200×900, which fits that screen and exercises a narrower reading workspace.
Retain all geometry checks, side-by-side, scroll, history, restart and
window-deduplication assertions. Run the full desktop suite locally, format
and typecheck, then submit a new candidate commit for the entire required
remote Check set. App source and app-build fingerprint remain unchanged.

## Phase 2 — CI viewport correction validated

The complete desktop suite passes at 1200×900 without warning regressions:
`.tmp/e2e-runs/functional-1788877142318-250925/summary.json` (two cases,
about 91 seconds). Typecheck, full formatting and targeted E2E lint pass.
Both phase audits pass again for this test-only correction; remote qualification
and canonical delivery remain outstanding. Submit the corrected candidate SHA
for the entire required Check workflow, preserving the failed prior evidence.


## Phase 2 — Completed delivery and closing audit

- Delivered SHA: `8cb1fbe7b12bff005e5e9dc423761c3c853cb2ba`,
  [PR 665](https://github.com/ThonkTank/Salt-Marcher/pull/665).
- [Complete candidate Check](https://github.com/ThonkTank/Salt-Marcher/actions/runs/34237684246),
  attempt 1: all 15 required jobs including exact-SHA aggregate passed. The
  corrected desktop suite passed on the CI display; previous failed candidate
  evidence remains recorded above.
- `pnpm handoff:app` completed without resume/bypass. State ID
  `06626fc6-3246-40b6-b22e-0b9cac92c5d0`; original/active attempt
  `ae4c9ae5-a841-483f-add9-2408b35abc02`.
- Downloaded and installed artifact SHA-256:
  `ecd2955ef8c24cae39c1502f8e995443c408b80b751cac365676971882a91bad`.
  Installed runtime passed two quick checks and four domain readbacks.
- SQLite-consistent backup:
  `2026-09-08T14-34-44-535Z-468573e429a1-a8186cf7`, manifest SHA-256
  `ed4f6af527a242688a0e7d1df1371d029ad42d281cc74ccf5958eb2b2e0b2196`.
- `pnpm delivery:promote` fast-forwarded the same SHA to main.
  [Main attestation](https://github.com/ThonkTank/Salt-Marcher/actions/runs/34239238120)
  is green and verified with `readSuccessfulPostPromotionEvidence`, manifest
  version 4. Origin/main matches the delivered SHA.
- Phase 2 implementation-plan and canonical-roadmap audits pass including
  delivery. No outstanding phase 2 discrepancy remains.

## Phase 3 — Context refresh

Started from completed phase 2 main on `codex/scene-desktop-phase-3`.
Inspect the existing map/travel and combat surfaces, session runtime ownership,
scene/group/time/location/loot actions and their requirements before recording
 the concrete implementation plan. No phase 3 implementation edits precede it.


## Phase 3 — Concrete implementation plan

Outcome: productive map/travel and encounter windows in the opt-in desktop,
using existing domain services and controls. No character/XP/rest redesign yet.

Repository findings: Utility TravelBoundaryScheduler already owns travel time;
canvas mounting does not own the scheduler. Travel view/controller currently
lives in SessionSurface, resets presentation on scope changes and holds camera
memory only inside Pixi. Combat auto-follow currently replaces the reference
reader on turn changes and must be disabled for desktop only. Scene/group/loot
commands and dialogs already exist; no separate manual clock-edit command exists.
Time remains accessible through the existing travel and rest controls.

Implementation sequence:

1. Extend strict desktop documents to version 3 with map, combat and loot
   singleton windows and independent per-scene map presentation (selected map,
   hex and bounded per-map camera memory). Upgrade versions 1 and 2 explicitly,
   preserving every existing document and preferred geometry. Retain presentation
   after window close; never persist domain snapshots in desktop storage.
2. Compose desktop session controllers above individual windows. Reuse existing
   encounter, travel and loot components, with compact overview/group actions and
   explicit location editing. Keep the Party popup available. Disable automatic
   monster reference following in desktop; explicit inspection still opens the
   shared reader. Route the top-bar travel action to the desktop map explicitly.
3. Restore map camera and selection across close, scene switch and restart.
   Pause rendering when fully occluded or hidden, resume with current data and
   no camera reset. Window lifecycle must neither abort nor start domain commands.
   Keep per-scene encounter preparation selection while switching windows.
4. Add aggregate-owned, transactional domain guards: travelling blocks entry
   into initiative/combat; initiative/combat block travel start/resume in that
   scene. Paused travel and resolution may coexist; inspection/planning remain
   possible. Reject conflicts with a typed capability error and useful localized
   feedback. Other scenes remain independent. Verify restart handling against
   existing requirements; do not introduce a second scheduler or lifecycle.
5. Extend meaningful fixtures and acceptance tests; update requirements,
   migration progress and measured bundle budgets where necessary.

Validation: contract/reducer upgrade and scope tests; map presentation and
render scheduling tests; integration tests for both activity-conflict directions,
no partial writes and scene independence; targeted desktop E2E for map, reference
and combat coexistence, close/minimize/reopen, scene changes and camera retention.
Run required local checks, then audit implementation against this plan and
separately against original phase 3. Record corrective plans before corrections.
Finally clean candidate commit/push, full exact-SHA remote Check, canonical
handoff, same-SHA promotion and green-main attestation.

Acceptance: map inspection during combat does not dismiss descriptions; closing
or minimizing map/combat changes no domain runtime; reopening restores current
runtime and presentation. Existing scene/location/group/loot/time actions remain
reachable. No automatic document replacement on turn change, no offscreen drawing,
no cross-scene state leakage, no simultaneous travel execution and combat in one
scene. Legacy layout and Party access remain functional.

### Phase 3 — Compile correction round 1

Initial typecheck identifies readonly encounter selection crossing a mutable DTO,
optional camera passed explicitly undefined, an insufficiently discriminated
launcher action union, and fixtures still supplying version 2 as current writes.
Correct those boundaries, keep legacy versions only in upgrade fixtures, and rerun
typecheck. Preserve map-choice priority for legacy integration while allowing the
desktop's saved selection to take precedence. These are implementation corrections;
phase audit and behavioral validation remain outstanding.

### Phase 3 — Validation correction round 2

Targeted checks: 51 passed, one legacy-upgrade fixture failed because spreading
current initial state accidentally inserted version-3 fields into a purported
version-1 document. Keep that fixture historically accurate (windows only) and
repeat it. The strict reader correctly rejected the malformed old document.
Typecheck now passes. Add direct tests for presentation retention, union occlusion,
paused render scheduling and transactional activity conflicts before the phase audit.

### Phase 3 — Validation correction round 3

The E2E runner could not start because the new fixture directory was not yet
materialized in source. Add its versioned descriptor and matching parser branch,
retaining the prior descriptor. Lint also rejects a render-time ref update and
synchronous canvas error-state propagation in the visibility effect. Move the
presentation ref update into layout synchronization and use the canvas's existing
guarded microtask pattern for redraw; explicitly declare camera/effect dependencies.
Rerun lint/typecheck, rebuild, and repeat the complete desktop suite.

### Phase 3 — Validation correction round 4

The initial UI run exposed insufficient contrast on the overview's new location
button (4.4:1). It also emitted stale-element warnings after overview remounting.
Stop that obsolete-build run; synchronize rebuild completion before repeating it.
Use the primary text token on the location control and inspect scene/mount identity
for the warning source. Full regression tests are still running and will be audited
before additional fixes. No failed/obsolete UI run counts as acceptance evidence.

### Phase 3 — Product-truth audit and corrective plan 5

Full regression: 1,149 passed; 18 failures share one cause. Existing qualified
current-format fixtures intentionally combine initiative preparation with travel.
The original roadmap prohibits simultaneous *execution* of travel and combat; it
does not prohibit preparing an encounter. The phase plan's additional initiative
restriction was therefore too broad relative to product truth. Correct the plan:
allow encounter selection/initiative preparation during travel, just as route
planning remains available during combat. Only entering the actual combat phase
requires paused/stopped travel; only the actual combat phase blocks start/resume.
Keep all existing Golden-Master fixtures and semantic hashes unchanged. Adapt the
new tests to prove rejected initiative confirmation and unchanged runtime, then
rerun the 18 qualification failures and domain tests. No additional product scope.

Also keep the desktop's scene selector mounted across scene changes. Scope dialog
state within its controller instead of keying/remounting the entire desktop;
window contents retain their existing scene-specific keys. This prevents stale
selector handles and still closes obsolete transient dialogs safely.

### Phase 3 — Pre-delivery audit correction round 6

Inspection found that persisted encounter selection can retain an ID after its
scene group is archived/deleted. Filter the selection supplied to evaluation and
commands by current active groups, preserving stored presentation until phase 6's
orphan cleanup. Otherwise a hidden obsolete checkbox could prevent preparation.
Keep current groups selectable and do not silently modify any domain data.

Evidence so far: corrected qualification/domain tests 33/33; lifecycle tests 18/18;
architecture plus desktop/travel targeted tests 95/95. The full desktop suite
passed all three initial cases with zero stale-element warnings, including both
themes and restart. Additional closed-window travel acceptance is running.

### Phase 3 — Travel acceptance correction round 7

Three desktop cases pass again. The added travel case selected 11 hexes east of
its current position, incorrectly assuming the source was Hafen at q=0. The
retained scene is Wald at q=2, so q=13 is correctly unauthored and start remains
disabled (failure screenshot confirms the map's empty-hex selection). Select eight
steps, valid from either populated fixture scene. Strengthen the case to compare
committed location before/after the closed-window interval and restore the exact
selected-hex announcement after restart. No production route behavior changes.

### Phase 3 — Legacy runtime audit correction round 8

New-command guards alone leave an already persisted legacy combination of actual
Combat plus travelling able to advance on a scheduler tick. Add an aggregate-owned
check before any travel advancement: pause that conflicting journey without moving
its last committed hex or changing scene time. Do not pause Initiative preparation
(the existing qualification fixture) or any other scene. Add an integration case
that seeds only this legacy impossible-under-new-commands combination and proves
the first tick reconciles it without movement. Keep scheduler ownership unchanged.

### Phase 3 — Transport concurrency correction round 9

The travel test now proves movement while the window is closed, but Pause raced a
Utility boundary tick and returned a legitimate stale-revision rejection. The
screenshot shows the stale message and continued movement. Improve this existing
transport race within the reused controller: only a definitely rejected `pause`
may refresh current provider state and retry once against the latest travelling
revision, in the same still-current scene scope. If already paused, accept that
readback; if completed/aborted/changed scope, do not issue another write. Never
retry start/resume or any outcome_unknown/transport failure. Keep domain CAS guards
intact. Add async tests for tick-stale recovery, unknown-outcome non-replay and
scope cancellation; repeat the closed-window travel acceptance.

## Phase 3 — Implementation-plan audit

- Version-3 strict desktop documents, explicit v1/v2 upgrades and independently
  retained map camera/hex plus encounter selection are implemented. Storage remains
  installation-owned and CAS-revisioned; no domain snapshot is duplicated.
- Existing map/travel, encounter, group, loot and personal-ledger controls are
  integrated. Overview remains compact, travel controls expand on demand, the
  toolbar travel action explicitly opens them, and Party/rest remain available.
- Controllers outlive windows, the Utility scheduler remains sole clock owner,
  full union occlusion pauses map drawing, and reopening restores presentation.
  Scope-bound dialogs close on scene change; scene selector stays mounted.
- Desktop combat auto-follow is disabled; explicit inspection still routes to
  the shared reference reader. Invalid archived/deleted group selections cannot
  block current preparation.
- Actual Combat versus travelling guards are atomic and scene-local. The plan's
  overbroad Initiative restriction was corrected against product truth in round 5.
  Legacy conflicting execution is paused before movement. Definite stale Pause
  recovery is bounded to one current-scope retry and excludes unknown outcomes.
- Requirements and migration progress are updated. No SQL schema change or bundle
  budget increase is needed. Character, XP and rest semantics remain for phases 4–5.

Local evidence: full unit/integration run initially 1,149 passed and 18 failures
from the overbroad Initiative restriction; all those failures passed unchanged
qualification oracles after correction (33/33 focused qualification/domain cases).
Latest runtime/domain/architecture checks pass 113/113, including stale Pause,
unknown-outcome non-replay, scope cancellation, legacy reconciliation and combat
regressions. Earlier desktop/projection/lifecycle checks also passed. Lint,
typecheck, formatting, version truth, build, smoke and bundle checks pass on their
recorded runs. Final four-case desktop E2E and remote delivery remain outstanding;
this phase is not closed.

## Phase 3 — Original-roadmap audit

Every phase-3 implementation bullet has a corresponding production path and
focused tests: shared map/reise window; encounter window; independent runtime;
preserved map/zoom/selection and suspended hidden drawing; per-scene execution
exclusion; accessible existing scene/time/location/group/loot actions. Phases 1–2
remain covered by the desktop suite. The preview remains opt-in and the old Party
entry point remains available, as required by this milestone. No phase 4–6 work
has been substituted for phase 3. Final combined UI acceptance and the canonical
exact-SHA delivery gates are still required before the closing audit can pass.

### Phase 3 — Final local acceptance

The complete four-case desktop suite passes, 1m40.7s, with zero warning regressions:
`.tmp/e2e-runs/functional-1788880821514-285660/summary.json`. It covers phase 1/2
behavior, both themes, independent reader/combat/map windows, camera retention,
scene isolation, actual movement with the map closed, explicit Pause and paused
restart with the selected hex restored. Calibrate its CI estimate to 105 seconds.
Final runtime checks are 113/113; build/smoke/bundle checks pass. Reachable renderer
is 1,577,721 bytes against 3,019,898; existing limits remain unchanged. Both the
implementation-plan and original-roadmap local audits pass with no remaining
local discrepancy. Exact-SHA candidate checks, handoff and green-main promotion
are the remaining phase-3 gates.


## Phase 3 — Completed delivery and closing audits

- Delivered SHA: `a8f679e2e9de7a334d18bb578c2b8adb4c74c0af`,
  [PR 666](https://github.com/ThonkTank/Salt-Marcher/pull/666).
- [Candidate Check](https://github.com/ThonkTank/Salt-Marcher/actions/runs/34244432318),
  attempt 1: all 15 required jobs including exact-SHA aggregate passed.
- `pnpm handoff:app` completed without resume or bypass. State ID
  `aa81627e-6cc6-4488-b943-53d83d009413`; original/active attempt
  `a31da4fd-f8d7-4ca4-ac3f-a091e7a6bfd4`.
- Downloaded and installed AppImage SHA-256:
  `069503f8bb739bf35f3555a23ee8237a644aad03f0bd5a20a27f8aa60566fe3c`.
  Installed runtime passed two quick checks and four domain readbacks.
- SQLite-consistent backup:
  `2026-09-08T15-38-12-991Z-bd8f9415e76a-834af1ae`, manifest SHA-256
  `09a286e5d456df906eee83cbf4b1410015f1e8702aef4522271f2c854899a502`.
- Deployment fingerprint:
  `caac77c829cd68fde2a2c6a06cd4108412059480e7189b8319a7e2906afee361`.
- `pnpm delivery:promote` fast-forwarded the same SHA to main.
  [Main Check](https://github.com/ThonkTank/Salt-Marcher/actions/runs/34246102450)
  passed and `readSuccessfulPostPromotionEvidence` verified its manifest-version-4
  attestation for the delivered SHA.
- Implementation-plan and original-roadmap closing audits both pass. No phase 3
  requirement or delivery gate remains outstanding.

## Phase 4 — Context refresh

Started on `codex/scene-desktop-phase-4` from the completed phase 3 SHA. Inspect
character contracts, existing complete Party CRUD/loot controls, catalog tab
composition and scene quick-info requirements before recording the concrete plan.
No phase 4 implementation edit precedes its plan.

## Phase 4 — Concrete implementation plan

Outcome: a full campaign Character catalog and an independent compact scene
quick-info window, using existing Party/loot capabilities and authored nullable
facts. No membership/XP/rest redesign or legacy-popup removal in this phase.

Repository findings: Party contracts and persistence already support all required
fields, name-only UI drafts, stable roster IDs, inactive creation and personal loot.
The root CampaignWorkspaceProjection already refreshes session data on domain
notices across all workspaces. Catalog currently has local section selection and
no character deep link. Desktop version 3 has no character window. Party update
and delete currently reconcile only the focused combat and are not atomic across
the affected scene; this must be corrected for campaign-wide CRUD.

Implementation sequence:

1. Add renderer-only per-campaign catalog navigation (section and selected PC)
   in the workspace owner. Add `Katalog → Charaktere` with searchable stable roster
   rows (name/player primary, ID disambiguation, level and inactive/scene status),
   a selected detail pane, create/edit and explicit delete confirmation in that
   pane, plus existing personal-ledger access. A scene quick-info link selects the
   correct catalog character; returning to Session preserves the desktop.
2. Implement a compact, labeled character form using the existing strict draft
   schema and public Party adapter. Only name is required; empty optional inputs
   become null, languages retain authored order and case-insensitive uniqueness.
   Report field/mutation failures inline, keep drafts on failure, prevent duplicate
   submissions, and do not replay unknown outcomes. Use current snapshots and
   guard draft base profiles against conflicting edits; runtime-only revisions
   must not silently overwrite another character profile.
3. Make Party update/delete transactional and reconcile the actually assigned
   scene's combat through aggregate APIs. Preserve existing initiative values,
   active turn and player runtime while refreshing names/removing deleted PCs.
   Inactive edits never activate or assign characters. Historical loot ownership
   remains under the existing loot persistence behavior; no resource tracking.
4. Add a `characters` desktop singleton with persisted language/passive-comparison
   controls. Document version 4 explicitly upgrades v1/v2/v3 while retaining all
   prior windows and map presentation. Show only current scene PCs in stable
   scene-membership order: name/player/level, current and next-threshold XP,
   three fixed passive columns, written languages, personal loot and catalog link.
   Highlight matches without filtering or reordering rows; missing facts show —.
5. Add a versioned 18-character fixture with two scenes, inactive/incomplete PCs
   and namesakes. Verify CRUD, null clearing, invalid saves, explicit deletion,
   personal loot, scene isolation, comparison order and catalog return/restart.
   Update requirements and migration progress without rewriting the roadmap.

Validation: draft/projection/highlighting and version-upgrade unit tests; mutation
concurrency/scope tests; integration tests for inactive CRUD and nonfocused-scene
combat reconciliation with preserved initiative/turn; targeted E2E for library and
quickinfos, both themes and a small workspace. Run applicable existing Party,
Catalog, desktop, architecture, type/lint/format/build/smoke/bundle checks. Audit
separately against this plan and original phase 4, recording fixes before edits.
Complete clean candidate push, all exact-SHA remote checks, canonical app handoff,
same-SHA main promotion and green-main evidence before phase 5.

Acceptance: inactive name-only creation and complete nullable profile editing work
without participation changes. Namesakes remain distinguishable and independently
editable. Only present PCs appear in quickinfos; comparisons preserve row order.
XP/next threshold are visible without changing existing XP/rest rules. Catalog
navigation returns to the same scene workspace and open reference documents.
No unrelated catalog or legacy Party workflow regresses.

### Phase 4 — Validation correction 1

The first focused run passed 22 cases and failed the new invalid-form case:
inline error text nested inside a label changed the input's accessible name.
Keep labels stable with an explicit accessible name; retain the error description
association. Re-run the form cases and continue the planned integration/fixture
coverage. This corrects actual orientation/accessibility, not the test oracle.

### Phase 4 — Validation correction 2

The new nonfocused-scene integration case exposed an existing deletion failure:
combat persistence resolves Party foreign references while loading, so deleting a
PC before reconciling makes the combat unreadable. Combat sources also retain PCs
after initiative and during resolution. Correct deletion by asking every scene's
combat aggregate to remove the character before deleting its Party record, within
the same transaction. Preserve surviving cards/turn; clear undo history only in
affected combats so undo cannot resurrect a deleted character reference. Cover
rollback, successful deletion and nonfocused combat reads. No historical loot rows
are changed. Type validation also requires explicit optional navigation undefined
handling at the existing optional surface seam.

### Phase 4 — Validation correction 3

Architecture regression checks passed 101 cases and found two boundary violations:
a runtime schema import in the renderer and static UI copy outside typed messages.
Keep authoritative strict Zod validation at IPC, use lightweight form validation
for immediate field feedback, and move all new copy into the existing workspace
message catalog. Preserve test assertions and bundle boundaries. Remove the unused
comparison export and correct the E2E accessibility helper call signature before
running the built acceptance suite.

### Phase 4 — Validation correction 4

The copy and renderer boundaries now pass. Two new concurrency tests failed before
rendering because their capability fixture omitted the existing global session
subscription. Supply that fixture dependency and rerun; production behavior and
assertions stay unchanged. The built desktop acceptance run is now in progress.

### Phase 4 — Bundle review and adjustment plan

The measured reachable renderer is 1,594,925 bytes, 25,344 above the phase-2
baseline and below the unchanged 3,019,898-byte hard limit. This crosses the
16-KiB review threshold after phase-3 play windows plus the new lazy character
catalog, profile form and quickinfo UI. No dependency was added. Shell increased
26 bytes, common workspace 2,766, catalog 809 and session 1,507 against that
baseline; the catalog/form remains a dynamic leaf and the existing reference and
Pixi boundaries remain intact. Record these reviewed measurements as the next
baseline, without increasing any hard budget or growth allowance, then recheck.

### Phase 4 — Built acceptance correction 5

The four previous desktop E2E cases still pass. The new case reaches name-only
creation but the new detail does not appear: Party commands return a Party
snapshot without emitting the runtime session notice assumed by the initial
plan. Publish the successful returned aggregate into the campaign-scoped workspace
projection, then refresh the full session for scene/combat reconciliation; never
replay the mutation. Also constrain the character catalog to the actual work-area
height so its roster scrolls internally rather than extending the entire page.
Re-run built acceptance and add mutation-publication coverage.

### Phase 4 — Phase-plan audit

The catalog implements stable campaign rows, primary identity search, namesake
suffixes, full nullable profile CRUD and explicit permanent deletion. Personal
loot reuses its existing ledger. Root per-campaign navigation carries deep links
and retains selection when returning from Session. Lightweight field feedback
plus authoritative IPC validation replace the initial direct-schema rendering
plan as documented in correction 3. Concurrency cases prove profile conflict
protection, duplicate-save prevention, publication of confirmed results and late
completion suppression after unmount.

The independent Character window uses current scene membership order, all three
fixed passives, written languages, XP/next threshold, and comparison highlighting
without sorting. Version 4 explicitly retains v1/v2/v3 presentation state. Domain
CRUD targets assigned/nonfocused combats transactionally; tests cover rename,
initiative/active-turn preservation, failed deletion rollback and successful
reference removal. No XP/rest/membership semantics were changed.

The 18-PC v8 fixture contains two scenes, inactive/incomplete characters and three
namesakes. The full five-case built E2E run passed, including existing desktop,
reference, map/combat/travel lifecycle, new CRUD/loot/scene isolation, comparisons,
null clearing, invalid creation, delete confirmation, empty search, both themes
and restart. Summary:
`.tmp/e2e-runs/functional-1788883735998-311714/summary.json`, 5 passing in 1m49.4s.
Focused library concurrency/form/presentation tests pass 7/7; focused combined
architecture/domain cases passed 31/31 before the additional publication case.
Existing domain/desktop regression cases passed; the two initial architecture
failures were corrected and separately revalidated. Full lint, typecheck,
formatting, version truth, built smoke and reviewed bundle budgets pass on their
recorded inputs. No phase-plan discrepancy remains; final checks and delivery
still required before closing the phase.

### Phase 4 — Original roadmap audit

All six phase-4 implementation bullets and its acceptance paragraph are met:
full Character catalog, nullable/inactive records and personal loot, independent
scene quickinfos, stable language/passive comparisons, XP/next threshold/catalog
access, unchanged XP/rest rules. Existing desktop state survives catalog returns.
Phase 5 membership, XP/burden and selected-rest work and phase 6 legacy removal
remain explicitly pending. The roadmap itself is unchanged.

### Phase 4 — Candidate correction 6

Candidate `af7e92da83cf3ea01002fd0caae18d3d2bd63e6a` (PR 667,
Check 34249690905) failed portable lint: the final added publication test used an
async stub without await. Earlier full lint preceded that added test. Replace the
stub with Promise.resolve, rerun lint on the exact changed test and its seven
cases, and push a new candidate SHA. The application implementation is unchanged;
the failed SHA is not eligible for handoff or promotion. The new SHA must still
pass the complete remote set and canonical handoff.

### Phase 4 — Candidate correction 7

Corrected candidate `67655becd8267e13d308ed1ca58a8e0a7fdf20b8`, Check
34250219664, passed portable/static/app, native platforms, packaged harness and
most completed visual suites. The campaign visual suite fails before any image
comparison: its walking scenario opens Catalog after previously selecting Places,
then assumes Catalog always resets to Monsters. The approved phase plan explicitly
retains catalog navigation. Update that scenario to select Monsters explicitly
before searching; preserve all assertions and golden images. Run the campaign
combat scenario locally, then push a new exact candidate. Failure-artifact upload
also received an intermediary 403, but the completed job log identifies the
selector assumption without ambiguity. No production or golden changes planned.

### Phase 4 — Acceptance timing correction 8

The explicit Monsters selection reaches the next acceptance gate. Axe reported
mixed light foreground/dark background on a transparent filter-reset button.
Source inspection shows that button already uses the theme-aware text token;
Theme updates the root data-theme attribute in a React effect, while the shared
accessibility helper starts Axe immediately after dispatching the toggle. Correct
the helper to wait for the requested root theme before scanning and to wait for
the original theme when restoring. Re-run campaign combat before considering any
CSS change. No contrast threshold, assertion or golden image is relaxed.

### Phase 4 — Layout/contrast correction 9

Waiting for the theme alone did not resolve the filter-reset contrast failure;
retain the stronger timing guarantee but reject that as the root-cause diagnosis.
Add computed-color/token/ancestor diagnostics to accessibility failures to identify
the actual cascade before editing colors. The completed hex/NPC CI shard also
found a real 5.6px horizontal overflow at 720px: the sixth Catalog section prevents
the header from shrinking. Allow section buttons to wrap, then rerun the NPC
small-viewport scenario and campaign combat. Preserve all accessibility and
geometry assertions and all golden images.

### Phase 4 — Contrast correction 10

Computed diagnostics confirm an actual stale foreground: the reset button is
rgb(74,53,32) while its own --text-2 token is already the correct dark #d6c49c;
all ancestors and root are dark. Add an explicit dark-theme selector for the
shared reset control so a theme change resolves its foreground under that
selector. Keep semantic tokens and existing contrast thresholds. Remove the
temporary control-specific diagnostics; retain the helper's theme-settlement
checks. Rebuild and rerun campaign combat/NPC acceptance.

### Phase 4 — Resize acceptance correction 11

The NPC screenshot after resizing back to 1280×800 shows the correct contained
layout. The resize helper captures content bounds once, immediately when outer
bounds match, then compares the renderer against that frozen value even while
Electron content bounds can still settle. Read current Electron content bounds
on every renderer-acknowledgement poll, still requiring the requested outer size
and exact renderer/owned-layout agreement. This strengthens the actual agreement
check without changing viewport limits. Re-run both cases on the completed build;
no result from a run overlapping a rebuild counts as final acceptance.

### Phase 4 — Contrast investigation 12

The explicit selector also fails to change the measured button foreground. Do not
claim that correction as effective. Inspect the exact matching live stylesheet
rules and computed style before another production edit; keep the acceptance
threshold unchanged. The resize correction is being validated independently in
the same run. Temporary diagnostics are removed once the cause is isolated.

### Phase 4 — Contrast correction 13

Live matching rules confirm the built stylesheet and explicit dark selector are
loaded, with no overriding color declaration, but the button's var(--text-2)
foreground remains the old light value despite the token resolving dark. Its
parent's computed foreground updates correctly. Make the transparent reset action
inherit that surrounding foreground, remove the ineffective redundant dark rule,
and validate both themes. No palette constants or contrast exceptions are added.

### Phase 4 — Test-host rendering correction 14

The live native geometry is already 1280×800, but renderer reads stay 720×540
through every poll; the eventual screenshot is 1280×800. Tests are running on the
host's existing :0/Wayland desktop (no Xvfb executable), unlike CI's isolated Xvfb.
Together with the correctly loaded CSS rules and stale resolved foreground this
points to deferred background rendering, not palette or layout constants. In the
E2E helper only, disable background throttling on the test process windows and
await a renderer frame before accessibility measurements; also do this before
native resize. Remove ineffective production reset-color edits and temporary
cascade/geometry diagnostics. Retain root-theme and live-bounds agreement checks.
Run the original unchanged contrast/geometry assertions before accepting this
host-level correction. Production window/background policy remains untouched.

### Phase 4 — Isolated display correction 15

The local host is Fedora KDE/Wayland using existing DISPLAY=:0 and has no Xvfb.
Even the test-only unthrottled-frame experiment times out waiting for frames.
Stop this failed local experiment and withdraw the speculative helper changes
(corrections 8, 11, 12 diagnostics and 14); restore the original helper and retain
all original assertions. Download/extract Fedora's Xvfb package into /tmp only,
without installing or changing the host, and rerun on an isolated display matching
CI. Production reset-color experiments are already removed. Only the confirmed
catalog wrapping fix and explicit Monsters test navigation remain as functional
corrections. No overlapping-run or host-background result is final acceptance.

### Phase 4 — Corrective acceptance and re-audit

The isolated Xvfb run passes both unchanged scenarios: campaignCombat 1m28.2s,
npcCatalog 1m17.4s, including both themes, 720px containment, expansion and restart.
Summary: `.tmp/e2e-runs/functional-1788886339413-335804/summary.json`.
This validates the host-background diagnosis. All experimental color, animation,
resize and diagnostic helper edits were withdrawn. The only lasting corrections
since candidate 67655becd are catalog-section wrapping and explicit Monsters
navigation in the walking scenario. No golden or accessibility oracle changed.

Re-audit against the phase plan: catalog navigation retention and compact viewport
support now coexist with the prior NPC/group/combat workflows. Re-audit against
original phase 4: all bullets still hold; no change to XP/rest semantics or phase
5/6 scope. The final sceneDesktop suite is being repeated on the same isolated
screen before the next candidate push. Future local visual/E2E validation uses
that isolated display rather than the host's active Wayland desktop.

The isolated final desktop run passes all five cases in 1m51.1s:
`.tmp/e2e-runs/functional-1788886546941-337141/summary.json`.

### Phase 4 — Final scope audit correction 16

The final lifecycle audit finds a missing distinction: canceling a library view
must suppress late navigation, but must not suppress publication of an already
committed Party result. Move campaign-scoped aggregate publication/refresh into
the mutation execution's confirmed-result continuation, independent of the
view's guarded accept callback. Keep selection/editor state changes guarded by
the coordinator. Strengthen the late-completion unit case to require shared
publication and prohibit late navigation; rerun focused tests, lint/typecheck,
build and the scene suite before candidate delivery. No mutation replay added.

### Phase 4 — Final corrective validation and audits

Correction 16 passes all seven focused cases, including publication after view
closure with no late navigation; changed-file lint and both typecheck projects
pass. The completed build passes all five sceneDesktop cases in 1m50.3s on the
isolated screen: `.tmp/e2e-runs/functional-1788886867170-341307/summary.json`.
The earlier isolated campaignCombat/NPC acceptance validates the unchanged shared
UI corrections. Final bundle measurement remains below all reviewed budgets.

Phase-plan re-audit: confirmed mutations update campaign state independently of
view lifetime, while draft/selection callbacks remain scoped. Catalog rows,
nullable CRUD, loot, scene-only comparisons and retained navigation meet the plan.
Original-roadmap re-audit: phase 4 is implemented without XP/rest semantics changes
or premature legacy removal. All discovered discrepancies are resolved; exact
candidate checks, canonical handoff and green-main promotion remain outstanding.


## Phase 4 — Delivery closure

Candidate `63b4279001365b891d097eede49bfe0a0f1d3988` passed all 15 required
jobs in Check 34254846635. Canonical handoff completed with state
`fc4535c3-aced-439c-b485-41048eb3b0ac`, origin/active attempt
`4cc205fe-708f-43cb-8241-4fb022da9d9c`. CI artifact and installed bytes match
`581433d55b1bdf33c69b9cfc3fc544dcfb84eaf03eeac7132791bb5719465941`.
Backup `2026-09-08T17-18-24-319Z-3946f8d998f2-5ee09ae8` was verified;
installed runtime passed two quick checks and four domain readbacks.
Promotion fast-forwarded the same SHA from a8f679e2e. Main Check 34256714284
passed; readSuccessfulPostPromotionEvidence verified manifest version 4.
Phase 4 is complete with no unresolved audit discrepancy.

## Phase 5 — Context refresh and plan before implementation

Base is the delivered phase-4 SHA above; implementation continues in the isolated
worktree on `codex/scene-desktop-phase-5`. Original checkout remains untouched.
The canonical roadmap and contributor boundaries were re-read. Current PartyStore
mixes manual XP with rest counters; encounter awards already have a combat-ID
uniqueness guard. Current rests target all active characters. SceneStore owns
assignments but has no production scene creation command. Travel detects changed
membership before advancing; combat reconciliation must target each affected
scene, never merely the focused one. Party commands require explicit shared
projection publication after confirmed persistence, including after view closure.

Implementation sequence and acceptance:

1. **5A:** Add strict scene-scoped batch membership and move contracts with Party
   and Scene expected revisions. Validate all IDs, eligibility and target before
   writing within CampaignUnitOfWork. Preserve surviving assignment order; append
   newly assigned members in roster order. Removed members become inactive;
   moved members stay active. Add aggregate-owned new-scene creation inheriting
   source time/location. Retain empty sources and existing target metadata.
   Reconcile affected combat and pause changed journeys without advancing them.
   Build compact anchored selection popovers with stable search/list/scroll,
   clear/select-all and one bottom-right Apply. Test rollback, stale revisions,
   invalid/duplicate IDs, source/target isolation and full replacement.
2. **5B:** Separate manual delta/absolute XP from encounter burden while retaining
   level-floor validation. Add persisted trust flags through campaign migration;
   preserve old counters as untrusted. Keep confirmed encounter awards atomic and
   once-only for explicit actual recipients. Provide only amount/plus/minus/set
   controls, immediate publication and local errors; no optimistic command replay.
   Test migration, floor/bounds, repeat awards and unchanged manual burden.
3. **5C:** Add explicit-ID, revision-checked scene rest commands. Short rest resets
   only short burden/trust; long resets both. Default UI selection to all present;
   require the same button twice, invalidate on selection/type/scope/revision or
   dismissal. Compute compact burden/orientation from productive rule tables;
   missing levels and untrusted baselines cannot yield precise forecasts.
   Test selected-only effects, confirmation invalidation, rule values and errors.
4. Validate each package before proceeding to the next. Extend real desktop E2E
   with the 18-character fixture for replace/split/merge, XP and selected rests;
   use isolated DISPLAY=:1 sequentially. Run lint/typecheck, focused unit and
   SQLite integration, build and affected E2E/bundle checks. Update requirements
   and migration progress. Audit separately against this plan and original
   phase 5; record corrective plans before fixes. Deliver only after exact-SHA
   remote checks, canonical handoff and green main. Legacy removal is phase 6.

### Phase 5A — Compilation correction 1

Initial typecheck found an overbroad import edit also adding schemas to the old
assignment operation arguments, a missing HexMapStore location owner and union
narrowing across a callback. Remove the stray arguments, supply the existing
WorldLocationStore and capture the narrowed target ID before callback validation.
Rerun typecheck before UI integration.

### Phase 5A — UI correction 2

Typecheck caught passing an ID instead of a character to the existing suffix
formatter. UI inspection also found nonexistent palette tokens and an older
request could dismiss a newly opened draft. Use the established sheet/border
tokens, pass the member and guard completion by draft identity; keep confirmed
shared publication independent. Validate these fixes with the batch integration
cases and UI tests before 5B.

### Phase 5A — Acceptance correction 3

The new integration case used a nonexistent composite location field. Compare
actual locationId/locationName and time instead; retain the inherited-location
requirement. Add a component case proving checkbox node identity, scroll and
selection retention during search, and one batched submission.

### Phase 5A — Test harness correction 4

All seven SQLite cases pass, including transactional rollback and inheritance.
The component harness omitted the required session notice subscription; add the
existing no-op subscription mock and rerun without changing production behavior.

### Phase 5A — Test typing correction 5

All eight focused cases pass. Typecheck requires publishSession's boolean return
in the mock; return true instead of undefined, then repeat typecheck.

### Phase 5A — Package validation and audits

Eight focused component/SQLite cases pass; both typecheck projects pass. The
plan audit verifies stable authored ordering, one atomic batch, inactive removal,
active transfer, inherited source metadata, existing-target preservation, retained
empty sources and dependent rollback. Original 5A audit passes these requirements;
full real-app acceptance remains part of phase-5 delivery. Proceed to 5B.

5B implementation detail: campaign schema 35 adds aggregate-owned short/long
trust flags, defaulting legacy rows to false without altering counters. New CRUD
characters start at trusted zero. Expose burden as an optional structured fact on
the character contract so old test/import consumers can represent unavailable
provenance; production PartyStore always supplies it. Daily budget is resolved
in the domain from the existing productive level table, never duplicated in UI.

### Phase 5B — Package validation and audits

Twelve existing/focused cases pass; eight migration/domain/release-baseline cases
pass, including preserved unknown counters, manual delta/absolute/floor behavior,
invalid recipient rollback and duplicate award suppression. Both typecheck
projects pass. The XP component is exercised independently for all three immediate
actions. Phase-plan and original 5B audit: no manual burden mutation, no fabricated
legacy baseline and no duplicate confirmed encounter effect. Proceed to 5C; full
app checks and phase-wide audit still required before delivery.

### Phase 5 — Corrective audit round 6

Twenty focused cases and 114 architecture/regression cases pass; build and bundle
budgets pass without raising baselines. Lint rejects render-time ref reads in XP
and rest anchors: capture the clicked element in state instead, as roster already
does. A publication audit finds full roster results could replace newer Party or
combat facts when only the scene revision was compared. Publish the confirmed
Party slice with its own revision guard and refresh the authoritative complete
session before dismissing; never replace a whole session using one aggregate's
revision. Keep publication independent of view lifetime. Finally, show suffixes
only for otherwise identical name/player rows. Implement after the current built
E2E run, then repeat relevant tests, lint and final built acceptance.

### Phase 5 — Corrective audit round 7

The first real-app run passes all five previous desktop cases and completes the
new roster/XP/rest/move interactions. Its final accessibility scan finds an
unfocusable scrollable travel body when the changed party pauses the journey.
Make the existing travel body keyboard-focusable; retain the unchanged axe rules.
Repeat all six desktop cases after corrections 6 and 7.

### Phase 5 — Transitional command audit correction 8

The new batch commands reconcile the correct scenes, but the retained legacy
single-member routes still reconcile only the focused combat. Because both UIs
remain available until phase 6, fix those routes in this phase too: resolve source
and target assignments, remove departed combat references, reconcile both affected
scenes in one UnitOfWork and pause only genuinely changed journeys. Keep legacy
single unassignment's active-but-unassigned meaning until its UI is removed.
Add an unfocused-scene regression case and rerun targeted domain and final app
acceptance before delivery; this is required parity, not a new feature.

### Phase 5 — E2E synchronization correction 9

All six cases pass in 1m56.3s, including accessibility, but the qualification
wrapper rejects two stale-element warnings. The new move case queries its window
immediately after changing scenes, before the keyed window replacement settles.
Wait for the scene container's actual target identity after each selection before
querying the new window. Preserve the zero-warning gate; do not increase warning
budgets. Legacy command correction passes 32 domain cases. Rebuild final code and
repeat the complete six-case suite with the synchronization fix.

### Phase 5 — Test helper typing correction 10

The new scene-selection helper must account for WebDriver's nullable attribute
return. Coalesce an absent value to the existing empty sentinel so the explicit
missing-scene error remains authoritative. Repeat typecheck; no app change.

### Phase 5 — Final local validation and separate audits

The final built desktop suite passes all six cases in 2m1.9s with no warning-gate
failure: `.tmp/e2e-runs/functional-1788889601195-363731/summary.json`.
This covers replacement, scene creation/merge, XP add/subtract/set, selected rest
confirmation, both themes, independent windows and restart. No golden changed.
Full lint passed; subsequent changed-file lint and final typecheck pass. The
format check passes. Architecture/regression coverage passed 114 cases; focused
burden/UI coverage passed 20, corrective coverage 16, legacy commands 32, and final
source/target/travel coverage 19 cases. Build and built smoke pass. Renderer
reachable size is 1,604,714 bytes, within unchanged hard and growth budgets.
Version truth confirms campaign schema 35 and migration registry 14.

Phase-plan audit: each package was implemented and validated in 5A -> 5B -> 5C
order. Commands validate full selections, use aggregate-owned SQL within one
UnitOfWork, preserve ordering/metadata and reconcile affected scenes. Publication
cannot roll back newer Party facts; confirmed writes survive view closure. Legacy
routes were corrected while they remain available. Unknown counters remain
stored and visibly untrusted; productive budget data drives orientation.

Original-roadmap audit: all 5A, 5B and 5C bullets and acceptance cases are covered.
Rest confirmation resets with selection/type/revision/scope/dismissal. Manual XP
never increases burden; encounter awards remain once-only. Empty sources survive,
inactive members remain searchable, moves affect only selected members. No player
resources, legacy removal or phase-6 default switch was introduced. All identified
discrepancies are resolved. Phase 5 remains in progress pending exact-SHA remote
qualification, canonical installation handoff and successful main attestation.
