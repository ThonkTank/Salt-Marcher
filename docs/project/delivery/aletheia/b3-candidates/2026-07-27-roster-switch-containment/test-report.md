Status: Test phase complete
Owner: Aletheia B3 test subagent (cycle 2)
Charter Version: C-0.7.0
Process Version: B3-1.1.0
Brief: ./brief.md (frozen at 2eb6ce0ca)
Concept: ./concept.md (frozen at 7cc035669)
Product baseline: 69d026440 (branch worktree-aletheia-b3)

# B3 Test Report — Roster Containment Under Campaign Switching

## 1. Probe

`test/app/CampaignRosterSwitchContainmentTest.java`, new sibling of the
evaluated cycle-1 probe, implemented per concept section 3:

- Deciding method `rosterTruthStaysCampaignContainedAcrossMixedSwitchCycles`
  (@Order(1)): production composition route
  (`AppBootstrap.openCampaignActivationAsync` + real `CampaignDeskHost` on a
  real shown `Stage`), two Campaigns seeded through the production
  `PartyApplicationService` with a namesake "Echo" pair (optional statistics
  truly absent) plus one fully-statted Solo PC each; 5 warmup switch pairs;
  8 blocks x [fail-after-commit | successful | cancel-before-commit]
  = 24 switch cycles; per-block roster CRUD (namesake e1 stat toggling
  set/clear, create `RC-<camp>-b<n>`, delete of the previous block's create
  resolved from the projection at delete time); racing create per block at
  switch initiation with a store-XOR oracle; revoked-/parked-/closed-window
  write attempts through `PartyApi` references captured while the runtime was
  still admitted (the reference shape a production UI holds across a switch
  boundary — this lands on the `WorkflowAdmissionController` seam exactly as
  concept section 1.3 maps); deterministic cancel window via
  `installNextPriorDrainSettlementForTesting` + `state()==PARKED` entry
  detection + armed pre-commit gate (odd blocks) and stale generation (even
  blocks); fail-after-commit via `failAfterRootSwapForTesting` +
  `recoverDurableActive`; external read-only JDBC oracle on
  `player_characters` (id, name, player_name, level, passive_perception, ac,
  in_party, travel_overworld_*, attached_to_party_token) +
  `party_roster_metadata.next_character_id`; projection-vs-oracle equality,
  namesake integrity, id invariants, cross-campaign and revoked/closed scans
  after every completed switch; byte-identical target-store check after every
  cancelled switch; full restart tail with post-restart namesake edit.
- Guard method `containmentOracleDiscriminatesMisScopedImplantFromBenignWrite`
  (@Order(2)): fresh installation; deliberately mis-scoped probe-local direct
  JDBC implant of a schema-valid foreign-named row (`RC-Alpha-implant`) into
  Beta's store must trip the cross-campaign oracle, cleanup must restore it
  to 0; a benign production-route same-campaign create (`RC-Beta-benign`)
  must not trip anything and must appear in projection and store exactly
  once.

## 2. Commands and tooling

- Compile: `./gradlew --offline compileTestJava`
- Probe (foreground only, per budget; never backgrounded):
  `./gradlew --offline uiTest --tests 'app.CampaignRosterSwitchContainmentTest'`
  (runs 2 and 3 with `--rerun-tasks` to defeat up-to-date caching)
- Gradle 9.6.1; Launcher/Daemon JVM OpenJDK 21.0.11 (Red Hat); JUnit
  platform per repo harness; Monocle headless (`monocle.platform=Headless`,
  `prism.order=sw`); sqlite-jdbc from the repo test classpath.

## 3. Host-load state (quiet-host protocol, PR #559 lesson)

- 2026-07-26 (implementation day): host NOT quiet — a concurrent uiTest run
  from the aletheia-b2 worktree (`RosterNamesakeDistinguishabilityProbeTest`),
  two Gradle daemons, a Kotlin daemon, and aletheia-c `host-lease-native`
  processes; loadavg up to 10.6. Only compile iterations and one shakedown
  probe run (green) were done in that window; no deciding numbers were taken
  from it.
