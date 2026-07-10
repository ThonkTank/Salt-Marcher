Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M3.2 diagnostic baseline metrics for the Encounter
architecture migration area before target design.

# Encounter Migration Baseline

## Purpose

This document records the M3.2 baseline metrics for the Encounter area before
any target design, wiring port, or implementation. The numbers are diagnostic:
they define the baseline for the later M3 conformance review, but they do not
approve a design or prescribe implementation.

## Scope

The roadmap labels the area as `encounter (230)`. The broad path search that
comes closest to that estimate, `find src -path '*encounter*'`, currently
returns 228 Java files but includes the already migrated `encountertable`
area. The reproducible Encounter-owned roots for this baseline are therefore:

- `src/domain/encounter`
- `src/view/statetabs/encounter`
- `src/data/encounter`

The migration-owned product subset is `src/domain/encounter` plus
`src/view/statetabs/encounter` with 191 Java files. The 11
`src/data/encounter` files are counted because they make the saved-plan
storage portion reproducible, but the ledger's data-layer exclusion still
applies: data code is not a normal per-area migration target unless the
approved Encounter design requires a gateway signature adaptation.

Adjacent Creature, Party, Worldplanner, Encounter Table, Session Planner, and
Catalog files consume Encounter published seams or provide foreign facts and
remain outside the Encounter denominator. The M3.1 harness inventory freezes
`worldPlannerEncounterHarness` and `encounterStateTabHarness` as the active
parity surfaces before target design.

## Reproduction

File count:

```bash
find src/domain/encounter src/view/statetabs/encounter src/data/encounter \
  -type f -name '*.java' | wc -l
# 202
```

Line count:

```bash
find src/domain/encounter src/view/statetabs/encounter src/data/encounter \
  -type f -name '*.java' -print0 | sort -z | xargs -0 wc -l
# 13216 total
```

LOC means physical Java file lines from `wc -l`, including blank lines and
comments. Secondary nonblank count from the same file set is 11,530 lines.

## File And LOC Baseline

| Root | Files | Physical LOC | Nonblank LOC | Migration ownership |
| --- | ---: | ---: | ---: | --- |
| `src/domain/encounter` | 173 | 9,895 | 8,648 | Product structure |
| `src/view/statetabs/encounter` | 18 | 2,842 | 2,464 | Product state-tab structure |
| `src/data/encounter` | 11 | 479 | 418 | Counted separately; not a normal migration target |
| Product subset | 191 | 12,737 | 11,112 | Main M3 design surface |
| Full measured set | 202 | 13,216 | 11,530 | Reproducible M3.2 measurement denominator |

## Intent-To-Publication Chains

Counting rule: count meaningful class-boundary hops from user or foreign-area
intent source to first Encounter-owned published-state replacement. Command
and value-record construction, same-class private helpers, and view-only
selection state are not counted. Data lookup internals are recorded separately
when they materially lengthen the path.

