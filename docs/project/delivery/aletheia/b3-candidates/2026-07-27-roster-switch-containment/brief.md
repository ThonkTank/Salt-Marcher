Status: Frozen
Owner: Aletheia B3 coordinator
Charter Version: C-0.7.0
Process Version: B3-1.1.0
Evaluation Version: E-0.7.0

# B3 Candidate — Roster Containment Under Campaign Switching

## Frozen Question

At product baseline `69d026440` (M2a Campaign Roster slice, PR #559), do the
new Party/Roster publication and persistence paths keep Roster truth
campaign-contained, namesake-stable, and projection-accurate under Campaign
activation switching, cancellation, and restart?

Falsifiable structural hypothesis under test: the M2a Roster
(`features/party` domain/application/publication plus its campaign-scoped
SQLite store) mounted on the M1 activation seam preserves `TN-01` identity
and `TN-02` ownership isolation under the same adversarial switch conditions
that qualified the seam itself — including in-flight roster mutations at
switch boundaries.

## Why This Candidate

- Changed surface: M2a rewrote `PartyPublishedState`/`PartyPublishedProjection`
  (+146 changed lines), roster domain identity
  (`PartyCharacterIdentity`, draft/progress/combat profile), and strict
  current-v1 persistence — the first Campaign-owned feature integrated onto
  the activation seam after M1 froze.
- M2a's own qualification proved roster journeys and warm-switch readiness in
  a quiet window, but did not adversarially cross roster mutations with
  activation cancellation/failure boundaries (cycle-1 probe seeded scenes/
  encounters/party-move, not roster CRUD; M2a tests exercised roster, not
  switch storms).
- Program-wide risk: every later slice (M3 current-Party, M4 planning) builds
  on exactly this publication path; a containment or staleness defect here
  propagates into every Party-consuming milestone. `TN-01`, `TN-02`, `TN-07`
  are the milestone's chief technical needs.

## Frozen Inputs

- Product commit: `69d026440` (green main tip; M2a product commits
  `830d12f82`, `4a55c3855`). Role worktree `.claude/worktrees/aletheia-b3`,
  branch `worktree-aletheia-b3` (rebased, B3 probe chain on top).
- Technical needs: `TN-01` (stable semantic identity, namesakes), `TN-02`
  (single owning scope, no cross-scope mutation), `TN-07` (membership
  authority), `TN-15` (durability acknowledgement — guard only), `TN-16`
  (restart resume truth).
- Workload: extension of the cycle-1 qualified switch-cycle route (production
  composition, `AppBootstrap.openCampaignActivationAsync`, real
  `CampaignDeskHost`), whose correlation with the frozen M1 journey was
  independently validated at `745450784`; roster CRUD seeds replace/augment
  scene-only seeds: per cycle create/edit/delete roster PCs including two
  same-named PCs per Campaign, with optional statistics omitted or edited,
  through the production Party application service.
- Resource profile: local dev machine standing in for `RP-R`; absolute
  latencies are guards only. Quiet-host discipline per PR #559 lesson: check
  host load before heavy runs; record concurrent daemons in the report.
- Tooling: existing repo harness (Gradle 9.6.1, JUnit, Monocle headless),
  external read-only JDBC oracle from cycle 1. No new external tools.

## Deciding Metrics

1. Cross-Campaign roster rows or mutations across all cycles = 0: Campaign
   B's roster is byte-identical (external JDBC oracle) after every Campaign A
   mutation, switch, cancelled switch, and failed switch, and vice versa
   (`TN-02`).
2. Namesake integrity: two same-named PCs per Campaign retain distinct stable
   identity and independent edits across ≥20 switch cycles and restart; zero
   merged, lost, or cross-linked records (`TN-01`).
3. Published projection truth: after every completed switch and after
   restart, the visible Party/Roster projection equals the per-Campaign JDBC
   oracle exactly — no stale, missing, or foreign-campaign entries; a roster
   mutation submitted on a revoked runtime generation is rejected and never
   published (`TN-02`/`TN-16`).
4. In-flight boundary containment: a roster mutation racing a
   cancel-before-commit or fail-after-commit activation either completes
   durably in its owning Campaign or is rejected visibly — never partially
   applied, never applied to the target Campaign, and the store remains
   consistent after restart (`TN-15` as guard, deciding on containment).

## Guard Metrics

- Probe deterministic across 3 consecutive runs (quiet host).
- Negative control: a probe-local deliberately mis-scoped write (foreign
  campaign id) must trip the JDBC containment oracle; a benign extra
  same-campaign write must not.
- Settled-heap slope recorded and compared against cycle-1's 0.59 MB/cycle
  (corroborating only — the leak finding is already handed off; a materially
  steeper slope with the roster shell is reported as added evidence, not a
  new deciding metric).
- No monotonic switch-latency growth trend (ratio ≤ 1.5, load-caveated).

## Budget (preregistered)

- Concept: 1 subagent run. Test: ≤2 subagent runs. Evaluation: 1 fresh
  subagent run (foreground long runs only, 600000 ms Bash timeout — no
  background gradle). Compute: local `./gradlew` only; no paid/external
  services. Budget expiry without decidable result → `inconclusive`.

## Rollback

All probe code stays on `worktree-aletheia-b3` under `test/` and this
candidate directory; production, A's checkout, and `main` untouched.
Rollback = drop candidate commits from the role branch.

## Handoff Rule

Per B3-1.1.0: a finished evaluated green structural test may merge through a
scoped PR; a red/defect-demonstrating test stays on the handoff branch until
A integrates it with the repair. Every instruction names exact commits,
mechanism, workload, measurements, alternatives, tradeoffs, owners, severity,
uncertainty, reopen trigger. Urgent findings → Charter inbox (A's current PR
or umbrella issue #555).
