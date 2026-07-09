Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: M3.3 target design for the Worldplanner architecture
migration area before any wiring-port or implementation commit.

# Worldplanner Migration Target Design

## Scope

This design covers the M3 Worldplanner product surface:

- `src/domain/worldplanner`
- `src/view/leftbartabs/worldplanner`

The baseline surface is 68 product Java files and 4,667 physical LOC; the
full reproducible Worldplanner count is 82 Java files and 5,440 LOC when
`src/data/worldplanner` is included
(`docs/project/architecture/architecture-migration-worldplanner-baseline.md:55`).
Data-layer code remains outside the normal M3 migration surface unless a
gateway signature adaptation is explicitly named by this design. No such data
gateway adaptation is part of this design.

This design is the step-3 artifact required by the roadmap. It does not permit
implementation or harness scenario/assertion changes. The M3.4 wiring-port
commit may only update references, adapter construction, and callbacks needed
to run the frozen Worldplanner harness scenarios against the old behavior.

## Non-Negotiable Constraints

- Behavior parity is absolute. Any visible behavior change in a migration pass
  is a defect. Pre-existing bugs are preserved and filed as separate R2 issues.
- No questions to the owner. Never wait on the owner; the acceptance window
  never blocks the pipeline. Decide yourself, journal the reasoning.
- No security analysis. No pause/throttle/stop mechanisms. Git history plus
  revert is the safety model.
- Harness scenarios and assertions are frozen; only wiring may be ported, in a
  separate prior commit.

## Current Defect

The authored Worldplanner state objects are not the defect. `WorldNpc` owns
NPC text normalization and lifecycle replacement, `WorldFaction` owns NPC link
deduplication and inventory-limit replacement, and `WorldLocation` owns
location link replacement
(`src/domain/worldplanner/model/world/WorldNpc.java:30`,
`src/domain/worldplanner/model/world/WorldFaction.java:38`,
`src/domain/worldplanner/model/world/WorldLocation.java:32`).

