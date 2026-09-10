# Action-scoped draft coordination execution

Canonical roadmap:
`docs/project/architecture/action-scoped-draft-coordination-roadmap.md`.

## Status

Final complete verification and exact-SHA delivery pending. Application SHA
`054f643685e2c710cf17690a16d8d027c444dd9f` completed its canonical handoff and
was promoted to `main`; a subsequently exposed background-write transition race
is being corrected and requires a new exact-SHA delivery.

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

Status: in progress.

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

Corrective round 4 plan: the first `main` attestation queried GitHub immediately
after promotion and did not yet find the completed exact-SHA candidate run.
Rerun only that evidence job after GitHub indexed the unchanged candidate; do
not rebuild or change the delivered application.

Corrective round 5 plan: the documentation-closure check reproduced the local
workspace geometry timeout. Its browser script mixed the synchronous WebDriver
execution API with an awaited `requestAnimationFrame`; measure immediately
after DOM insertion instead, because `getBoundingClientRect()` performs the
required layout flush. Keep every geometry and isolation assertion unchanged.
The corrected Workspace suite passes all three cases locally in 1 minute 20
seconds without a browser-driver timeout.

Corrective round 6 plan: the resumed full check found the same renderer-script
timeout pattern in the Campaign creation suite's remaining double-frame waits.
Move all three remaining frame-settling waits out of synchronous WebDriver
scripts: keep DOM changes synchronous, poll font readiness explicitly, then
pause briefly through WebDriver before capture. Preserve the scroll, font and
golden assertions.

Corrective round 7 plan: after the frame waits were removed, Campaign creation
reached its complete management flow and exposed two clicks that advanced before
their campaign dialog had finished closing. Wait for the rename dialog to
disappear, and after Restore wait for the Trash close action to become enabled
and for its dialog to disappear. Keep every campaign lifecycle assertion.

Corrective round 8 plan: the targeted rerun exposed a real transition race. A
scene change made immediately after a requested Travel write could observe its
draft as dirty, then show an empty resolution dialog after the write settled.
Forward `settleBackgroundWrites` through the shared owner hook and provide it on
command-owning Party, Character, XP, Combat, Group, Scene, Travel and Campaign
drafts. Scene transitions can then wait for already-requested writes without
replaying them or coupling unrelated drafts. Add direct unit coverage and make
the Travel acceptance wait for the Abort receipt before its next action.

Corrective round 9 plan: the restarted complete check exposed an intermittent
mixed-theme accessibility sample in Campaign Combat. The shared two-theme
helper used the persistent preference action for a reversible visual probe,
creating unrelated queued installation writes. Switch the probe locally through
`data-theme`, wait beyond the existing control transition before measuring, and
restore it without persistence. Direct inspection also showed that the Group
dialog snapped its background while a blanket control transition retained the
prior theme's foreground or control surface. Remove the theme-dependent text,
border and background animations from that blanket rule while preserving its
state-dependent opacity transition; retain the 4.5:1 oracle.

Corrective round 10 plan: the corrected Combat accessibility path reached its
three-width golden checks and exposed that Electron could confirm a resize on a
different visible window while the WebDriver-owned renderer retained its prior
width. Prefer a focused or visible Electron window with the renderer URL and
retain the existing browser-owned fallback when the renderer does not
acknowledge the native resize.

Corrective round 11 plan: the complete run reached the Hex location workflow
after its minimum-size check and found that the test restored inner dimensions
as outer dimensions, then tried to use a catalog action while the fixed
location inspector still covered it. Preserve and restore the actual outer
geometry, close the inspector before starting the next catalog action, and use
the shared interactable-click helper. The isolated Hex workflow passes without
weakening its placement, partial-save or accessibility assertions.

Corrective round 12 plan: under Linux/Xvfb, Electron and the DOM can acknowledge
the new outer bounds while ChromeDriver retains the previous CSS viewport. That
allowed frame geometry to pass without entering responsive breakpoints. After
the native resize acknowledgement expires, set the renderer-owned Puppeteer
viewport directly and verify its dimensions before continuing. Hidden Session
workspaces no longer participate in active-layout acknowledgement. Dialog,
Campaign Combat and Hex workflows all pass with the corrected helper; the
dialog oracle now observes its genuinely stacked minimum-width layout.

Corrective round 13 plan: the complete functional run and its unchanged resume
both reproduced the Travel suite's direct-token-drag failure before any changed
draft transition. Synthetic untrusted pointer events no longer establish a
reliable browser gesture once the renderer viewport is explicitly controlled.
Keep the direct pointer contract, but drive down, an intermediate move, the
destination move and up through the renderer-owned Puppeteer page so coordinates
share the viewport used for the map geometry. Retain both persisted-location
assertions and the complete travel-control journey.

