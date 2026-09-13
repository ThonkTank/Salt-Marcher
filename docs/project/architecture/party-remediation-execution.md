# Party remediation execution

Canonical scope: [Party remediation roadmap](party-remediation-roadmap.md).

## Status

| Package | Implemented | Validated | Delivered |
| --- | --- | --- | --- |
| 1 — History errors and Party documentation | Yes | Yes | Yes — 4b885295f |
| 2 — Handoff preflight and invocation | Yes | Yes | Yes — e77a997db |
| 3 — Independent desktop scenarios | Yes | Yes | Yes — aa325e9a0 |
| 4 — History capture investigation | Yes — investigation only | Yes | Pending exact-SHA delivery |

## Package 1 plan — 2026-09-13

Baseline: `bc3e325707d331fa242e5e09b3b12b3d5b94b110`, clean candidate
`codex/party-remediation-1` in a separate worktree. The original checkout's
modified `action-scoped-draft-coordination-execution.md` is outside this work.

1. Replace nullable history query state with explicit loading/ready/failure
   state scoped to its campaign, snapshot and refresh request. Preserve the
   existing Party command controller and original-command recovery. Do not use
   a failed refresh as evidence of an empty history or enable stale actions.
2. Show a compact, wrapping alert and native retry button on read failure only.
   Retry reads history; it never replays a write. Ignore superseded/unmounted
   responses using the existing request lifecycle pattern.
3. Exercise empty/success/loading, repeated failure, keyboard retry, superseded
   campaign/snapshot/unmount responses, and non-replay in component tests.
   Verify actual 240/360 px rendering with the existing app test harness.
4. Correct conflicting current XP/rest statements in the Party domain,
   persistence and historical dropdown documents; keep historical architecture
   descriptions explicitly historical. Extend the current specification with
   history read-error behavior.
5. Run focused lint/format, type checks and relevant component/architecture
   tests before candidate submission. Record separate plan/roadmap audits and
   any corrective rounds here. Qualify the exact candidate SHA in Check, run
   canonical app handoff, promote that SHA and verify Main before package 2.

Acceptance: no error on empty history; errors and keyboard-operable retry;
current actions restored only by a successful current read; repeated failures
and late replies safe; no duplicate writes; compact layout at 240/360 px;
consistent current Party rules; no migration or new public contract.

Delivery evidence will identify candidate, selected Check evidence, handoff
receipt and Main attestation. Final delivery status cannot be claimed in the
candidate before these external events have completed; later log entries retain
the distinction.

### Package 1 validation and corrective round 1

The first focused run passed 15 tests across desktop Party, the shared command
gate and the renderer async boundary. Focused lint then caught four test `act`
callbacks declared async without awaiting their deferred response. Corrective
plan: await the deliberately resolved/rejected response inside each callback,
then repeat lint and focused tests before type/build checks. Product behavior
did not fail this round.

Layout validation will use a separate registered E2E spec with the existing
scene fixture. In that test process only, the history IPC handler will return
a controlled read failure and then a captured valid history response. This
allows real keyboard retry and 240/360 px checks without adding a production
fault-injection capability or corrupting campaign data. Restart restores normal
handlers; the isolated test profile contains no user data.

### Package 1 corrective round 2

The isolated E2E assertions passed, including Enter retry and unchanged Party
and stored history after restart. The runner correctly rejected the run for
new WebDriver window-rectangle/scroll fallback warnings (10/2). Screenshots also
showed that scrolling to the retry button unnecessarily hid the first error
line at 240 px. Plan: use the DOM scroll position of the existing window content,
assert the complete error area fits vertically as well as horizontally, and
rerun this same suite. Keep the warning gate intact. Update the registry runtime
from the actual successful run, rather than retaining its provisional estimate.

### Package 1 validation and audits

- Focused components/command gate/async boundary plus all architecture suites:
  12 files, 104 tests passed (`vitest run tests/architecture` plus the six
  targeted Party/registry/ordering files). Existing XP, roster and command
  recovery checks remain covered.
