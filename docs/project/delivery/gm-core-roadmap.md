Status: Active
Owner: Aletheia A
Last Reviewed: 2026-07-25
Source of Truth: Revisable program-wide sequencing and completion guidance for
the interview-derived local GM core.

# GM-Core Product Completion Roadmap

## Boundary

This is temporary Product-A delivery guidance. It does not define product
behavior, technical obligations, architecture, contracts, verification policy,
or either Aletheia process. Those remain owned by the linked canonical
documents. Delete this roadmap when the complete GM core reaches the program
exit below.

The milestones are a sequencing hypothesis, not an approved fixed plan. A
milestone may move, split, merge, or disappear when practical evidence shows a
better path. Prior investment does not keep a step or foundational decision
closed. Each accepted slice must remain a usable product increment through a
real production route rather than only a structural foundation.

The owner has established that no real users or legacy data exist before the
complete GM core reaches feature completion. Legacy-data compatibility,
conversion, migration, and fallback are therefore outside every pre-completion
milestone and must not constrain its design or implementation. Current-format
restart, recovery, import, and export proof remains required where the
canonical outcomes require it; that is product correctness, not legacy
compatibility.

## Next-Step Revalidation

Before selecting every next slice, including the continuation of a partially
built milestone, revalidate:

1. which unmet canonical acceptance outcome gives the next independently
   usable GM value;
2. whether its assumed prerequisite is accepted through practical evidence or
   merely present in code, tests, prose, or an unaccepted candidate;
3. whether current production-route evidence, user observation, failures, and
   risks still support the proposed dependency order;
4. whether the step is premature, too broad, incomplete, or better split,
   merged, reordered, or deleted;
5. whether an architecture, product, domain, contract, or safety premise has
   been falsified and must reopen in its canonical owner before more product
   work; and
6. the exact production journey, causal counterexample where practical,
   independent replay, visible owner acceptance, and exit facts that will
   decide the slice.

Record only the resulting slice and compact delivery state in its one short
delivery owner. Do not turn this roadmap into a progress ledger or duplicate
the Product Process.

## Current Program State

- Within the active Campaign slice, runtime foundation commit `1c570d287` and
  installation/Campaign store-lifetime separation commit `df4d42071` are the
  accepted checkpoints recorded by the
  [Campaign Runtime Slice](campaign-runtime/README.md). This roadmap has not
  audited every other capability against every canonical acceptance outcome;
  all other milestone completion remains unassessed until live,
  requirement-by-requirement Next-Step Revalidation.
- The active Campaign branch contains the activation, whole-shell switching,
  Campaign selector, and visible exact-resume candidate. Its live evidence
  belongs in the [Campaign Runtime Slice](campaign-runtime/README.md); until
  that owner records final independent replay, required full `./gradlew check`,
  CI, installed-desktop proof, and owner acceptance, the candidate remains work
  in progress rather than an accepted milestone.
- **Next-step verdict:** M2a remains the right next product slice because
  `AC-F10` is independently useful and needs accepted Campaign isolation, but
  starting it before M1 exits is premature. No broader content lifecycle,
  current-Party/Scene transition, M2b knowledge record, or compatibility bridge
  is an entry prerequisite. After M1 acceptance, revalidate M2a once more at
  the actual boundary and open it as a separate production increment rather
  than widening the current Campaign-runtime candidate.
- No real users or legacy data exist before complete GM-Core feature
  completion. Consequently, no active or proposed pre-completion slice owes a
  legacy conversion, compatibility bridge, migration, fallback, or
  migration-shaped architectural hedge. This binding owner premise expires
  only when the Product Process compatibility covenant activates.

## Milestone Hypotheses

### M1 — Usable Campaign Activation And Exact Resume

- **Outcome and needs:** `AC-F01`, `AC-F02`, `AC-L01`, `AC-D01`; chiefly
  `TN-01`, `TN-02`, `TN-07`, `TN-15`, `TN-16`, and `TN-21`.
- **Dependency hypothesis:** whole-program work needs a truthful active-Campaign
  boundary before Campaign-owned capabilities can be integrated safely.
