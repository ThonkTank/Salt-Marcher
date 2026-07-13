Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: M3.2 diagnostic baseline metrics for the Worldplanner
architecture migration area before target design.

# Worldplanner Migration Baseline

## Purpose

This document records the M3.2 baseline metrics for the Worldplanner area
before any target design, wiring port, or implementation. The numbers are
diagnostic: they define the baseline for the later M3 conformance review, but
they do not approve a design or prescribe implementation.

## Scope

The roadmap's `worldplanner (82 files)` count is reproducible only with these
roots:

- `src/domain/worldplanner`
- `src/view/leftbartabs/worldplanner`
- `src/data/worldplanner`

The migration-owned product subset is `src/domain/worldplanner` plus
`src/view/leftbartabs/worldplanner` with 68 Java files. The 14
`src/data/worldplanner` files are counted because they make the roadmap number
reproducible, but the ledger's data-layer exclusion still applies: data code is
not a normal per-area migration target unless the approved Worldplanner design
requires a gateway signature adaptation.

Adjacent Creature, Encounter Table, and Encounter files are harness consumers
or published-boundary providers and remain outside the 82-file baseline.

## Reproduction

File count:

```bash
find src/domain/worldplanner src/view/leftbartabs/worldplanner \
  src/data/worldplanner -type f -name '*.java' | wc -l
# 82
```

Line count:

```bash
find src/domain/worldplanner src/view/leftbartabs/worldplanner \
  src/data/worldplanner -type f -name '*.java' -print0 \
  | sort -z | xargs -0 wc -l
# 5440 total
```

LOC means physical Java file lines from `wc -l`, including blank lines and
comments. Secondary nonblank count from the same file set is 4,785 lines.

## File And LOC Baseline

| Root | Files | Physical LOC | Nonblank LOC | Migration ownership |
| --- | ---: | ---: | ---: | --- |
| `src/domain/worldplanner` | 42 | 1,726 | 1,514 | Product structure |
| `src/view/leftbartabs/worldplanner` | 26 | 2,941 | 2,585 | Product structure |
| `src/data/worldplanner` | 14 | 773 | 686 | Counted separately; not a normal migration target |
| Product subset | 68 | 4,667 | 4,099 | Main M3 design surface |
| Full roadmap set | 82 | 5,440 | 4,785 | M3 measurement denominator |

## Intent-To-Mutation Chains

Counting rule: count meaningful class-boundary hops from user intent source to
first Worldplanner-owned domain or durable mutation. Command/value-record
construction and same-class private helpers are not counted. Persistence
internals and published readback tails are recorded separately when they
materially lengthen the path.

| Interaction | Baseline chain | Hop count | Evidence |
| --- | --- | ---: | --- |
| Create NPC | `WorldPlannerStateView.action/snapshot` -> `WorldPlannerIntentHandler.createNpc` -> `WorldPlannerApplicationService.createNpc` -> `CreateWorldNpcUseCase.execute` -> `WorldNpc` construction / `repository.save` | 5 | `src/view/leftbartabs/worldplanner/WorldPlannerStateView.java:158-192`, `src/view/leftbartabs/worldplanner/WorldPlannerIntentHandler.java:142-149`, `src/domain/worldplanner/WorldPlannerApplicationService.java:72-80`, `src/domain/worldplanner/model/world/usecase/CreateWorldNpcUseCase.java:26-68` |
| Defeat or reactivate NPC | `WorldPlannerStateView.action/snapshot` -> `WorldPlannerIntentHandler.defeatNpc/reactivateNpc` -> `WorldPlannerApplicationService.setNpcLifecycleStatus` -> `SetWorldNpcLifecycleStatusUseCase.execute` -> `WorldNpc.markDefeated/reactivate` -> `WorldPlannerStateChanges.replaceNpc` -> `repository.save` | 5 to domain mutation; 7 including replacement/save | `src/view/leftbartabs/worldplanner/WorldPlannerStateView.java:162-163`, `src/view/leftbartabs/worldplanner/WorldPlannerIntentHandler.java:161-168`, `src/domain/worldplanner/WorldPlannerApplicationService.java:93-96`, `src/domain/worldplanner/model/world/usecase/SetWorldNpcLifecycleStatusUseCase.java:21-42`, `src/domain/worldplanner/model/world/usecase/WorldPlannerStateChanges.java:12-25` |
| Set faction inventory limit | `WorldPlannerStateView.action/snapshot` -> `WorldPlannerIntentHandler.setInventoryLimit` -> `WorldPlannerApplicationService.setFactionInventoryLimit` -> `SetWorldFactionInventoryLimitUseCase.execute` -> `WorldFaction.setInventoryLimit` -> `WorldPlannerStateChanges.replaceFaction` -> `repository.save` | 5 to domain mutation; 7 including replacement/save | `src/view/leftbartabs/worldplanner/WorldPlannerStateView.java:169-176`, `src/view/leftbartabs/worldplanner/WorldPlannerIntentHandler.java:193-198`, `src/domain/worldplanner/WorldPlannerApplicationService.java:112-119`, `src/domain/worldplanner/model/world/usecase/SetWorldFactionInventoryLimitUseCase.java:27-45`, `src/domain/worldplanner/model/world/WorldFaction.java:54-69` |
| Link location to encounter table | `WorldPlannerStateView.action/snapshot` -> `WorldPlannerIntentHandler.addLocationEncounterTable` -> `WorldPlannerApplicationService.addLocationEncounterTable` -> `AddWorldLocationEncounterTableUseCase.execute` -> `WorldLocation.addEncounterTable` -> `WorldPlannerStateChanges.replaceLocation` -> `repository.save`; reference validation crosses the Encounter Table seam before mutation | 5 to domain mutation; 7 including replacement/save | `src/view/leftbartabs/worldplanner/WorldPlannerStateView.java:179-186`, `src/view/leftbartabs/worldplanner/WorldPlannerIntentHandler.java:211-214`, `src/domain/worldplanner/WorldPlannerApplicationService.java:132-137`, `src/domain/worldplanner/model/world/usecase/AddWorldLocationEncounterTableUseCase.java:25-41`, `src/domain/worldplanner/model/world/WorldLocation.java:41-47`, `src/domain/worldplanner/WorldPlannerServiceContribution.java:88-101` |