- Focused Prettier and ESLint passed; TypeScript checks and production build
  passed. No migration or capability schema changed.
- Isolated real-Electron `partyHistoryRead` passed in run
  `functional-1789297299330-1173056`, including both themes, complete alert/button
  geometry at 360/240 px, Enter retry, unchanged Party data and unchanged stored
  history after process restart. No new warning regression. Both screenshots
  were inspected; all error text and the retry button remain visible.
- Domain-document statements were checked against `applyXpAdjustment`, the
  Party store's rest updates and the confirmed Party window specification.

Plan audit: pass. Current request identity invalidates stale available actions
at render time; effect cleanup suppresses superseded/unmounted replies. Empty
success and loading have no error footer. Read retry never calls any command
port; original uncertain-command recovery and draft coordination stay in place.
The native retry button has focused component coverage and actual Enter coverage.

Roadmap audit: package 1 passes all local acceptance criteria for F5/F7b. The
historical dropdown is explicitly retired, current XP/rest rules no longer
contradict the Party specification, and the normal compact layout is unchanged.
The required exact-SHA Candidate/Check, handoff, promotion and Main evidence
remain outstanding; package 1 is not yet delivered. Packages 2–4 remain open.

### Package 1 delivery — 2026-09-13

Closed after verifying all three delivery boundaries for
`4b885295ffd0e406daa1d0a030d00c8b529b1255`:

- Candidate Check: https://github.com/ThonkTank/Salt-Marcher/actions/runs/34753469862
  (all 16 required jobs passed).
- Canonical `corepack pnpm handoff:app`: completed; state
  `a0ec877f-86b5-4bd5-8ea4-5c287a63a1dc`, original attempt
  `0db4b1b8-a6e3-4cdf-ad26-922bed302907`; packaged and installed bytes both
  `ef312a046da3f5be3a9f7fb956d0fa5a4248fa33f5a1e4fbffad4e421e8e9123`.
  Backup `532d4808-6a39-438c-bd68-566923b15873` preceded activation;
  installed-runtime verification passed.
- Promotion used that same SHA; PR #688 merged. Main Check passed:
  https://github.com/ThonkTank/Salt-Marcher/actions/runs/34754430009.

## Package 2 plan — 2026-09-13

Baseline: `origin/main@4b885295ffd0e406daa1d0a030d00c8b529b1255`, clean branch
`codex/party-remediation-2`. Package 1 is closed. The original checkout's local
document modification remains outside this work.

1. Expose a read-only inspection from the existing profile-lock owner, reusing
   its metadata schema and PID/boot/start/executable identity comparison. Return
   absent/stale, live-owner, or unknown evidence without removing any lock.
   Missing identity support files must not count as a missing process.
2. Compose installation availability from canonical profile/launch locks and
   compatible legacy runtime/launch locks. Resolve profile aliases with the
   existing canonical-path mechanism. A live owner means busy; uncertainty
   prevents a free result. Keep the final installation lock authoritative for
   app starts after the preflight and preserve existing lock/receipt formats.
3. Put that admission check before candidate/artifact acquisition and attempt
   creation in canonical handoff. Keep the legacy process scan as supplemental
   compatibility behavior in the already-locked installer; do not confuse its
   Boolean result with the authoritative preflight.
4. Correct the AGENTS resume invocation. Test the actual package-script/front
   door argument forwarding and real canonical entrypoint rejection on an
   occupied or unknown isolated installation before it can reach external
   qualification, download, or handoff-state writes.
5. Cover live/stale/malformed/unreadable evidence, missing process identity,
   canonical aliases, launcher reservations, a late app start, and read-only
   inspection. Reuse and extend state-machine resumption checks to prove normal
   close followed by resume retains hash-proven completed phases.
6. Run focused format/lint/types and lock/installation/handoff/architecture
   tests; separately audit plan and roadmap. Qualify, hand off and promote the
   exact SHA under current repository rules before starting package 3.

Acceptance: free/busy/unknown diagnosis independent of executable spelling;
unknown never admitted; no lock/process deletion by diagnosis; material work
blocked early; final locks still stop races; documented resume command accepted
through the real entrypoint; previous phase identities and proofs retained.

