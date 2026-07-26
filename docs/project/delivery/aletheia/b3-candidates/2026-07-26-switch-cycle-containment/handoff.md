Status: Handoff to A
Owner: Aletheia B3 coordinator
Charter Version: C-0.7.0
Process Version: B3-1.1.0
Evaluation Version: E-0.7.0

# B3 Structural Instruction — Per-Switch Memory Leak In Campaign Activation

## Producer And Commits

- Producer: Aletheia B3 (coordinator + concept/test/evaluation phase subagents).
- Product baseline: `fb229a119` (main tip, M1 slice, PR #558).
- Candidate chain on `worktree-aletheia-b3`: brief `c0e59ad6d`, concept
  `543f7417f`, probe + test report `ffffaa99b`, independent evaluation
  `d63a88f28` (cherry-picked from evaluation worktree `58dfe8e1f`).
- Probe: `test/app/CampaignSwitchCycleContainmentTest.java` (handoff-ready
  regression guard; stays on the B3 branch until A integrates it).

## Confirmed Product Finding

Every warm Campaign switch permanently retains ~0.59 MB of post-full-GC heap
(steady-state, after a one-time ~14 MB warmup component), linear and
non-decelerating through 72 measured switch cycles (settled heap 67.1 MB →
116.2 MB = 1.73×). Independent evaluation classified it per pre-registered
rule as an unbounded leak within the tested horizon; the M1 containment
hypothesis is **refuted for the resident-memory component only**.

Everything else the M1 seam claims was **confirmed** through 72 adversarial
cycles (8×[fail-after-commit | success | cancel-before-commit] ×3 blocks):
cross-Campaign mutations 0; revoked-generation writes 0 (24/24
`REJECTED_SYNC`); threads, campaign FDs, WAL/SHM sidecars, and
strongly-reachable runtime/shell aggregates exactly flat (2 = active+parked);
cancelled activations leave the prior Campaign fully usable including restart
resume.

## Mechanism (measured, attribution partial)

`jcmd GC.class_histogram` deltas over 72 cycles (live objects after full GC):
`int[]` +34.46 MB (+587 arrays, ~59 KB each — pixel-buffer scale), plus
per-cycle JavaFX scene-graph retention: +2 `Button`, +1 `Label`, +5
`NGRegion` per cycle, with matching `RectBounds`, `HashMap$Node`,
`SimpleBooleanProperty`, `PseudoClassState` growth — detached scene-graph
subtrees and render surfaces survive full GC while the runtimes/shells that
hosted them are weakly reachable only. Suspect GC-root paths (unverified):
CSS `StyleManager` caches, listeners on shared singletons surviving shell
retirement, Prism SW surfaces held by the toolkit. The leak is therefore in
UI-layer retirement, not in lane/DB/aggregate release (those are proven
clean).

## Workload And Environment

Intensified variant of the frozen M1 Alpha/Beta journey reusing its exact
production composition route (verified against
`test/app/CampaignRuntimeProductionJourneyTest.java:1127-1157`); Monocle
headless, Prism SW; Gradle 9.6.1, JUnit 6.1.2, OpenJDK 21.0.11, Linux
6.19.14. Correlation with the frozen real journey validated by the evaluator.
Raw numbers: test-report.md + artifacts/ (3 deterministic runs) and
evaluation-report.md §5 (72-cycle floors + histogram deltas).

## Alternatives And Tradeoffs

- Do nothing: a 4-hour session with ~30 switches costs ~18 MB + warmup —
  tolerable short-term, but the trend is linear with no ceiling, violates the
  `TN-22`-analogous steady-state envelope, and will erode `TN-16` readiness
  budgets as later milestones (M3 masks, M4 planning) enlarge per-shell scene
  graphs. Severity grows with every UI-heavier slice.
- Fix at retirement seam (recommended direction): make shell retirement
  actually release scene-graph roots (deregister shared-singleton listeners,
  clear CSS caches or scope them per shell, release Prism surfaces).
- Suppressing the symptom (periodic forced GC, cache caps) would hide the
  signal without releasing the retained subtrees — rejected.

## Severity, Uncertainty, Reopen Trigger

- Severity: medium now, escalating with UI surface growth; program-wide
  blast radius (every milestone rides this seam).
- Uncertainty: exact GC-root path unattributed (histogram-level only);
  absolute latency numbers were load-inflated (guards only); horizon tested
  to 72 cycles.
- Next owner action (A): integrate the probe as a regression guard (its green
  verdict currently must NOT be read as "no memory leak" — heap was demoted
  to corroborating), locate and cut the GC-root path, then re-promote the
  heap slope to a deciding metric with a calibrated last-48-cycle bound and a
  heap-shaped negative control (evaluation disposition: repair of the probe's
  oracle in that follow-up).
- Reopen trigger: any post-fix run with `CYCLE_BLOCKS ≥ 24` whose last-48-
  cycle settled-heap slope exceeds the calibrated bound reopens this finding;
  independent re-evaluation required before any `Final` claim on the
  activation seam.

## Maturity

Candidate test: **Preliminary** (evaluator verdict; qualified use as
regression guard for the confirmed metrics, repair path named above).
Product hypothesis: confirmed except resident-memory component — refuted.
