Status: Concept complete
Owner: Aletheia B3 concept subagent
Charter Version: C-0.7.0
Process Version: B3-1.1.0
Brief: ./brief.md (frozen at 2eb6ce0ca, product baseline 69d026440)

# B3 Concept — Roster Containment Under Campaign Switching

All paths and line numbers verified against the role worktree sources at the
frozen baseline (branch `worktree-aletheia-b3`, product baseline `69d026440`).

## 1. Mechanism Map: The M2a Roster On The M1 Activation Seam

### 1.1 Where roster identity is generated and persisted

- Identity is a domain-assigned monotonic `long`, not the name.
  `PartyRoster.createCharacter` (`features/party/domain/roster/PartyRoster.java:28-35`)
  assigns `nextCharacterId` to the new `PartyCharacter`
  (`PartyCharacter.fromDraft`, `PartyCharacter.java:30-38`) and returns a new
  roster with `nextCharacterId + 1`. `PartyCharacterIdentity`
  (`PartyCharacterIdentity.java`) is a pure value object (trimmed `name`,
  nullable `playerName`) — namesakes are distinguished *only* by the `long` id.
  Update/delete/setMembership target by id (`PartyRoster.java:37-73`); deletion
  never renumbers and never decrements `nextCharacterId`, so ids are never
  reused within a campaign.
- Persistence is campaign-scoped: the `"party"` feature store is registered
  per-Campaign (`CampaignStoreManifest.java:26`) on the per-Campaign
  `campaign.sqlite` at `campaignRoot/<campaign-uuid>/campaign.sqlite`
  (`CampaignActivationCoordinator.pathFor`). Tables
  (`PartyPersistenceSchema.java`):
  - `player_characters(id INTEGER PRIMARY KEY, name TEXT NOT NULL, player_name
    TEXT, level INTEGER, current_xp, xp_since_long_rest, xp_since_short_rest,
    short_rests_taken_since_long_rest, passive_perception INTEGER, ac INTEGER,
    in_party INTEGER NOT NULL DEFAULT 0, travel_* columns,
    attached_to_party_token)`
  - `party_roster_metadata(singleton_id INTEGER PRIMARY KEY CHECK
    (singleton_id = 1), next_character_id INTEGER NOT NULL)`
- Every save is one whole-roster SQLite transaction
  (`PartyRosterSqliteStore.save`, `gateway/local/PartyRosterSqliteStore.java:24-39`):
  `setAutoCommit(false)` → delete-missing → upsert-all → save
  `next_character_id` → `commit()`, with `rollback()` on any failure.
  `PartyRosterRecordValidator` (`model/PartyRosterRecordValidator.java:19-35`)
  enforces on both load and save: unique positive ids and
  `next_character_id > max(id)`. Consequence: a *single* roster mutation can
  never be partially applied at the store level — it is atomic per SQLite
  transaction; "partial application" could only arise across the
  mutation/publication/switch composition, which is exactly what the probe
  crosses.

### 1.2 How the roster mounts on CampaignRuntime and how publication is rebuilt

- `CampaignRuntime.createComponents` builds the Party component with the
  *admitted* lanes: `PartyServiceAssembly.create(stores.party(),
  executionLane, sessionPreparationIoLane, uiDispatcher, diagnostics)`
  (`app/CampaignRuntime.java:766-767`). All roster mutations and the
  publication refresh run on the admitted `"salt-marcher-runtime"`
  `SerialExecutionLane`; there is no second route to the store.
- Rebuild on activation: `Components.start` calls
  `PartyServiceAssembly.start(party)` (`CampaignRuntime.java:851`) →
  `PartyApplicationService.refreshPublishedState()`
  (`features/party/application/PartyApplicationService.java:84-86`) →
  `repository.load()` → `PartyPublishedState.publishRoster`
  (`PartyPublishedState.java:146-164`), which republishes snapshot,
  activeParty, activeComposition, activePartyFacts, adventuringDaySummary and
  travelPositions with fresh per-runtime revision counters. This happens while
  the fresh runtime's admission is still OPEN; the runtime then pauses and
  drains itself before FOUNDATION_PREPARED (`CampaignRuntime.start`,
  `:406-415`), so the startup publication is always complete before the
  coordinator can commit a switch to it.
