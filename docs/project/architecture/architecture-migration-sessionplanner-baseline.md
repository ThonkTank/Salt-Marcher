Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M3.2 diagnostic baseline metrics for the Session Planner
architecture migration area before target design.

# Session Planner Migration Baseline

## Purpose

This document records the M3.2 baseline metrics for the Session Planner area
before any target design, wiring port, or implementation. The numbers are
diagnostic: they define the baseline for the later M3 conformance review, but
they do not approve a design or prescribe implementation.

## Scope

The roadmap's `sessionplanner (121 files)` count is reproducible only with
these roots:

- `src/domain/sessionplanner`
- `src/view/leftbartabs/sessionplanner`
- `src/data/sessionplanner`

The migration-owned product subset is `src/domain/sessionplanner` plus
`src/view/leftbartabs/sessionplanner` with 103 Java files. The 18
`src/data/sessionplanner` files are counted because they make the roadmap
number reproducible, but the ledger's data-layer exclusion still applies: data
code is not a normal per-area migration target unless the approved Session
Planner design requires a gateway signature adaptation.

Adjacent generic catalog CRUD controls, Party, Encounter, World Planner,
Creature, and later Loot files are harness consumers or published-boundary
providers and remain outside the 121-file baseline. The Session Planner domain
contract identifies the area as owner of session-local participant references,
encounter allocations, rest placement, placeholder state, and selection truth,
but not party truth, encounter-plan roster truth, creature truth, or loot truth
(`src/domain/sessionplanner/DOMAIN.md:15-20`,
`src/domain/sessionplanner/DOMAIN.md:68-83`). The requirements likewise define
the visible planning surface around persisted sessions, participants, scenes,
saved encounter references, rest placement, and loot placeholders without
copying foreign truth (`docs/sessionplanner/requirements/requirements-session-planner.md:11-25`,
`docs/sessionplanner/requirements/requirements-session-planner.md:84-113`).

## Reproduction

File count:

```bash
find src/domain/sessionplanner src/view/leftbartabs/sessionplanner \
  src/data/sessionplanner -type f -name '*.java' | wc -l
# 121
```

Line count:

```bash
find src/domain/sessionplanner src/view/leftbartabs/sessionplanner \
  src/data/sessionplanner -type f -name '*.java' -print0 \
  | sort -z | xargs -0 wc -l
# 7831 total
```

LOC means physical Java file lines from `wc -l`, including blank lines and
comments. Secondary nonblank count from the same file set is 6,828 lines.

## File And LOC Baseline

| Root | Files | Physical LOC | Nonblank LOC | Migration ownership |
| --- | ---: | ---: | ---: | --- |
| `src/domain/sessionplanner` | 91 | 4,284 | 3,679 | Product structure |
| `src/view/leftbartabs/sessionplanner` | 12 | 2,380 | 2,109 | Product structure |
| `src/data/sessionplanner` | 18 | 1,167 | 1,040 | Counted separately; not a normal migration target |
| Product subset | 103 | 6,664 | 5,788 | Main M3 design surface |
| Full roadmap set | 121 | 7,831 | 6,828 | M3 measurement denominator |

## Intent-To-Mutation Chains

Counting rule: count meaningful class-boundary hops from user intent source to
the first Session Planner-owned domain or durable mutation. Command/value
record construction and same-class private helpers are not counted. Persistence
internals, publication, and foreign readback tails are recorded separately when
they materially lengthen the path.

