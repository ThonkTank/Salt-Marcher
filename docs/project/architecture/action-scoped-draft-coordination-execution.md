# Action-scoped draft coordination execution

Canonical roadmap:
`docs/project/architecture/action-scoped-draft-coordination-roadmap.md`.

## Status

Implementation complete; delivery pending. The baseline is application SHA
`9ac241b2c96934cd21a1079b35cf0fe60889622c` on
`codex/action-scoped-draft-coordination`.

## Phase 1 — Binding conflict matrix

Status: complete.

Plan:

- Compare the matrix with live-session requirements, current travel commands,
  draft owners, scene/window transitions, quit, and maintenance.
- Record product-backed couplings and explicitly independent actions in the
  requirements and architecture documentation.
- Validate documentation formatting and audit the matrix against the canonical
  roadmap before closing the phase.

Acceptance: every matrix row has an identified owner and consistency reason;
global resolution is limited to quit and maintenance.

Validation:

- Repository inspection identified the shared transition hook, coordinator,
  travel command preparation, SceneDesktop close/scene transitions, and global
  release-settings resolution as the relevant owners.
- The live-session requirements now distinguish action-scoped travel,
  window/scene context loss, and application-wide barriers.

Audit: passed against the phase plan and canonical roadmap. Party membership,
route state, scene context loss, and same-scene Combat are necessary couplings.
Unrelated registered editors and dependencies of unaffected owners are
explicitly independent.

## Phase 2 — Coordination contract

Status: complete.

Plan:

- Add typed draft concerns and typed transition selections to the shared
  renderer coordinator without moving editor persistence into the coordinator.
- Resolve selected owners plus their dependency closure, and expose targeted
  lock state separately from the application-wide maintenance lock.
- Adapt the transition hook and focused coordinator tests while preserving an
  explicit all-drafts mode for quit and maintenance.

Acceptance: selection is deterministic, dependencies are resolved only for
selected roots, irrelevant missing editors cannot fail a transition, and a
targeted lock does not block unrelated owners.

Corrective round 1 plan: preserve the existing Party roster's explicit
per-editor checks by representing ID selection in the typed contract; do not
broaden those checks to all drafts.

Validation: coordinator and transition tests pass (29 tests), the Party-only
maintenance regression passes, and TypeScript accepts the new selection
contract.

Audit: passed after corrective round 1. Concern and exact-ID selections are
deterministic; selected dependency closure is retained. Targeted resolution
locks selected owners while `isLocked()` remains the application-wide barrier.

## Phase 3 — Travel transitions

Status: complete.

Plan:

- Tag route and Party-membership drafts with typed scene concerns.
- Let one transition hook choose an action-specific selection per request.
- Resolve route and Party membership for start/resume/position, while pause,
  abort and multiplier changes bypass independent drafts.
- Preserve current command preparation, revision refresh, domain Combat guards,
  and unknown-outcome behavior.

Acceptance: dirty XP does not block pause; pause does not alter that XP draft;
start/resume resolve same-scene route and Party drafts; other scenes remain
independent; existing travel regressions pass.

Corrective round 1 plan: update obsolete tests that encoded global resolution;
retain their stale-read and unmount coverage under action-scoped preparation.

Corrective round 2 plan: replace the travel preparation's second, internal
all-drafts barrier with the same action selection used by its transition dialog.

Corrective round 3 plan: tag and lock the same-scene travel command owner during
fresh preparation so parallel travel controls remain blocked without imposing an
application-wide editing barrier.

Validation: 63 focused coordinator, transition, route, Party, and travel-console
tests pass. The travel-console acceptance now proves that Pause leaves an XP
draft dirty and unsaved while same-scene Party and route failures still prevent
Start.

Audit: passed after three corrective rounds. The first round updated obsolete
global-coupling expectations, the second removed a nested global barrier, and
the third restored same-scene travel-command serialization with a targeted
concern. Command preparation, revision refresh, Combat guards and unknown-outcome
handling remain in their existing owners.

## Phase 4 — Window and scene transitions

Status: complete.

Plan:

- Tag scene-local and window-local owners with lifecycle concerns.
- Select the current window concern for Close and the current scene concern for
  scene changes. Minimize must not resolve drafts because it keeps content
  mounted.
- Include scene dialogs and command owners that are replaced on focus changes;
  keep persistent route/command state available when only the Map window closes.
- Add UI tests for close/minimize/scene behavior and missing irrelevant owners.

Acceptance: Close resolves only drafts lost with that window; Minimize preserves
them without prompting; scene changes resolve only the departed scene; drafts in
other contexts remain intact.

Validation: 79 focused transition, desktop, Party, travel, encounter, group, and
workspace tests pass; TypeScript passes. The transition UI test proves that a
window lock disables its own editor while an editor in another window remains
enabled, and that the scene selection includes both when leaving the scene.

Audit: passed. Window children inherit window and scene concerns. Persistent
travel owners carry explicit scene concerns outside the window tree. Combat,
group, roster, scene-command and workspace transitions now select semantic or
lifetime concerns; production transition callers no longer depend on the
implicit all-drafts selection. Global quit and release maintenance continue to
call the coordinator's explicit all-drafts mode.

## Phase 5 — Acceptance and regression

Status: complete.

Plan:

- Run the complete portable validation suite and the affected Electron desktop
  and travel acceptance paths.
- Confirm distinct evidence for necessary same-scene coupling, unrelated XP,
  different contexts, dependency failures, partial saves, context changes during
  resolution, and application-wide maintenance.
- Record any failure before a corrective round and repeat the relevant checks.

Acceptance: all roadmap coupling and independence cases have direct test
evidence; static checks and affected application paths pass without weakening
historical or visual oracles.