- **Practical proof:** a production-composition replay creates Alpha and Beta,
  proves each name-only Campaign opens with an immediately usable empty primary
  Scene, seeds each through the Campaign-owned production services, then reads
  the exact focused Scene, Running Encounter participant/HP/initiative/round,
  and Party travel location from the current production shell after repeated
  switches and process restart before making another durable mutation. The
  current-profile warm-switch population must meet the `TN-16` readiness
  budget with the representative next mutation; M13 retains normative
  `RP-R`/`RP-L`, every-supported-OS, and fully integrated state qualification.
  Fault injection covers pre- and post-commit activation failures. Separately,
  the installed application proves name-only creation plus immediate
  keyboard-operated selection, switching, and exact restart resume. This
  milestone does not claim that the still-later Party, map, or travel-authoring
  UI is already available merely to seed the isolation proof.
- **Owner acceptance:** Aaron operates the selector and all switch/restart
  states by keyboard and confirms immediate, understandable behavior.
- **Exit and reopen:** exit only after the active slice's frozen replay, full
  check, CI, installation, and owner acceptance. Reopen runtime/store/activation
  decisions on leakage, stale authority, unsafe crash truth, or unusable
  switching.
- **Exclusions:** Campaign copy, import/export/deletion and every later workflow.

### M2a — Campaign Roster

- **Outcome and needs:** `AC-F10`, the canonical one-Roster-per-Campaign
  behavior as a directly usable outcome and prerequisite for later
  current-Party and Scene outcomes; chiefly `TN-01`, `TN-02`, and `TN-07`.
  This slice does not claim final
  qualification of `AC-Q14`, `AC-L02`, or `AC-C02`.
- **Dependency hypothesis:** the first foundational assumption worth testing is
  whether the GM can manage all Campaign PCs independently from current table
  participation. Broader Campaign-object lifecycle and Party/Scene transitions
  are not prerequisites for this usable vertical slice.
- **Practical proof:** from the production UI create a PC with only a name,
  create two same-named PCs with distinct identity, edit or omit every optional
  statistic, switch Campaigns, restart, and visibly compare exact Roster truth.
  Creation must not silently enroll a PC in the current Party. A causal
  counterexample must show the current mandatory-statistics or
  automatic-membership behavior failing the same journey.
- **Owner acceptance:** Aaron creates, corrects, and distinguishes
  representative PCs entirely through the installed application and judges the
  Campaign Roster understandable without relying on current-Party controls.
- **Exit and reopen:** exit only when missing optional statistics never block
  Roster management, same-named PCs retain distinct identity, Roster creation
  leaves Party and Scene membership unchanged, and the other Campaign remains
  unchanged. Reopen identity, Roster ownership, or navigation if namesakes
  merge or the visible flow needs a bridge around the chosen model.
- **Exclusions:** current-Party participation and every Party/Scene transition;
  `AC-Q14`; Campaign copy; NPC/place/faction/Quest/rumour records; definition
  refresh; Scene attachment; completed history; generic object
  deletion/trash/restore; and compatibility work for disposable development
  data.

After M2a, Next-Step Revalidation chooses between the complete M3 current-Party
and Scene flow and a small M2b knowledge-record slice only if one concrete
downstream workflow makes that record immediately useful. The guide currently
places `AC-F07` in M3, where a note-first record has a real Running-Scene use;
`AC-F05` in M5, where both source and copied target can traverse a complete
object lifecycle; and `AC-Q14` in M4's first automatic PC workflow. Revalidation
must move any of them rather than build a preparatory bridge if those deciding
journeys are not yet possible.

### M3 — Current Party, Continuous Scenes, And Runtime Masks

- **Outcome and needs:** `AC-F07`, `AC-F08`, `AC-L02` through `AC-L07`, `AC-C02`,
  `AC-C03`; chiefly `TN-02`, `TN-03`, `TN-05`, `TN-07`, `TN-08`, `TN-10`,
  `TN-11`, `TN-15`, `TN-16`, `TN-21`, `TN-28`, `TN-31`, and `TN-34`.
- **Dependency hypothesis:** authoritative Party/Scene membership and pending
  reconciliation must precede planning, travel, and outcome work that spans
  several live contexts.