The dominant Worldplanner-owned user-action baseline is 5 meaningful hops to
the first domain mutation. Lifecycle, inventory-limit, and location-link
routes reach 7 hops if the immutable replacement helper and repository save
tail are counted separately.

The cross-area "Zum Encounter" route leaves the Worldplanner area after
`WorldPlannerIntentHandler.addNpcToEncounter` calls
`EncounterApplicationService.applyState`. Its Worldplanner-owned portion is
recorded for the M3 seam statement instead of counted as a Worldplanner
mutation path.

If a review counts durable SQLite row mutation instead of the domain/repository
mutation, successful saves add `SqliteWorldPlannerRepository`,
`SqliteWorldPlannerLocalGateway`, `SqliteWorldPlannerWriter`, and the concrete
SQL statement. If a review counts published readback mutation, successful
Worldplanner mutations add `WorldPlannerServiceAssembly.publish`.

## Forwarding-Only Baseline

Forwarding-only means a concrete class whose production behavior is primarily
unpacking, delegating, or proxying to another object without owning meaningful
decision logic. Interfaces are noted as seam overhead but not counted as
forwarding-only classes.

| Class | Baseline classification | Evidence |
| --- | --- | --- |
| `src/domain/worldplanner/WorldPlannerApplicationService.java` | Forwarding-only candidate | Public methods mostly null-check command records, map command fields, and delegate to per-verb use cases under the common storage-failure wrapper (`src/domain/worldplanner/WorldPlannerApplicationService.java:67-138`). |
| `src/domain/worldplanner/model/world/usecase/LoadWorldPlannerUseCase.java` | Forwarding-only candidate | `execute()` and `refresh()` only call `repository.load()` (`src/domain/worldplanner/model/world/usecase/LoadWorldPlannerUseCase.java:15-20`). |
| `src/domain/worldplanner/published/WorldPlannerSnapshotModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions, with an empty-snapshot default (`src/domain/worldplanner/published/WorldPlannerSnapshotModel.java:26-35`). |
| `src/data/worldplanner/WorldPlannerServiceContribution.java` | Data-layer forwarding candidate, counted separately | `register` only registers `SqliteWorldPlannerRepository` as `WorldPlannerRepository` (`src/data/worldplanner/WorldPlannerServiceContribution.java:10-12`). |

Baseline count: 3 product/published forwarding or proxy candidates plus 1
data-layer candidate counted separately.

Seam overhead to account for in the design, but not counted as concrete
forwarding-only classes: `WorldPlannerRepository` is a two-method storage seam
and `WorldPlannerReferencePort` is a two-method external-reference seam.
`WorldPlannerServiceContribution` is not forwarding-only because it owns
assembly memoization and the published Creature / Encounter Table reference
validator.

## String Boundary Round-Trips

String round-trip means a typed or finite-domain value is converted to a String
for an internal Worldplanner boundary and later parsed, normalized, or matched
back into the same finite-domain meaning. User text fields and persisted
display names do not count.

| Family | Baseline round-trip | Evidence |
| --- | --- | --- |
| Lifecycle status | Domain `WorldNpcLifecycleState` is published with `.name()`, parsed through `WorldNpcLifecycleStatus.fromName`, sent back through `SetWorldNpcLifecycleStatusCommand`, and converted to the use-case enum with `valueOf(command.status().name())`. | `src/domain/worldplanner/WorldPlannerServiceAssembly.java:80-88`, `src/domain/worldplanner/published/WorldNpcLifecycleStatus.java:7-13`, `src/domain/worldplanner/WorldPlannerApplicationService.java:166-175` |
| NPC status filters | Search filter options carry `ACTIVE` and `DEFEATED` String keys and match them against `npc.status().name()`. | `src/view/leftbartabs/worldplanner/WorldPlannerContributionModel.java:327-331`, `src/view/leftbartabs/worldplanner/WorldPlannerNpcMainContentModel.java:221-233` |
| Statblock id filters | Creature rows become labels like `#id | name`; filter keys recover the id substring and match it against `Long.toString(npc.creatureStatblockId())`. | `src/view/leftbartabs/worldplanner/WorldPlannerNpcMainContentModel.java:46-58`, `src/view/leftbartabs/worldplanner/WorldPlannerContributionModel.java:321-326`, `src/view/leftbartabs/worldplanner/WorldPlannerContributionModel.java:406-411`, `src/view/leftbartabs/worldplanner/WorldPlannerNpcMainContentModel.java:247-257` |
| Encounter-table id filters | Encounter table labels use the same `#id | name` convention and are matched back through String keys for faction and location filtering. | `src/view/leftbartabs/worldplanner/WorldPlannerFilterContentPartModel.java:39-48`, `src/view/leftbartabs/worldplanner/WorldPlannerFactionMainContentModel.java:246-291`, `src/view/leftbartabs/worldplanner/WorldPlannerLocationMainContentModel.java:202-216` |
| NPC and faction reference id filters | NPC and faction relationship ids are rendered into labels, then recovered or matched as String keys for faction and location filters. | `src/view/leftbartabs/worldplanner/WorldPlannerFactionMainContentModel.java:230-232`, `src/view/leftbartabs/worldplanner/WorldPlannerFactionMainContentModel.java:260-261`, `src/view/leftbartabs/worldplanner/WorldPlannerLocationMainContentModel.java:188-216` |
| Stock discriminator | Faction stock filters use `finite` and `unlimited` String keys and match them against boolean inventory-limit state. | `src/view/leftbartabs/worldplanner/WorldPlannerContributionModel.java:345-347`, `src/view/leftbartabs/worldplanner/WorldPlannerFactionMainContentModel.java:266-271` |
| Encounter source discriminator | Encounter source filters use `faction` and `location` String keys and match them against rows from the published source projection. | `src/view/leftbartabs/worldplanner/WorldPlannerContributionModel.java:363-369`, `src/view/leftbartabs/worldplanner/WorldPlannerSourceMainContentModel.java:65-87` |

Baseline count: 7 product String round-trip families. Data-layer enum
serialization in `src/data/worldplanner/mapper/WorldPlannerMapper.java:97-136`
and `src/data/worldplanner/gateway/local/SqliteWorldPlannerWriter.java:55` is
counted separately because persistence stores NPC lifecycle status as a String.

Numeric user-entry parsing in `WorldPlannerIntentHandler.parseQuantity` and
display-only `toString()` text projections are not counted as finite-domain
round-trips for this baseline.

## Residual Notes For Design

- The M3 Worldplanner target design must use the 68-file product subset as its
  normal structural surface and explicitly name any data-layer gateway
  signature adaptation if one is required.
- Published seams consumed by Encounter, Encounter Table, Creature, search
  controls, and shell surfaces remain byte-compatible unless both sides are
  migrated in the same approved design.
- The M3.3 target design must account for the cross-area "Zum Encounter" route
  and the published-reference validator without changing visible behavior.
- M3.2 does not authorize a wiring port or implementation. The next step is a
  judge-approved Worldplanner target design with target classes,
  representative call chains, deletion list, seam statement, and untouched-list.
