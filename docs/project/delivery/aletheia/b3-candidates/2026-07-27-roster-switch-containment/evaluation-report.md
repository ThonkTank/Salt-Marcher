Status: Evaluation complete
Owner: Aletheia B3 independent evaluation subagent (cycle 2, contract E-0.7.0)
Charter Version: C-0.7.0
Process Version: B3-1.1.0
Brief: ./brief.md (frozen at 2eb6ce0ca)
Concept: ./concept.md (frozen at 7cc035669)
Test report: ./test-report.md (frozen at e6baf80a4)
Product baseline: 69d026440 (M2a roster slice)
Evaluated candidate commit: e6baf80a4 (chain 2eb6ce0ca -> 7cc035669 -> 5ff46cda6 -> e6baf80a4)

# B3 Evaluation Report — Roster Containment Under Campaign Switching (cycle 2)

Independent evaluation in an isolated worktree, detached at e6baf80a4. I did
not author the brief, concept, candidate, or test; no thresholds were changed;
missing evidence is classified inconclusive, never success.

## 1. Freeze and integrity

- All chain commits exist and are reachable: 2eb6ce0ca (brief), 7cc035669
  (concept), 5ff46cda6 (cycle-1 compile repair), e6baf80a4 (probe + report +
  artifacts); product baseline 69d026440 exists.
- Production containment: `git diff --stat 69d026440 e6baf80a4 -- app features
  platform shell` produced **no output** (literally empty; exit 0). The
  product tree is byte-identical to the M2a baseline.
- Full diff `69d026440..e6baf80a4`: 16 files, 3985 insertions, 0 deletions,
  every path status `A` (pure addition), every path under
  `docs/project/delivery/aletheia/b3-candidates/` or `test/app/`. No
  modification of any pre-existing file relative to baseline.

### 1.1 Audit of the cycle-1 probe repair (5ff46cda6)

The commit modifies only `test/app/CampaignSwitchCycleContainmentTest.java`
(7 insertions, 2 deletions; 4 of the insertions are an explanatory comment).
Line-by-line finding:

- Removed: `new CreateCharacterCommand(new CharacterDraft(...), MembershipState.ACTIVE)`
  — the pre-M2a two-argument constructor. At baseline 69d026440,
  `features/party/api/CreateCharacterCommand.java` is a one-component record
  `(CharacterDraft draft)`; the old call cannot compile, and a broken
  `compileTestJava` blocks every uiTest. The repair was genuinely forced.
- Added: one-argument create plus
  `setMembership(new SetPartyMembershipCommand(1L, MembershipState.ACTIVE))`
  before the already-awaited `moveCharacters(List.of(1L), ...)`.
- Semantic equivalence verified in production source at baseline:
  `PartyRoster.createCharacter` -> `PartyCharacter.fromDraft` defaults
  membership to `RESERVE` (`PartyCharacter.java:36`), so the explicit
  `setMembership(..., ACTIVE)` restores exactly the state the old two-argument
  call produced. Id `1L` is guaranteed: each `seedCampaign` call runs once per
  freshly created campaign store whose `party_roster_metadata` singleton is
  initialized with `next_character_id = 1`
  (`PartyPersistenceSchema.java:82`), and it is the first create. Ordering is
  guaranteed: `createCharacter` and `setMembership` are queued on the same
  serial `ExecutionLane` (`PartyApplicationService`), and the subsequent
  `moveCharacters` is awaited with an asserted `SUCCESS` — which itself
  requires the character to exist.
- The hunk sits entirely inside the `seedCampaign` helper (setup, executed
  once per campaign, not per switch cycle). No assertion, oracle, workload
  loop, threshold, or teardown line of the evaluated cycle-1 probe changed.

**Verdict: the repair is a minimal, semantically equivalent compile repair
against the M2a API change. No cycle-1 oracle is weakened.** Residual note:
the original two-argument create was one atomic mutation, the repair is two
sequential mutations (one extra published roster state during setup); no
cycle-1 oracle counts setup mutations, so this is immaterial. The test
report's branch-hygiene observation (the role branch as handed over did not
compile at the frozen baseline) is accurate and worth carrying to A.

## 2. Replay (independent, foreground)

- Host load before the run: two idle Gradle daemons (this repo's wrapper,
  9.6.1) as the only gradle processes; `/proc/loadavg` = `7.75 7.47 5.04`
  (moderate background load; latency/heap guards remain load-caveated per
  brief). Load after the run: `9.17 8.43 5.70`.
- Command (foreground, 600000 ms budget, never backgrounded):
  `./gradlew --offline uiTest --tests 'app.CampaignRosterSwitchContainmentTest'`
  — BUILD SUCCESSFUL in 1m 30s, `compileTestJava FROM-CACHE`.
- Replay result: `tests="2" skipped="0" failures="0" errors="0"`.

Literal replay-vs-retained comparison (retained runs 1-3 from
`artifacts/run1.xml..run3.xml`, re-extracted by me from the raw XMLs):

