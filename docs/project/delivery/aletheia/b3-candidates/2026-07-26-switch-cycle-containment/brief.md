Status: Frozen
Owner: Aletheia B3 coordinator
Charter Version: C-0.7.0
Process Version: B3-1.1.0
Evaluation Version: E-0.7.0

# B3 Candidate — Switch-Cycle Containment And Resource Steady State

## Frozen Question

At product baseline `fb229a119` (M1 Campaign activation slice, PR #558), does
repeated warm Campaign switching — including cancelled and failed activations —
leak execution-lane threads, SQLite connections/handles, closure executors, or
resident memory beyond steady state, or admit any cross-Campaign or
revoked-generation mutation?

Falsifiable structural hypothesis: the activation seam
(`app/CampaignActivationCoordinator`, `app/CampaignRuntime`,
`app/RevocableUiDispatcher`, `platform` execution lanes and
`WorkflowAdmissionController`) contains every runtime aggregate it creates
under repetition and mid-cycle failure, not only in the single-pass journeys
M1 qualified.

## Why This Candidate

- Changed surface: M1 introduced ~6k lines of new activation/runtime machinery
  (coordinator ~3k lines, runtime, lanes, admission controller, revocable
  dispatcher, PARKED slot, recovery fallback modes).
- M1's frozen replay (17 production journey tests at `f94c373d4`) qualified
  single and repeated switches plus pre-/post-commit fault injection, but no
  sustained cycle count with steady-state resource comparison and no
  cancelled-preparation storm.
- Program-wide risk: every later milestone (M2a–M13) mounts Campaign-owned
  features on this seam; a latent leak or containment breach has the highest
  structural blast radius in the program (`TN-02`, `TN-15`, `TN-16`;
  steady-state envelope analogous to `TN-22`).

## Frozen Inputs

- Product commit: `fb229a119` (green main tip; newest checkpoint-complete A
  slice; network fetch was denied at freeze time, so this is last-fetched
  origin/main). Role worktree: `.claude/worktrees/aletheia-b3`, branch
  `worktree-aletheia-b3`.
- Technical needs: `TN-02`, `TN-15`, `TN-16`, `TN-22` (steady-state envelope
  by analogy).
- Resource profile: local dev machine standing in for `RP-R`; absolute latency
  budgets are guards only, not deciding metrics.
- Workload: intensified variant of the frozen M1 Alpha/Beta production journey,
  reusing the production composition route of
  `test/app/CampaignRuntimeProductionJourneyTest.java` so signals correlate
  with the frozen real journey on every deciding signal.
- Tooling: Gradle wrapper + JUnit harness in repo; JVM ManagementFactory beans
  (threads, memory); platform persistence connection accounting. No external
  tools.

## Deciding Metrics

1. Cross-Campaign mutation count across all cycles = 0 (`TN-02`).
2. Writes admitted on a revoked runtime generation = 0.
3. After ≥20 switch cycles (mix of successful, cancelled-before-commit, and
   failed-after-commit activations): live non-daemon threads, open DB
   connections/statements, retained runtime aggregates within 10% of
   pre-cycle steady state (post-warmup, forced-GC settling); no growth trend.
4. Every cancelled-before-commit activation leaves the prior runtime fully
   usable: next durable mutation succeeds and survives restart.

## Guard Metrics

- Probe suite deterministic across ≥3 consecutive runs.
- Negative control: a deliberately suppressed lane release must be detected by
  the same oracle; an unrelated benign change must not trip it.
- No monotonic warm-switch slowdown trend across cycles (scaling guard).

## Budget (preregistered)

- Concept: 1 subagent run. Test: ≤2 subagent runs. Evaluation: 1 fresh
  subagent run. Compute: local `./gradlew` only; no network/paid services.
- Budget expiry without decidable result → `inconclusive`.

## Rollback

All probe code stays on `worktree-aletheia-b3`; production, A's checkout, and
`main` untouched. Rollback = drop candidate commits from the role branch.

## Handoff Rule

B3 returns only an evaluated test or a precise structural instruction for A
(exact commits, mechanism, workload, measurements, alternatives, tradeoffs,
owners, severity, uncertainty, reopen trigger) to A's current PR or the
umbrella issue #555. B3 never repairs production code.