- **Practical proof:** activate and deactivate Roster PCs through the current
  Party, attach name-only creation to the focused Scene by default with opt-out,
  attach a note-first narrative record to a present place, faction, or NPC and
  resolve it manually in that real Scene workflow, then split, move, and reunite
  characters across several continuously usable Scenes and coexisting masks;
  inject Scene/Encounter failures and restart through visibly pending retry.
- **Owner acceptance:** Aaron runs the complete Scene, Party, Catalog-add,
  lightweight-create, and multi-mask flow without leaving the live workspace.
- **Exit and reopen:** exit with exactly one Scene per active PC, no implicit
  content deletion, no stale synchronized claim, and unaffected contexts
  unchanged. Reopen the Scene/mask model if practical play requires bridges or
  blocks ordinary movement.
- **Exclusions:** complete Encounter outcome, spatial travel, weather, and
  passive display.

### M4 — Manual Session Planning And Assisted Preparation

- **Outcome and needs:** `AC-F03`, `AC-F04`, `AC-P01` through `AC-P07`,
  `AC-P10`, `AC-Q12`, `AC-Q14`; chiefly `TN-01` through `TN-03`, `TN-07`,
  `TN-10`, `TN-13`, `TN-15`, `TN-21`, `TN-22`, `TN-27`, `TN-28`, `TN-31`,
  `TN-32`, `TN-36`, and `TN-37`.
- **Dependency hypothesis:** planning becomes useful after Campaign content and
  live Scene handoffs are stable; manual preparation must work before optional
  generation can add value.
- **Practical proof:** build and replace an unnamed plan without a Party,
  preserve accepted placements, then generate from a planning-only Party and
  Adventure Day; prove impossible constraints yield no partial result and one
  regeneration leaves all other edits untouched. The automatic workflow blocks
  on its missing relevant PC statistic while unrelated optional PC data remains
  optional and unrelated Roster/manual-planning work stays usable.
- **Owner acceptance:** Aaron prepares a real session manually and with
  assistance, edits the timeline, groups, treasures, Items, placements, notes,
  and weighted Encounter Table inputs, and reaches the placed content in play.
- **Exit and reopen:** exit when manual planning is independent, accepted World
  content survives plan replacement, and generation is cancellable and
  causally isolated. Reopen planning/generation ownership if drafts or accepted
  truth cannot be separated cleanly.
- **Exclusions:** weather preparation, automatic combat start, automatic award,
  and general-purpose dice rolling.

### M5 — Encounter Outcome, Rewards, Lifecycle, And History

- **Outcome and needs:** `AC-F05`, `AC-F06`, `AC-F09`, `AC-R01` through `AC-R08`,
  `AC-C01`, `AC-C04`; chiefly `TN-01` through `TN-06`, `TN-10`, `TN-12`,
  `TN-13`, `TN-21`, `TN-28`, `TN-33`, and `TN-35`.
- **Dependency hypothesis:** the Scene/mask and preparation flows supply real
  participants, groups, treasures, provenance, and authoritative contexts for
  a useful follow-up slice.
- **Practical proof:** complete an Encounter with selected rounded XP, HP/death
  carry-forward, deferred notice, partial reward distribution, ledger stack
  edits, sale/give-away reminders, loot compensation, correction, backdating,
  and restart; copy a Campaign-owned object into the other Campaign and prove
  both sides remain independently editable; change a reusable definition and
  compare current versus frozen completed facts, then delete/restore a
  referenced object while comparing current dependents, runtime, trash, and
  `[UNKNOWN]` history. Fault each coupled outcome and prove old-or-new truth.
- **Owner acceptance:** Aaron completes and corrects representative Encounter
  and Quest outcomes, distributes every Item explicitly, and judges ledger and
  explanatory history useful without losing the Running Scene.
- **Exit and reopen:** exit with atomic selected outcomes, one deferred notice,
  truthful correction links, and no inferred narrative consequence. Reopen
  transaction or history boundaries on hybrid state or opaque chronology.
- **Exclusions:** rules-complete inventory, automatic Quest resolution, coin
  deduction, and arbitrary historical replay/restore.

### M6 — Authored Dungeon World And Editor