### Package 2 local validation and audit preparation

- 112 tests passed across profile locks, installation preflight, actual handoff
  entrypoints, Local installation, handoff resources/state machine/dry-run
  (six files, 249.30 s). The documented package command forwarded `--resume`;
  busy/unknown entrypoint tests stopped before qualification in an isolated
  workspace without Git metadata and created no artifact/attempt directories.
- 18 Local startup/launcher tests passed (919 ms). A real `launchDesktop`
  invocation selected its deployment and ran a child probe: admission reported
  busy while the launcher retained its reservation, then free after normal exit.
- Type checks, focused ESLint/Prettier and production build passed.
- The live/stale inspection uses the original Zod lock schema and process
  identity owner. Read-only inspection leaves stale/live/invalid metadata intact;
  missing process support data is unknown. A missing process directory is
  independently established before considering an owner gone.
- Original checkout status still contains only the pre-existing modified
  `action-scoped-draft-coordination-execution.md`.

Plan audit so far: the shared read-only owner and composed canonical/legacy
inspection are in place; admission precedes candidate qualification, artifact
acquisition and attempt creation. Final installation leases remain unchanged.
The installed-application Boolean scan remains supplemental inside the locked
installer and is no longer authoritative handoff admission. There is no new
persistent format or IPC contract. Real entrypoint and late-start/resume proof
checks pass. Architecture and process-interruption results are still pending;
therefore phase validation and final audits are not closed yet.

### Package 2 final local audits

Architecture and real-process installation interruption validation completed:
seven files, 87 tests passed in 453.48 s. Together with the prior focused and
launcher checks, 217 relevant tests passed. The interruption tests retained
their original per-child and per-case deadlines; no assertion or warning gate
was disabled. Build, type checks, format and lint are green.

Plan audit: pass. All six implementation/validation steps are represented by
current code and tests. Canonical and legacy lease formats and the public
installer module surface are unchanged. The actual stable launcher and actual
package command are exercised; admission blocks before any candidate lookup,
download or attempt state. Existing final lease acquisition still prevents a
late-start race, and normal close permits continuation with the same backup
proof. Original handoff identity and hash-chain reuse remain covered by the
existing state-machine boundary cases.

Roadmap audit: F6/F7a local acceptance passes. Diagnosis is read-only and based
on shared profile/process identity, independent of current/deployment AppImage
spelling. Missing/unreadable/invalid metadata cannot grant admission. The
current AGENTS invocation now matches the tested `pnpm handoff:app --resume`.
No migration, new persistence format, process termination, live-lock removal,
or weakening of handoff/promotion checks was introduced. Exact-SHA remote
qualification, canonical handoff and Main confirmation remain delivery work.

### Package 2 delivery — 2026-09-13

Closed for `e77a997db9e94966488086c6a55ff3d9eeb9f6f7` after:

- Candidate Check https://github.com/ThonkTank/Salt-Marcher/actions/runs/34755246055
  passed all 16 required jobs.
- Canonical handoff completed with state `9fe524af-2971-4d08-9123-604955b38e2f`,
  original attempt `bdb8af76-9b81-40c6-aac0-c488952cc41a`. Downloaded and installed
  bytes both hash to `43f0ff20504223b6e1f234ab8b00a4dbb2c531d8f6e9d7849a16cda2bd212f46`.
  Backup `b8bfe53b-2c59-4c06-bcac-cfecac186a62` preceded activation, and installed
  runtime readbacks passed.
- The same SHA was promoted; PR #689 merged. Main Check passed:
  https://github.com/ThonkTank/Salt-Marcher/actions/runs/34756202235.

## Package 3 plan — 2026-09-13

Baseline: clean `codex/party-remediation-3` from current Main
`e77a997db9e94966488086c6a55ff3d9eeb9f6f7`. Package 2 is closed.

1. Measure the existing eleven-case `sceneDesktop` suite in a detached baseline
   worktree at that SHA, with its own build/output/test profiles and the same
   host/toolchain. Keep this immutable while editing the candidate. Preserve
   suite/per-case timings as the comparison baseline.
