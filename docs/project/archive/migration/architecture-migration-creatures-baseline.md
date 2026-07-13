Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: M3.2 diagnostic baseline metrics for the Creature
architecture migration area before target design.

# Creature Migration Baseline

## Purpose

This document records the M3.2 baseline metrics for the Creature area before
any target design, wiring port, or implementation. The numbers are diagnostic:
they define the baseline for the later M3 conformance review, but they do not
approve a design or prescribe implementation.

## Scope

The roadmap's `creatures (90 files)` count is reproducible only with these
roots:

- `src/domain/creatures`
- `src/data/creatures`

The migration-owned product subset is `src/domain/creatures` with 35 Java
files. The 55 `src/data/creatures` files are counted because they make the
roadmap number reproducible, but the ledger's data-layer exclusion still
applies: data code is not a normal per-area migration target unless the
approved Creature design requires a gateway signature adaptation.

The Creature domain document classifies this area as a read-only reference
catalog with no authored write model
(`docs/creatures/domain/domain-creatures.md:8-15`,
`docs/creatures/domain/domain-creatures.md:42-50`). For M3.2, the relevant
chain target is therefore Creature publication, not Creature domain mutation.

Adjacent catalog view files under `src/view/leftbartabs/catalog`, Encounter
state-tab files, Worldplanner reference validation, and Encounter generation
files are harness consumers or published-boundary consumers and remain outside
the 90-file baseline. The main adjacent catalog/detail view consumer set is 12
Java files / 3,848 physical LOC / 3,435 nonblank LOC and is not part of the
Creature denominator.

## Reproduction

File count:

```bash
find src/domain/creatures src/data/creatures -type f -name '*.java' | wc -l
# 90
```

Line count:

```bash
find src/domain/creatures src/data/creatures -type f -name '*.java' \
  -print0 | sort -z | xargs -0 wc -l
# 4587 total
```

LOC means physical Java file lines from `wc -l`, including blank lines and
comments. Secondary nonblank count from the same file set is 3,868 lines.

## File And LOC Baseline

| Root | Files | Physical LOC | Nonblank LOC | Migration ownership |
| --- | ---: | ---: | ---: | --- |
| `src/domain/creatures` | 35 | 2,060 | 1,754 | Product structure |
| `src/data/creatures` | 55 | 2,527 | 2,114 | Counted separately; not a normal migration target |
| Product subset | 35 | 2,060 | 1,754 | Main M3 design surface |
| Full roadmap set | 90 | 4,587 | 3,868 | M3 measurement denominator |

## Intent-To-Publication Chains

Counting rule: count meaningful class-boundary hops from user or foreign-area
intent source to first Creature-owned published-state replacement. Command and
value-record construction, same-class private helpers, and view-only selection
state are not counted. Data lookup internals are recorded separately when they
materially lengthen the path.

