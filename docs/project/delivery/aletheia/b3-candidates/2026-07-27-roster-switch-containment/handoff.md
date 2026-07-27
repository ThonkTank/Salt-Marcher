Status: Handoff (green evaluated probe → scoped PR; no product defect)
Owner: Aletheia B3 coordinator
Charter Version: C-0.7.0
Process Version: B3-1.1.0
Evaluation Version: E-0.7.0

# B3 Handoff — Roster Switch-Containment Probe (Cycle 2)

## Producer And Commits

- Product baseline: `69d026440` (main tip, M2a roster slice, PR #559).
- Chain on `worktree-aletheia-b3`: brief `2eb6ce0ca` → concept `7cc035669` →
  cycle-1 compile repair `5ff46cda6` → probe + report `e6baf80a4` →
  independent evaluation `28f3e4e50` (cherry-picked from `db5347e3e`).
- Probe: `test/app/CampaignRosterSwitchContainmentTest.java`.

## Result — Product Hypothesis CONFIRMED On All Four Metrics

Under 24 adversarial switch cycles per run (8×[fail-after-commit | success |
cancel-before-commit], 4 deterministic runs incl. independent replay):

1. Cross-Campaign containment: 0 foreign roster rows at every scan; target
   store byte-identical after all 32 cancelled switches.
2. Namesake integrity: two same-named PCs kept distinct stable ids across all
   cycles and restart; nullable-stat toggles parity-exact; single-row edits.
3. Projection truth: published Party/Roster projection == external JDBC
   oracle after every switch, recovery, restart; 64/64 revoked-generation
   writes visibly rejected, 0 persisted.
4. Boundary containment: 32/32 racing creates durable exactly once in the
   owning Campaign, never the target; 160/160 boundary writes rejected clean,
   0 partial applications.

Negative control (foreign-row JDBC implant) trips the oracle; benign
same-campaign create does not. Maturity: **Preliminary**, disposition
**qualified use** — fit to merge as a green structural regression guard.

## Corroborating Evidence For The Open Cycle-1 Leak Finding

Settled-heap slope with the M2a roster shell: 0.82–0.88 MB per switch cycle
(cycle-1 baseline: 0.59). The leak handed off at `f8fe1dbf8` grows with UI
surface, as predicted. Corroborating only; no new deciding claim.

## Secondary Findings

- Branch hygiene: after rebasing onto the M2a baseline, the evaluated cycle-1
  probe no longer compiled (M2a changed `CreateCharacterCommand` arity),
  blocking all uiTests on the role branch. Repaired minimally at `5ff46cda6`;
  the independent evaluator audited the diff as semantically equivalent with
  no oracle weakened. Process note for all roles: recompile the role branch
  immediately after every baseline rebase.
- Residual uncertainty: the racing-create reject arm never occurred by
  scheduling (32/32 admitted). The evaluator judged the mechanism covered by
  the state-based rejection path (8×/run closed-window + 32×/run
  revoked/parked rejections) but recorded the free-running interleaving at
  fail-after-commit initiation as untested. Optional hardening for A: a
  deterministic seam to force that interleaving.

## Next Owner Action

- B3 coordinator: merge the green probe chain through a scoped PR (tests +
  candidate docs only, no production changes) under normal branch/CI/owner
  rules.
- A: no repair required from this cycle. The cycle-1 leak instruction
  (`f8fe1dbf8`, umbrella #555) remains open and gains the corroborating slope
  data above.

## Reopen Trigger

Any later slice changing Party publication, roster persistence, or the
activation admission path reruns this probe; a single foreign row, merged
namesake, stale projection, or partial boundary write reopens the M2a
containment claim and requires fresh independent evaluation.
