# Party remediation execution

Canonical scope: [Party remediation roadmap](party-remediation-roadmap.md).

## Status

| Package | Implemented | Validated | Delivered |
| --- | --- | --- | --- |
| 1 — History errors and Party documentation | Yes | Yes | Yes — 4b885295f |
| 2 — Handoff preflight and invocation | Yes | Local checks passed; remote pending | No |
| 3 — Independent desktop scenarios | No | No | No |
| 4 — History capture investigation | No | No | No |

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
