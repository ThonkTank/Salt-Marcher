Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: Architecture migration target principles, milestones, and
per-area cycle for removing enforced role-family doctrine while preserving
behavior parity.

# SaltMarcher Architecture Migration Roadmap (v2)

Scope: Full migration of `src/**`, `tools/quality/**`,
`tools/gradle/build-harness/**`, and governance docs away from the enforced
role-family architecture toward a simpler, behavior-identical structure.

## Non-Negotiable Owner Constraints

Restate these in every agent-facing artifact derived from this plan:

- No questions directed at the owner. The owner acts only as behavioral
  oracle (uses the app, reports behavior) and reads German status notes.
- No security analysis passes.
- No pause/throttle/stop mechanisms. Git history plus revert is the safety
  model.
- Behavior parity is absolute: the application does exactly the same thing
  before and after every merged step. Any visible behavior change inside a
  migration pass is a defect. Pre-existing bugs are preserved (bug parity)
  and filed as separate R2 issues for the normal flow.

## Target Principles

1. **Locality.** A small behavior change touches few files, ideally one area.
2. **Short chains.** Intent (UI event) to state mutation: at most 3
   meaningful hops. No class whose only job is forwarding.
3. **Typed boundaries.** Enums and value types cross layer boundaries as
   themselves. No String round-trips, no duplicate enum definitions, no
   stringly-typed `kind` constants where a type exists.
4. **One representation per purpose.** State is reshaped only when a real
   consumer needs the target shape.
5. **Logic lives where its data lives.** No squeezing logic into
   view/feature god files.
6. **Structure is judged by outcomes** (cycle-free, dependency direction,
   behavior harness green, approved design implemented), never by role
   taxonomy or naming suffix.

The pilot area's final code is the living reference. Where this document and
pilot code disagree, pilot code wins and this document gets corrected via a
journal-noted amendment. The task master may amend this roadmap the same way
when reality contradicts it.

## Operating Model

- One migration task master, run in normal agent chats, is the only
  standing actor. It dispatches one step at a time to subagents:
  elaborate -> design (where the cycle requires it) -> implement ->
  Phase-1 review (local subagents) -> Phase-2 review (independent judge) ->
  merge on green CI.
- **WIP limit: exactly one area in flight**, tracked in the ledger. Never
  start area N+1 before area N is merged, green, and ledger-updated.
- Migration steps are risk class R1. The L-tier design-note obligation is
  discharged wholesale by this roadmap; the per-area design artifact (see
  cycle below) replaces it with something stronger.
- Every merged step leaves the repo buildable, green, behavior-identical.
- Revert unit = one area (or dungeon sub-slice). A failed area reverts
  whole; the failure cause goes to the journal; retry with amended design.
- Interim work outside the migration (owner bug reports, small features via
  normal chats) follows surrounding code in legacy areas and the pilot
  reference in migrated areas. It never lands in an in-flight area; the
  ledger row is checked before such work starts.

## The Per-Area Cycle (applies to every area and dungeon sub-slice)

1. **Harness check/closure.** Verify behavior harnesses cover the area's
   user-visible behavior through production routes; close gaps against the
   OLD structure first, so parity is provable across the restructure.
2. **Baseline metrics.** File count, LOC, longest intent->mutation chain,
   forwarding-only classes, String boundary round-trips. Diagnostic only.
3. **Target design (mandatory, judge-approved before implementation).**
   A short per-area design artifact containing, concretely:
   - the target class list with a one-sentence responsibility each;
   - the target call chain for 2-3 representative interactions
     (named, end to end);
   - an explicit **deletion list**: every class that will no longer exist;
   - a **seam statement**: which published surfaces foreign areas consume
     and that these stay byte-compatible until both sides are migrated;
   - what stays untouched and why.
   The judge approves the design against the Target Principles before any
   implementation starts. The required elements are a mechanical
   completeness checklist: a design missing any of them, above all a
   named deletion list, is incomplete and goes back without discussion;
   "details during implementation" is not an approvable design. For the
   pilot, this step is explicitly allowed 2-3 iterations; that is its
   purpose.
4. **Harness wiring port** (separate commit; scenarios and assertions
   frozen, and any scenario change inside a migration pass fails review
   automatically).
5. **Implementation strictly against the approved design.** Deviations
   require a design amendment commit (with reason) BEFORE the deviating
   code. "While we're here" behavior changes fail review categorically.
6. **Review = design conformance + parity + metric targets.** The judge
   checks: deletion list executed (deleted classes are gone), call chains
   match the design, seams byte-compatible, harness green with frozen
   scenarios. Metrics from step 2 are re-run against the binding targets
   (see M2). A missed target is acceptable only with an explicit, reviewed
   justification naming the concrete code reason (for example, a genuine
   async boundary forcing a fourth hop). An unexplained miss is Rework, and
   so is hitting a number through gaming (compressing lines, deleting
   comments, merging unrelated things). The numbers are served with
   judgment, never abandoned and never worshipped.