- On a *parked* reuse (`takeReusableParked`,
  `CampaignActivationCoordinator.java:1024,1845-1860`;
  `retirePriorAfterActivation` `:1902-1925`) there is no reload: the retained
  `PartyPublishedState` of the parked runtime is re-exposed as-is and admission
  resumes at `activateVisibleShell` → `CampaignRuntime.activatePublishedShell`
  → `admission.resumeWith` (`CampaignRuntime.java:502-522`). While parked,
  admission is paused and drained, so no write can change the store behind the
  retained projection — projection-vs-store equality across park/reuse is a
  real invariant the probe can decide.
- On restart, everything is rebuilt from the store
  (`resumeDurableActive` → fresh candidate → `refreshPublishedState`).

### 1.3 Fate of an in-flight roster mutation per switch window

All five roster mutation entry points funnel through
`PartyApplicationService.runRosterMutation`
(`PartyApplicationService.java:233-248`): load → domain mutation → `save` →
`publishRoster` → `publishMutation`, all inside a single admitted-lane task.

- **Admission closes for a switch (pause-and-drain)**: a task *already
  admitted* keeps its workflow admission and runs to full completion — the
  drain future completes only when `activeWorkflows == 0`
  (`platform/execution/WorkflowAdmissionController.java:63-72,279-289`), and
  the coordinator awaits that drain *before* the pre-commit gate and pointer
  commit (`activate`, `CampaignActivationCoordinator.java:1094-1127`). So an
  in-flight mutation is never cut mid-way: it completes durably (atomic store
  transaction) in its owning Campaign before the switch can commit.
- **Mutation submitted after pause/revoke**: `WorkflowAdmissionController
  .submit` throws `RejectedExecutionException` synchronously when state is not
  OPEN (`:183-206`). `createCharacter`/`updateCharacter`/`deleteCharacter`/
  `setMembership` are void and do not catch it — the caller gets the exception
  (visible rejection); `moveCharacters` catches it and completes with the
  storage-error `MutationResult` (`PartyApplicationService.java:137-151`).
  **This is the single revoked-generation rejection point** for roster writes:
  the admitted lane wrapper in `WorkflowAdmissionController`.
- **Activation cancels before commit** (pre-commit gate throw, stale
  generation, commit rejection): the target lease is released before commit
  (`releaseBeforeCommit`) and the prior is restored via
  `restoreConfirmedPrior` → `prior.candidate().resumeAdmission()`
  (`:1759-1816`, resume at `:1796`). Nothing was ever written to the target
  Campaign's party store (the target runtime self-paused after startup and its
  admission is never resumed), and the prior's roster accepts mutations again
  after restore.
- **Activation fails after commit** (publication failure in `rollForward`,
  `:1211-1242`): the prior candidate is `closeDetached` (admission revoked —
  all later prior-side roster writes rejected forever) and the *target*
  candidate is retained inside `RecoveryCampaign` with admission still paused;
  no production surface can reach the target's `PartyApplicationService` until
  `recoverDurableActive` promotes it and `activateVisibleShell` resumes
  admission. Containment in this window is therefore structural
  (unreachability + paused admission), and the probe decides it by the JDBC
  truth of both stores plus rejection visibility on the reachable (prior)
  side.

## 2. Workload Correlation Basis

- The cycle-1 probe (`test/app/CampaignSwitchCycleContainmentTest.java`,
  evaluated at `745450784`) already seeds roster CRUD through the production
  Party application service: `seedCampaign` (`:747-755`) calls
  `runtime.components().party().application().createCharacter(new
  CreateCharacterCommand(new CharacterDraft(...)))` and
  `moveCharacters(...)` on the production-composed runtime obtained from
  `AppBootstrap.openCampaignActivationAsync` + real `CampaignDeskHost`. The
  route is therefore already proven to carry roster writes.
