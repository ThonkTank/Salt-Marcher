Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-06-19
Source of Truth: Canonical target architecture for migrated feature-owned
runtime packages under `src/features/**`.

# Feature Runtime Architecture Standard

## Goal

Feature Runtime Architecture is the canonical target for migrated
`src/features/**` packages.

It gives migrated features one owner for interaction state, typed targets,
preview, mutation dispatch, publication, and render frames without forcing the
legacy `src/view/**` and `src/domain/**` role chain into new feature work.

This standard does not redefine the legacy cockpit view architecture for
`src/view/**` or the legacy domain-role architecture for `src/domain/**`.
Those standards remain authoritative for non-migrated roots only.

## Scope

Applies when a feature is intentionally migrated into `src/features/**`.

Does not apply to:

- legacy `src/view/**` active roots and reusable `slotcontent/**`
- legacy `src/domain/**` authored-core and published/readback roots
- `src/data/**` source adapters
- shell/bootstrap architecture outside the documented feature-runtime shell seam

Current enforcement status:

- `checkFeatureRuntimeEnforcement` is the named mechanical gate for focused
  `src/features/**` placement plus the feature-runtime fitness invariants
  listed below.
- Existing `checkViewEnforcement` and `checkDomainEnforcement` routes do not
  prove feature-runtime conformance for `src/features/**`.
- The feature-runtime gate runs the layering-backed `src/features/**`
  source-root placement diagnostics plus the `featureRuntimeFitness` bundle.
- Active non-empty `src/features/**` source roots are allowed by the layering
  `src/` direct-child allowlist. The feature-runtime fitness bundle adds a
  narrow topology gate without forcing legacy `src/view/**` or `src/domain/**`
  role chains into `src/features/**`.