The defect is the ceremony around those objects. User actions currently flow
through `WorldPlannerIntentHandler`, `WorldPlannerApplicationService`,
`WorldPlannerUseCaseServiceAssembly`, per-verb use cases, replacement helpers,
and then the entity or repository. The baseline measured dominant
Worldplanner-owned chains at 5 meaningful hops to the first domain mutation and
up to 7 when immutable replacement/save tails are counted separately
(`docs/project/architecture/architecture-migration-worldplanner-baseline.md:65`).
The same baseline identified 3 product/published forwarding or proxy
candidates plus 7 product String round-trip families
(`docs/project/architecture/architecture-migration-worldplanner-baseline.md:98`,
`docs/project/architecture/architecture-migration-worldplanner-baseline.md:119`).

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `src.domain.worldplanner.WorldPlannerServiceContribution` | Keep the byte-compatible service-registry entrypoint for `WorldPlannerApplicationService` and `WorldPlannerSnapshotModel`, including the existing published Creature and Encounter Table reference validator. |
| `src.domain.worldplanner.WorldPlannerServiceAssembly` | Be the single Worldplanner composition root for repository, reference validator, stateful snapshot model, application service, and initial load. |
| `src.domain.worldplanner.WorldPlannerApplicationService` | Keep all current public command method descriptors while directly owning refresh, NPC/faction/location mutations, reference validation, storage-failure handling, immutable state replacement, repository save, and publish. |
| `src.domain.worldplanner.WorldPlannerSnapshotProjection` | New projector that maps `WorldPlannerState` to the byte-compatible `WorldPlannerSnapshot` without duplicating lifecycle enum meaning. |
| `src.domain.worldplanner.published.WorldPlannerSnapshotModel` | Become a stateful published model that owns current snapshot/listeners while keeping `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.worldplanner.model.world.repository.WorldPlannerRepository` | Stay the unchanged data gateway seam for `src/data/worldplanner.repository.SqliteWorldPlannerRepository`. |
| `src.domain.worldplanner.model.world.port.WorldPlannerReferencePort` | Stay the explicit Creature and Encounter Table reference validation seam. |
| `src.domain.worldplanner.model.world.WorldPlannerState` | Stay the immutable authored world state, lookup owner, next-id owner, and status-text carrier. |
| `src.domain.worldplanner.model.world.WorldNpc` | Stay the NPC entity/value record for display name, statblock id, notes, and lifecycle transitions. |
| `src.domain.worldplanner.model.world.WorldFaction` | Stay the faction entity/value record for display name, primary encounter table, NPC links, and inventory limits. |
| `src.domain.worldplanner.model.world.WorldLocation` | Stay the location entity/value record for faction and encounter-table links. |
| `src.domain.worldplanner.model.world.WorldFactionInventoryLimit`, `WorldPlannerIds`, `WorldNpcLifecycleState` | Stay as value, identity normalization, and domain lifecycle types used by domain and data code. |
| `src/domain/worldplanner/published/**` command records, summary records, `WorldPlannerSnapshot`, `WorldNpcLifecycleStatus`, and `WorldPlannerReadStatus` | Stay byte-compatible published API surfaces consumed by view, Encounter, harnesses, and future migrated areas. |
| `src.view.leftbartabs.worldplanner.WorldPlannerContribution` | Keep the shell contribution id, title, group, nav icon, runtime mode, and returned shell slots. |
| `src.view.leftbartabs.worldplanner.WorldPlannerBinder` | Stay the tab composition point that wires services, published model subscriptions, catalog snapshots, search controls, views, inspector details, and direct callbacks without becoming a forwarding controller. |
| `src.view.leftbartabs.worldplanner.WorldPlannerViewModel` | New single typed view model replacing the contribution/content-model stack; owns active module, selections, filters, catalog option ids, main/state/detail projections, and stable option lookup. |
| `src.view.leftbartabs.worldplanner.WorldPlannerVocabulary` | New typed view vocabulary for modules, lifecycle filters, stock filters, source filters, and id-backed options; display labels are not parsed as state. |
| `src.view.leftbartabs.worldplanner.WorldPlannerControlsView` | Keep the JavaFX controls view and emit module/search/filter callbacks wired by `WorldPlannerBinder`. |
| `src.view.leftbartabs.worldplanner.WorldPlannerMainView` | Keep the JavaFX module stack view and bind it to `WorldPlannerViewModel` projections for NPC, faction, location, and source modules. |
| `src.view.leftbartabs.worldplanner.WorldPlannerNpcMainView`, `WorldPlannerFactionMainView`, `WorldPlannerLocationMainView`, `WorldPlannerSourceMainView` | Keep the JavaFX list/module views while reading typed projections from `WorldPlannerViewModel` and emitting selection callbacks. |
| `src.view.leftbartabs.worldplanner.WorldPlannerStateView` | Keep the JavaFX state/editor view and emit direct command callbacks for NPC, faction, location, and Encounter handoff actions. |
| `src.view.leftbartabs.worldplanner.WorldPlannerDetailView` | Keep the JavaFX inspector detail renderer, with projection data supplied by `WorldPlannerViewModel`. |

## Target Call Chains

Counting rule: count named production class boundaries from user action source
to the first Worldplanner-owned domain or durable mutation.
`WorldPlannerBinder` callback registration is wiring and MUST NOT become a
forwarding controller.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Create NPC | `WorldPlannerStateView` create action -> `WorldPlannerApplicationService.createNpc` -> `WorldNpc` construction / `WorldPlannerRepository.save` / `WorldPlannerSnapshotModel.publish` | 3 hops to domain/repository mutation and published readback. |
| Set faction inventory limit | `WorldPlannerStateView` stock action -> `WorldPlannerApplicationService.setFactionInventoryLimit` -> `WorldFaction.setInventoryLimit` / `WorldPlannerRepository.save` / `WorldPlannerSnapshotModel.publish` | 3 hops to domain/repository mutation and published readback. |
| Link location to encounter table | `WorldPlannerStateView` table-link action -> `WorldPlannerApplicationService.addLocationEncounterTable` -> `WorldPlannerReferencePort.encounterTableExists` then `WorldLocation.addEncounterTable` / `WorldPlannerRepository.save` / `WorldPlannerSnapshotModel.publish` | 3 Worldplanner-owned hops; Encounter Table lookup remains a foreign reference seam. |
| Add selected NPC to Encounter | `WorldPlannerStateView` selected-NPC action -> `WorldPlannerBinder` callback resolves selected NPC id and statblock id from `WorldPlannerViewModel` -> `EncounterApplicationService.applyState(ApplyEncounterStateCommand.addWorldNpcCreature(...))` | Foreign Encounter seam; no-op behavior stays unchanged when Encounter is unavailable or selection ids are unresolved. |