- M2a's own production test, `test/app/CampaignRosterProductionJourneyTest.java`
  (`productionShellKeepsNullableRostersStableAndCampaignOwnedAcrossRestart`),
  drives the same service through the UI and asserts against the same models
  the probe will use. Exact production entry points it exercises (and the
  probe reuses directly, minus the UI layer):
  - `PartyApplicationService.createCharacter(CreateCharacterCommand)` — via
    "+ Roster-Charakter"/"Erstellen" (`createNameOnlyCharacter`, `:303-325`)
  - `PartyApplicationService.updateCharacter(UpdateCharacterCommand)` — via
    "Speichern" (`editCharacter`, `:448-483`)
  - readback via `components().party().snapshot().current()`
    (`reserveMembers`, `:791-796`) and `mutation().current()`
    (storage-error await, `:355-357`)
  - external JDBC roster oracle `durableRosterTruth` (`:420-441`):
    `SELECT id, name, player_name, level, passive_perception, ac, in_party
    FROM player_characters ORDER BY id` — the probe adopts this query
    verbatim, extended by
    `SELECT next_character_id FROM party_roster_metadata WHERE singleton_id=1`.
  - namesake pairs: two "Echo" PCs with asserted distinct stable ids
    (`:93-105`); nullable optional statistics set, cleared, and asserted
    truly absent (`:111-140`).
- `DeleteCharacterCommand` is a production API record
  (`features/party/api/DeleteCharacterCommand.java`) wired through
  `PartyApplicationService.deleteCharacter` (`:109-112`); the probe adds it to
  cover the full CRUD triangle the brief names.
- Correlation claim: the probe's roster workload is the same commands, the
  same service instance graph, the same store, and the same oracle SQL as
  M2a's own qualification — composed onto the cycle-1 switch-storm route whose
  correlation with the frozen M1 journey was independently validated at
  `745450784`.

## 3. Chosen Probe Design

### 3.1 Test class and run command

**New sibling class** `test/app/CampaignRosterSwitchContainmentTest.java`,
`@Tag("ui")`, package `app` (needed for the package-private coordinator
seams), run via
`./gradlew uiTest --tests app.CampaignRosterSwitchContainmentTest`
(foreground, 600000 ms Bash timeout per budget). Probe-local copies of the
cycle-1 idioms it needs (`ProbeHostHarness`, `runOnFx`, `awaitFxCondition`,
settle/sample helpers) — copying is the established convention (cycle-1 itself
copied the frozen journey harness) and keeps the evaluated cycle-1 artifact
untouched. Justification against extending the cycle-1 class: section 4a.

Structure: one deciding method (`@Order(1)`) plus one guard-control method
(`@Order(2)`) sharing the oracle helpers.

### 3.2 Setup and per-cycle roster script

Setup (deciding method):
1. Bootstrap at `@TempDir` installation path; production host harness on a
   real `Stage`; `openCampaignActivationAsync(campaignRoot, harness)`.
2. `create("Alpha", 0)`, seed Alpha; `create("Beta", 1)`, seed Beta. Seed per
   Campaign, all through `PartyApplicationService`:
   - two namesakes: `createCharacter("RC-<camp>-Echo")` twice → capture ids
     `e1 < e2` from `snapshot().current().snapshot().reserveMembers()`,
     assert distinct;
   - one distinct PC `RC-<camp>-Solo` with full optional stats
     (level/pp/ac set);
   - optional statistics of both namesakes initially absent (null).
3. Warmup: 5 successful Alpha↔Beta switch pairs (cycle-1 shape) →
   {Beta active, Alpha parked}; sample S0 (heap floor + latency baseline).

**Cycle mix — 8 blocks × 3 switch variants = 24 switch cycles (≥ 20 per
metric 2), mirroring cycle-1's qualified mix.** Per block:

- **Cycle A — fail-after-commit** to Alpha:
  1. Before the switch, submit one racing roster create on the active Beta
     runtime (`RC-Beta-race-b<n>`) immediately after invoking
     `switchTo(alphaId, gen)` (no await between); classify its outcome
     (SUCCESS / REJECTED_SYNC / STORAGE_ERROR) — XOR oracle in 3.4.
  2. `harness.failAfterRootSwap()` armed → expect `RECOVERY_REQUIRED`.
  3. In the recovery window, attempt `createCharacter("RC-REVOKED-b<n>")` and
     one `moveCharacters` on the captured stale Beta runtime → record
     outcomes (expected: rejected visibly; any SUCCESS counts as admitted
     revoked write = metric-3 failure evidence unless durably contained in
     Beta only — decided by the store scan).
  4. `recoverDurableActive()` → `RESUMED` on Alpha; then perform the block's
     Alpha roster mutations: `updateCharacter(e1_alpha, ...)` alternating
     optional stats (odd blocks: set level=7/pp=15/ac=17; even blocks: clear
     all to null), `createCharacter("RC-Alpha-b<n>")`,
     `deleteCharacter(id of RC-Alpha-b<n-1>)` (from block 2 on). Namesake
     `e2_alpha` is never edited.
  5. Projection-vs-oracle comparison point (3.4) on Alpha; cross-campaign and
     revoked row scans on both stores.