2. Extract the eleven `it` bodies into separate registered specs, retaining
   their original acceptance titles/assertions. Export only existing shared
   save/geometry/scene-navigation helpers. Each spec resumes its own seeded
   campaign before any reads; initial restarts that only inherited previous
   test state become normal initial navigation. Internal restart assertions keep
   the same scenario profile.
3. Make setup dependencies explicit: map/combat opens its own reference document;
   travel prepares and starts its own combat before exercising the existing
   resolution/travel sequence. Existing fixture provides two populated scenes,
   locations, map, groups and the character library. Each scenario selects its
   needed scene/windows rather than inheriting another scenario's final state.
4. Register all specs with the existing v8 scene fixture and functional CI
   registry. Add a completeness check for the original eleven acceptance titles,
   one scenario per spec, fresh campaign entry and removal of the old combined
   spec. Preserve existing registry, fixture and warning validation mechanisms.
5. Run every scenario separately through the standard isolated runner, correct
   discovered missing setup with recorded fix rounds, and run the complete set
   in reversed order. For the fault-containment experiment, temporarily inject
   an explicit abort into the reference scenario only, run it followed by the
   Party layout/accessibility and Party action scenarios, then restore exact
   test bytes. Preserve expected failure evidence and verify the two independent
   scenarios still pass; do not ship a disabled assertion or fault hook.
6. Compare baseline and isolated timings on the same host, record fresh-start
   costs and removed inherited restarts, and replace registry estimates with
   measured suite durations. Run format/lint/types and registry/architecture
   checks before remote validation. Audit against this plan and the original
   roadmap, then deliver on the exact-SHA candidate path. No application code
   changes or new local installation are intended for this test-only phase.

Acceptance: all eleven original cases mapped and passed independently and in
changed order; reference abort contained; restart/geometry/travel/combat/history
coverage retained; actual runtime comparison; no assertion disabled or blanket
wait increase; original user document unchanged.

### Package 3 baseline and corrective round 1

The unchanged combined suite passed all eleven cases in baseline run
`functional-1789301465434-1303357`: 174819 ms total suite duration, 167.2 s
reported test duration, no regression warnings. It used a detached worktree at
`e77a997db`; the only untracked item is its dependency-directory symlink, so the
build reports dirty metadata despite unchanged tracked source. Its app-build
fingerprint is exactly `fa16f62e8e5e90ef3d3d10cbaaaafdb84ac777a68595504623ef974561685bdf`.
The candidate measurements will reuse these identical built application bytes.

Registry/order/matrix/runner checks passed (15 tests). Extraction exposed six
existing untyped WebDriver matcher calls in the new shared helper, which no
longer falls under the old spec-file lint exception. Corrective plan: express
its same error-absence and scene-attribute conditions with typed WebDriver
`waitUntil` predicates, preserving normal wait defaults and all acceptance
conditions. Do not broaden lint exceptions or remove assertions. Repeat focused
lint, then validate each independently registered scenario with the normal
isolated runner.

### Package 3 corrective round 2 — startup timing investigation

The first isolated layout, geometry and reference scenarios passed, but their
reported durations (91.4/77.1/79.1 s) suggest a repeated approximately one-minute
setup cost beyond the combined baseline. The normal-order run remains unchanged
and active. Plan: run the short shortcuts scenario with WebDriver command logs
to locate the delay. In particular, inspect the newly explicit scene selection
when that scene is already selected. If the trace confirms a redundant selection
wait, avoid that no-op while retaining scene identity verification; do not
increase deadlines or accept an unexplained cost as fixture startup overhead.
Apply any correction only after the current run is terminal, then repeat the
relevant scenarios before the reverse-order and failure-containment audit.

### Package 3 corrective round 2 result