Corrective round 1 plan: the full renderer lint rejected reading the pending
transition ref while rendering draft labels. Store the dialog's selection in
React state when opening it, then repeat lint, focused tests, and the complete
portable suite.

Corrective round 2 plan: the full test lint found an obsolete mutable declaration
in the new XP-independence acceptance. Make the test state immutable and repeat
the complete portable suite.

Corrective round 3 plan: the portable suite exposed two independent issues.
Recompute selected roots at each retry so a successfully closed child is not
looked up in a later snapshot, and replace scene-location tests that required an
unrelated editor dialog with an explicit independence acceptance. Repeat both
focused suites before the full portable run.

Corrective round 4 plan: the contract audit found that the transition hook still
defaulted silently to the global selection. Require every caller to state its
selection, and keep all-draft behavior explicit even in generic test harnesses.
The first focused run then showed that the travel test harness's synthetic
"Bereich wechseln" action had also relied on that implicit default. Declare its
all-draft scope explicitly while travel commands continue to override it with
their action-specific selections.

Corrective round 5 plan: the final contract audit found that an affected editor
mounted after a targeted resolution began was detected at completion but was not
itself locked. Track the active selection, lock newly matching owners and late
dependencies immediately, and add a direct regression test.

Corrective round 6 plan: Electron acceptance exposed two Scene Desktop tests
whose oracle still required XP resolution on Minimize and scene-location edits.
Update them to assert the binding contract: Minimize preserves the live XP
draft, location changes leave it untouched, and only closing its window resolves
it. The separate Travel suite failed before its command assertion because the
synthetic pointer drag did not persist; rerun it independently before changing
product code.

The unchanged Travel acceptance passed on its isolated rerun. Its first failure
was therefore classified as the suite's existing synthetic-pointer flake; no
product behavior or oracle was weakened.

The first corrected Scene Desktop run confirmed that both actions close the
anchored popup presentation while retaining its draft owner. Reopen the popup
before asserting its retained value, matching the product distinction between
temporary popup visibility and the window-owned draft lifetime.

The follow-up proved that scene-location changes already preserve the XP draft,
but Minimize unmounted all window children because minimized windows were
filtered out of the render tree. Keep minimized windows mounted with the native
`hidden` state so local drafts survive while layout, focus and map-render
activity continue to consider visible windows only.

The mounted-minimized implementation invalidated one older acceptance assertion
that equated hidden with nonexistent. Assert invisibility there. The same run's
unrelated search-result contrast check measured 4.4:1 against 4.5:1; repeat the
suite after the product assertion is corrected before classifying that result.

The repeat showed that the window's flex rule overrode the browser's native
hidden presentation and reproduced the 4.4:1 search metadata contrast. Add an
explicit hidden rule and use the next stronger existing text token for that
small metadata only; both remain within the established SaltMarcher tokens.

Validation: the complete portable suite passes 87 architecture, 1,540 unit and
389 integration tests. After the corrective rounds, 44 focused coordination and
travel tests pass, the unchanged Travel Electron acceptance passes, and all 11
Scene Desktop Electron acceptance cases pass, including both-theme
accessibility, window persistence, Party/Groups, Combat and travel lifecycles.

Audit: passed after six corrective rounds. Necessary same-scene dependencies,
irrelevant missing dependencies, partial saves, retry, late owner registration,
targeted locks, global maintenance and the explicit independent XP cases all
have direct evidence. No production transition hook can silently fall back to a
global selection.

## Phase 6 — Documentation and delivery

Status: planned.

Plan:

- Close the stale Party/Groups delivery note and publish this roadmap, execution
  record, conflict matrix and separate resource investigation.
- Run the final complete validation from the clean candidate content.
- Commit and push the candidate, require exact-SHA remote checks, complete the
  canonical app handoff, promote the identical SHA to `main`, and confirm the
  promoted checks.

Acceptance: documentation names the delivered evidence without ambiguity; the
candidate and `main` point at the identical, remotely green, locally handed-off
application SHA.

Corrective round 1 plan: the final formatter rejected line wrapping in two
changed test files. Apply the repository formatter to those files, then repeat
the complete validation.

Corrective round 2 plan: candidate run 34346265351 passed Portable, macOS,
Windows and packaged-harness qualification but its Linux build reported 18,137
bytes of reachable renderer growth, 3,100 bytes in the common Workspace graph
and 26 bytes in the shell graph. Record the measured baseline with an explicit
dependency and chunk rationale; absolute graph budgets and the 16 KiB growth
gate remain unchanged. Requalify the resulting exact SHA.

Corrective round 3 plan: candidate run 34346985571 passed every build, package,
platform and visual job, but its `campaign-workspaces` shard exposed that the
character form still consumed only the global editing lock. Thread its owning
catalog draft's targeted lock into the form while keeping the internal
transition-save path available, add a direct unit contract, and retain the
window-visibility oracle with a longer runner allowance. The focused rerun
passes all 11 Scene Desktop cases and the corrected workspace draft-transition
case. The unrelated local workspace geometry case remains classified as a
browser-driver timeout because its synchronous browser script timed out before
an assertion while the same case passed in the candidate run.

## Separate resource-exhaustion investigation

Status: complete with an explicit attribution boundary.

The previous boot's journal proves that `dbus-broker-launch` failed to create a
directory watcher and that SaltMarcher aborted only after the user D-Bus
connection disappeared. The host's low shared inotify-instance ceiling is the
stronger explanation than the D-Bus service's much higher descriptor limit, but
historical per-process usage was not recorded, so the consumer that exhausted
the pool cannot be named. The full evidence and no-change decision are recorded
in `desktop-resource-exhaustion-investigation.md`.