- **Cycle B — successful switch** back to Beta (latency-timed): same
  mutation script on Beta (`e1_beta` alternating, `RC-Beta-b<n>` create,
  previous block's delete); revoked-write attempt on the captured stale Alpha
  runtime (`RC-REVOKED-…` marker); comparison point on Beta.
- **Cycle C — cancel-before-commit** of a switch to Alpha, alternating:
  - odd blocks (deterministic gate-aligned window, section 3.3):
    drain-settlement gate + armed pre-commit gate → `PRE_COMMIT_FAILED`;
  - even blocks: stale `expectedGeneration` → `STALE_GENERATION`.
  After restore: assert Beta accepts a roster write again
  (`RC-Beta-postcancel-b<n>` create, then delete it to keep truth compact),
  comparison point on Beta, and assert Alpha's JDBC roster row set is
  byte-identical to its last comparison-point capture (metric 1).

S1 after block 4, S2 after block 8 (heap slope guard). Restart tail: 3.5.

### 3.3 Deterministic alignment with the two boundary windows

- **Cancel-before-commit window** (odd blocks of cycle C):
  1. `coordinator.installNextPriorDrainSettlementForTesting(settlement)` with
     a probe-held `CompletableFuture<Void>` — the coordinator's transition
     thread then blocks between prior drain completion and the pre-commit
     gate (`gateNextPriorDrain`, `CampaignActivationCoordinator.java:1258-1264`;
     awaited at `:1097-1101`).
  2. Invoke `switchTo(alphaId, gen)` without awaiting; wait for window entry
     deterministically via `betaRuntime.state() == PARKED`
     (`CampaignRuntime.pauseAndDrain` flips PARKING→PARKED exactly when the
     admission drain settles, `CampaignRuntime.java:567-586`).
  3. Inside the window: attempt `createCharacter("RC-CLOSED-b<n>")` and
     `moveCharacters` on the Beta runtime → expect synchronous
     `RejectedExecutionException` / storage-error result (metric 4 "rejected
     visibly" arm; recorded, and the marker must later appear in *neither*
     store).
  4. Arm the pre-commit gate (`bootstrap.installCampaignPreCommitGateForTesting`
     one-shot throw, cycle-1 idiom), complete `settlement` → await
     `PRE_COMMIT_FAILED`; phase back to ACTIVE on Beta.
  Window dwell stays far below the coordinator's 10 s phase timeout (only
  synchronous rejections happen inside it).
- **Fail-after-commit window** (cycle A): `failAfterRootSwapForTesting`
  (`app/CampaignDeskHost.java:396-398`) makes the committed publication fail
  deterministically; the reachable surface in the recovery window is the
  detached prior runtime (revoked — step 3 above). The unpromoted target is
  structurally unreachable (section 1.3); the probe decides its cleanliness
  via the Alpha JDBC scan after `RESUMED` (no `RC-REVOKED-%`/`RC-CLOSED-%`/
  foreign rows, namesake truth intact, `next_character_id` consistent).
- The **racing** submissions (cycle A step 1) are intentionally
  non-deterministic in *which* arm they land in but deterministic in the
  allowed outcomes — the XOR oracle makes them flake-proof (section 3.4).

### 3.4 Oracles