| Interaction | Baseline chain | Hop count | Evidence |
| --- | --- | ---: | --- |
| Catalog search or page refresh | `CatalogControlsView.publishSnapshot` or `CatalogMainView.publishSortSelection/publishPageShift` -> `CatalogIntentHandler.consume/refreshCatalog` -> `CreaturesApplicationService.refreshCatalog` -> `SearchCreatureCatalogUseCase.execute` -> `CreatureCatalogPort.searchCatalog` -> `CreaturesPublishedStateServiceAssembly.publishCatalogPage` -> `CreaturesPublishedModelChannelServiceAssembly.replace` | 7 to Creature publication; 8 including catalog view subscriber readback | `src/view/leftbartabs/catalog/CatalogControlsView.java:261-297`, `src/view/leftbartabs/catalog/CatalogMainView.java:84-107`, `src/view/leftbartabs/catalog/CatalogIntentHandler.java:118-166`, `src/domain/creatures/CreaturesApplicationService.java:56-83`, `src/domain/creatures/model/catalog/usecase/SearchCreatureCatalogUseCase.java:29-67`, `src/domain/creatures/CreaturesPublishedStateServiceAssembly.java:89-97`, `src/domain/creatures/CreaturesPublishedModelChannelServiceAssembly.java:23-34`, `src/view/leftbartabs/catalog/CatalogBinder.java:57-58` |
| Filter option refresh | `CatalogIntentHandler.refreshCatalogSources` -> `CreaturesApplicationService.refreshFilterOptions` -> `LoadCreatureFilterOptionsUseCase.execute` -> `CreatureCatalogPort.loadFilterValues` -> `CreaturesPublishedStateServiceAssembly.publishFilterOptions` -> `CreaturesPublishedModelChannelServiceAssembly.replace` | 6 | `src/view/leftbartabs/catalog/CatalogIntentHandler.java:169-172`, `src/domain/creatures/CreaturesApplicationService.java:51-54`, `src/domain/creatures/model/catalog/usecase/LoadCreatureFilterOptionsUseCase.java:66-79`, `src/domain/creatures/CreaturesPublishedStateServiceAssembly.java:77-87`, `src/domain/creatures/CreaturesPublishedModelChannelServiceAssembly.java:23-34` |
| Open creature detail | `CatalogMainView.publishCreatureEvent` -> `CatalogIntentHandler.openCreatureDetail` -> `CreaturesApplicationService.selectCreatureDetail` -> `LoadCreatureDetailUseCase.execute` -> `CreatureCatalogPort.loadCreatureDetail` -> `CreaturesPublishedStateServiceAssembly.publishCreatureDetail` -> `CreaturesPublishedModelChannelServiceAssembly.replace`; the inspector render tail opens via `CatalogBinder` and `CreatureDetailsContentModel` | 7 to Creature publication; longer detail-render tail | `src/view/leftbartabs/catalog/CatalogMainView.java:92-99`, `src/view/leftbartabs/catalog/CatalogIntentHandler.java:175-178`, `src/domain/creatures/CreaturesApplicationService.java:86-88`, `src/domain/creatures/model/catalog/usecase/LoadCreatureDetailUseCase.java:22-41`, `src/domain/creatures/CreaturesPublishedStateServiceAssembly.java:99-107`, `src/domain/creatures/CreaturesPublishedModelChannelServiceAssembly.java:23-34`, `src/view/leftbartabs/catalog/CatalogBinder.java:49-54`, `src/view/slotcontent/details/creature/CreatureDetailsContentModel.java:42-52` |
| Encounter candidate request | `EncounterCreatureRequestServiceAssembly.requestCandidates` -> `CreaturesApplicationService.refreshEncounterCandidates` -> `LoadCreatureEncounterCandidatesUseCase.execute` -> `CreatureCatalogPort.loadEncounterCandidates` -> `CreaturesPublishedStateServiceAssembly.publishEncounterCandidates` -> `CreaturesPublishedModelChannelServiceAssembly.replace`; Encounter later reads via `EncounterCreatureCatalogServiceAssembly.loadCandidates` | 6 to Creature publication; 7 including foreign readback | `src/domain/encounter/EncounterCreatureRequestServiceAssembly.java:31-47`, `src/domain/creatures/CreaturesApplicationService.java:90-98`, `src/domain/creatures/model/catalog/usecase/LoadCreatureEncounterCandidatesUseCase.java:26-54`, `src/domain/creatures/CreaturesPublishedStateServiceAssembly.java:109-119`, `src/domain/creatures/CreaturesPublishedModelChannelServiceAssembly.java:23-34`, `src/domain/encounter/EncounterCreatureCatalogServiceAssembly.java:43-54` |

The dominant Creature-owned baseline is 7 meaningful hops to first publication.
There is no old-structure Creature domain write model in this area; the
observable state changes are published catalog, detail, filter option, and
encounter-candidate model replacements.

If a review counts SQLite lookup internals, successful catalog and candidate
reads add `SqliteCreatureCatalogQueryAdapter`,
`SqliteCreatureCatalogLocalGateway`, the mapping facade, and the concrete
SQLite store before publication.

## Forwarding-Only Baseline

Forwarding-only means a concrete class whose production behavior is primarily
unpacking, delegating, or proxying to another object without owning meaningful
decision logic. Interfaces are noted as seam overhead but not counted as
forwarding-only classes.

| Class | Baseline classification | Evidence |
| --- | --- | --- |
| `src/domain/creatures/CreaturesApplicationService.java` | Forwarding-only candidate with minor default and sort normalization | Public methods null-guard command records, unpack fields, normalize two sort strings, and delegate to four use cases (`src/domain/creatures/CreaturesApplicationService.java:51-109`). |
| `src/domain/creatures/CreaturesServiceContribution.java` | Register-only composition candidate | `register` creates the service assembly and registers factories that delegate to assembly methods (`src/domain/creatures/CreaturesServiceContribution.java:6-24`). |
| `src/domain/creatures/CreaturesServiceAssembly.java` | Composition/pass-through candidate | Creates the application service from four use cases and returns published models from the shared published-state assembly (`src/domain/creatures/CreaturesServiceAssembly.java:18-50`). |
| `src/domain/creatures/published/CreatureCatalogModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions, with a storage-error default (`src/domain/creatures/published/CreatureCatalogModel.java:13-37`). |
| `src/domain/creatures/published/CreatureDetailModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions, with a storage-error default (`src/domain/creatures/published/CreatureDetailModel.java:13-35`). |
| `src/domain/creatures/published/CreatureFilterOptionsModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions, with a storage-error default (`src/domain/creatures/published/CreatureFilterOptionsModel.java:13-37`). |
| `src/domain/creatures/published/CreatureEncounterCandidatesModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions, with a storage-error default (`src/domain/creatures/published/CreatureEncounterCandidatesModel.java:14-34`). |
| `src/data/creatures/CreaturesServiceContribution.java` | Data-layer forwarding candidate, counted separately | `register` only registers `SqliteCreatureCatalogQueryAdapter` as `CreatureCatalogPort` (`src/data/creatures/CreaturesServiceContribution.java:11-16`). |
| `src/data/creatures/query/SqliteCreatureCatalogQueryAdapter.java` | Data-layer adapter forwarding candidate, counted separately | Each port method delegates to the local gateway and `CreatureCatalogQueryMappingFacade` (`src/data/creatures/query/SqliteCreatureCatalogQueryAdapter.java:28-48`). |