| Interaction | Baseline chain | Hop count | Evidence |
| --- | --- | ---: | --- |
| Generate encounter from the state tab | `EncounterStateIntentHandler.consume` -> `EncounterApplicationService.applyState` -> `ApplyEncounterStateUseCase.execute` -> `ApplyEncounterSessionUseCase.apply` -> `EncounterSession.apply` -> `EncounterSessionBuilder.generate` -> `EncounterSessionGeneration.generate` -> `EncounterSessionRepository.generate` -> `EncounterSessionUseCaseAdaptersRepository.generate` -> `EncounterGenerationUseCase.execute` -> generation preparation/assembly -> `PublishEncounterSessionUseCase.execute` -> `EncounterSessionPublishedStateServiceAssembly.publishCurrentSession` -> `EncounterStateModel` readback | 13 to Encounter state publication; 15 including state-tab readback | `src/view/statetabs/encounter/EncounterStateIntentHandler.java:42-50`, `src/domain/encounter/EncounterApplicationService.java:32-69`, `src/domain/encounter/application/ApplyEncounterStateUseCase.java:56-67`, `src/domain/encounter/model/session/EncounterSession.java:166-171`, `src/domain/encounter/model/session/EncounterSessionGeneration.java:39-52`, `src/domain/encounter/model/session/repository/EncounterSessionRepository.java:44-47`, `src/domain/encounter/model/session/repository/EncounterSessionUseCaseAdaptersRepository.java:80-91`, `src/domain/encounter/model/generation/usecase/EncounterGenerationUseCase.java:39-66`, `src/domain/encounter/EncounterSessionPublishedStateServiceAssembly.java:45-56`, `src/domain/encounter/EncounterSessionSnapshotProjectionServiceAssembly.java:30-42` |
| Open saved plan from the state tab | `EncounterStateIntentHandler.consume` -> `EncounterApplicationService.applyState` -> `ApplyEncounterStateUseCase.execute` -> `ApplyEncounterSessionUseCase.apply` -> `EncounterSession.apply` -> `EncounterSessionBuilder.applySavedPlanCommand` -> `EncounterSessionSavedPlans.openSavedPlan` -> `EncounterSessionRepository.loadPlan` -> `EncounterSessionUseCaseAdaptersRepository.loadPlan` -> `LoadSavedEncounterPlanUseCase.execute` -> `EncounterPlanRepository.load`; loaded creatures are resolved through `EncounterSessionRepository.loadCreature`; the resulting session is published through `PublishEncounterSessionUseCase` and `EncounterSessionPublishedStateServiceAssembly` | 13 to Encounter state publication; saved-plan list may republish on the same command | `src/view/statetabs/encounter/EncounterStateIntentHandler.java:47-50`, `src/domain/encounter/application/ApplyEncounterStateUseCase.java:19-40`, `src/domain/encounter/model/session/EncounterSession.java:172-178`, `src/domain/encounter/model/session/EncounterSessionSavedPlans.java:50-80`, `src/domain/encounter/model/session/repository/EncounterSessionRepository.java:54-66`, `src/domain/encounter/model/session/repository/EncounterSessionUseCaseAdaptersRepository.java:120-130`, `src/domain/encounter/model/plan/usecase/LoadSavedEncounterPlanUseCase.java:16-24` |
| Combat progression and result route | `EncounterStateIntentHandler.consume` for combat/results input -> `EncounterApplicationService.applyState` -> `ApplyEncounterStateUseCase.execute` -> `ApplyEncounterSessionUseCase.apply` -> `EncounterSession.apply` -> combat handler (`CombatTurnTracker`, `CombatRosterMutation`, or `CombatResolutionTracker`) -> `PublishEncounterSessionUseCase.execute` -> `EncounterSessionPublishedStateServiceAssembly.publishCurrentSession` | 8 to Encounter state publication | `src/view/statetabs/encounter/EncounterStateIntentHandler.java:83-123`, `src/domain/encounter/model/session/EncounterSession.java:126-151`, `src/domain/encounter/model/session/EncounterSession.java:208-227`, `src/domain/encounter/model/session/usecase/PublishEncounterSessionUseCase.java:21-31`, `src/domain/encounter/EncounterSessionPublishedStateServiceAssembly.java:45-56` |
| Saved-plan budget refresh | `EncounterApplicationService.refreshPlanBudget` -> `PublishEncounterPlanBudgetUseCase.execute` -> `LoadEncounterPlanBudgetUseCase.execute` -> `EncounterPlanRepository.load` plus Party/Creature fact lookups -> `EncounterPlanPublishedStateServiceAssembly.publishPlanBudget` -> `EncounterPlanBudgetModel.current/subscribe` | 6 to Encounter plan-budget publication | `src/domain/encounter/EncounterApplicationService.java:40-41`, `src/domain/encounter/model/plan/usecase/PublishEncounterPlanBudgetUseCase.java:21-34`, `src/domain/encounter/model/plan/usecase/LoadEncounterPlanBudgetUseCase.java:38-75`, `src/domain/encounter/EncounterPlanPublishedStateServiceAssembly.java:41-45`, `src/domain/encounter/published/EncounterPlanBudgetModel.java:13-28` |

The dominant Encounter-owned baseline is 13 meaningful hops to first
Encounter state publication for generation and saved-plan readback. The combat
route is shorter once a session already exists, but it still crosses the same
application-service, usecase, session, and publication layers.