7. **Close-out.** Ledger update, German status note, owner smoke checklist
   available. The acceptance window never blocks the pipeline: the next
   area may start immediately after merge. Owner anomaly reports are
   handled whenever they arrive, as normal R2 bugs, or by reverting the
   area if the anomaly is severe and the revert is still clean. Absence of
   a report counts as acceptance; no active sign-off step exists.

## Milestone M0 - Migration Constitution and Doctrine Removal

Nothing in `src/**` production code changes in M0.

- **M0.1 Charter.** Commit this roadmap under
  `docs/project/architecture/` as the owning document for the migration.
- **M0.2 AGENTS.md amendment.**
  - Hard Rule 3 is rescinded for form-enforcing checks (they are removed
    in M0.4); it continues to apply to outcome checks (cycles, layer
    direction, behavior harnesses, doc link integrity), which may never be
    weakened.
  - The R3c freeze does not apply to migration passes under this roadmap.
  - Surface-owner table: doctrine-doc rows are replaced by "legacy areas:
    match surrounding code; migrated areas: match the pilot reference
    (ledger names the commit)."
- **M0.3 Migration ledger.** `docs/project/architecture/migration-ledger.md`:
  areas x (standard, status: pending | in-flight | done, merge commit,
  harness status). Single source of truth; at most one row in-flight.
- **M0.4 Global removal of form enforcement.** Delete all form-enforcing
  ErrorProne checkers and build-harness topology/role rules repo-wide in
  one pass. Keep only: package cycles, layer dependency direction,
  documentation link/placement basics, behavior-harness gates. CI green
  afterward (removal cannot change behavior; the gate set shrinks, the
  remaining gates stay binding).
- **M0.5 Doctrine doc and skill removal.** Delete the pattern documents
  (`domain-layer.md`, `view-layer.md`, `feature-runtime.md`, related
  enforcement inventories) and the doctrine-teaching skills
  (`domain-layer`, `view-layer-mvvm`, `feature-runtime`). Requirements,
  contract, and verification docs stay. They are behavior truth, not
  structure doctrine.
- **Done when:** gates green; grep for the removed checker names and
  doctrine docs returns nothing; a fresh agent asked to simplify a small
  legacy surface no longer refuses on Rule-3 grounds and no longer
  reproduces the role family.

## Milestone M1 - Parity Oracle

- **M1.1 Harness inventory** per area in the ledger: existing harnesses,
  which boundary classes they import, scenario coverage. Known gaps per
  `harness-gaps.md`: creatures, encountertable.
- **M1.2 Parity protocol** committed in the charter: wiring may be ported
  (separate commit), scenarios and assertions are frozen during migration
  passes. Where step 1 of an area cycle discovers nondeterministic old
  behavior, the harness asserts the deterministic envelope and the
  nondeterminism is recorded as a normal R2 issue. It is not "fixed"
  inside the migration.
- **M1.3 Pilot harness hardening** for hex: verify create/edit/paint/
  select/travel/readback coverage end to end; close gaps.
- **M1.4 Owner smoke scripts.** Per area a ~10-line German checklist next
  to the ledger.
- **M1.5 Render parity net (preparation for M4/M5).** Before any view/
  render migration, add before/after image snapshot comparison for the
  dungeon map render pipeline (render frames to images, diff). The view
  layer is where harness coverage is thinnest and owner smoke would
  otherwise carry all parity weight.
- **Done when:** ledger lists harness status for every area; parity
  protocol committed; hex harness verified end to end.

## Milestone M2 - Pilot: hex (87 files, best harness coverage)

Runs the full per-area cycle. Specific to the pilot:

- The step-3 design is the hardest and most valuable artifact of the whole
  migration; 2-3 design iterations are expected and budgeted.
- Expected shape (informative, the design decides): per-verb `*UseCase`
  classes collapse into few cohesive services; the repeated
  "mutate -> build snapshot -> publish" tail becomes one shared code path;
  forwarding-only `*Operations`/`*Port`/`*Assembly` layers are deleted with
  one composition point per area; String boundary crossings become typed;
  parallel state representations merge where no consumer needs the
  intermediate shape; the published seam consumed by shell and foreign
  areas stays byte-compatible (seam statement).
- **Reference declaration:** on close-out, the ledger names the hex commit
  as the living reference. No new pattern document is written.
- **Done when:** every binding target met or individually justified and
  accepted; harness green with frozen scenarios; owner smoke checklist
  delivered; ledger declares the reference commit; retro written to the
  journal.
