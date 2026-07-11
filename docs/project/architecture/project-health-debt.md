Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-07
Source of Truth: Central register for known project-health debt IDs,
marker synchronization, removal conditions, and current disposition.

# Project Health Debt Register

## Purpose

This register is the searchable canonical list for known structural,
architecture, governance, and quality debt that survived a pass. The local
marker remains the primary in-file warning; this register provides cross-file
searchability and disposition.

Do not record ordinary task notes here. Add an entry only when a supported
finding cannot be fixed in the same pass and would otherwise be hidden in pass
logs or reviewer output.

## Entry Format

Use one section per ID:

```text
## PH-YYYYMMDD-NNN - Short Title

- Status: Open | In Progress | Removed | False Positive | Superseded
- Resolution Mode: Same Pass | Next Matching Touch | Scheduled Repair | User Excluded
- Resolver Status: Open | Queued | In Progress | Blocked | Resolved | False Positive | Superseded | User Excluded
- Marker: <path>:<line> | none - <process/tooling reason>
- Problem: <known issue>
- Owner Areas: <comma-separated owner-area tokens>
- Affected Paths: <comma-separated repo-relative paths>
- Related Symbols: <comma-separated descriptive symbols; not intake triggers>
- Intake Trigger: <comma-separated repo-relative paths or owner-area tokens that pull this debt into a later pass>
- Required Next Action: <concrete resolver action for the next matching pass>
- Source Evidence: <pass log, review output, command, or discovery note>
- Decision: <why it remains and why this is not target architecture>
- Remove When: <concrete condition>
- Last Checked: YYYY-MM-DD
```

Every code or documentation marker must have exactly one section here. Every
section must have a matching marker unless `Marker: none` names a pure process
or tooling problem with no honest local marker location.

Entries without `Resolution Mode` or `Resolver Status` are interpreted as
`Next Matching Touch` and `Open`. That compatibility default keeps older debt
active until it is resolved, closed, superseded, or explicitly user-excluded.
List-valued fields use comma-separated tokens. Repo-relative path tokens are
matched case-sensitively; owner-area tokens are matched case-insensitively.
Only `Marker`, `Owner Areas`, `Affected Paths`, and `Intake Trigger`
participate in automatic debt intake. `Related Symbols` are searchable context
only; add a matching path or owner token to `Intake Trigger` when a symbol
should pull debt into a later pass.
Resolver field transitions are defined by the
[Project Health resolver dispositions](project-health.md:1).

## Active Debt

## PH-20260709-002 - Dungeon Map Content Model And Hit-Ref Target Protocol Residual

- Status: Open
- Resolution Mode: Next Matching Touch
- Resolver Status: Blocked
- Marker: src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:34
- Problem: The accepted Dungeon map residual still couples the reusable map ContentModel, prepared pointer-target frames, string hit-ref lookup, placeholder target kinds, and runtime target selection protocol instead of a narrower target model where map content projection and runtime hit/target resolution have explicit owners and typed boundaries.
- Owner Areas: view-layer, feature-runtime, project-health
- Affected Paths: src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java, src/features/dungeon/runtime/PointerInteractionTargets.java, src/features/dungeon/runtime/DungeonEditorMapHitRefs.java
- Related Symbols: DungeonMapContentModel, PointerTarget, pointerHitRefsAt, currentPointerTargetFrames, PointerInteractionTargets.fromHitTargets, DungeonEditorMapHitRefs, hit-ref protocol, prepared pointer target frames
- Intake Trigger: src/view/slotcontent/main/dungeonmap, src/features/dungeon/runtime/PointerInteractionTargets.java, src/features/dungeon/runtime/DungeonEditorMapHitRefs.java, view-layer, feature-runtime
- Required Next Action: When the Dungeon map content model or runtime hit-ref protocol is next touched, either move hit-ref/target resolution to typed target-owner seams with a smaller map content projection model or replace this entry with narrower synchronized debt entries for the remaining content-model and protocol owners.
- Source Evidence: build/agent-pass-logs/2026-07-09-architecture-goal-completion-audit/final-h01-h18-completion-audit.md identified F2 as accepted but unmaterialized debt keeping H05, H16, and H17 open on c53a853c201cf12fe17f801df1f911256cb29da0.
- Decision: Materialized as active project-health debt because the final audit accepted F2 as large residual debt outside this materialization pass, but leaving it only in pass logs would hide the cross-owner content-model and hit-ref protocol blocker from future intake.
- Remove When: Dungeon map content projection and runtime hit/target resolution no longer depend on the broad ContentModel plus string hit-ref/prepared-target protocol, or a later view-layer and feature-runtime owner replaces this broad family with synchronized narrower debt entries.
- Last Checked: 2026-07-09