The "Add selected NPC to Encounter" route is not a Worldplanner mutation path.
It is preserved by two complementary proofs: `worldPlannerUiHarness` fires the
visible `Zum Encounter` button through the shell-bound Worldplanner UI and
asserts the selected statblock id plus World NPC id in the published
`EncounterStateModel`; `worldPlannerEncounterHarness` separately proves the
deeper cross-context Encounter source and result-state routes.

## Frozen Parity Inventory

The selected M3 Worldplanner parity tasks are:

- `./gradlew worldPlannerBackendHarness --console=plain`
- `./gradlew worldPlannerEncounterHarness --console=plain`
- `./gradlew worldPlannerControlsRawInputHarness --console=plain`
- `./gradlew worldPlannerUiHarness --console=plain`

The frozen scenario and assertion inventory is the union below. M3.4 and M3.5
may port wiring references, but MUST NOT add, remove, rename, split, merge,
weaken, or reinterpret these scenarios or their pass/fail oracles.

| Harness evidence | Frozen scenario/assertion families |
| --- | --- |
| `test/src/domain/worldplanner/WorldPlannerBackendHarness.java:60-115` | NPC/faction/location mutations, duplicate rejection, lifecycle defeat/reactivate/null/mismatch behavior, finite/unlimited stock, persistence reload, readback-only load, storage/save error stable-snapshot preservation, service-first mutation, malformed row errors, invalid finite inventory rejection, foreign reference rejection, and missing reference services fail-closed behavior. |
| `test/src/domain/worldplanner/WorldPlannerEncounterHarness.java:50-157` | Production Worldplanner seeding, location/faction source resolution, explicit table intersection, invalid-source blocking, finite stock caps including zero-cap behavior, and World NPC identity through builder, combat, and result state. |
| `test/src/view/leftbartabs/worldplanner/WorldPlannerControlsRawInputHarness.java:60-115` | Projection render emits no input, user module switch emits one input with module index, refresh emits one active-module refresh event, and startup refresh remains routed through the same-root activation intent rather than binder-owned direct service calls. |
| `test/src/view/leftbartabs/worldplanner/WorldPlannerUiHarness.java:58-173` | Shell slots, absence of the old English `Refresh` label and old counter labels, preserved German `Aktualisieren` refresh behavior through the raw-input harness, state-panel editors, create/update/defeat/reactivate actions, selected-NPC `Zum Encounter` handoff into `EncounterStateModel`, search/filter chips, module switching, inspector detail/clear behavior, faction inventory, location links, source module, and readback lists. |
| `docs/worldplanner/verification/verification-world-planner.md:44` | Verification document records backend, encounter integration, combat lifecycle, public location-choice integration, and UI proof obligations for Worldplanner. |

The current old-structure proof is recorded in the ledger: backend, encounter,
raw-input, and UI harnesses were green in M3.1 on 2026-07-09 after the
production-route encounter harness closure
(`docs/project/architecture/migration-ledger.md:73`).

## Deletion List

The implementation step is incomplete until these classes no longer exist:

- `src/domain/worldplanner/WorldPlannerUseCaseServiceAssembly.java`
- `src/domain/worldplanner/model/world/usecase/AddWorldFactionNpcUseCase.java`
- `src/domain/worldplanner/model/world/usecase/AddWorldLocationEncounterTableUseCase.java`
- `src/domain/worldplanner/model/world/usecase/AddWorldLocationFactionUseCase.java`
- `src/domain/worldplanner/model/world/usecase/CreateWorldFactionUseCase.java`
- `src/domain/worldplanner/model/world/usecase/CreateWorldLocationUseCase.java`
- `src/domain/worldplanner/model/world/usecase/CreateWorldNpcUseCase.java`
- `src/domain/worldplanner/model/world/usecase/LoadWorldPlannerUseCase.java`
- `src/domain/worldplanner/model/world/usecase/SetWorldFactionInventoryLimitUseCase.java`
- `src/domain/worldplanner/model/world/usecase/SetWorldNpcLifecycleStatusUseCase.java`
- `src/domain/worldplanner/model/world/usecase/UpdateWorldNpcNotesUseCase.java`
- `src/domain/worldplanner/model/world/usecase/WorldPlannerStateChanges.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerContributionModel.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerIntentHandler.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerControlsContentModel.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerDetailContentModel.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerFactionMainContentModel.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerFilterContentPartModel.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerLocationMainContentModel.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerMainContentModel.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerNpcMainContentModel.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerSourceMainContentModel.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerStateContentModel.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerControlsViewInputEvent.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerFactionMainViewInputEvent.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerLocationMainViewInputEvent.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerNpcMainViewInputEvent.java`
- `src/view/leftbartabs/worldplanner/WorldPlannerStateViewInputEvent.java`

`src/domain/worldplanner/model/world/usecase/` must be empty or gone after
implementation. The expected product surface after deleting 28 files and
adding `WorldPlannerSnapshotProjection`, `WorldPlannerViewModel`, and
`WorldPlannerVocabulary` is 43 Java files. Deleting comments or compressing
code without executing this list is not migration.

## Seam Statement

These surfaces stay byte-compatible in M3 until their consumer sides migrate:

- `src.domain.worldplanner.WorldPlannerApplicationService`: class name,
  package, public method names, and published command parameter types.
- `src.domain.worldplanner.WorldPlannerServiceContribution`: service-registry
  registration of `WorldPlannerApplicationService` and
  `WorldPlannerSnapshotModel`, plus optional explicit `WorldPlannerReferencePort`
  behavior.
- `src.domain.worldplanner.published.WorldPlannerSnapshotModel`: `current()`,
  `subscribe(...)`, current constructor signature, service-registry key, and
  snapshot delivery behavior.
- Every record and enum in `src/domain/worldplanner/published/**`: record
  component order, component types, accessor names, static factories, and enum
  constants.
- `src.domain.worldplanner.model.world.repository.WorldPlannerRepository` and
  the domain value types it exposes to `src/data/worldplanner`.
- `src.domain.worldplanner.model.world.port.WorldPlannerReferencePort` because
  harnesses, explicit tests, and optional foreign-reference providers use it.
- `src.view.leftbartabs.worldplanner.WorldPlannerContribution`: contribution id
  `world-planner`, group `planning`, title `World Planner`, nav icon path,
  runtime mode, cockpit slots, and inspector detail key semantics.
- `src/domain/encounter/**`, `src/domain/creatures/**`,
  `src/domain/encountertable/**`, shared search-filter controls, shell APIs,
  and SQLite schema/persistence semantics.

M3.4 may port same-area harness and Worldplanner view wiring references away
from the deleted content-model/input-event classes. It must not change a
harness scenario, assertion, fixture value, or pass/fail oracle.

## Wiring-Port Boundary

`WorldPlannerControlsRawInputHarness` currently imports
`WorldPlannerControlsContentModel` and `WorldPlannerControlsViewInputEvent`,
and it asserts startup refresh ownership by reading source text from
`WorldPlannerBinder.java` and `WorldPlannerIntentHandler.java`
(`test/src/view/leftbartabs/worldplanner/WorldPlannerControlsRawInputHarness.java:25`,
`test/src/view/leftbartabs/worldplanner/WorldPlannerControlsRawInputHarness.java:97`).
Therefore M3.4 MUST port that harness to the new `WorldPlannerViewModel` and
callback boundary before implementation deletes the old classes. The startup
refresh oracle must remain the same behavior: binder must not construct or call
the refresh command directly, and refresh must still be routed through explicit
same-root activation.