| Interaction | Baseline chain | Hop count | Evidence |
| --- | --- | ---: | --- |
| Create a session from the catalog controls | `CatalogCrudControlsView.publishSubmit/createSubmittedEvent` -> `SessionPlannerIntentHandler.consumeCatalogMutation` -> `SessionPlannerApplicationService.createSession` -> `CreateSessionPlanUseCase.execute` -> `SeedSessionPlanUseCase.execute` -> `SessionPartyFactsPort.activePartyMembers` -> `SessionPlanSeedHelper.createSeeded` / `SessionPlan.rename` -> `SaveCurrentSessionPlanUseCase.executeNewCurrent` -> `SessionPlanRepository.save` | 7 to seeded `SessionPlan` construction or rename; 9 including canonical save/current-pointer tail | `src/view/slotcontent/controls/catalogcrud/CatalogCrudControlsView.java:341-352`, `src/view/slotcontent/controls/catalogcrud/CatalogCrudControlsView.java:420-427`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:255-267`, `src/domain/sessionplanner/SessionPlannerApplicationService.java:31-49`, `src/domain/sessionplanner/model/session/usecase/CreateSessionPlanUseCase.java:26-33`, `src/domain/sessionplanner/model/session/usecase/SeedSessionPlanUseCase.java:20-30`, `src/domain/sessionplanner/model/session/helper/SessionPlanSeedHelper.java:12-20`, `src/domain/sessionplanner/model/session/usecase/SaveCurrentSessionPlanUseCase.java:29-40` |
| Add a blank scene | `SessionPlannerTimelineMainView.rawPublish` -> `SessionPlannerIntentHandler.addScene` -> `SessionPlannerEncounterApplicationService.addScene` -> `AddSessionSceneUseCase.execute` -> `LoadCurrentSessionPlanUseCase.execute` -> `SessionPlan.addScene` -> `SaveCurrentSessionPlanUseCase.execute` -> `SessionPlanRepository.save` | 6 to first `SessionPlan` mutation; 8 including durable save | `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:70-75`, `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:330-342`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:119-122`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:304-305`, `src/domain/sessionplanner/SessionPlannerEncounterApplicationService.java:65-68`, `src/domain/sessionplanner/model/session/usecase/AddSessionSceneUseCase.java:16-17`, `src/domain/sessionplanner/model/session/SessionPlan.java:135-143`, `src/domain/sessionplanner/model/session/usecase/SaveCurrentSessionPlanUseCase.java:23-40` |
| Attach a saved Encounter plan to the current session | `SessionPlannerControlsView.publishAttachPlan` -> `SessionPlannerIntentHandler.attachEncounter` -> `SessionPlannerEncounterApplicationService.attachEncounter` -> `AttachSessionEncounterUseCase.execute` -> `LoadCurrentSessionPlanUseCase.execute` -> `SessionPlan.attachEncounter` -> `SaveCurrentSessionPlanUseCase.execute` -> `SessionPlanRepository.save` | 6 to first `SessionPlan` mutation; 8 including durable save | `src/view/leftbartabs/sessionplanner/SessionPlannerControlsView.java:81-105`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:65-71`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:300-301`, `src/domain/sessionplanner/SessionPlannerEncounterApplicationService.java:70-73`, `src/domain/sessionplanner/model/session/usecase/AttachSessionEncounterUseCase.java:16-17`, `src/domain/sessionplanner/model/session/SessionPlan.java:145-156`, `src/domain/sessionplanner/model/session/usecase/SaveCurrentSessionPlanUseCase.java:23-40` |
| Update scene title, notes, or World Planner location | `SessionPlannerTimelineMainView.rawPublishSceneText` -> `SessionPlannerIntentHandler.saveTimelineScene/updateEncounterScene` -> `SessionPlannerEncounterApplicationService.updateEncounterScene` -> `UpdateSessionEncounterSceneUseCase.execute` -> `LoadCurrentSessionPlanUseCase.execute` -> optional `SessionLocationReferencePort.locationExists` -> `SessionPlan.updateEncounterScene` -> `SaveCurrentSessionPlanUseCase.execute` -> `SessionPlanRepository.save` | 6 to first `SessionPlan` mutation without location validation; 7 with a nonzero World Planner location check; 8-9 including durable save | `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:220-248`, `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:390-409`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:181-188`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:346-351`, `src/domain/sessionplanner/SessionPlannerEncounterApplicationService.java:102-109`, `src/domain/sessionplanner/model/session/usecase/UpdateSessionEncounterSceneUseCase.java:23-30`, `src/domain/sessionplanner/model/session/SessionPlan.java:232-240` |
| Add or remove a participant reference | `SessionPlannerTimelineMainView.rawPublishParticipantAdd/rawPublishParticipantRemove` -> `SessionPlannerIntentHandler.addTimelineParticipant/removeTimelineParticipant` -> `SessionPlannerParticipantApplicationService.addParticipant/removeParticipant` -> `AddSessionParticipantUseCase` or `RemoveSessionParticipantUseCase` -> `LoadCurrentSessionPlanUseCase.execute` -> `SessionPlan.addParticipant/removeParticipant` -> `SaveCurrentSessionPlanUseCase.execute` -> `SessionPlanRepository.save` | 6 to first `SessionPlan` mutation; 8 including durable save | `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:78-132`, `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:433-464`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:201-211`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:288-293`, `src/domain/sessionplanner/SessionPlannerParticipantApplicationService.java:23-31`, `src/domain/sessionplanner/model/session/usecase/AddSessionParticipantUseCase.java:16-17`, `src/domain/sessionplanner/model/session/SessionPlan.java:104-127` |
| Set or clear a rest gap | `SessionPlannerTimelineMainView.rawPublishRestGap` -> `SessionPlannerIntentHandler.setTimelineRest/clearTimelineRest` -> `SessionPlannerRestApplicationService.setRestGap/clearRestGap` -> `SetSessionRestGapUseCase` or `ClearSessionRestGapUseCase` -> `LoadCurrentSessionPlanUseCase.execute` -> `SessionPlan.setRestPlacement/clearRestPlacement` -> `SaveCurrentSessionPlanUseCase.execute` -> `SessionPlanRepository.save` | 6 to first `SessionPlan` mutation; 8 including durable save | `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:292-328`, `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:360-372`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:157-166`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:330-335`, `src/domain/sessionplanner/SessionPlannerRestApplicationService.java:24-33`, `src/domain/sessionplanner/model/session/usecase/SetSessionRestGapUseCase.java:18-28`, `src/domain/sessionplanner/model/session/SessionPlan.java:250-276` |
| Add or remove a loot placeholder | `SessionPlannerTimelineMainView.rawPublishScene/rawPublishLoot` -> `SessionPlannerIntentHandler.addTimelineLoot/removeTimelineLoot` -> `SessionPlannerLootApplicationService.addLootPlaceholder/removeLootPlaceholder` -> `AddSessionLootPlaceholderUseCase` or `RemoveSessionLootPlaceholderUseCase` -> `LoadCurrentSessionPlanUseCase.execute` -> `SessionPlan.addLootPlaceholder/removeLootPlaceholder` -> `SaveCurrentSessionPlanUseCase.execute` -> `SessionPlanRepository.save` | 6 to first `SessionPlan` mutation; 8 including durable save | `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:259-288`, `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:345-387`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:169-178`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:338-343`, `src/domain/sessionplanner/SessionPlannerLootApplicationService.java:28-36`, `src/domain/sessionplanner/model/session/usecase/AddSessionLootPlaceholderUseCase.java:16-17`, `src/domain/sessionplanner/model/session/SessionPlan.java:278-312` |

The dominant Session Planner baseline is 6 meaningful hops from rendered
Session Planner timeline intent to the first `SessionPlan` mutation. The
longest Session Planner-owned paths reach 7 hops: create-session seeding reads
active-party facts before constructing the first `SessionPlan`, and scene save
validates a nonzero World Planner location before updating the scene.
Successful mutation routes then add the shared canonical save and publication
tail:
`SaveCurrentSessionPlanUseCase` -> `SessionPlanRepository.save` ->
`SessionPlannerPublishedStateRepositoryServiceAssembly.publishCurrentSession`
-> projection assemblies -> `SessionPlannerPublishedModelsServiceAssembly`
channel publish (`src/domain/sessionplanner/model/session/usecase/SaveCurrentSessionPlanUseCase.java:23-40`,
`src/domain/sessionplanner/SessionPlannerPublishedStateRepositoryServiceAssembly.java:52-77`,
`src/domain/sessionplanner/SessionPlannerPublishedModelsServiceAssembly.java:91-108`).

If a review counts durable SQLite row mutation instead of the domain/repository
mutation, successful saves add `SqliteSessionPlanRepository`,
`SessionPlanMapper`, `SqliteSessionPlannerLocalGateway`, and the concrete
write gateway before the SQL statement
(`src/data/sessionplanner/repository/SqliteSessionPlanRepository.java:42-45`,
`src/data/sessionplanner/mapper/SessionPlanMapper.java:24-70`,
`src/data/sessionplanner/gateway/local/SqliteSessionPlannerLocalGateway.java:62-139`).

## Forwarding-Only Baseline

Forwarding-only means a concrete class whose production behavior is primarily
unpacking, delegating, or proxying to another object without owning meaningful
decision logic. Interfaces are noted as seam overhead but not counted as
forwarding-only classes.

| Class | Baseline classification | Evidence |
| --- | --- | --- |
| `src/domain/sessionplanner/SessionPlannerApplicationService.java` | Forwarding-only catalog command candidate | Public methods null-check command records and delegate to catalog use cases (`src/domain/sessionplanner/SessionPlannerApplicationService.java:31-49`). |
| `src/domain/sessionplanner/SessionPlannerParticipantApplicationService.java` | Forwarding-only participant command candidate | `addParticipant` and `removeParticipant` unpack command records and delegate to use cases (`src/domain/sessionplanner/SessionPlannerParticipantApplicationService.java:23-31`). |
| `src/domain/sessionplanner/SessionPlannerEncounterApplicationService.java` | Forwarding-only encounter command candidate | Public methods unpack command records and delegate to encounter use cases (`src/domain/sessionplanner/SessionPlannerEncounterApplicationService.java:60-109`). |
| `src/domain/sessionplanner/SessionPlannerRestApplicationService.java` | Forwarding-only rest command candidate with String conversion | Methods unpack rest commands, convert rest kind with `.name()`, and delegate to use cases (`src/domain/sessionplanner/SessionPlannerRestApplicationService.java:24-33`). |
| `src/domain/sessionplanner/SessionPlannerLootApplicationService.java` | Forwarding-only loot command candidate | Methods unpack loot commands and delegate to use cases (`src/domain/sessionplanner/SessionPlannerLootApplicationService.java:28-36`). |
| `src/domain/sessionplanner/SessionPlannerServiceContribution.java` | Register-only composition candidate | `register` creates resolver factories that delegate to `SessionPlannerServiceAssembly` methods (`src/domain/sessionplanner/SessionPlannerServiceContribution.java:17-67`). |
| `src/domain/sessionplanner/SessionPlannerServiceAssembly.java` | Composition/pass-through candidate | Stores a runtime assembly and forwards every create/model method to it (`src/domain/sessionplanner/SessionPlannerServiceAssembly.java:12-58`). |
| `src/domain/sessionplanner/SessionPlannerRuntimeServiceAssembly.java` | Composition/pass-through candidate | Splits application-service creation and published-state model access by forwarding to two assemblies (`src/domain/sessionplanner/SessionPlannerRuntimeServiceAssembly.java:12-62`). |
| `src/domain/sessionplanner/SessionPlannerEncounterFactsInvokerServiceAssembly.java` | Foreign-facts invoker forwarding candidate | Refreshes Encounter budget state through the Encounter service, then delegates readback to `SessionEncounterFactsPort` (`src/domain/sessionplanner/SessionPlannerEncounterFactsInvokerServiceAssembly.java:23-27`). |
| `src/domain/sessionplanner/SessionPlannerPartyFactsInvokerServiceAssembly.java` | Foreign-facts invoker forwarding candidate | Invokes Party adventuring-day calculation, then delegates readback to `SessionPartyFactsPort` (`src/domain/sessionplanner/SessionPlannerPartyFactsInvokerServiceAssembly.java:24-28`). |
| `src/domain/sessionplanner/SessionPlannerLocationReferenceReadbackServiceAssembly.java` | Foreign readback adapter candidate | Reads the World Planner snapshot, maps locations to planner references, and reuses that mapped list for ID existence checks (`src/domain/sessionplanner/SessionPlannerLocationReferenceReadbackServiceAssembly.java:19-33`). |
| `src/domain/sessionplanner/model/session/usecase/AddSessionSceneUseCase.java` | Load/mutate/save pass-through use case | `execute` only loads the current plan, calls `SessionPlan.addScene`, and saves (`src/domain/sessionplanner/model/session/usecase/AddSessionSceneUseCase.java:16-17`). |
| `src/domain/sessionplanner/model/session/usecase/AttachSessionEncounterUseCase.java` | Load/mutate/save pass-through use case | `execute` only loads the current plan, calls `SessionPlan.attachEncounter`, and saves (`src/domain/sessionplanner/model/session/usecase/AttachSessionEncounterUseCase.java:16-17`). |
| `src/domain/sessionplanner/model/session/usecase/AddSessionParticipantUseCase.java` | Load/mutate/save pass-through use case | `execute` only loads the current plan, calls `SessionPlan.addParticipant`, and saves (`src/domain/sessionplanner/model/session/usecase/AddSessionParticipantUseCase.java:16-17`). |
| `src/domain/sessionplanner/model/session/usecase/RemoveSessionParticipantUseCase.java` | Load/mutate/save pass-through use case | `execute` only loads the current plan, calls `SessionPlan.removeParticipant`, and saves (`src/domain/sessionplanner/model/session/usecase/RemoveSessionParticipantUseCase.java:16-17`). |
| `src/domain/sessionplanner/model/session/usecase/SetSessionEncounterDaysUseCase.java` | Load/mutate/save pass-through use case with value wrapper | `execute` only wraps the decimal in `EncounterDays`, calls `SessionPlan.setEncounterDays`, and saves (`src/domain/sessionplanner/model/session/usecase/SetSessionEncounterDaysUseCase.java:19-21`). |
| `src/domain/sessionplanner/model/session/usecase/SetSessionEncounterAllocationUseCase.java` | Load/mutate/save pass-through use case | `execute` only loads the current plan, calls `SessionPlan.setEncounterAllocation`, and saves (`src/domain/sessionplanner/model/session/usecase/SetSessionEncounterAllocationUseCase.java:18-20`). |
| `src/domain/sessionplanner/model/session/usecase/SelectSessionEncounterUseCase.java` | Load/mutate/save pass-through use case | `execute` only loads the current plan, calls `SessionPlan.selectEncounter`, and saves (`src/domain/sessionplanner/model/session/usecase/SelectSessionEncounterUseCase.java:16-17`). |
| `src/domain/sessionplanner/model/session/usecase/RemoveSessionEncounterUseCase.java` | Load/mutate/save pass-through use case | `execute` only loads the current plan, calls `SessionPlan.removeEncounter`, and saves (`src/domain/sessionplanner/model/session/usecase/RemoveSessionEncounterUseCase.java:16-17`). |
| `src/domain/sessionplanner/model/session/usecase/MoveSessionEncounterUpUseCase.java` | Load/mutate/save pass-through use case | `execute` only loads the current plan, calls `SessionPlan.moveEncounterUp`, and saves (`src/domain/sessionplanner/model/session/usecase/MoveSessionEncounterUpUseCase.java:16-17`). |
| `src/domain/sessionplanner/model/session/usecase/MoveSessionEncounterDownUseCase.java` | Load/mutate/save pass-through use case | `execute` only loads the current plan, calls `SessionPlan.moveEncounterDown`, and saves (`src/domain/sessionplanner/model/session/usecase/MoveSessionEncounterDownUseCase.java:16-17`). |
| `src/domain/sessionplanner/model/session/usecase/SetSessionRestGapUseCase.java` | Load/mutate/save pass-through use case with String discriminator | `execute` loads the current plan, maps the String rest kind to a `SessionRestPlacement`, calls `SessionPlan.setRestPlacement`, and saves (`src/domain/sessionplanner/model/session/usecase/SetSessionRestGapUseCase.java:18-28`). |
| `src/domain/sessionplanner/model/session/usecase/ClearSessionRestGapUseCase.java` | Load/mutate/save pass-through use case | `execute` only loads the current plan, calls `SessionPlan.clearRestPlacement`, and saves (`src/domain/sessionplanner/model/session/usecase/ClearSessionRestGapUseCase.java:16-18`). |
| `src/domain/sessionplanner/model/session/usecase/AddSessionLootPlaceholderUseCase.java` | Load/mutate/save pass-through use case | `execute` only loads the current plan, calls `SessionPlan.addLootPlaceholder`, and saves (`src/domain/sessionplanner/model/session/usecase/AddSessionLootPlaceholderUseCase.java:16-17`). |
| `src/domain/sessionplanner/model/session/usecase/RemoveSessionLootPlaceholderUseCase.java` | Load/mutate/save pass-through use case | `execute` only loads the current plan, calls `SessionPlan.removeLootPlaceholder`, and saves (`src/domain/sessionplanner/model/session/usecase/RemoveSessionLootPlaceholderUseCase.java:16-17`). |
| `src/domain/sessionplanner/published/SessionPlannerCurrentSessionModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a default unregistered-session snapshot (`src/domain/sessionplanner/published/SessionPlannerCurrentSessionModel.java:10-30`). |
| `src/domain/sessionplanner/published/SessionPlannerCatalogModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with an empty-catalog default (`src/domain/sessionplanner/published/SessionPlannerCatalogModel.java:10-30`). |
| `src/domain/sessionplanner/published/SessionPlannerParticipantsModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with an empty projection default (`src/domain/sessionplanner/published/SessionPlannerParticipantsModel.java:10-30`). |
| `src/domain/sessionplanner/published/SessionPlannerSceneTimelineModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with an empty timeline default (`src/domain/sessionplanner/published/SessionPlannerSceneTimelineModel.java:10-30`). |
| `src/domain/sessionplanner/published/SessionPlannerStatePanelModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with an empty state-panel default (`src/domain/sessionplanner/published/SessionPlannerStatePanelModel.java:10-30`). |
| `src/data/sessionplanner/SessionPlannerServiceContribution.java` | Data-layer forwarding candidate, counted separately | `register` only registers `SqliteSessionPlanRepository` as `SessionPlanRepository` (`src/data/sessionplanner/SessionPlannerServiceContribution.java:8-13`). |
| `src/data/sessionplanner/repository/SqliteSessionPlanRepository.java` | Data-layer adapter forwarding candidate, counted separately | Repository methods delegate to the local gateway and mapper (`src/data/sessionplanner/repository/SqliteSessionPlanRepository.java:24-65`). |