## Removed Or Closed Debt

## PH-20260709-001 - Dungeon Editor Feature Runtime Migration Residual

- Status: Superseded
- Resolution Mode: Next Matching Touch
- Resolver Status: Superseded
- Marker: none - marker removed from `src/features/dungeon/runtime/DungeonEditorAuthoredRuntimeAssembly.java` because the active M4.2 migration design and ledger now own the concrete runtime assembly, store, operation dispatch, root coordination, and publication replacement through the approved deletion list and cycle steps.
- Problem: The accepted Dungeon Editor feature-runtime migration residual still concentrated runtime assembly over authored domain internals, broad runtime store state, operation-family dispatch, runtime root composition, and readback/frame publication compatibility instead of the target feature-runtime split where runtime state, operation engines, typed targets, publication, and render-frame construction have narrower owners.
- Owner Areas: feature-runtime, project-health, architecture-migration
- Affected Paths: docs/project/architecture/architecture-migration-dungeon-editor-session-runtime-target-design.md, docs/project/architecture/migration-ledger.md
- Related Symbols: DungeonEditorAuthoredRuntimeAssembly, DungeonEditorStoreState, DungeonEditorAuthoredRuntimeOperations, DungeonEditorFeatureRuntimeRoot, DungeonEditorRuntimeFramePublisher, DungeonEditorRuntimeApplicationService, DungeonEditorRuntimeCommands, DungeonEditorPointerWorkflow, DungeonEditorRuntimeContext
- Intake Trigger: docs/project/architecture/architecture-migration-dungeon-editor-session-runtime-target-design.md, docs/project/architecture/migration-ledger.md, architecture-migration
- Required Next Action: none - M4.2 step 3 approved the concrete target owners, deletion list, nested bridge removal, metrics, and frozen proof route; M4.2 step 4 introduced the compatibility seams; M4.2 step 5 must execute that approved implementation rather than reopen this broad project-health placeholder.
- Source Evidence: build/agent-pass-logs/2026-07-09-architecture-goal-completion-audit/final-h01-h18-completion-audit.md identified F1 as accepted but unmaterialized debt keeping H01, H03, H05, and H16 open on c53a853c201cf12fe17f801df1f911256cb29da0; `docs/project/architecture/architecture-migration-dungeon-editor-session-runtime-target-design.md` now supersedes it with named target classes, call chains, seam statement, and a 37-file deletion list plus nested bridge removal.
- Decision: Superseded by the active architecture-migration cycle rather than hidden as baseline. The roadmap and ledger now carry stronger, step-ordered obligations for the same residual: wiring port first, then implementation deletion list, conformance review, and close-out with focused proof and judge approval.
- Remove When: superseded on 2026-07-11 by M4.2 target design and wiring-port governance; final code removal remains tracked by M4.2 implementation and conformance review.
- Last Checked: 2026-07-11

## PH-20260707-001 - Feature Runtime Fitness Function Gap

- Status: Removed
- Resolution Mode: Next Matching Touch
- Resolver Status: Resolved
- Marker: none - marker removed from the retired feature-runtime doctrine doc
  after a temporary diagnostic gained the dedicated `featureRuntimeFitness`
  bundle.