Baseline count: 7 product/published forwarding or proxy candidates plus 2
data-layer candidates counted separately.

Seam overhead to account for in the design, but not counted as concrete
forwarding-only classes: `CreatureCatalogPort` is the four-method data lookup
seam and `CreaturesPublishedStateRepository` is the four-method internal
publication seam. The service-registry composition classes are counted in the
table because they are concrete product classes. The static data-layer
`CreatureCatalogQueryMappingFacade` owns record mapping and sort enum parsing,
so it is data mapping overhead rather than a product forwarding class.

## String Boundary Round-Trips

String round-trip means a typed, finite-domain, or selected reference value is
carried as a String across an internal Creature boundary and later parsed,
normalized, or matched back into the same finite-domain meaning. Free-form user
search text, imported monster display text, and persistence text columns do not
count.

| Family | Baseline round-trip | Evidence |
| --- | --- | --- |
| Challenge rating range | Catalog controls and the published command carry minimum and maximum CR as Strings; `SearchCreatureCatalogUseCase` trims them and maps them through the fixed CR-to-XP table before lookup; filter options publish the same finite CR list as Strings for selection. | `src/view/leftbartabs/catalog/CatalogControlsViewInputEvent.java:5-41`, `src/domain/creatures/published/RefreshCreatureCatalogCommand.java:6-31`, `src/domain/creatures/model/catalog/usecase/SearchCreatureCatalogUseCase.java:34-47`, `src/domain/creatures/model/catalog/usecase/LoadCreatureFilterOptionsUseCase.java:13-17`, `src/domain/creatures/model/catalog/usecase/LoadCreatureFilterOptionsUseCase.java:82-87` |
| Catalog sort field and direction | `CatalogMainContentModel.SortOption` holds sort field and direction names as Strings; the command and application service preserve or normalize those names; the data mapper converts the sort field with `valueOf` and the SQLite store switches on typed sort enums. | `src/view/leftbartabs/catalog/CatalogMainContentModel.java:77-99`, `src/domain/creatures/published/RefreshCreatureCatalogCommand.java:15-31`, `src/domain/creatures/CreaturesApplicationService.java:100-109`, `src/data/creatures/mapper/CreatureCatalogQueryMappingFacade.java:24-39`, `src/data/creatures/mapper/CreatureCatalogQueryMappingFacade.java:68-70`, `src/data/creatures/model/CreatureCatalogSearchCriteriaRecord.java:32-47` |
| Taxonomy filter keys | Filter options publish size, type, subtype, biome, and alignment keys as `List<String>`; selected keys return through controls and search specs, are normalized in the use case, and are inserted into typed temp-filter tables for matching. | `src/domain/creatures/published/CreatureFilterOptions.java:5-19`, `src/view/leftbartabs/catalog/CatalogControlsContentModel.java:160-215`, `src/domain/creatures/model/catalog/usecase/SearchCreatureCatalogUseCase.java:48-56`, `src/domain/creatures/model/catalog/CreatureCatalogData.java:60-80`, `src/data/creatures/gateway/local/CreatureFilterTempTableValues.java:31-80` |
| Publication status discriminators | Use cases publish finite status constants as Strings; `CreaturesPublishedStateServiceAssembly` projects those Strings back to public `CreatureReadStatus`, `CreatureQueryStatus`, and `CreatureLookupStatus` enums. | `src/domain/creatures/model/catalog/repository/CreaturesPublishedStateRepository.java:10-21`, `src/domain/creatures/model/catalog/usecase/SearchCreatureCatalogUseCase.java:39-66`, `src/domain/creatures/model/catalog/usecase/LoadCreatureDetailUseCase.java:22-41`, `src/domain/creatures/model/catalog/usecase/LoadCreatureEncounterCandidatesUseCase.java:42-54`, `src/domain/creatures/CreaturesPublicationProjectionServiceAssembly.java:15-34` |

Baseline count: 4 product String boundary families. The taxonomy-filter family
is diagnostic because these values are imported catalog vocabulary, not a
clearly owned Creature enum set. Shared view chip keys such as `size:` and
`type:` are catalog-view consumer strings and are not counted in the Creature
product subset.

Data-layer enum
serialization in `src/data/creatures/model/CreatureCatalogSearchCriteriaRecord`
and SQLite filter-value text storage is counted separately because
`src/data/**` remains outside normal per-area migration.

## Residual Notes For Design

- The M3 Creature target design must use the 35-file product subset as its
  normal structural surface and explicitly name any data-layer gateway
  signature adaptation if one is required.
- Published seams consumed by catalog view, Encounter, Worldplanner, search
  controls, and shell surfaces remain byte-compatible unless both sides are
  migrated in the same approved design.
- The product domain is a read-only imported reference catalog in this
  migration area. The M3.1 harness fixture create/edit setup is not product
  authored behavior and must not be treated as a write-model design target.
- M3.2 does not authorize a wiring port or implementation. The next step is a
  judge-approved Creature target design with target classes, representative
  call chains, deletion list, seam statement, and untouched-list.