Baseline count: 30 product/published forwarding or proxy candidates plus 2
data-layer candidates counted separately.

Seam overhead to account for in the design, but not counted as concrete
forwarding-only classes: `SessionPlanRepository` is the storage seam,
`SessionPlannerPublishedStateRepository` is the internal publication seam, and
`SessionPartyFactsPort`, `SessionEncounterFactsPort`, and
`SessionLocationReferencePort` are foreign readback seams. The shared
`SessionPlannerPublishedModelChannelServiceAssembly` owns state and listener
fanout, so it is not a pure proxy despite its small size.
`SessionPlannerApplicationServicesServiceAssembly` and
`SessionPlannerPublishedStateServiceAssembly` own runtime memoization,
foreign-model readback construction, and published-state lifecycle; they are
composition overhead, but not pure forwarding-only classes.
`SessionPlannerPartyFactsReadbackServiceAssembly` and
`SessionPlannerEncounterFactsReadbackServiceAssembly` own status and projection
mapping, so they are not counted as pure proxies.
`CreateSessionPlanUseCase`, `DeleteSessionPlanUseCase`,
`RenameSessionPlanUseCase`, `SelectSessionPlanUseCase`,
`LoadCurrentSessionPlanUseCase`, `SaveCurrentSessionPlanUseCase`,
`SeedSessionPlanUseCase`, and `UpdateSessionEncounterSceneUseCase` are not
counted as pure forwarding-only classes because they own current-session
fallbacks, input guards, foreign-facts reads, location validation, selection
fallbacks, storage-failure handling, or publication side effects
(`src/domain/sessionplanner/model/session/usecase/CreateSessionPlanUseCase.java:26-40`,
`src/domain/sessionplanner/model/session/usecase/DeleteSessionPlanUseCase.java:34-54`,
`src/domain/sessionplanner/model/session/usecase/RenameSessionPlanUseCase.java:22-31`,
`src/domain/sessionplanner/model/session/usecase/SelectSessionPlanUseCase.java:24-37`,
`src/domain/sessionplanner/model/session/usecase/LoadCurrentSessionPlanUseCase.java:24-42`,
`src/domain/sessionplanner/model/session/usecase/SaveCurrentSessionPlanUseCase.java:23-45`,
`src/domain/sessionplanner/model/session/usecase/SeedSessionPlanUseCase.java:20-39`,
`src/domain/sessionplanner/model/session/usecase/UpdateSessionEncounterSceneUseCase.java:23-30`).