- **External JDBC roster oracle** (read-only sqlite-jdbc connection to each
  `campaign.sqlite`, cycle-1 idiom):
  - row truth: `SELECT id, name, player_name, level, passive_perception, ac,
    in_party FROM player_characters ORDER BY id`;
  - metadata: `SELECT next_character_id FROM party_roster_metadata WHERE
    singleton_id = 1`; invariants: ids unique, `next_character_id > max(id)`,
    monotonically non-decreasing across samples;
  - cross-campaign (metric 1): `COUNT(*) FROM player_characters WHERE name
    LIKE 'RC-Alpha-%'` in Beta's store and vice versa = 0 after every block
    and at the end (all probe names carry the owning-campaign prefix);
  - revoked/closed (metrics 3/4): `name LIKE 'RC-REVOKED-%' OR name LIKE
    'RC-CLOSED-%'` = 0 in both stores;
  - race XOR (metric 4): `RC-<camp>-race-b<n>` appears exactly once in the
    owning store iff its submission reported SUCCESS, and zero times anywhere
    iff it was rejected — any other combination fails.
- **Projection-vs-oracle comparison point** (metric 3), after every completed
  switch/recovery and after restart: map
  `components().party().snapshot().current().snapshot()` (active + reserve
  members → id, name, playerName, level, passivePerception, armorClass,
  membership) read on the FX thread, and assert equality with the
  `MemberTruth` row set from the JDBC oracle of the *same* campaign; assert
  the foreign campaign's member names are absent from the projection.
  Await protocol before each comparison: `mutation().current().status() ==
  SUCCESS` and the expected row visible in `snapshot().current()`
  (M2a `awaitFxCondition` idiom) — never sample JDBC before the model
  confirms completion.
- **Namesake integrity** (metric 2): at every comparison point and after
  restart, `e1`/`e2` of the active campaign still exist with their original
  ids; `e1` carries exactly the block-parity stats; `e2` has never gained any
  optional stat; no merged/lost/cross-linked record (id sets checked
  per-campaign across all 24 cycles + restart).
- **Guards**: settled-heap floor at S0/S1/S2 → slope per cycle recorded and
  compared against cycle-1's 0.59 MB/cycle (report-only, corroborating);
  success-switch latency first-4 vs last-4 mean ratio ≤ 1.5 (load-caveated);
  determinism = 3 consecutive quiet-host runs in the evaluation protocol.

### 3.5 Restart verification (metrics 2/3/4 tail)

Capture both campaigns' full JDBC truth (rows + `next_character_id`), close
the bootstrap, reopen a second `AppBootstrap` on the same installation path,
`resumeDurableActive()` → `RESUMED` on the last durable campaign (Beta):
- projection == JDBC oracle for Beta (exact member-truth equality);
- Alpha's JDBC truth byte-identical to the pre-restart capture;
- one post-restart namesake edit on Beta (`updateCharacter(e1_beta, …)`)
  succeeds, changes only `e1_beta`'s row, and bumps nothing in Alpha;
- cross-campaign and revoked/closed scans still 0.

### 3.6 Negative and benign controls (guard method, `@Order(2)`)

Fresh mini-setup (own temp dir, one bootstrap, Alpha+Beta created and seeded
with one namesake pair each):
- **Negative control — mis-scoped write must trip the oracle**: a probe-local
  direct JDBC write into *Beta's* store of a schema-valid row named
  `RC-Alpha-implant` (INSERT into `player_characters` with
  `id = next_character_id`, then bump `party_roster_metadata`). Assert the
  cross-campaign containment oracle reports > 0. Then delete the implant and
  restore the metadata; assert the oracle returns to 0 and Beta's projection
  after a `refreshPublishedState`-triggering benign mutation still matches
  the store.
- **Benign control — same-campaign write must not trip**: one extra
  production-route `createCharacter("RC-Beta-benign")` on Beta; assert the
  cross-campaign and revoked oracles stay 0 and the row appears in Beta's
  projection and store exactly once.
This proves the containment oracle discriminates scope violations from benign
writes without touching production code.

## 4. Alternatives Considered

- **(a) Extend the cycle-1 class vs new sibling class — chosen: sibling.**
  Extending would mutate an already-evaluated frozen probe (evaluation
  `745450784` names that class at baseline `fb229a119`), destroying the
  audit chain and letting cycle-2 edits silently change cycle-1's semantics;
  the class is also ~1100 lines with a resource-steady-state deciding oracle,
  while cycle 2's deciding oracles are roster-truth oracles. A sibling keeps
  both probes independently re-runnable and lets the evaluator rerun cycle 1
  unchanged as a regression control. Cost: some duplicated harness idioms —
  accepted, and consistent with the repo's deliberate probe-local-copy
  convention.