- The former retained fitness-function gap is closed as
  [PH-20260707-001](../project-health-debt.md#ph-20260707-001---feature-runtime-fitness-function-gap);
  remaining non-listed expectations stay Review-Owned.

## Current State And Target State

Current state:

- SaltMarcher's canonical view and domain standards are still rooted in
  `src/view/**` and `src/domain/**`.
- `checkFeatureRuntimeEnforcement` owns the narrow feature-runtime fitness
  invariants listed below.

Target state:

- a migrated feature owns one runtime boundary under
  `src/features/<feature>/runtime/**`
- transient session/workflow state lives with that feature runtime instead of
  being split across legacy view-model and published-model chains
- UI code under `src/features/<feature>/ui/**` emits raw input and renders
  prepared runtime frames
- storage code under `src/features/<feature>/storage/**` persists authored facts
- shell registration under `src/features/<feature>/shell/**` stays narrow

## Current Compatibility Inventory

These rows record current compatibility under the feature-runtime owner. They
are not target naming precedent for new `src/features/**` work.

| Surface | Owner | Current disposition | Affected paths | Removal condition |
| --- | --- | --- | --- | --- |
| Dungeon Editor legacy view/shell/UI seam | feature-runtime, view-layer | Current compatibility, not target feature-runtime conformance. The live path still registers Dungeon Editor through the legacy `src/view/**` shell contribution and routes raw map input through the view Binder/IntentHandler into feature-runtime operation ports. | `src/view/leftbartabs/dungeoneditor/**`, `src/features/dungeon/shell/DungeonEditorFeatureShellBinding.java`, `bootstrap/ShellViewDiscovery.java` | Dungeon Editor shell registration and raw input UI are owned by the feature-runtime shell/UI seam, with runtime render frames and typed raw-input APIs consumed directly by that seam. |
| `InterpretDungeonEditorMainViewInputUseCase` | feature-runtime | Current compatibility. The `UseCase` suffix maps to a runtime operation-engine/input-interpretation component and is not domain-role naming precedent. | `src/features/dungeon/runtime/InterpretDungeonEditorMainViewInputUseCase.java` | The Dungeon Editor runtime operation/input boundary is renamed or retired into target feature-runtime vocabulary, or a later narrow feature-runtime topology rule explicitly accepts or rejects these suffixes. |
| `DungeonEditorBoundaryClusterCellsHelper` | feature-runtime | Current compatibility. The `Helper` suffix maps to private runtime implementation detail and is not shared architecture vocabulary. | `src/features/dungeon/runtime/DungeonEditorBoundaryClusterCellsHelper.java` | The Dungeon Editor runtime operation/input boundary is renamed or retired into target feature-runtime vocabulary, or a later narrow feature-runtime topology rule explicitly accepts or rejects these suffixes. |
| `DungeonEditorRuntimePointerPort` | feature-runtime | Current compatibility. The `Port` suffix maps to the temporary runtime pointer-operation compatibility seam and is not target shell/storage port precedent. | `src/features/dungeon/runtime/DungeonEditorRuntimePointerPort.java` | The Dungeon Editor runtime operation/input boundary is renamed or retired into target feature-runtime vocabulary, or a later narrow feature-runtime topology rule explicitly accepts or rejects these suffixes. |

## Canonical Vocabulary

Feature Runtime Architecture uses these target terms:

| Term | Meaning |
| --- | --- |
| `Feature Runtime Root` | The feature-owned runtime boundary that coordinates the migrated feature. |
| `Runtime State` | Transient session, workflow, preview, selection, and draft state that belongs to the migrated feature. |
| `Typed Target` | Runtime-owned semantic target resolved from raw UI input. |
| `Operation Engine` | Runtime-owned mutation and validation owner used by preview and commit. |
| `Editor Preview Result` | Runtime-owned result of running the operation owner without persistence. |
| `Render Frame` | Runtime-owned prepared frame for UI rendering after preview or commit. |
| `Shell Binding` | Narrow shell-facing registration and lifecycle seam for the migrated feature. |
| `Storage Adapter` | Feature-owned persistence adapter for authored facts. |

These are architecture terms first, not mandatory filename suffixes for Wave 1.
Future implementation waves may choose exact class names and local package
splits, but they must preserve these ownership boundaries.

## Mechanical Fitness Gate

`./gradlew checkFeatureRuntimeEnforcement --console=plain` is mechanically
enforced for these `src/features/**` invariants:

- `feature-runtime-package-family-shape`: feature source files live only under
  `runtime/`, `ui/`, `storage/`, or `shell/`.
- `feature-runtime-runtime-root-presence`: every feature with runtime sources
  declares exactly one public final `runtime/*FeatureRuntimeRoot.java` owner
  that directly exposes the `RuntimeOperations` boundary and has a static
  `create(...)` factory consuming `RuntimeDependencies`.
- `feature-runtime-shell-binding-narrowness`: shell sources stay at the
  `*FeatureShellBinding` or narrow `*Operations` seam and import only
  JDK/JavaFX delivery APIs, shell public contracts, same-feature runtime APIs,
  and same-feature domain readback/persistence seams.
- `feature-runtime-compatibility-seam-locality`: retained
  `*Compatibility.java` seams stay package-private inside `runtime/`, keep a
  `LEGACY_REMOVE_ON_TOUCH` marker, and are referenced only by same-feature
  runtime sources.
- `layering-no-passive-carrier-shape-mirror-inside-feature-root`: the
  feature-runtime route includes the layering passive-carrier mirror scanner
  for `src/features/<feature>` roots so focused feature-runtime proof rejects
  duplicated passive record/enum carrier shapes inside the migrated feature.

The gate intentionally does not prove the full semantic adequacy of runtime
state ownership, preview/commit owner identity, render-frame publication,
storage behavior, UI raw-input behavior, or every compatibility inventory row.
Those expectations remain Review-Owned unless a later owner names a sharper
mechanical invariant.

## Target Package Shape

Feature Runtime Architecture reserves `src/features/<feature>/` for migrated
feature work. The canonical target shape is:

```text
src/features/<feature>/
  runtime/         session state, target resolution, operation engine,
                   preview engine, publication, and render-frame construction
  ui/              JavaFX views, render-only controls, and raw input events
  storage/         persistence adapters and repository implementations
  shell/           shell contribution and wiring only
```

Rules:

- a migrated feature MAY keep these concerns in fewer files while the feature
  is small
- a migrated feature MUST keep ownership explicit even when multiple concerns
  temporarily live in one class
- runtime owns target, preview, mutation, publication, and render-frame
  semantics
- UI owns raw input capture and render-only controls, not target semantics
- storage owns persistence mechanics, not editor operation semantics
- shell owns contribution wiring only
- `src/features/**` MUST NOT be forced to recreate the legacy
  `Contribution -> Binder -> ContributionModel -> ContentModel ->
  IntentHandler -> ApplicationService -> published/*Model` chain just for
  architectural compliance

## Responsibility Model

### Feature Runtime Root

- owns runtime composition for one migrated feature
- coordinates runtime state, typed target resolution, preview, operation
  dispatch, publication, render frames, and persistence calls
- is the first architecture owner for migrated feature behavior
- does not become a generic shell host, persistence adapter, or replacement
  for authored truth

### Runtime State

- owns transient feature session/workflow state
- includes preview, hover, draft, selection, current tool/mode, and other
  non-authored runtime facts
- must not become the authored persistence source of truth

### UI

- owns JavaFX controls, raw input event capture, and render-only behavior
- renders prepared `Render Frame` facts from runtime
- must not resolve semantic targets, preview operations, mutation deltas, or
  render diffs by reinterpreting authored facts

### Storage

- owns persistence adapters and repository implementations
- persists authored facts and reloads authored facts for runtime use
- must not own editor target, preview, authored mutation, publication, or
  render-frame semantics

### Shell Binding

- owns feature contribution and shell wiring
- may depend on shell public contracts and the feature runtime root
- stays narrow; it must not become the feature's behavior owner

## Dependency Direction

Source-code dependencies for migrated feature runtime point inward toward the
feature runtime owner and outward only through named public seams:

- `shell binding -> shell public contracts + feature runtime root`
- `ui -> JavaFX/JDK APIs + feature runtime raw-input and render-frame APIs`
- `runtime -> runtime-owned storage contracts + documented authored fact seams`
- `storage -> concrete persistence sources + runtime-owned storage contracts`

Forbidden shortcuts:

- treating `src/features/**` as a second `src/view/**` tree that must obey
  passive-View role chains
- treating `src/features/**` as a second `src/domain/**` tree that must obey
  `ApplicationService` / `UseCase` / `published/*Model` topology
- hiding authored writes behind shell callbacks or ad hoc cross-feature
  global state
- pushing render/styling ownership into storage or authored fact seams

## Review-Owned Expectations

Until a named gate exists, review owns:

- whether a migrated feature keeps runtime/session state in `Runtime State`
  instead of scattering it across legacy view/domain roles
- whether shell binding stays narrow
- whether UI remains render-only and raw-input-only
- whether storage remains persistence-only
- whether preview and commit run the same operation owner
- whether render frames come from runtime publication
- whether typed target and boundary carriers drift back into legacy
  view/domain shapes or stringly protocols
- whether a migration still depends on a compatibility seam and, if so, which
  wave removes it

## References

- [Architecture Overview](docs/project/architecture/overview.md:1)
- [Layering Architecture Standard](docs/project/architecture/patterns/layering-architecture.md:1)
- [View Layer Standard](docs/project/architecture/patterns/view-layer.md:1)
- [Domain Layer Standard](docs/project/architecture/patterns/domain-layer.md:1)
- [Agent Instruction Standard](docs/project/architecture/agent-instructions.md:1)