- **Outcome and needs:** the interview-derived
  [Dungeon requirements bundle](../../dungeon/README.md), with its feature,
  editor, map-surface, and authored-content protection outcomes; chiefly
  `TN-01`, `TN-03`, `TN-05`, `TN-20`, `TN-21`, `TN-24`, `TN-28`, `TN-31`, and
  `TN-32`. The Dungeon owners define the behavior; this roadmap adds no second
  Dungeon specification.
- **Dependency hypothesis:** stable Campaign identity and content lifecycle
  should precede the dense authored Dungeon graph, while travel depends on a
  practically usable spatial and semantic Dungeon.
- **Practical proof:** author and reopen one multi-level voxel Dungeon with
  rooms, passages, doors, stairs/transitions, described surfaces, templates,
  features, and exact anchors; exercise preview/commit/undo and destructive
  geometry edits while proving invested content is retained and reassignable,
  then qualify a large sparse Dungeon through the production editor.
- **Owner acceptance:** Aaron builds and materially revises a representative
  Dungeon using the raster, relationship, room/key, description, and feature
  flows and confirms that authoring remains understandable and responsive.
- **Exit and reopen:** exit only when every Dungeon acceptance outcome is
  production-proven, installed, and owner-approved, with no authored-content
  loss across geometry change and restart. Reopen geometry/content identity,
  editor composition, or storage decisions when practical authoring needs a
  bridge, hidden duplicate truth, or unsafe destructive workflow.
- **Exclusions:** live travel behavior, procedural Dungeon generation,
  photorealistic rendering, and free-form non-grid geometry.

### M7 — Places, Travel, Hex/Dungeon Position, And Perception

- **Outcome and needs:** `AC-T01` through `AC-T07`; chiefly `TN-02`, `TN-07`
  through `TN-09`, `TN-12` through `TN-15`, `TN-20`, `TN-21`, `TN-23` through
  `TN-25`, and `TN-28`.
- **Dependency hypothesis:** continuous Scenes and history are needed before
  full-place transitions, checkpoints, interruptions, causal undo, knowledge,
  and World progression can be verified end to end.
- **Practical proof:** move a whole and partial subgroup through ordinary,
  Hex, and Dungeon places; pause/reroute/interrupt, undo/redo several committed
  checkpoints, restart, and compare positions, times, later authoritative
  facts, character knowledge, and permitted perception.
- **Owner acceptance:** Aaron authors and travels representative Hex and
  Dungeon routes, uses overrides and interruptions, reveals knowledge, and
  confirms Scene continuity and practical map interaction.
- **Exit and reopen:** exit with causal checkpoint removal, no duplicate World
  consequence, no cross-Scene rollback, and no hidden-information leak. Reopen
  place, position, time, or map decisions if one travel workflow cannot cover
  the practical routes coherently.
- **Exclusions:** core cross-map route planning, procedural Hex generation,
  autonomous faction simulation, and player-controlled display input.

### M8 — Calendar, Scene Time, Weather, And World Progression

- **Outcome and needs:** `AC-P08`, `AC-L08`, `AC-L09`, `AC-T08`, `AC-Q11`;
  chiefly `TN-08`, `TN-09`, `TN-13`, `TN-14`, `TN-25`, and `TN-27`.
- **Dependency hypothesis:** established Scene clocks, places, checkpoints, and
  history provide the authority required for calendar relevance, coherent
  weather, once-only shared consequences, and safe override release.
- **Practical proof:** advance divergent Scenes through authored fantasy
  calendar events and moving regional weather, override and release inputs,
  backdate and reunite, restart and catch up in different orders, then verify
  independent relevance and exactly-once shared effects; enable bounded Actor
  Autonomy and prove Party-danger work pauses for GM authority.
- **Owner acceptance:** Aaron configures a Campaign calendar and climate,
  advances and corrects Scene time, inspects weather/effects, and resolves a
  warned contradiction without automatic narrative adjudication.
- **Exit and reopen:** exit when model-specific weather bounds are owned and
  tested, Scene-local relevance is distinct from shared consequence, and
  supporting failure leaves play usable. Reopen time authority or the weather
  model when discontinuity or double application is observed.