- **(b) Racing real mutations vs deterministic gate-aligned mutations —
  chosen: deterministic gates decide, one racing submission per block with an
  XOR outcome oracle corroborates.** Pure racing cannot guarantee the
  cancel/fail windows are ever actually hit on a loaded host (PR #559
  lesson) and would make red/green depend on scheduling; pure gate alignment
  alone would miss the "submitted concurrently with switch initiation" shape
  the brief names. The hybrid keeps every assertion deterministic (each race
  outcome is classified, then must match the store exactly) while the
  `installNextPriorDrainSettlementForTesting` + `state()==PARKED` window and
  the armed pre-commit/fail-after-root-swap seams give exact, repeatable
  boundary placement.
- **(c) UI-driven roster CRUD (M2a journey shape) vs application-service
  driven — chosen: service-driven.** Both hit the identical
  `PartyApplicationService` on the identical admitted lane; the UI layer's
  equivalence is already qualified by M2a's own journey test. Driving popups
  through 24 switch cycles would multiply headless-FX cost and flake surface
  without adding mechanism coverage for the frozen question (which is about
  publication/persistence/admission, not widget wiring).

## 5. Risks, Confounders, Controls

1. **Host contention (PR #559 lesson).** Latency and heap guards are
   load-sensitive. Controls: quiet-host protocol — before each deciding run
   record `/proc/loadavg` and running gradle/java daemons in the report;
   latency ratio is a guard (1.5×), never deciding; heap slope is
   report-only corroboration of the already-handed-off leak finding.
2. **JavaFX headless (Monocle).** Same risk profile as cycle 1. Controls:
   reuse the qualified `testsupport.JavaFxRuntime` startup, `@Tag("ui")`
   fork, FX-thread polling (`awaitFxCondition`) for every projection read,
   explicit layout pulses only where cycle 1 needed them.
3. **Timing of admission-close vs mutation submission.** A naive sleep-based
   window would be nondeterministic. Controls: window entry detected by
   `CampaignRuntime.state() == PARKED` (exact drain-settled point), window
   held open by the probe-owned drain settlement future, only synchronous
   operations inside the window, dwell ≪ the 10 s coordinator phase timeout;
   outcome classification (SUCCESS/REJECTED/NOT_COMPLETED) with store-XOR
   assertions so no single scheduling outcome can flake the probe.
4. **SQLite WAL visibility for the external oracle.** An external JDBC reader
   could in principle observe pre-checkpoint state. Controls: read only
   after the in-process mutation model confirms completion (WAL readers see
   committed transactions immediately on the same filesystem — cycle 1
   already validated this exact oracle route mid-run); sidecar
   (`-wal`/`-shm`/`-journal`) absence is checked at rest points only; the
   restart tail re-reads through a completely fresh process composition.
5. **Fire-and-forget void mutation API.** `createCharacter` et al. return no
   future; premature oracle reads would race the lane. Control: every
   comparison point is gated on `mutation().current()` and the expected row
   in `snapshot().current()` before any JDBC read (M2a await idiom).
6. **Delete/create id bookkeeping in the script.** The per-block delete must
   target the previous block's create id, resolved from the projection at
   delete time (never hard-coded), so a defect surfaces as an oracle
   mismatch, not a probe bug.
7. **Budget.** One deciding method + one control method in one `uiTest`
   invocation; ≤ 2 test-phase subagent runs; foreground gradle with 600000 ms
   timeout; no background gradle; expiry without decidable result →
   `inconclusive` per brief.

## 6. Decision Rule (unchanged from the brief)

Metrics 1–4 of the brief decide; the controls and heap/latency figures guard.
Any cross-campaign roster row, any merged/lost/cross-linked namesake, any
projection-vs-oracle mismatch after a completed switch or restart, any
revoked-window roster write that is neither durably owned nor visibly
rejected, or a partially applied roster mutation fails the frozen structural
hypothesis; all-green across 3 quiet-host runs passes it.