- Binding targets: >=40% LOC reduction, zero forwarding-only classes,
  chain <=3 hops, zero String round-trips. Every target is met or its miss
  is individually justified in the review artifact and accepted by the
  judge; blanket waivers do not exist. The M2 retro may recalibrate a
  number for the rollout only with a written reason grounded in pilot
  evidence. Recalibration is a charter amendment, not a quiet drift.

## Milestone M3 - Rollout wave 1 (small -> large)

worldplanner (82) -> creatures (90) -> party (141) -> sessionplanner (121) ->
encountertable -> encounter (230). Each runs the per-area cycle. Creatures
and encountertable build their missing harnesses in step 1 against the old
structure.

Adjustment rule: if two consecutive areas need the same deviation from the
pilot shape, amend the charter principles once; do not accumulate area-local
folklore.

## Milestone M4 - Dungeon (644 files; five sub-slices, each a full cycle)

- **M4.1 Authored core** (`domain/dungeon/model/core/**`): real logic,
  expected to survive largely intact; the usecase/published ceremony around
  it collapses.
- **M4.2 Editor session/runtime** (`domain/dungeon/model/runtime/**` +
  `features/dungeon/runtime/**`): the 137-file feature runtime and the
  runtime usecase layer merge into one editor runtime with typed
  interaction handling. If the step-3 design shows this exceeds one
  revertable step, split by interaction family (rooms/walls, corridors,
  stairs/transitions, labels/markers); the boundary consolidation
  (`PreparedFrameFacts`/`RenderFrame`) becomes its own final step.
- **M4.3 Travel** (`runtime/travel/**` + travel published surface).
- **M4.4 Rendering pipeline** (`view/slotcontent/main/dungeonmap/**`):
  collapse the Snapshot -> Facts -> Frame -> ContentPartModel cascade to what
  the canvas needs; break up the 2,206-line ContentModel along real
  responsibilities. Image-snapshot parity (M1.5) is mandatory here.
- **M4.5 Editor view** (`view/leftbartabs/dungeoneditor/**`):
  IntentHandler/StateView slimmed against the new runtime; string-kind
  constants replaced by the typed model.

Dungeon harness suite plus image snapshots anchor parity for all slices.

## Milestone M5 - Remaining view surfaces and shell seam

- Remaining `view/**` areas (catalog, dropdowns, statetabs), per-area cycle
  with image-snapshot parity where rendering is involved.
- Shell/bootstrap: only what migrated composition points require; the shell
  API stays stable unless it forces forwarding layers to survive.
- **Data layer decision (binding):** `src/data/**` keeps its structure; it
  does real work and is not migrated per area. Its form checkers already
  fell in M0.4. Data code changes only where a migrated area's slimmer
  boundary requires an adapted gateway signature.

## Milestone M6 - Completion

Entry: ledger shows every area done.

- **M6.1 Doc teardown remainder.** Replace what is left of structure
  doctrine with ONE architecture statement (<=2 pages): the six Target
  Principles plus pointers into real code. Update AGENTS.md accordingly.
- **M6.2 Governance right-sizing.** Remove the Migration Regime from
  AGENTS.md (the amendment sunsets itself). Reduce doc metadata ceremony
  (drop `Owner`/`Last Reviewed` obligations; scope the documentation gate
  to link integrity). Merge the dual marker systems
  (`LEGACY_REMOVE_ON_TOUCH`, `PROJECT_HEALTH_DEBT`) into one.
- **M6.3 Final measurement.** Repo-wide metrics vs. pre-migration baseline
  (LOC, file count, checker count, doc line count, average chain length).
  German closing report.
- **Done when:** nothing in the repo teaches or enforces the old role
  family; a fresh agent asked to add a small feature to hex produces the
  new shape naturally.

## Standing Risks and Countermeasures

- **Cosmetic passes** ("renamed, still works"): countered by the mandatory
  deletion list in step 3 and design-conformance review in step 6.
- **Ad-hoc spaghetti / metric chasing:** countered by judge-approved design
  before implementation, amendment-before-deviation, and the dual metric
  rule: misses need individual justification, gamed hits are Rework.
- **Thin parity net in the view layer:** countered by M1.5 image-snapshot
  comparison before M4.4/M4.5.
- **Cross-area seam breakage:** countered by the seam statement. Published
  surfaces consumed by foreign areas stay byte-compatible until both sides
  are migrated; seam slimming is its own later step.
- **Interim drift in legacy areas after M0:** accepted consciously; interim
  fixes follow surrounding code, affected areas are rewritten anyway, and
  the ledger prevents collisions with the in-flight area.
- **Pilot needing several attempts:** expected and budgeted; that is what
  the pilot is for.