- **Exclusions:** meteorological simulation for its own sake and automatic
  narrative decisions.

### M9 — Local Media, Music, And Passive Presentation

- **Outcome and needs:** `AC-P09`, `AC-L10`, `AC-T09`; chiefly `TN-14`,
  `TN-21`, `TN-24`, `TN-26`, and `TN-31`.
- **Dependency hypothesis:** focused Scene, spatial visibility, weather, and
  content tags must exist before automatic presentation can be judged safely.
- **Practical proof:** switch focused Scenes while autoplay, ambience, maps,
  and artwork react; exercise manual precedence/release, blank/replace, display
  loss, missing/damaged/slow media, restart, and a prohibited-information
  oracle.
- **Owner acceptance:** Aaron manages local media and uses the music player and
  passive second display during live play across real monitor configurations.
- **Exit and reopen:** exit with zero private/mechanical/text leaks, no stale
  unsafe frame, smooth manual control, and unaffected Scene usability under
  every media fault. Reopen projection or media boundaries on any leak or live
  coupling.
- **Exclusions:** player input, mandatory network media, and video/streaming
  platform integration.

### M10 — Shops, Trade, And Restock

- **Outcome and needs:** `AC-S01` through `AC-S08`; chiefly `TN-01` through
  `TN-03`, `TN-05`, `TN-06`, `TN-09`, `TN-10`, `TN-21`, `TN-28`, and `TN-32`.
- **Dependency hypothesis:** stable Campaign objects, Scene availability,
  character ledger, history, Item references, and authoritative time make Shop
  ownership and trade a self-contained vertical value slice.
- **Practical proof:** buy, sell, manually restock, and trigger fixed and
  weighted restock across divergent Scene clocks; delete/reassign/trash/restore
  an owner, inject coupled-write failures, and restart without duplicate stock
  or ledger/history effects.
- **Owner acceptance:** Aaron manages an NPC- and place-owned Shop from a Scene,
  completes representative trades, and judges quantities, prices, notes,
  reassignment, and restock controls.
- **Exit and reopen:** exit with atomic stock/ledger transitions, scoped
  once-only restock, preserved manual stock, and explanatory history. Reopen
  owner or Item-instance boundaries if trade requires copied or dangling truth.
- **Exclusions:** automatic coin deduction, player shopping, and economic
  simulation beyond configured stock rules.

### M11 — Recovery, Portability, And Campaign Deletion

- **Outcome and needs:** `AC-D02` through `AC-D06`; chiefly `TN-01` through
  `TN-05`, `TN-13`, `TN-17`, `TN-19`, `TN-22`, `TN-30`, and `TN-33`.
- **Dependency hypothesis:** the payload and asset families should be stable
  enough to prove complete manifests; safety mechanisms needed by earlier
  slices may land sooner and are not deferred by this ordering.
- **Practical proof:** crash and corrupt each independently addressable class,
  recover the newest unique safe state with disclosure, export a complete
  Campaign, import it on another supported OS as a new independent Campaign,
  resolve shared-definition conflicts, and trash/restore/permanently delete.
- **Owner acceptance:** Aaron performs visible recovery, cross-install import,
  conflict choice, and recoverable/permanent deletion with disposable data.
- **Exit and reopen:** exit with complete closed manifests, source-independent
  semantic readback, unaffected existing Campaigns, bounded cancellation, and
  no application-controlled resurrection after permanent deletion. Reopen
  packaging or ownership on omission, silent conflict choice, or unsafe loss.
- **Exclusions:** partial export, merge into an existing Campaign, and every
  legacy conversion, compatibility, migration, or fallback concern before
  complete GM-Core feature completion.

### M12 — Optional Capabilities And Permissioned Extensions

- **Outcome and needs:** `AC-Q07` through `AC-Q09`; chiefly `TN-27` through
  `TN-30`.
- **Dependency hypothesis:** real replaceable capabilities and retained data
  must exist before extensibility and permission isolation can be established
  by behavior rather than a speculative framework.
- **Practical proof:** add, omit, replace, disable, damage, update, revoke, and
  restore representative content, mask, generator, importer, and presentation
  extensions; probe every protected sink before/after exact consent and under
  stale handles while opening and exporting the Campaign.
