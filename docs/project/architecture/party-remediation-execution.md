# Party remediation execution

Canonical scope: [Party remediation roadmap](party-remediation-roadmap.md).

## Status

| Package | Implemented | Validated | Delivered |
| --- | --- | --- | --- |
| 1 — History errors and Party documentation | Yes | Local checks passed; remote pending | No |
| 2 — Handoff preflight and invocation | No | No | No |
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