The additional trace disproved the scene-selection hypothesis. In the existing
WebDriver shutdown, `deleteSession()` begins at 12:23:43.514 UTC, the utility
process reports closed at 12:23:43.542, and the command returns at 12:24:53.534: a
70.020 s shutdown call. No other logged gap exceeds 2.243 s. The normal selection
needs no corrective edit. The diagnostic shortcuts run passed; its duration is
not used as the primary benchmark because it overlapped the normal run. This
is session teardown overhead, not slow scenario setup or a product action.
The unchanged runner also charges shutdown to its displayed test duration, so
that label is not a pure assertion-body measurement. Final evidence will report
whole-suite time and separately identify this observed shutdown component. No
runner timeout, process-lifecycle code or acceptance assertion will be changed
to conceal the measured cost. Lint and type checks passed after round 1.

### Package 3 normal-order evidence and CI placement plan

All eleven independent suites passed on their first attempt in run
`functional-1789301907598-1312518`, 951385 ms total, with zero regression warnings.
The unchanged combined baseline took 174819 ms; isolation adds 776566 ms on
this host. Approximately 700 seconds are explained by ten additional shutdowns
of the kind measured in the command trace. This estimate is not a claim that
each shutdown was separately traced. The remaining difference includes fresh
fixtures, startup, additional explicit setup and orchestration, less three
removed inherited restarts. Layout/geometry/reference code matched the original
assertions, and a full body diff of all eleven cases found only the recorded
independent setup additions/removal of inherited initial restarts.

After fault containment and reverse-order validation, replace the temporary
zero registry durations with the rounded-up maximum of normal/reverse measured
suite durations. Distribute only the eleven newly extracted cases across the
existing four functional CI shards by assigning longest cases first to the
currently least-loaded shard. Preserve unrelated suite assignments, the visual
matrix, all four job identities and registry order grouped by functional shard.
This prevents the added profile cost from being concentrated in one CI job.
Rerun registry/matrix/completeness checks after this measured placement.

### Package 3 controlled-failure evidence

Run `functional-1789302864183-1330257` intentionally throws
`Controlled reference scenario abort` after the first reference document opens.
The standard runner reports References as the single product failure, then
passes PartyLayout (including both-theme accessibility) and PartyActions. No
retry or excluded assertion was used. The reference file was restored in a
finally block to SHA-256
`f81c206fcebf23f14659681dcc2f77279f8f0cf0c207bbad2a54a78d8985c3e2`
before the full reversed-order run began. This is expected failure evidence,
not a green run or a shipped fault hook.

### Package 3 validation and audits — 2026-09-13

The reversed-order run `functional-1789303128493-1333994` passed all eleven
suites on their first attempt, with zero regression warnings and the same
built application identity as baseline/normal/fault runs. Total 950153 ms;
normal-order total 951385 ms, baseline 174819 ms. The evidence inventory and
normalized raw outcomes are checked in under `docs/project/evidence/` with
reproduction steps and the shutdown-cost limitation.

After the final measured CI assignment, format, focused ESLint and both type
checks passed. The final architecture/registry/matrix/order run passed 80 tests
in nine files, and runner-core passed four tests. The earlier complete
architecture command passed 88 tests, including alignment/developer-feedback
checks. `git diff --check` passed. Application fingerprint recomputation equals
Main exactly: `fa16f62e8e5e90ef3d3d10cbaaaafdb84ac777a68595504623ef974561685bdf`.

Plan audit: passes. The eleven original titles and assertion bodies are mapped
to eleven independently registered specs with separate profiles. Added setup
is explicit, no earlier scenario state is used, and internal restart
persistence checks retain their scenario profile. The reference-abort
experiment caused no Party/accessibility cascade. The normal and reversed
orders pass completely; all temporary fault bytes are gone. Registry weights
are measured, the four existing functional shards remain complete, and the
visual matrix/unrelated assignments are unchanged.

Roadmap audit: F4 passes. All original restart, geometry, travel, combat,
roster and Undo/Redo acceptance cases remain covered. The real added runtime
is documented rather than hidden by timeout or assertion changes. No product
code, campaign data, schema, public contract, extra CI gate or user's original
local document was changed. F3 uses existing format/lint/type/architecture
checks before candidate submission. Package 3 is implemented and locally
validated; exact-SHA remote qualification and Main confirmation remain the
delivery steps. Package 4 has not started.