- **Owner acceptance:** Aaron installs and removes a representative extension,
  understands requested data/file/network scope, changes consent, and recovers
  from an incompatible extension without losing its retained data.
- **Exit and reopen:** exit with zero undeclared protected access or safety
  bypass and no unrelated workflow/data change across absence/replacement.
  Reopen the trust or modular boundary on ambient authority or required
  cross-feature reconstruction.
- **Exclusions:** mandatory online services, remote play, generic multi-system
  rules, and permissions inferred from installation alone.

### M13 — Whole-Product Qualification And Installed Release

- **Outcome and needs:** `AC-Q01` through `AC-Q06`, `AC-Q10`, `AC-Q13`, plus
  regression and traceability over every `AC-*` and `TN-01` through `TN-37`.
  Qualification covers every obligation active before first-real-user/data
  cutover; `TN-18` is traced as conditionally inactive until the Product Process
  compatibility covenant freezes the initial released format.
- **Dependency hypothesis:** cross-platform, scale, accessibility, failure,
  cancellation, and resource qualification is meaningful only against the
  integrated product, although each earlier slice must prove its affected
  quality obligations rather than defer them here.
- **Practical proof:** run every complete GM journey offline against the
  normative `RP-H`, `RP-R`, `RP-L`, and applicable `RP-X` profiles; exercise
  supported OS, display, keyboard, scaling, localization, privacy, fault,
  cancel/retry, current-format recovery, and long-operation survivor matrices.
- **Owner acceptance:** Aaron tests and approves every visible core function in
  the installed application; documentation-only surfaces use their canonical
  gate.
- **Exit and reopen:** exit only when every interview-derived need is mapped to
  accepted production evidence, no severe finding or required need remains,
  literal local `./gradlew check` and required CI are green, supported desktop
  packages are installed/qualified, the branch is merged, and the published
  program is ready for use. Any failing journey reopens the owning milestone or
  its foundational decision rather than receiving a roadmap-only waiver.
- **Exclusions:** player-operated apps, remote play, touch/mobile layouts,
  general GM dice roller, generic game-system core, and other parked QoL.

## First-Real-User/Data Cutover Revalidation

After M13 exits and before first non-disposable use or distribution, revalidate
the exact candidate against the normative
[Product Process Compatibility Covenant](aletheia/product-process.md#compatibility-covenant).
That covenant alone defines when compatibility obligations start. Persistence
and export contracts own the resulting format semantics, and Process Evaluation
owns any process-adoption verdict. This roadmap adds no trigger condition,
waiver, format rule, or proof substitute.

Treat any missing covenant evidence as a reason to reopen its canonical owner,
not as a fourteenth feature milestone or as permission to add pre-completion
compatibility work. Once the canonical covenant records activation, this guide
may describe the boundary only as an established input to later revalidation.

## Coverage And Retirement

The milestone assignment covers `AC-F01..F10`, `AC-P01..P10`, `AC-L01..L10`,
`AC-T01..T09`, `AC-R01..R08`, `AC-S01..S08`, `AC-D01..D06`, `AC-Q01..Q14`, and
`AC-C01..C04`. The canonical requirement and technical-needs owners decide
their meaning; this list only guards delivery omission.

After M13 exits and the Product Process records compatibility-covenant
activation, delete this roadmap and every finished slice delivery owner.
Product behavior, technical obligations, architecture, contracts, tests, Git,
CI, and release artifacts remain in their respective canonical surfaces.

## Canonical Inputs

- [Program Capability Requirements](../requirements/requirements-program-capabilities.md)
- [Program Technical Needs](../architecture/program-technical-needs.md)
- [Source Architecture](../architecture/source-architecture.md)
- [Dungeon Feature Documentation](../../dungeon/README.md)
- [Program Needs Interview Baseline](../interviews/program-needs/README.md)
- [Project Interviews](../interviews/README.md)
- [Project Vision](../vision.md)
- [Resource Policy](../policies/resource-policy.md)
- [Program Charter](aletheia/program-charter.md)
- [Product Process](aletheia/product-process.md)
- [Quality Platforms](../verification/quality-platforms.md)