If a review counts SQLite saved-plan internals, saved-plan save/load/list add
`SqliteEncounterPlanRepository`, `SqliteEncounterLocalGateway`,
`EncounterPlanSqliteStore`, and `EncounterPlanMapper` before the domain plan
returns. These data-layer internals are counted separately because `src/data/**`
is not a normal per-area migration target.

## Forwarding-Only Baseline

Forwarding-only means a concrete class whose production behavior is primarily
unpacking, delegating, registering, or proxying to another object without
owning meaningful decision logic. Interfaces are noted as seam overhead but not
counted as forwarding-only classes.

| Class | Baseline classification | Evidence |
| --- | --- | --- |
| `src/domain/encounter/EncounterApplicationService.java` | Forwarding/unpacking candidate | Public methods unpack published commands into usecase requests and delegate to three usecases (`src/domain/encounter/EncounterApplicationService.java:32-92`). |
| `src/domain/encounter/EncounterServiceContribution.java` | Register-only composition candidate | Registers one application service factory and five published model factories (`src/domain/encounter/EncounterServiceContribution.java:13-21`). |
| `src/domain/encounter/EncounterServiceAssembly.java` | Published-model factory/pass-through candidate | Creates the application service and returns published models from the shared published-state assembly (`src/domain/encounter/EncounterServiceAssembly.java:8-31`). |
| `src/domain/encounter/EncounterPublishedStateServiceAssembly.java` | Published-state pass-through candidate | Holds session and plan published-state assemblies and exposes their repositories and models without additional decision logic (`src/domain/encounter/EncounterPublishedStateServiceAssembly.java:8-39`). |
| `src/domain/encounter/model/session/usecase/ApplyEncounterSessionUseCase.java` | Stateful session wrapper candidate | Holds one `EncounterSession`, refreshes it on construction/current read, and delegates commands to `EncounterSession.apply` (`src/domain/encounter/model/session/usecase/ApplyEncounterSessionUseCase.java:9-24`). |
| `src/domain/encounter/published/EncounterStateModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a not-registered default (`src/domain/encounter/published/EncounterStateModel.java:10-28`). |
| `src/domain/encounter/published/EncounterBuilderInputsModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with an empty-input default (`src/domain/encounter/published/EncounterBuilderInputsModel.java:10-25`). |
| `src/domain/encounter/published/EncounterTuningPreviewModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a storage-error default (`src/domain/encounter/published/EncounterTuningPreviewModel.java:11-33`). |
| `src/domain/encounter/published/SavedEncounterPlanListModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a storage-error default (`src/domain/encounter/published/SavedEncounterPlanListModel.java:10-28`). |
| `src/domain/encounter/published/EncounterPlanBudgetModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a storage-error default (`src/domain/encounter/published/EncounterPlanBudgetModel.java:10-28`). |
| `src/data/encounter/EncounterServiceContribution.java` | Data-layer forwarding candidate, counted separately | Registers `SqliteEncounterPlanRepository` as `EncounterPlanRepository` (`src/data/encounter/EncounterServiceContribution.java:9-12`). |
| `src/data/encounter/repository/SqliteEncounterPlanRepository.java` | Data-layer adapter forwarding candidate, counted separately | Port methods delegate to the local gateway and `EncounterPlanMapper` (`src/data/encounter/repository/SqliteEncounterPlanRepository.java:24-49`). |

Baseline count: 10 product/published forwarding or proxy candidates plus 2
data-layer candidates counted separately.

Structural overhead that is intentionally not counted as pure forwarding:
`ApplyEncounterStateUseCase` owns action-code normalization and saved-plan
republication; `UpdateEncounterBuilderInputsUseCase` maps published builder
controls into generation inputs; the saved-plan and budget publication usecases
own storage-error and invalid-request fallback behavior; the request/readback
assemblies translate foreign Creature, Party, Encounter Table, and Worldplanner
published seams into Encounter facts. They remain design targets if the target
design can collapse them without changing behavior, but they are not pure
proxy classes.

## String Boundary Round-Trips

String round-trip means a typed, finite-domain, or selected reference value is
carried as a String across an internal Encounter boundary and later matched,
normalized, or interpreted back into the same finite-domain meaning. Free-form
status text, generated labels, creature names, imported display taxonomy, and
view-local numeric text parsing do not count.

| Family | Baseline round-trip | Evidence |
| --- | --- | --- |
| Combatant identity keys | Domain combat rows publish string combatant ids such as `monster-<id>` and `world-npc-<id>`; the state-tab sends those ids back through combat input events and `ApplyEncounterStateCommand`, and the session resolves them by string equality for HP and initiative mutations. | `src/domain/encounter/model/session/EncounterSessionCreatureRows.java:24-35`, `src/domain/encounter/model/session/repository/EncounterSessionCreatureDataRepository.java:68-89`, `src/domain/encounter/published/EncounterStateSnapshot.java:150-191`, `src/view/statetabs/encounter/EncounterStateIntentHandler.java:92-100`, `src/domain/encounter/model/session/CombatTurn.java:24-84`, `src/domain/encounter/model/session/EncounterSession.java:140-151`, `src/domain/encounter/model/session/EncounterSession.java:210-227` |
| Creature taxonomy filters | Builder inputs carry creature type, subtype, and biome keys as `List<String>` through the published builder-input seam into `EncounterGenerationInputs`, then into Creature candidate requests. The vocabulary is imported from the Creature catalog, but Encounter currently stores and forwards it as internal generation state. | `src/domain/encounter/published/EncounterBuilderInputs.java:5-28`, `src/domain/encounter/published/UpdateEncounterBuilderInputsCommand.java:10-28`, `src/domain/encounter/model/session/usecase/UpdateEncounterBuilderInputsUseCase.java:36-57`, `src/domain/encounter/model/generation/EncounterGenerationInputs.java:7-19`, `src/domain/encounter/EncounterCreatureRequestServiceAssembly.java:31-47` |
| State-tab active content mode | Published `EncounterStateSnapshot.Mode` is converted to `effective.name()` and parsed into the duplicate view-local `EncounterStateContentModel.ActiveContent` enum with `valueOf(...)`. | `src/domain/encounter/published/EncounterStateSnapshot.java:7-30`, `src/view/statetabs/encounter/EncounterStateContributionModel.java:18-23`, `src/view/statetabs/encounter/EncounterStateContentModel.java:7-12` |

Baseline count: 3 product String boundary families.

Diagnostic non-counts:

- `ApplyEncounterStateCommand.Action` is a finite action enum converted to an
  `int` code and mapped back to `EncounterSessionCommand.Action`
  (`src/domain/encounter/published/ApplyEncounterStateCommand.java:330-355`,
  `src/domain/encounter/application/ApplyEncounterStateUseCase.java:19-40`,
  `src/domain/encounter/application/ApplyEncounterStateUseCase.java:89-95`).
  It is a real boundary smell, but it is not a String round-trip.
- Encounter status lines and generated/saved plan labels are display text; the
  product does not parse them back into finite-domain values.
- Difficulty labels are display output; builder difficulty selection returns as
  boolean/number controls, not as parsed label text.
- View-local `NumberField.parse` and button action ids such as `+hp` or `-hp`
  stay inside `src/view/statetabs/encounter` control handling and do not cross
  the Encounter product boundary as domain protocol.

## Residual Notes For Design

- The M3 Encounter target design must use the 191-file product subset as its
  normal structural surface and explicitly name any data-layer gateway
  signature adaptation if one is required.
- Published seams consumed by the state tab, Worldplanner, Session Planner,
  Creature details, Encounter Table candidates, Party facts, and the M3.1
  harnesses remain byte-compatible unless both sides are migrated in the same
  approved design.
- The target design must preserve the old production behavior proven by
  `worldPlannerEncounterHarness` and `encounterStateTabHarness`, including
  saved-plan readback, generation, combat mode transitions, result-state
  publication, and plan-budget publication.
- M3.2 does not authorize a wiring port or implementation. The next step is a
  judge-approved Encounter target design with target classes, representative
  call chains, deletion list, seam statement, frozen parity inventory, and
  metric targets or explicitly justified exceptions.