## String Boundary Round-Trips

String round-trip means a typed, finite-domain, or selected reference value is
carried as a String across an internal Session Planner boundary and later
parsed, normalized, or matched back into the same finite-domain meaning.
Free-form session names, scene titles, scene notes, visible labels, and
persistence text columns do not count.

| Family | Baseline round-trip | Evidence |
| --- | --- | --- |
| Session catalog identity through generic CRUD controls | `SessionPlannerContributionModel` projects selected session IDs and catalog item IDs with `Long.toString`; generic `CatalogCrudControlsViewInputEvent` carries those IDs as Strings; `SessionPlannerIntentHandler` parses them back with `parsePositiveLong` for open, rename, and delete commands. | `src/view/leftbartabs/sessionplanner/SessionPlannerContributionModel.java:72-89`, `src/view/slotcontent/controls/catalogcrud/CatalogCrudControlsViewInputEvent.java:3-29`, `src/view/slotcontent/controls/catalogcrud/CatalogCrudControlsView.java:380-427`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:237-267`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:284-285` |
| Rest kind command boundary | `SessionPlannerSceneTimelineProjectionServiceAssembly` projects domain rest placements as public `SessionPlannerRestKind`; the timeline intent handler passes that enum through `SetSessionRestGapCommand`; `SessionPlannerRestApplicationService` converts it with `.name()`; `SetSessionRestGapUseCase` switches on String constants to rebuild `SessionRestPlacement`. | `src/domain/sessionplanner/SessionPlannerSceneTimelineProjectionServiceAssembly.java:113-127`, `src/domain/sessionplanner/published/SessionPlannerRestKind.java:3-7`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:101-105`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:334-335`, `src/domain/sessionplanner/SessionPlannerRestApplicationService.java:24-27`, `src/domain/sessionplanner/model/session/usecase/SetSessionRestGapUseCase.java:18-28` |
| Encounter-days value text | `EncounterDays` publishes an exact decimal display string through the session snapshot; the timeline view republishes edited text; `SessionPlannerIntentHandler` parses it back to `BigDecimal`; the published set-days command then carries the typed value to the use case. | `src/domain/sessionplanner/model/session/EncounterDays.java:23-24`, `src/domain/sessionplanner/published/SessionPlannerSessionSnapshot.java:47-63`, `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:94-104`, `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:467-479`, `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java:214-218`, `src/domain/sessionplanner/published/SetSessionEncounterDaysCommand.java:5-8` |

