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

## PH-20260707-001 - Feature Runtime Fitness Function Gap

- Status: Open
- Resolution Mode: Next Matching Touch
- Resolver Status: Open
- Marker: docs/project/architecture/patterns/feature-runtime.md:37
- Problem: Feature-runtime conformance for `src/features/**` remains review-owned while the active `feature-runtime` diagnostic surface proves placement only; no named gate currently proves internal feature-runtime topology, passive-carrier mirror absence, shell narrowness, runtime state ownership, preview/commit owner identity, render-frame publication, typed target and boundary-carrier drift, or UI/storage boundaries for the non-trivial Dungeon feature runtime.
- Owner Areas: feature-runtime, architecture-enforcement, project-health
- Affected Paths: docs/project/architecture/patterns/feature-runtime.md, tools/quality/skills/feature-runtime/SKILL.md, src/features/dungeon/runtime/**, src/features/dungeon/shell/**, src/view/leftbartabs/dungeoneditor/**
- Related Symbols: AR-09, checkFeatureRuntimeEnforcement, DungeonEditorFeatureRuntimeRoot, DungeonEditorAuthoredRuntimeAssembly, DungeonEditorFeatureShellBinding, DungeonEditorIntentHandler, passive-carrier mirror absence
- Intake Trigger: docs/project/architecture/patterns/feature-runtime.md, tools/quality/skills/feature-runtime/SKILL.md, src/features/dungeon/runtime/**, src/features/dungeon/shell/**, src/view/leftbartabs/dungeoneditor/**, feature-runtime, architecture-enforcement
- Required Next Action: On the next matching feature-runtime owner-doc or Dungeon feature-runtime touch, either add a proportional named feature-runtime topology or fitness gate for the highest-drift invariants, prove the migration removed the compatibility seam and review-owned drift risk, replace the queued repair with an owner-approved equivalent proof route, or keep the gap explicitly review-owned with updated evidence.
- Source Evidence: build/agent-pass-logs/2026-07-07-architecture-hypothesis-review/hypothesis-03-feature-runtime-legacy-chain.md; build/agent-pass-logs/2026-07-07-architecture-hypothesis-review/hypothesis-11-review-owned-fitness-functions.md; build/agent-pass-logs/2026-07-07-architecture-hypothesis-review/hypothesis-16-unmaterialized-structural-debt.md; build/agent-pass-logs/2026-07-07-architecture-repair-plan.md; build/agent-pass-logs/2026-07-07-architecture-repair-roadmaps/wave-10-feature-runtime-fitness-disposition-unter-roadmap.md.
- Decision: Materialization is the default because a broad topology gate would overclaim coverage or push migrated runtime code toward artificial passive carriers, micro-wiring, or legacy role ceremony. Leaving the gap review-owned is not target architecture; it is retained debt until a proportional named invariant gate lands, an owner-approved equivalent proof route covers the high-drift invariants, or the feature-runtime migration removes the seam that makes the drift risk material.
- Remove When: A later repair introduces a named feature-runtime topology or fitness gate, or an owner-approved equivalent proof route, that covers the high-drift invariants for active `src/features/**` code and the Dungeon Editor compatibility seam has either been removed or explicitly accepted by that proof route.
- Last Checked: 2026-07-08

## PH-20260708-001 - World Planner ContributionModel Residual Mapping Hotspot

- Status: Open
- Resolution Mode: Next Matching Touch
- Resolver Status: Open
- Marker: src/view/leftbartabs/worldplanner/WorldPlannerContributionModel.java:15
- Problem: `WorldPlannerContributionModel` no longer builds the module-owned filter and state decisions directly, but it still owns residual cross-content mapping into shared search/state/detail surfaces because the same-root ContentModel dependency boundary forbids module ContentModels from referencing those sibling or reusable ContentModels directly.
- Owner Areas: view-layer
- Affected Paths: src/view/leftbartabs/worldplanner/WorldPlannerContributionModel.java
- Related Symbols: WorldPlannerContributionModel.applySearchProjection, WorldPlannerContributionModel.detailProjection, WorldPlannerContributionModel.applyNpcState, WorldPlannerContributionModel.applyFactionState, WorldPlannerContributionModel.applyLocationState, WorldPlannerContributionModel.applySourceState
- Intake Trigger: src/view/leftbartabs/worldplanner/**
- Required Next Action: In the roadmap follow-up, replace the remaining aggregate search/state/detail mapping with an owner-approved module-owned projection path that preserves the ViewContentModelDependencyBoundary, or remove the marker if the target architecture confirms this aggregate mapping is the accepted boundary adapter.
- Source Evidence: W8-S10 implementation pass on 2026-07-08; `tools/gradle/run-staged-verification.sh focused-handoff --path src/view/leftbartabs/worldplanner --area view` passed before residual materialization, and the first attempted direct ContentModel-to-ContentModel split failed `ViewContentModelDependencyBoundary`.
- Decision: Retained as open view-layer debt because a broader redesign of the shared search/state/detail projection path would exceed the bounded W8-S10 worker slice and risks widening module APIs.
- Remove When: roadmap follow-up replaces the remaining aggregate search/state/detail mapping with an owner-approved module-owned projection path, or owner review accepts the aggregate mapping as the target boundary adapter.
- Last Checked: 2026-07-08

## Removed Or Closed Debt

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