- Problem: Feature-runtime conformance for `src/features/**` remained review-owned while the active `feature-runtime` diagnostic surface proved placement only; no named gate proved internal feature-runtime topology, passive-carrier mirror absence, shell narrowness, runtime state ownership, preview/commit owner identity, render-frame publication, typed target and boundary-carrier drift, or UI/storage boundaries for the non-trivial Dungeon feature runtime.
- Owner Areas: feature-runtime, architecture-migration, project-health
- Affected Paths: docs/project/architecture/architecture-migration-roadmap.md, docs/project/architecture/migration-ledger.md, src/features/dungeon/runtime/**, src/features/dungeon/shell/**, src/view/leftbartabs/dungeoneditor/**
- Related Symbols: AR-09, retired feature-runtime diagnostic, DungeonEditorFeatureRuntimeRoot, DungeonEditorAuthoredRuntimeAssembly, DungeonEditorFeatureShellBinding, DungeonEditorIntentHandler, passive-carrier mirror absence, featureRuntimeFitness
- Intake Trigger: src/features/dungeon/runtime/**, src/features/dungeon/shell/**, src/view/leftbartabs/dungeoneditor/**, feature-runtime, architecture-migration
- Required Next Action: none - the temporary diagnostic resolved the recorded
  feature-runtime fitness-function gap before the M0 doctrine teardown removed
  the role-family teaching surface.
- Source Evidence: build/agent-pass-logs/2026-07-07-architecture-hypothesis-review/hypothesis-03-feature-runtime-legacy-chain.md; build/agent-pass-logs/2026-07-07-architecture-hypothesis-review/hypothesis-11-review-owned-fitness-functions.md; build/agent-pass-logs/2026-07-07-architecture-hypothesis-review/hypothesis-16-unmaterialized-structural-debt.md; build/agent-pass-logs/2026-07-07-architecture-repair-plan.md; build/agent-pass-logs/2026-07-07-architecture-repair-roadmaps/wave-10-feature-runtime-fitness-disposition-unter-roadmap.md; R3c after-W10 restack introduced `FeatureRuntimeFitnessRules` and added the `featureRuntimeFitness` bundle to the `feature-runtime` diagnostic surface.
- Decision: Closed by adding a named narrow gate rather than overclaiming complete feature-runtime semantic conformance. The new gate covers the high-drift shape and seam invariants that were previously hidden; runtime state ownership adequacy, preview/commit identity, render-frame publication semantics, UI raw-input behavior, storage behavior, and compatibility-inventory judgments remain explicitly Review-Owned unless a later owner names sharper mechanical rows.
- Remove When: resolved on 2026-07-08 by the feature-runtime fitness gate.
- Last Checked: 2026-07-08

## PH-20260708-001 - World Planner ContributionModel Residual Mapping Hotspot

- Status: False Positive
- Resolution Mode: Next Matching Touch
- Resolver Status: False Positive
- Marker: none - marker removed from src/view/leftbartabs/worldplanner/WorldPlannerContributionModel.java after the invalid `WorldPlannerFilterContentPartModel` dependency and mirrored module search carriers were removed, leaving only target ContributionModel orchestration into the reusable search control.
- Problem: `WorldPlannerContributionModel` was recorded as residual debt for cross-content mapping into shared search/state/detail surfaces after the bounded module split. W10 follow-up proved two invalid alternatives: centralizing the search carrier in `WorldPlannerFilterContentPartModel` violates `ViewContributionModelDependencyBoundary`, while per-module `SearchProjection`/`Filter*` records violate `layering-no-passive-carrier-shape-mirror-inside-feature-root`.
- Owner Areas: view-layer
- Affected Paths: src/view/leftbartabs/worldplanner/WorldPlannerContributionModel.java
- Related Symbols: WorldPlannerContributionModel.applySearchProjection, WorldPlannerContributionModel.detailProjection, WorldPlannerContributionModel.applyNpcState, WorldPlannerContributionModel.applyFactionState, WorldPlannerContributionModel.applyLocationState, WorldPlannerContributionModel.applySourceState
- Intake Trigger: src/view/leftbartabs/worldplanner/**
- Required Next Action: none - target view-layer ownership accepts the aggregate ContributionModel as the boundary adapter that orchestrates child ContentModels and applies the one canonical reusable search-control projection, while module ContentModels keep component-specific filtering, selection, and render facts.
- Source Evidence: W8-S10 implementation pass on 2026-07-08; `tools/gradle/run-staged-verification.sh focused-handoff --path src/view/leftbartabs/worldplanner --area view` passed before residual materialization; W10 production-handoff intake matched this entry; W10 production-handoff later rejected `WorldPlannerContributionModel -> WorldPlannerFilterContentPartModel` through `ViewContributionModelDependencyBoundary`; the W10-PH001 resolution pass removed mirrored module search carriers after `layering-no-passive-carrier-shape-mirror-inside-feature-root` rejected them; `docs/project/architecture/architecture-migration-roadmap.md` defines `ContributionModel` as root-wide projection state owner that orchestrates child `ContentModel`s and defines `ContentModel`s as component-specific owners.
- Decision: Closed as false positive for automatic debt intake after the boundary-invalid ContentPartModel dependency and mirrored module search carriers were removed. Direct module ContentModel-to-shared ContentModel mapping remains correctly rejected by `ViewContentModelDependencyBoundary`; direct ContributionModel-to-ContentPartModel sharing is rejected by `ViewContributionModelDependencyBoundary`; mirrored module search carrier records are rejected by the layering passive-carrier mirror rule. The remaining aggregate projection into shared search/state/detail surfaces is therefore the accepted root ContributionModel orchestration path, not hidden residual debt.
- Remove When: false positive closed on 2026-07-08.
- Last Checked: 2026-07-08

## PH-20260624-001 - Dungeon Editor Runtime View Target Bridge

- Status: Removed
- Resolution Mode: Next Matching Touch
- Resolver Status: Resolved
- Marker: none - bridge method deleted from src/view/leftbartabs/dungeoneditor/DungeonEditorContributionModel.java
- Problem: Runtime typed targets still round-trip through `DungeonMapContentModel.PointerTarget` and legacy string/enum carriers before returning to runtime pointer samples.
- Owner Areas: feature-runtime, view-layer
- Affected Paths: src/view/leftbartabs/dungeoneditor/DungeonEditorContributionModel.java, src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java, src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java, src/features/dungeon/runtime/DungeonEditorRuntimeOperations.java, src/features/dungeon/runtime/DungeonEditorPreparedFrameFacts.java
- Related Symbols: DungeonEditorContributionModel.runtimePointerTarget, DungeonEditorContributionModel.mapInteractionFrame, DungeonMapContentModel.PointerTarget, DungeonEditorIntentHandler.HoverTargetPolicy, DungeonEditorRuntimeOperations.PointerTarget, DungeonEditorPreparedFrameFacts.PointerTarget
- Intake Trigger: src/view/leftbartabs/dungeoneditor/DungeonEditorContributionModel.java, src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java, src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java, src/features/dungeon/runtime/DungeonEditorRuntimeOperations.java, src/features/dungeon/runtime/DungeonEditorPreparedFrameFacts.java, feature-runtime, view-layer
- Required Next Action: none - W3-S1 deleted the bridge method, moved prepared-frame and pointer-sample transport to `DungeonEditorRuntimePointerTarget`, and moved hover/sample policy into the runtime resolver.
- Source Evidence: build/agent-pass-logs/2026-06-24-dungeon-editor-runtime-typed-target-worker-implementation.md; build/agent-pass-logs/2026-06-24-dungeon-editor-runtime-workflow-mapping-worker-implementation.md; build/agent-pass-logs/2026-06-24-dungeon-editor-runtime-typed-interaction-frame-implementation.md.
- Decision: Resolved by making the map interaction frame and pointer workflow consume runtime-owned typed targets directly while the map retains only technical hit/display coordinates.
- Remove When: resolved on 2026-06-24.
- Last Checked: 2026-06-24

## References

- [Project Health Standard](project-health.md:1)
- [Project Health Skill](../../../tools/quality/skills/project-health/SKILL.md:1)
