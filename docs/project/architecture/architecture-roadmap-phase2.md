Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-13
Source of Truth: Phase 2 architecture decomposition roadmap after the
M0-M6 architecture migration cycle.

# SaltMarcher Architecture Roadmap — Phase 2: Decomposition

Activation: becomes Active when committed by the task master.
Predecessor: `architecture-migration-roadmap.md` (M0–M6, complete on main).
Phase 1 removed the enforced role family and collapsed forwarding chains.
Phase 2 targets what Phase 1 created or left behind: consolidation god
files, the dungeon render cascade, view-layer debt, and typed-boundary
residue.

## What carries over unchanged from Phase 1

- The owner constraints, verbatim (no owner questions; owner is behavioral
  oracle only; no security passes; no pause mechanisms; git+revert is the
  safety model; German status notes).
- The operating model: one task master in normal agent chats, subagent
  dispatch, two-phase review, one work item in flight, ledger as single
  source of truth (Phase 2 gets its own ledger section), revert unit =
  work item.
- The per-area cycle, with the design-step amendments below.
- Behavior parity remains absolute, harness scenarios stay frozen, seams
  consumed by other areas stay byte-compatible while one side is in flight.
- The existing parity nets are assets: behavior harnesses per area and
  `DungeonMapRenderParitySnapshotHarness` (image diff) for rendering work.

## Phase-1 targets are REPEALED — do not carry them forward

Phase 1 optimized for reduction: fewer files, fewer LOC, dead layers
deleted. Phase 2 optimizes for decomposition. Under Phase-2 work it is
explicitly acceptable — often expected — that **file count rises and LOC
rises slightly**. Any agent still steering by "≥40% LOC reduction" or
"fewer files is better" is working against this roadmap. Reviews must not
count LOC growth against a work item unless it comes from duplication or
forwarding.

## Phase-2 Binding Targets

Per work item, checked in conformance review; misses need individually
justified, judge-accepted exceptions; gamed hits are Rework:

1. **Cohesion:** every service/model class owns ONE structural concept or
   UI concern. Test formulation in each design: "this class is the only
   place that changes when <concept> changes."
2. **Size tripwires:** no class > 500 physical LOC and no class > 40
   members without an individual justification naming the cohesive reason.
   Tripwires are review triggers, not absolute bans.
3. **No forwarding rebirth:** a split must divide data ownership and the
   logic operating on it. A new class whose methods predominantly delegate
   to one other class is a failed split (this is the Phase-1 disease in
   reverse; both directions are Rework).
4. **Typed boundaries, completion:** zero enum↔String round-trips outside
   persistence serialization and JavaFX interop that has no typed
   alternative; each remaining instance is listed and justified in the
   design's seam statement.
5. **Chains:** area-local intent→mutation stays ≤3 hops; the Phase-1
   dungeon exceptions (7–11 hops) are re-baselined per slice with a real
   target set in that slice's design, not inherited as accepted.

## Design-step amendments (per work item)

The Phase-1 design artifact (target classes, call chains, deletion list,
seam statement) gains one mandatory element:

- **Split map:** for every god file being decomposed, a table mapping each
  responsibility cluster (named data + operations) to its target class.
  Every existing member must appear exactly once. Members that fit no
  cluster are listed explicitly — they are the design's hardest decisions,
  not leftovers to sweep into a `Misc` class. Designs with a remainder
  bucket ("Common", "Shared", "Util", "Base") holding logic are incomplete
  and go back.

## Work item W0 — Preconditions

- **W0.1 Override verification — RESOLVED.** The owner has confirmed he
  set the `judge-override` label on PR #451 himself. The override path is
  legitimate; no investigation is needed and none may be started. Phase 2
  has no owner touchpoints.
- **W0.2 Evidence archive.** Move Phase-1 migration evidence (baselines,
  target designs, close-out notes) to `docs/project/archive/migration/`.
  Ledger and roadmap stay active. Active instruction surface must not
  reference archived files. Doc line count of the ACTIVE surface is
  recorded before/after.
- **W0.3 Phase-2 ledger section** with the work items below, states, and
  the repealed-targets note, so no later agent chat resurrects Phase-1
  metrics.

## Work item W1 — Split `DungeonAuthoredApplicationService`
(1,816 LOC, 197 members)

The pilot of Phase 2: pure domain, best harness coverage, lowest risk,
teaches the split recipe. Expected clusters (informative; the split map
decides): rooms/clusters, corridors, stairs, transitions, markers,
feedback/derived-state projection. The published seam and repository
contracts stay byte-compatible. Behavior harnesses green with frozen
scenarios. Its retro calibrates the size tripwires for the rest of
Phase 2 (charter amendment if needed, evidence-based).

## Work item W2 — Dungeon render cascade

Scope: `DungeonEditorPreparedFrameFacts` (1,004 LOC, 94 members), the
Snapshot→Facts→Frame→ContentPartModel chain, `DungeonMapContentModel`
(1,652 LOC, 182 members), 14 published dungeon snapshots.

- Step 1 of the cycle here is a **consumer inventory**: for every field in
  Facts/Frame/Snapshots, which renderer actually reads it. Fields nobody
  reads are deleted; shapes collapse to what consumers prove they need.
- The Phase-1 exception (11 hops) is re-baselined; the design sets the
  real target from the consumer inventory.
- `DungeonMapRenderParitySnapshotHarness` (image diff) is mandatory and
  runs before/after every commit in this item; scenes with known
  nondeterminism assert the deterministic envelope.
- If elaboration shows one revert unit is too large, split by render
  concern (surfaces/geometry, tokens/markers, overlays/labels), image net
  per sub-item.

## Work item W3 — View god files

`WorldPlannerViewModel` (1,449), `DungeonEditorStateView` (1,347),
`CatalogControlsView` (1,304), `DungeonEditorViewModel` (1,265),
`PartyTopBarViewModel` (1,103), then remaining >500-LOC view classes by
size. Per file its own cycle pass (small revert units). Split along UI
concerns (panel/tab/control group), not technical layers — do not
reintroduce a ContentModel/PartModel taxonomy. String userData plumbing
and vocabulary `valueOf` round-trips in the touched files are converted
to typed handling in the same pass (deletion list includes the String
seams).

## Work item W4 — Sweep and close

- Repo-wide: remaining enum↔String round-trips outside the justified list;
  remaining >500-LOC / >40-member classes get a one-line disposition each
  (split, justified, or scheduled).
- Final measurement against the Phase-2 baseline (recorded in W0.3):
  cohesion outliers, tripwire violations, chain table, typed-boundary
  residue. German closing report.
- **Done when:** every class over a tripwire carries an accepted
  justification; the dungeon chain table shows re-baselined targets met;
  the image and behavior nets are green; the active doc surface did not
  grow.

## Standing risks

- **Forwarding rebirth from splits:** countered by target 3 and split-map
  review (delegation-dominant classes are Rework).
- **Misc-bucket designs:** countered by the split-map completeness rule.
- **JavaFX lifecycle breakage in W3:** countered by per-file revert units,
  behavior harnesses, image net where rendering is touched, owner smoke
  as last net.
- **Metric carryover from Phase 1:** countered by the repeal section and
  the ledger note; reviews citing LOC reduction as a merit are corrected.
- **Worth-it drift:** W2 and W3 exist because extension pain concentrates
  there. If a W3 file is untouched by any feature work and its split shows
  no consumer benefit in design, the task master may close it as
  "justified as-is" via ledger note — decomposition is a means, not a KPI.