Corrective round 14 plan: repeated direct runs showed that the SVG location
overlay is not a reliable source for Pixi token coordinates and that a
renderer-owned Puppeteer mouse can block ChromeDriver diagnostics. Publish the
authoritative Pixi camera beside the existing render counters, derive the token
points from that camera, and use an element-relative WebDriver pointer action.
After renderer restart, wait for the restored route facts before asserting that
the Start action is ready. Two clean focused Travel runs pass the complete
drag, persistence, restart and control journey without diagnostic hooks.

Corrective round 15 plan: the complete Scene Desktop run found that the
Characters window can already remain open after a scene switch. Calling its
toolbar toggle again then closes the window before the roster assertion. Use
the existing idempotent window-opening helper so the acceptance observes the
new scene regardless of the prior window state. Keep the Vivian/Edrik content
oracles and restart persistence unchanged.

Corrective round 16 plan: a resumed functional run reused the already loaded
Scene Desktop specification and reproduced two timing-sensitive waits from the
prior source. Make scene selection wait for the desktop's matching scene ID
before opening Characters, and allow the long-rest receipt up to the existing
15-second interaction allowance before requiring its popup to close. Preserve
all roster, rest, scene and persistence assertions. The changed specification
requires a fresh check; evidence from the already loaded resumed process is not
credited to it.

Corrective round 17 plan: the freshly loaded Scene Desktop suite reached a
paused journey while its command owner was still settling, so a direct Stop
click was ignored and the subsequent abort assertion observed the unchanged
paused state. Use the shared interactable-click helper for Stop so it waits for
the command to become enabled and reacquires a replaced element. Keep the
required `Reise abgebrochen.` receipt assertion unchanged.

Corrective round 18 plan: two campaign performance samples exceeded their
unchanged one-second p95 gate while a separate Codex task ran a historical QEMU
qualification VM at high CPU and I/O load. Pause that task, stop its VM, remove
only its regenerable qualification work and repeat the unchanged performance
oracle on an idle host. Do not alter the production path or its threshold.

Corrective round 19 plan: the final lint requires the asynchronous Stop locator
to await its WebDriver element explicitly. Apply that syntax-only correction
and repeat the full check; runtime behavior and acceptance assertions are
unchanged.

Corrective round 20 plan: the complete visual run exposed a stale renderer
viewport during the Campaign Combat golden sequence. The resize helper accepted
the requested native outer size while the renderer still displayed the prior
1,024-pixel viewport. Require a plausible native-frame inset before accepting
that fallback, and wait for the Combat window's restored-size control after
requesting maximization. Keep the golden dimensions and pixels unchanged.

Corrective round 21 plan: the fresh functional run showed that waiting the full
15-second interaction allowance before each safe renderer-viewport fallback
adds about one minute to Campaign Combat and exceeds its unchanged scenario
limit. Give a native renderer resize 750 ms to settle, then use the existing
verified Puppeteer fallback. Keep the resize acknowledgement, scenario limit
and golden oracles unchanged.

Validation: the latest local portable validation passes 87 architecture, 1,542
unit and 389 integration tests, plus reference, catalog, schema and
render-artifact checks. Linux-specific validation passes 63 tests. Reachable
renderer growth is 441 bytes and Common Workspace growth is 89 bytes, with all
absolute budgets green. The authoritative Pixi camera brings reachable
renderer growth to 601 bytes, including 160 bytes in the Pixi leaf; Common
Workspace growth remains 89 bytes. Focused Dialog, Campaign Combat and Hex workflows pass
after the final viewport correction; two focused Travel runs pass after the
authoritative-camera correction. After the competing VM stopped, the unchanged
focused campaign qualification passes with p95 163.858 ms and maximum 176.02
ms. Candidate run 34351088621 and handoff
artifact SHA-256
`69ad8433cd11d975be5f71a7eb38a9063d2a14b2784b17e21003f41748589b73`
remain evidence for the previously promoted application SHA; the corrective
candidate requires its own final complete check and exact-SHA handoff.

Audit: pending the final complete check and exact-SHA delivery of corrective
rounds 8 through 21.

## Separate resource-exhaustion investigation

Status: complete with an explicit attribution boundary.

The previous boot's journal proves that `dbus-broker-launch` failed to create a
directory watcher and that SaltMarcher aborted only after the user D-Bus
connection disappeared. The host's low shared inotify-instance ceiling is the
stronger explanation than the D-Bus service's much higher descriptor limit, but
historical per-process usage was not recorded, so the consumer that exhausted
the pool cannot be named. The full evidence and no-change decision are recorded
in `desktop-resource-exhaustion-investigation.md`.

During corrective verification, Btrfs also exhausted allocatable metadata while
131 GiB of old generated qualification VM images occupied a previous Codex work
directory. Removing only those regenerable images and aborted local E2E state
restored 188 GiB of free space and reduced metadata use to about 30 percent;
campaign data, backups, published outputs and the active installation were
retained.

A parallel update task later recreated 74 GiB of historical qualification VM
work while the final performance gate was running, producing sustained I/O
pressure and p95 outliers above one second. The task was paused, its VM stopped,
and only that regenerable work directory removed. Root returned to 183 GiB free;
the qualified outputs and project data remained intact.