- 2026-07-27 (deciding runs): only this worktree's Gradle + Kotlin daemons
  running. `/proc/loadavg` immediately before each run:
  - run 1: `6.74 2.98 1.70` (1-min spike from the probe's own compile)
  - run 2: `6.91 4.13 2.23`
  - run 3: `6.53 5.59 3.12`
  Latency and heap guards remain load-caveated per brief.

## 4. Determinism (guard)

Three consecutive foreground runs of the identical probe version, all
`tests="2" skipped="0" failures="0" errors="0"`, with identical verdicts on
every deciding and control oracle. Raw JUnit XMLs: `artifacts/run1.xml`,
`artifacts/run2.xml`, `artifacts/run3.xml`. Wall time: 1m03s / 2m27s / 2m00s
(runs 2-3 include full recompile due to `--rerun-tasks`). An additional
earlier shakedown run of the pre-refactor probe (rejections then observed at
the `CampaignRuntime.components()` state guard rather than the admission
seam) also passed; it is not counted toward determinism.

## 5. Deciding metrics — raw results (all three runs identical unless noted)

### Metric 1 — cross-Campaign roster rows/mutations = 0: PASS

- Cross-campaign scan (`RC-Alpha-%` in Beta's store + `RC-Beta-%` in Alpha's
  store) asserted 0 after every one of the 24 cycles, after all cycles, and
  after restart: 0 every time, all runs.
- After every cancelled switch (8 per run), the target Campaign's full store
  truth (all rows incl. travel columns + `next_character_id`) was
  byte-identical to its pre-cancel capture: held in all 8 blocks, all runs.

### Metric 2 — namesake integrity across >= 20 cycles and restart: PASS

- 24 switch cycles per run (>= 20 required). Both `RC-<camp>-Echo` namesakes
  retained their original distinct ids at every comparison point and after
  restart; e1 carried exactly the block-parity optional statistics
  (odd: player=Mira, level=7, pp=15, ac=17; even: all truly absent/NULL);
  e2 never gained any optional statistic; Solo stats stable (3/14/16);
  zero merged, lost, or cross-linked records. The post-restart edit of
  e1(Beta) changed exactly that one row (verified row-by-row against the
  pre-restart capture), left `next_character_id` unchanged, and bumped
  nothing in Alpha.
- Id invariants held at every comparison point: unique positive ids,
  `next_character_id > max(id)`, monotonically non-decreasing.

### Metric 3 — published projection truth: PASS

- After every completed switch, every recovery, and after restart, the
  visible projection (active + reserve members: id, name, playerName, level,
  passivePerception, armorClass, membership) equaled the same-campaign JDBC
  oracle exactly; no stale, missing, or foreign-campaign entry ever visible.
- Roster mutations submitted on a revoked runtime generation (detached prior
  after fail-after-commit) were rejected synchronously and never published
  or persisted: per run 8x revoked-create `REJECTED_SYNC:
  RejectedExecutionException` and 8x revoked-move `REJECTED_RESULT:
  STORAGE_ERROR`; `RC-REVOKED-%` rows in both stores = 0 throughout.

### Metric 4 — in-flight boundary containment: PASS

- Racing create at switch initiation (8 per run): all 24 submissions across
  the three runs were ADMITTED (landed before the admission pause) and each
  was durable exactly once in its owning Campaign (Beta) and never present
  in the target Campaign (Alpha) — store-XOR oracle satisfied 24/24. The
  rejected arm of the XOR was not exercised by scheduling in these runs
  (honest note: the race is intentionally outcome-open; both arms are
  oracle-covered, only one arm occurred).
- Closed-window attempts inside the deterministic drain-settled window
  (prior PARKED, coordinator blocked before the pre-commit gate; 4 odd
  blocks per run): create `REJECTED_SYNC:RejectedExecutionException`, move
  `REJECTED_RESULT:STORAGE_ERROR` — 100% visible rejection; `RC-CLOSED-%`
  rows = 0 in both stores throughout.
- Parked-prior attempts after successful switches (8 per run): same visible
  rejections; no marker rows.
- Per run: 40 boundary write attempts, 0 admitted, 0 partially applied;
  store consistency (validator invariants + projection equality) confirmed
  after every block and after restart.
- Restored prior after every cancelled switch accepted a roster
  create+delete round trip again (8 per run).

## 6. Guard metrics

- Determinism: PASS (section 4).
- Negative control: PASS — the mis-scoped foreign-named implant tripped the
  cross-campaign oracle (`crossCampaignRows=1`) in all runs; after cleanup
  the oracle returned to 0.
- Benign control: PASS — the same-campaign create tripped nothing
  (`crossCampaignRows=0`), appeared exactly once in projection and store,
  and the full comparison point held.
- Settled-heap slope (corroborating only, vs cycle-1's 0.59 MB/cycle):
  - run 1: S0=61,676,888 S1=81,480,880 S2=83,743,824 -> 0.877 MB/cycle
  - run 2: S0=63,343,752 S1=81,576,584 S2=83,845,632 -> 0.815 MB/cycle
  - run 3: S0=61,759,472 S1=82,306,512 S2=83,636,272 -> 0.869 MB/cycle
  The overall slope is materially steeper than cycle-1's 0.59 MB/cycle and
  is reported as added evidence for the already-handed-off leak finding
  (1798e8c9e), not as a new deciding signal. Note the growth is
  front-loaded: S0->S1 ~1.5-1.7 MB/cycle, S1->S2 ~0.11-0.19 MB/cycle, so
  the linear per-cycle figure overstates the late-phase rate; load caveat
  applies. Store sidecars absent at every sample point.
- Switch-latency trend: PASS — first-4 vs last-4 mean ratio 0.80 / 0.87 /
  0.83 (all <= 1.5; latencies improved over the run). Raw nanos in the
  artifacts.

## 7. Deviations (all forced, with reasons)

1. **Cycle-1 probe compile repair** (violates the "never modify the cycle-1
   probe" instruction; unavoidable): the rebase of the evaluated cycle-1
   probe onto baseline 69d026440 left the pre-M2a call
   `new CreateCharacterCommand(draft, MembershipState.ACTIVE)` in
   `CampaignSwitchCycleContainmentTest.seedCampaign`, which no longer
   compiles (M2a reduced the record to one component). This broke
   `compileTestJava` for the whole test source set — no uiTest of any kind
   could run. Minimal semantically-equivalent repair in a separate commit:
   create via the current single-argument command, then
   `setMembership(new SetPartyMembershipCommand(1L, MembershipState.ACTIVE))`
   before the already-awaited move. No oracle, assertion, or workload of the
   evaluated probe changed. This is also a branch-hygiene finding: the B3
   role branch as handed over did not compile at the frozen baseline.
2. **Boundary attempts through captured `PartyApi` references** (refinement
   of concept 3.2/3.3 wording "on the captured stale runtime"): calling
   through `runtime.components()` after park/detach is rejected earlier by
   the `CampaignRuntime.components()` state guard (IllegalStateException),
   which never reaches the roster path. The probe instead captures
   `components().party().application()` while the runtime is still admitted
   and submits through that reference — the reference shape production UI
   actually holds across a boundary, landing on the
   `WorkflowAdmissionController` rejection point the concept names as the
   single revoked-generation rejection seam. Both guards were thereby
   observed: the state guard (shakedown run) and the admission seam
   (deciding runs).
3. **Run scheduling around a busy host**: implementation-day host was not
   quiet (concurrent B2 uiTest, aletheia-c lease processes, loadavg ~10);
   deciding runs were deferred to a quieter window and per-run load was
   recorded (section 3).

No thresholds, questions, or oracles were changed; nothing was weakened to
go green.

## 8. Honest limitations / inconclusives

- The racing-create XOR oracle only ever saw the ADMITTED arm (24/24); the
  reject arm of the race is covered by construction (same rejection seam as
  the closed-window attempts, which were exercised 12x per run) but was not
  hit by scheduling in these runs.
- The unpromoted target runtime's cleanliness in the fail-after-commit
  window is decided indirectly (JDBC truth of both stores after RESUMED +
  marker scans), as the concept specifies — it is structurally unreachable
  from any production surface, so no direct write attempt on it exists.
- Heap slope and latency numbers were taken on a shared dev machine with
  moderate background load (recorded); they are guards/corroboration, not
  deciding.

## 9. Verdict

All four deciding metrics PASS across 3 consecutive deterministic quiet-host
runs; negative and benign controls discriminate; guards clean (heap slope
reported as corroborating evidence for the known leak finding). The frozen
structural hypothesis — M2a Roster truth stays campaign-contained,
namesake-stable, and projection-accurate under adversarial Campaign
switching, cancellation, failure, and restart at baseline 69d026440 — is
corroborated; no defect found.