`WorldPlannerBackendHarness.assertForeignReferencesAreRejectedBeforePersistence`
currently instantiates `WorldPlannerUseCaseServiceAssembly` directly
(`test/src/domain/worldplanner/WorldPlannerBackendHarness.java:332`). M3.4 MUST
port that proof to the service-registry/reference-port seam or to a
package-visible application-service factory before implementation deletes
`WorldPlannerUseCaseServiceAssembly`.

The allowed M3.4 shape is narrow: introduce `WorldPlannerViewModel` as a
compatibility facade over the existing content models and port harness/view
wiring references to that facade and direct callbacks while keeping old
behavior underneath. M3.4 MUST NOT delete the old content models, input-event
records, or `WorldPlannerIntentHandler`. M3.5 then replaces the facade internals
with the target typed model and executes the deletion list.

## Metric Targets And Exceptions

| Metric | Target for implementation | Design exception |
| --- | --- | --- |
| LOC | Product subset falls from 4,667 physical LOC to 2,800 or less. The full 82-file count will not be forced to a 40% reduction because `src/data/worldplanner` is ledger-excluded. | Full-set LOC reduction is a data-layer exception unless a gateway signature adaptation becomes necessary. |
| Forwarding-only classes | Zero product forwarding/proxy classes: the application service and published model own state/logic, and the per-verb/usecase/content/input/intent-handler stack is deleted. | `src/data/worldplanner/WorldPlannerServiceContribution` remains a data-layer service-registration seam outside the product migration surface. |
| Intent-to-mutation chain | All Worldplanner-owned mutations use at most 3 meaningful class-boundary hops. | The "Zum Encounter" path remains a foreign Encounter seam and is not counted as a Worldplanner mutation path. |
| String round-trips | Zero non-seam Worldplanner-owned String round-trips: service internals, view model, domain state, and repository-facing code use typed values or numeric ids as source truth. | Shared `SearchFilterControlsContentModel` still uses String group/option keys; Worldplanner conversion must be centralized in `WorldPlannerVocabulary`, and labels such as `#id | name` must not be parsed as state. Persistence enum String storage remains a data-layer serialization concern. |

The exceptions are individually justified by existing consumer seams, not by
preference. The conformance review must reject any additional unexplained
metric miss.

### M3.5 LOC Exception Amendment

The implemented M3.5 product subset lands at 43 Java files and 3,709 physical
LOC, not the original 2,800 LOC target. Phase 1 and Phase 2 accepted this as a
bounded exception after verifying that the deletion list is executed, the old
usecase/content/input/intent-handler references are absent, forwarding-only
product proxies are gone, and the remaining size is concentrated in the
byte-compatible published/domain seams plus the typed JavaFX projection model.
The exception does not relax the 43-file target, forwarding-only target,
chain-length target, String round-trip target, or frozen-harness parity rules.

## Untouched Surfaces

- `src/data/worldplanner/**` persistence, schema, mapper, gateway, and
  repository semantics stay unchanged.
- `src/domain/encounter/**` and `src/view/statetabs/encounter/**` stay
  unchanged; Worldplanner only calls the current Encounter published service
  for the existing selected-NPC handoff.
- `src/domain/creatures/**` and `src/domain/encountertable/**` stay unchanged;
  Worldplanner keeps using their current published catalogs/reference services.
- `src/view/slotcontent/controls/searchfilter/**` stays unchanged as a shared
  control seam; Worldplanner adapts at its boundary.
- `src/view/leftbartabs/catalog/**` and `src/domain/sessionplanner/**` stay
  unchanged as snapshot consumers.
- Shell contribution behavior stays unchanged: same id, title, group, nav
  icon, runtime mode, cockpit slots, and inspector detail behavior.
- Harness scenarios and assertions stay frozen. Any behavior anomaly found
  during implementation is an R2 issue or area revert, not an in-pass fix.

## Required Reviews

Phase 1 and Phase 2 must approve this artifact before M3.4 starts. Reviewers
must check that the design names target classes, representative call chains,
the full deletion list, seam compatibility, untouched surfaces, frozen parity
inventory, wiring-port boundary, and each metric exception above. A vague
implementation-only answer is rework.