### Package 3 delivery — 2026-09-13

Closed for `aa325e9a08eabbd5bf8dab39d62d21c2561d7144`. Candidate Check
https://github.com/ThonkTank/Salt-Marcher/actions/runs/34758494155 passed all
16 required jobs. The standard promotion verified the unchanged app-build
fingerprint and promoted the same SHA without a new application installation.
PR #691 merged. Main Check passed for that exact SHA:
https://github.com/ThonkTank/Salt-Marcher/actions/runs/34759384440.

## Package 4 plan — 2026-09-13

Baseline: clean `codex/party-remediation-4` from current Main
`aa325e9a08eabbd5bf8dab39d62d21c2561d7144`. Package 3 is closed. This phase
is an investigation with a documented decision, not a production optimization.

Inspection finds that `PartyActionService.execute` captures all four state
owners before work, and each owner's `changes` recaptures its domain afterward.
Scene/travel use broad strict row schemas; combat enumerates every stored scene
and loads both runtime and history. Measurement must separate those costs from
domain work, projections, history persistence and installation reconciliation.

1. Add a reproducible test-only measurement harness using actual CampaignStore,
   LivePlayService and PartyActionService with temporary synthetic databases.
   Reuse the existing test database-access adapter. No installed profiles or
   application sources are edited. Synthetic fixtures vary characters (6/100),
   scenes (2/12/100), and independent combat/travel state: no states, small
   state sets, and larger participant/history/path sets. Include matching empty
   and populated scenes so unrelated-state cost can be distinguished from size.
2. Instrument owner capture/change methods and history/index persistence only
   within the benchmark process, restoring original methods afterward. Count
   executed prepared read/write calls and returned rows on both SQLite owners,
   with SQL shapes and exclusive phase timing. Separate transaction boundary
   time when possible, and state any measurement exclusion precisely. Capture
   output payload bytes independently from stored receipt bytes.
3. Measure XP, quick fields, short rest and move-with-new-scene through the real
   action service. Keep one selected character and a fixed active roster while
   varying unrelated data. The first history action on a reopened database is
   reported separately from seven repeated actions. Undo outside the timed
   region restores the domain fixture between repetitions and bounds history
   length; revision/receipt advancement remains real. This is service/database
   cold initialization, not an OS-cache flush or cold process measurement.
4. Run equivalent uninstrumented timing controls to quantify profiler overhead.
   Preserve raw samples/configuration, runtime/toolchain/source identities and
   a concise comparison. Validate that actions actually commit, payloads contain
   the intended changes, undo restores affected state, and unrelated owners do
   not enter the persisted payload. Small and large cases receive equal repeats.
5. Audit concrete schema coupling, including a temporary unrelated added scene
   column against the strict SELECT-* capture, in a disposable database. Record
   expected incompatibility separately from successful benchmark actions.
6. Decide from observed absolute and scaling costs. Keep the existing capture
   when no relevant disadvantage is demonstrated. If a disadvantage is proven,
   document a bounded follow-up by action/owner, expected benefit, atomicity and
   side-effect requirements, conflict protection and regression tests; do not
   perform that optimization in this phase. Run existing format/lint/types and
   appropriate tests before candidate validation, audit plan and roadmap
   separately, and deliver this investigation through the exact-SHA path.

Acceptance: reproducible real-action measurements, first/repeated separation,
query/row counts, capture/comparison/storage/total times, persisted sizes,
unrelated-scene dependence and concrete schema-coupling evidence. No production
refactor or new public contract is part of this phase.

### Package 4 fixture corrective round 1

The disposable fixture probe rejected its character draft because the real
PartyStore contract requires an explicit nullable passive-perception value.
Plan: supply that ordinary character field, verify the fixture against the
actual type/contracts, and repeat the populated-state probe before running
measurements. No benchmark samples have been accepted from the failing setup.