Baseline count: 3 product String boundary families.

Diagnostic non-counts: timeline widget actions are encoded as numeric widget
tokens and mapped back to `TimelineWidgetKind`, so they are a typed-boundary
concern but not a String round-trip (`src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainContentModel.java:20-64`,
`src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainContentModel.java:134-139`).
Participant choices use display labels in a `ComboBox<String>` but map back by
selected index, not by parsing the label (`src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainContentModel.java:116-120`,
`src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:433-449`).
Location choices use typed `LocationChoice` objects with a display-only
converter and return the selected `id()` directly
(`src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:548-570`).

Data-layer serialization of encounter days, encounter allocation percentages,
and rest kinds is counted separately because `src/data/**` remains outside
normal per-area migration
(`src/data/sessionplanner/mapper/SessionPlanMapper.java:24-70`,
`src/data/sessionplanner/mapper/SessionPlanMapper.java:78-95`,
`src/domain/sessionplanner/model/session/SessionRestPlacement.java:28-60`).

## Residual Notes For Design

- The M3 Session Planner target design must use the 103-file product subset as
  its normal structural surface and explicitly name any data-layer gateway
  signature adaptation if one is required.
- Published seams consumed by the Session Planner view, shell, Party,
  Encounter, World Planner, and later Loot surfaces remain byte-compatible
  unless both sides are migrated in the same approved design.
- The M3.1 harness closure freezes `sessionPlannerCatalogHarness` and
  `sessionPlannerShellLayoutHarness` before any wiring or implementation work.
  The frozen production route covers catalog create/rename/select/delete,
  delete-last replacement, no implicit `Session #0`, encounter-days set,
  add/remove blank scene, saved encounter attach, scene save/select/move/
  allocation/remove, rest set/clear, loot add/remove, participant add/remove,
  compact shell layout, sidebar ordering, and scroll behavior.
- M3.2 does not authorize a wiring port or implementation. The next step is a
  judge-approved Session Planner target design with target classes,
  representative call chains, deletion list, seam statement, and untouched-list.
