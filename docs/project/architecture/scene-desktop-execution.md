# Scene desktop roadmap execution

Canonical scope: [unchanged user roadmap](scene-desktop-roadmap.md).
Execution follows the explicitly requested Roadmap Executor skill. This log is
append-only for plans, audit results and corrective rounds. Phase completion
includes remote checks, exact-SHA app handoff and green promotion to main.

## Status

| Phase | Status | Evidence |
| --- | --- | --- |
| 1 — Window desktop and persistence | In progress | Plan below; implementation and verification outstanding |
| 2 — Reference windows | Not started | Depends on completed phase 1 |
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