The same fixture/type probe also found the adapter used `SceneStore.read` rather
than its actual `snapshot` method. Correct that call in this fixture-only round;
its missing return type caused the dependent implicit-any diagnostics. The
small real-action probe already passed XP, quick fields, rest and move, their
Undo checks and the expected unrelated-column failure; it is diagnostic only.

### Package 4 corrective round 2 — measurement boundary and lint

The first full series is diagnostic. Review found its quick-field closure
reads the expected settings revision inside the timed region, whereas other
inputs are prepared outside. Move that input lookup outside for an equivalent
service-call boundary. Lint also identifies one unused fixture assignment and
two `this` aliases in instrumentation. Remove the unused read and use bound
phase/accessor callbacks while preserving wrapped method receivers; do not add
lint exceptions. Add source-file hashes to the measurement record and fail
closed on uncounted pragma calls. After the diagnostic series is terminal,
repeat format/lint/types and the full equal-repeat measurement on final harness
bytes. Do not treat the preliminary timings as accepted results.

### Package 4 corrective round 3 — profiler transaction contract

The independent row/count oracle exposed a real instrumentation defect: SQLite
transaction-mode functions are non-configurable properties, so proxying their
property reads violates JavaScript proxy invariants. Default transactions used
by the diagnostic action series passed, but the profiler must preserve the
complete callable transaction surface. Plan: wrap the transaction callable and
copy its documented mode/database descriptors with separately wrapped functions,
rather than replacing immutable proxy property values. Preserve receiver and
exclusive phase accounting. Use reflective identity reads in the restoration
test to satisfy unbound-method lint without weakening assertions. Repeat the
oracle, existing history integration tests, lint/types and final measurements.

### Package 4 corrective round 4 — matched foreign-state controls

The completed seven-case series passes all 448 real action/Undo checks and
source-hash verification. It shows large populated-state cost, while XP on 100
empty scenes remains near the small case. Audit found that empty versus
populated fixtures also changes the source scene's own combat/travel, so that
pair alone cannot isolate the foreign-scene contribution. Plan: add two matched
source-only controls (6 characters/12 scenes and 100 characters/100 scenes),
with the exact same source actors/history/path as the deep and combined cases
but zero foreign states. Enable source state by nonzero actor count rather
than foreign-state count, and require the same source-side move payload checks.
Repeat the full nine-case equal-repeat series on final harness hashes. This
strengthens the planned unrelated-state attribution without changing product
code or introducing a new optimization scope.

### Package 4 validation and audits — 2026-09-13

Accepted measurement: `party-history-measurement.json`, recorded at
2026-09-13T13:40:17.252Z, on baseline `aa325e9a0`, with exact harness source
hashes verified. Nine cases × four actions × two instrumentation modes ×
eight calls = 576 committed actions, each followed by validated real Undo.
All foreign combat/travel states remained unchanged; move histories include
both affected source owners. The seven-case and setup probes remain diagnostic
only. The report `party-history-capture-assessment.md` includes full methods,
first/repeated timings, instrumentation controls, read/write/row counts, phase
attribution, actual payload/receipt sizes and source-coupling evidence.

The matched large source-only case takes 20.84 ms median for XP; adding 50
unchanged foreign combat/journey states increases that to 224.79 ms. The
small/large XP payload stays 1305 bytes while reads rise from 42 to 3252 and
returned rows from 118 to 39536. Empty scene count alone has little XP cost;
other actions also pay existing projection costs. These are synthetic host
measurements with documented timing boundaries, not an application-wide SLO.

Format, focused lint and both type checks pass. Independent profiler oracles
and existing history integration checks pass (13 tests); full architecture
checks pass (88 tests). The explicit unrelated-column probe fails as expected
without committing history. App-build fingerprint remains exactly equal to
Main: `fa16f62e8e5e90ef3d3d10cbaaaafdb84ac777a68595504623ef974561685bdf`.