| Signal | run1 | run2 | run3 | my replay |
|---|---|---|---|---|
| tests/failures/errors | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 |
| race outcomes | 8x ADMITTED | 8x ADMITTED | 8x ADMITTED | 8x ADMITTED |
| boundary attempts rejected | 40/40 | 40/40 | 40/40 | 40/40 |
| NEGATIVE-CONTROL crossCampaignRows | 1 | 1 | 1 | 1 |
| BENIGN-CONTROL crossCampaignRows | 0 | 0 | 0 | 0 |
| settled-heap slope MB/cycle | 0.877 | 0.815 | 0.869 | 0.870 |
| switch-latency last/first ratio | 0.80 | 0.87 | 0.83 | 0.85 |

Identical verdicts on every deciding and guard oracle; the replay is a fourth
consecutive deterministic pass. Heap and latency values sit inside the
retained band.

## 3. Controls (causal verification)

- Negative implant (probe lines 397-412): a schema-valid, deliberately
  mis-scoped direct JDBC row `RC-Alpha-implant` inserted into Beta's store,
  with `next_character_id` bumped to keep the store internally valid. The
  containment oracle `crossCampaignRosterRows` counts `RC-Alpha-%` rows in
  Beta's store, so the implant causally and necessarily trips it — confirmed
  in source and observed `crossCampaignRows=1` in my replay and all retained
  runs; cleanup restores 0.
- Benign control: `RC-Beta-benign` created through the production
  `PartyApplicationService` on the active Beta runtime — same-campaign by
  construction, cannot match either foreign prefix scan; asserted durable
  exactly once, visible exactly once, full comparison point and containment
  scans clean afterwards. Observed `crossCampaignRows=0` everywhere.
- Calibration limit (honest): the cross-campaign scan discriminates by name
  prefix, so it detects mis-scoped rows only when they carry the foreign
  marker. Content-level leaks are covered by the complementary oracles the
  probe also applies at every point (full-store byte equality after cancels
  and restart, projection-vs-store equality, marker scans for
  RC-REVOKED-/RC-CLOSED-). Within the probe's marker discipline the control
  pair demonstrates the oracle discriminates signal from benign noise.

## 4. Honest-notes audit

### 4.1 Racing-create reject arm (metric 4 branch coverage)

Claim under audit: the racing create's XOR oracle only ever saw the ADMITTED
arm (24/24 retained + 8/8 in my replay = 32/32); the report argues the reject
arm is "covered by construction" via the closed-window rejections.

My causal assessment from production source
(`platform/execution/WorkflowAdmissionController.java`): submission admission
is decided synchronously under a single monitor at line ~190 — if no workflow
is inherited and `state != OPEN`, the submit throws
`RejectedExecutionException`; otherwise the workflow is counted into
`activeWorkflows`, which `pauseAndDrain` awaits before the switch proceeds.
The rejection is purely state-based and does not depend on what the in-flight
switch later does (cancel, commit, or fail); there is no third outcome and no
partially-admitted state. Therefore:

- The reject arm's *mechanism* (state-guarded synchronous rejection during an
  in-flight switch) is exercised deterministically 8x per run by the
  closed-window attempts — which are themselves mutations racing a
  cancel-before-commit boundary, placed inside the drain-settled window
  (prior PARKED) rather than left to free scheduling — plus 16x revoked and
  16x parked attempts per run on the identical seam (40 rejected boundary
  writes per run, 0 admitted, 0 marker rows in any store).