Plan audit: passes after corrective rounds 1–4. Real services and disposable
databases provide all measurements. Inputs are prepared outside the action
timer; first service/database operation, repeated calls, setup/opening and
instrumentation controls are separated. Captures and comparisons have exclusive
time accounting, transaction boundaries remain visible, unexpected SQL paths
fail closed, and hashes prove the measured harness bytes. Matched source-only
controls establish the foreign-state dependency rather than attributing all
large-case latency to it. No production source or installed data was edited.

Roadmap audit: F2 passes as an investigation. A relevant disadvantage is
demonstrated and a bounded follow-up is specified by action/domain owner, with
benefit expectations and required atomicity, side-effect, compatibility and
conflict regressions. The proposed internal scope/effect contract is explicitly
a separate implementation package, not an implicit extension of this roadmap.
The existing capture remains unchanged. F3 uses existing gates; no new CI gate
or weakened check was introduced. Exact-SHA candidate qualification, promotion
and Main confirmation are still required to deliver this evidence package.

### Cross-package audit before final delivery

All four packages now satisfy their local plan and roadmap acceptance criteria.
Packages 1–3 have recorded exact-SHA candidate/Main delivery evidence; app
packages 1–2 also have completed canonical handoffs. Package 3 preserved all
eleven acceptance cases and proved failure containment. Package 4 distinguishes
measured findings from proposed future implementation. The canonical roadmap
is unchanged and the original checkout still contains only the user's existing
`action-scoped-draft-coordination-execution.md` change, untouched by this work.
No unresolved functional discrepancy remains in the approved scope. Deliver
package 4, then record its delivery and final cross-package closure in a pure
documentation candidate so the persisted execution log has a truthful final
status without anticipating remote results.

### Package 4 corrective round 5 — Main advanced during qualification

Candidate `4fe670eb90256e5c135dbe16eaaaf17c242bfd16` passed all 16 required
jobs in Check 34760799477. Promotion then correctly refused it: Main advanced
to `6267594b27d479ecf9cacdd46f9ad71e9b129837` (compact group manager; Main
Check 34760837655 passed). No stale candidate was promoted.

Plan: rebase this task-owned candidate on the current Main while preserving
this execution log. Review incoming changes, including campaign migrations and
the updated independent group-lifecycle spec. Rerun all nine measurement cases
on the new application/schema baseline rather than reusing old qualification.
Retain the prior measured evidence as historical diagnostics in the execution
record; replace the final report/raw samples with current-baseline evidence.
Repeat focused profiler/history tests, format/lint/types and architecture checks,
then push with an exact lease on the prior task-owned branch head and obtain
fresh exact-SHA CI before promotion. App fingerprint must equal the new Main;
no handoff or unrelated application change is introduced by this rebase.

### Package 4 current-Main revalidation and audit

The candidate rebase is conflict-free. Current Main changes campaign schema
43 to 44 for group-editor receipts and adapts the isolated group-lifecycle UI
case; PartyActionService and the four state-history owners are unchanged.
Fresh fixtures therefore use schema 44. The prior accepted raw series is
preserved in commit `1c5aed433edf30a1c919867c03239b371d79c621` before the
current evidence replacement, so the earlier dated audit remains historical.

The complete replacement series, recorded 2026-09-13T14:11:12.070Z, again
passes 576 real actions and 576 Undos with all payload/foreign-state assertions.
Harness hashes match. Its measurement checkout is `1c5aed433...`; application
inputs match Main `6267594b2` exactly. Matched large XP medians are now 21.48 ms
(source only) versus 228.56 ms (50 foreign combat/journey states), confirming
the same conclusion. The report and raw samples now use only this current
baseline; prior samples are not mixed into the statistics.

Focused lint, both type checks, the combined architecture/profiler/history run
(88 tests, including the 13 profiler/history cases), and a separate complete
architecture run (88 tests) all pass. The current app fingerprint equals Main:
`ab74d3e623f229024d7c4e5def829fa1097d3e808ece6b12d5e038a701ef45e7`.
Plan and roadmap audits pass again: the investigation is complete, the bounded
follow-up remains proposed only, and no application difference or new handoff
is introduced. The rebased final SHA requires a fresh Candidate Check; the
previous green run is not reused as qualification for it.