- The specific *interleaving* "free-running create lands after the admission
  pause of a fail-after-commit switch" was never hit by scheduling. Because
  the rejection code path is byte-identical and outcome-independent, and the
  admitted arm plus the deterministic rejected arm are both durably
  oracle-verified, I judge the closed-window rejections to genuinely cover
  the reject arm's behavior. Metric 4's containment claim ("completes durably
  in owner XOR rejected visibly; never partial; never in target") is
  **confirmed**, with the uncovered scheduling interleaving recorded as
  residual uncertainty rather than an untested oracle branch. Had the
  rejection seam been outcome-dependent, this would have gone inconclusive.

### 4.2 Heap slope 0.82-0.88 vs cycle-1 0.59 MB/cycle

Re-derived from the raw XML numbers: run1 (83743824-61676888)/2^20/24 =
0.877; run2 = 0.815; run3 = 0.869; my replay (83567424-61681480)/2^20/24 =
0.870. The report's figures are arithmetically correct. The front-loading
note is also correct (e.g. run1 S1->S2: (83743824-81480880)/2^20/12 = 0.18
MB/cycle late-phase vs ~1.6 S0->S1), so the linear figure overstates the
late-phase rate. The cycle-2 probe performs strictly more per-cycle work
(roster CRUD, boundary attempts, JDBC scans) than cycle-1, so a steeper slope
is expected and is corroborating evidence for the already-handed-off leak
finding (1798e8c9e), not a new deciding signal. Load-caveat applies. Treated
as corroborating only, per brief.

## 5. Tool audit

- JDBC oracle vs M2a schema: `storeTruth` selects exactly the
  `player_characters` columns present in
  `features/party/adapter/sqlite/model/PartyPersistenceSchema.java` (id,
  name, player_name, level, passive_perception, ac, in_party,
  travel_overworld_map_id, travel_overworld_tile_id,
  attached_to_party_token) plus `party_roster_metadata.next_character_id`
  (singleton_id = 1, initialized to 1, floor-clamped in
  `PartyRosterMetadataSqliteStore`). Read-only, external (separate JDBC
  connections, never through production code). NULL handling via `wasNull()`
  distinguishes truly-absent optionals — required by the namesake oracle.
- Store-XOR race oracle: conditional on the observed submission outcome
  (ADMITTED -> exactly 1 row in owner store; rejected -> 0), plus an
  unconditional 0-rows-in-target assertion. Both arms are specified; see 4.1
  for arm coverage.
- ForTesting seams (`installCampaignPreCommitGateForTesting`,
  `installNextPriorDrainSettlementForTesting`, `failAfterRootSwapForTesting`,
  `activeRuntimeForTesting`, `pendingCloseAttemptsForTesting`,
  `trackedCloseObligationsForTesting`): all pre-exist at baseline 69d026440
  in `app/` production sources (the production diff is empty, so none were
  added for this candidate). They construct deterministic windows; the
  oracles themselves read only JDBC truth and the published projection.
- Calibration: the control pair (section 3) demonstrates the containment
  oracle trips on true signal and stays silent on benign writes, in every
  run. Repeatability: four consecutive identical runs (three retained + my
  independent replay).

## 6. Workload correlation

Confirmed. The probe drives the identical production composition route as
the qualified cycle-1 probe (`AppBootstrap.openCampaignActivationAsync`, real
`CampaignDeskHost` on a real shown `Stage`, `ProbeHostHarness` structurally
matching cycle-1's, minus cycle-1's weak-shell leak set which served a
cycle-1-only metric), and the roster workload goes through the same M2a
production entry points `CampaignRosterProductionJourneyTest` uses
(`components().party().application()` create/update/delete/move,
`components().party().snapshot()` projection). The boundary-attempt
refinement (captured `PartyApi` references instead of post-park
`runtime.components()` calls) is faithful to production reference shape and
lands on the admission seam the concept names; the earlier
`CampaignRuntime.components()` state guard was additionally observed in the
shakedown run. No non-production shortcut found in any deciding path.

## 7. Rollback

Verified. Relative to baseline 69d026440 the candidate is pure additions
(every path status `A`) under `docs/.../b3-candidates/` and `test/app/`,
plus the audited cycle-1 repair 5ff46cda6 — which itself only edits a file
that is an addition relative to baseline. Production (`app features platform
shell`) is byte-identical. Dropping the chain commits from the role branch
restores the baseline exactly; `main` and other checkouts untouched.

## 8. Verdict

- **Candidate test maturity: Preliminary** (Charter C-0.7.0). Grounds: four
  deterministic green runs on one quiet-ish dev host (RP-R stand-in), one
  race arm exercised only by mechanism-equivalence, heap/latency guards
  load-caveated, single-machine evidence base.
- **Disposition: qualified use.** The probe is fit to merge through a scoped
  PR per the B3-1.1.0 handoff rule (finished, evaluated, green, structural),
  carrying the limitations below. No repair of the probe is needed; no
  restart warranted.
- **Product hypothesis** (M2a roster stays campaign-contained,
  namesake-stable, projection-accurate under switching), per deciding
  metric:
  - Metric 1 (cross-campaign rows/mutations = 0): **confirmed** — 0 at every
    scan across 24 cycles x 4 runs; byte-identical target store after all 32
    cancelled switches.
  - Metric 2 (namesake integrity, >= 20 cycles + restart): **confirmed** —
    24 cycles/run, stable distinct ids, parity-exact optional statistics,
    restart-stable, edit isolation row-exact.
  - Metric 3 (projection truth + revoked rejection): **confirmed** —
    projection == JDBC oracle at every comparison point; 64 revoked writes
    across 4 runs all visibly rejected, 0 persisted/published.
  - Metric 4 (in-flight boundary containment): **confirmed** — 32/32 admitted
    racing creates durable exactly once in owner, never in target; 160
    boundary writes across 4 runs all visibly rejected with 0 partial
    application; reject-arm mechanism causally covered (section 4.1).
    Residual uncertainty: the free-running reject interleaving at
    fail-after-commit initiation was never scheduled.
- **Uncertainty**: single host, moderate background load on guards;
  name-prefix containment scan depends on marker discipline (mitigated by
  full-store equality oracles); heap slope corroborating-only.
- **Rollback status**: clean (section 7).
- **Next owner action for A**: (1) merge the candidate via scoped PR from
  the role branch (green structural probe, handoff rule); (2) carry the
  branch-hygiene finding — the handed-over role branch did not compile at
  the frozen baseline until 5ff46cda6; consider a compile gate on role-branch
  rebases; (3) the steeper roster-shell heap slope (0.82-0.88 MB/cycle) is
  added evidence on the open leak finding 1798e8c9e, front-loaded growth
  noted; (4) optional hardening, not blocking: a deterministic
  reject-arm variant of the racing create (submit after pause entry of a
  fail-after-commit switch) would close the last untested interleaving.
