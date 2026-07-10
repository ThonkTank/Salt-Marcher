Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M3.2 diagnostic baseline metrics for the Encounter Table
architecture migration area before target design.

# Encounter Table Migration Baseline

## Purpose

This document records the M3.2 baseline metrics for the Encounter Table area
before any target design, wiring port, or implementation. The numbers are
diagnostic: they define the baseline for the later M3 conformance review, but
they do not approve a design or prescribe implementation.

## Scope

The roadmap lists `encountertable` without an explicit file count. The current
reproducible area roots are:

- `src/domain/encountertable`
- `src/data/encountertable`

The migration-owned product subset is `src/domain/encountertable` with 18 Java
files. The 10 `src/data/encountertable` files are counted because they make the
current area measurement reproducible, but the ledger's data-layer exclusion
still applies: data code is not a normal per-area migration target unless the
approved Encounter Table design requires a gateway signature adaptation.

The Encounter Table domain document classifies this area as a read-only
reference catalog for generator candidate pools. It publishes authored
encounter-table membership, does not own creature or loot truth, and has no
runtime mutation flow for table rows
(`docs/encountertable/domain/domain-encountertable.md:14-18`,
`docs/encountertable/domain/domain-encountertable.md:47-52`). The requirements
likewise name editing entries, creating entries, assigning loot, and rolling
loot as non-goals (`docs/encountertable/requirements/requirements-encountertable.md:14-19`).
For M3.2, the relevant chain target is therefore Encounter Table publication
and readback, not Encounter Table mutation.

Adjacent Catalog controls, Worldplanner reference validation, and Encounter
generation files are consumers of Encounter Table published seams and remain
outside the Encounter Table baseline denominator. The M3.1
`encounterTableReadbackHarness` under `test/src/domain/encountertable` is
proof-only and is excluded from production file and LOC counts.

## Reproduction

File count:

```bash
find src/domain/encountertable src/data/encountertable \
  -type f -name '*.java' | wc -l
# 28
```

Line count:

```bash
find src/domain/encountertable src/data/encountertable \
  -type f -name '*.java' -print0 | sort -z | xargs -0 wc -l
# 954 total
```

LOC means physical Java file lines from `wc -l`, including blank lines and
comments. Secondary nonblank count from the same file set is 800 lines.

## File And LOC Baseline

| Root | Files | Physical LOC | Nonblank LOC | Migration ownership |
| --- | ---: | ---: | ---: | --- |
| `src/domain/encountertable` | 18 | 558 | 462 | Product structure |
| `src/data/encountertable` | 10 | 396 | 338 | Counted separately; not a normal migration target |
| Product subset | 18 | 558 | 462 | Main M3 design surface |
| Full measured set | 28 | 954 | 800 | Reproducible M3.2 measurement denominator |

## Intent-To-Publication Chains

Counting rule: count meaningful class-boundary hops from user or foreign-area
intent source to first Encounter Table-owned published-state replacement.
Command and value-record construction, same-class private helpers, and view-only
selection state are not counted. Data lookup internals are recorded separately
when they materially lengthen the path.

| Interaction | Baseline chain | Hop count | Evidence |
| --- | --- | ---: | --- |
| Catalog table-source refresh | `CatalogIntentHandler.refreshCatalogSources` -> `EncounterTableApplicationService.refreshCatalog` -> `LoadEncounterTableSummariesUseCase.execute` -> `EncounterTableCatalogPort.loadSummaries` -> `EncounterTablePublishedStateRepositoryAdapter.publishCatalog`; `CatalogBinder` then reads/subscribes through `EncounterTableCatalogModel` and `CatalogControlsContentModel.applyEncounterTables` | 5 to Encounter Table publication; 7 including Catalog readback | `src/view/leftbartabs/catalog/CatalogIntentHandler.java:169-172`, `src/domain/encountertable/EncounterTableApplicationService.java:23-26`, `src/domain/encountertable/model/catalog/usecase/LoadEncounterTableSummariesUseCase.java:21-30`, `src/domain/encountertable/EncounterTableServiceAssembly.java:71-87`, `src/view/leftbartabs/catalog/CatalogBinder.java:57-70`, `src/view/leftbartabs/catalog/CatalogControlsContentModel.java:786-865` |
| Worldplanner encounter-table reference validation | `WorldPlannerServiceContribution.PublishedReferenceValidator.encounterTableExists` -> `EncounterTableApplicationService.refreshCatalog` -> `LoadEncounterTableSummariesUseCase.execute` -> `EncounterTableCatalogPort.loadSummaries` -> `EncounterTablePublishedStateRepositoryAdapter.publishCatalog` -> `EncounterTableCatalogModel.current` -> table-ID match | 5 to Encounter Table publication; 7 including foreign validation readback | `src/domain/worldplanner/WorldPlannerServiceContribution.java:88-101`, `src/domain/encountertable/EncounterTableApplicationService.java:23-26`, `src/domain/encountertable/model/catalog/usecase/LoadEncounterTableSummariesUseCase.java:21-30`, `src/domain/encountertable/EncounterTableServiceAssembly.java:71-87`, `src/domain/encountertable/published/EncounterTableCatalogModel.java:26-31` |
| Encounter generation candidate request | `EncounterTableCandidateRequestServiceAssembly.requestCandidates` -> `EncounterTableApplicationService.refreshCandidates` -> `LoadEncounterTableCandidatesUseCase.execute` -> `EncounterTableCatalogPort.loadGenerationCandidates` -> `EncounterTablePublishedStateRepositoryAdapter.publishCandidates`; Encounter later reads through `EncounterTableCandidatesModel.current` and `EncounterTableCandidateServiceAssembly.loadCandidates` | 5 to Encounter Table publication; 7 including Encounter readback | `src/domain/encounter/EncounterTableCandidateRequestServiceAssembly.java:19-35`, `src/domain/encountertable/EncounterTableApplicationService.java:28-33`, `src/domain/encountertable/model/catalog/usecase/LoadEncounterTableCandidatesUseCase.java:21-43`, `src/domain/encountertable/EncounterTableServiceAssembly.java:89-102`, `src/domain/encountertable/published/EncounterTableCandidatesModel.java:24-29`, `src/domain/encounter/EncounterTableCandidateServiceAssembly.java:22-60` |

The dominant Encounter Table product baseline is 5 meaningful hops to first
published-state replacement and 7 hops when the consuming Catalog, Worldplanner,
or Encounter readback step is included. There is no old-structure Encounter
Table product write model in this area; the observable state changes are
published catalog and candidate model replacements.

If a review counts SQLite lookup internals, successful summary and candidate
reads add `SqliteEncounterTableCatalogAdapter`,
`SqliteEncounterTableLocalGateway`, `EncounterTableSqliteStore`, and
`EncounterTableMapper` before publication. Candidate reads also use a temporary
selected-table table and join the `creatures` table for read-only creature
snapshots
(`src/data/encountertable/query/SqliteEncounterTableCatalogAdapter.java:24-37`,
`src/data/encountertable/gateway/local/SqliteEncounterTableLocalGateway.java:28-53`,
`src/data/encountertable/gateway/local/EncounterTableSqliteStore.java:44-68`,
`src/data/encountertable/mapper/EncounterTableMapper.java:14-37`).

## Forwarding-Only Baseline

Forwarding-only means a concrete class whose production behavior is primarily
unpacking, delegating, or proxying to another object without owning meaningful
decision logic. Interfaces are noted as seam overhead but not counted as
forwarding-only classes.

| Class | Baseline classification | Evidence |
| --- | --- | --- |
| `src/domain/encountertable/EncounterTableApplicationService.java` | Forwarding-only candidate with minor null-command normalization | `refreshCatalog` null-checks then delegates, while `refreshCandidates` turns a null command into flag/list/XP defaults before delegating (`src/domain/encountertable/EncounterTableApplicationService.java:23-33`). |
| `src/domain/encountertable/EncounterTableServiceContribution.java` | Register-only composition candidate | `register` creates one assembly and registers factories for the application service and two published models (`src/domain/encountertable/EncounterTableServiceContribution.java:10-16`). |
| `src/domain/encountertable/published/EncounterTableCatalogModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a storage-error default (`src/domain/encountertable/published/EncounterTableCatalogModel.java:14-36`). |
| `src/domain/encountertable/published/EncounterTableCandidatesModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a storage-error default (`src/domain/encountertable/published/EncounterTableCandidatesModel.java:14-34`). |
| `src/data/encountertable/EncounterTableServiceContribution.java` | Data-layer forwarding candidate, counted separately | `register` only registers `SqliteEncounterTableCatalogAdapter` as `EncounterTableCatalogPort` (`src/data/encountertable/EncounterTableServiceContribution.java:10-13`). |
| `src/data/encountertable/query/SqliteEncounterTableCatalogAdapter.java` | Data-layer adapter forwarding candidate, counted separately | Each port method delegates to the local gateway and maps records through `EncounterTableMapper` (`src/data/encountertable/query/SqliteEncounterTableCatalogAdapter.java:24-37`). |

Baseline count: 4 product/published forwarding or proxy candidates plus 2
data-layer candidates counted separately.

Seam overhead to account for in the design, but not counted as concrete
forwarding-only classes: `EncounterTableCatalogPort` is the two-method data
lookup seam, and `EncounterTablePublishedStateRepository` is the two-method
internal publication seam. `EncounterTableServiceAssembly` has pass-through
service/model factory methods, but its nested adapter owns current state,
listener fanout, status projection, and candidate mapping, so it is not counted
as a pure forwarding-only class
(`src/domain/encountertable/EncounterTableServiceAssembly.java:26-49`,
`src/domain/encountertable/EncounterTableServiceAssembly.java:52-140`).
`LoadEncounterTableSummariesUseCase` and
`LoadEncounterTableCandidatesUseCase` are not counted as pure forwarding-only
classes because they own storage-error publication, missing-command behavior,
and XP-ceiling normalization
(`src/domain/encountertable/model/catalog/usecase/LoadEncounterTableSummariesUseCase.java:21-30`,
`src/domain/encountertable/model/catalog/usecase/LoadEncounterTableCandidatesUseCase.java:21-43`).

## String Boundary Round-Trips

String round-trip means a typed, finite-domain, or selected reference value is
carried as a String across an internal Encounter Table boundary and later
parsed, normalized, or matched back into the same finite-domain meaning.
Free-form table names, imported creature display fields, UI chip keys, and
persistence text columns do not count.

| Family | Baseline round-trip | Evidence |
| --- | --- | --- |
| Publication status discriminators | Use cases publish finite status constants as Strings through `EncounterTablePublishedStateRepository`; `EncounterTableServiceAssembly` projects those Strings back to public `EncounterTableReadStatus` enums for catalog and candidate models. | `src/domain/encountertable/model/catalog/repository/EncounterTablePublishedStateRepository.java:8-20`, `src/domain/encountertable/model/catalog/repository/EncounterTablePublishedStateRepository.java:33-46`, `src/domain/encountertable/model/catalog/usecase/LoadEncounterTableSummariesUseCase.java:21-30`, `src/domain/encountertable/model/catalog/usecase/LoadEncounterTableCandidatesUseCase.java:27-38`, `src/domain/encountertable/EncounterTableServiceAssembly.java:71-98` |

Baseline count: 1 product String boundary family.

Diagnostic non-counts: encounter table IDs are carried as `long`/`Long` from
the published summary through Catalog controls, `EncounterBuilderInputs`, and
the Encounter candidate command path
(`src/view/leftbartabs/catalog/CatalogControlsContentModel.java:858-865`,
`src/view/leftbartabs/catalog/CatalogControlsView.java:329-335`,
`src/view/leftbartabs/catalog/CatalogControlsViewInputEvent.java:33-54`,
`src/domain/encounter/model/reference/EncounterTableCandidateCriteria.java:5-12`,
`src/domain/encountertable/published/RefreshEncounterTableCandidatesCommand.java:5-12`).
The Catalog view's filter-chip clear key converts table IDs to text only for a
shared UI chip route, not an Encounter Table product boundary
(`src/view/leftbartabs/catalog/CatalogControlsView.java:958-965`). Candidate
`challengeRating`, `creatureType`, and name fields are imported creature
snapshot/display values and are not parsed back into Encounter Table-owned
finite-domain types. Data-layer SQL names and text columns remain outside the
normal migration surface because `src/data/**` is counted separately.

## Residual Notes For Design

- The M3 Encounter Table target design must use the 18-file product subset as
  its normal structural surface and explicitly name any data-layer gateway
  signature adaptation if one is required.
- Published seams consumed by Catalog controls, Worldplanner reference
  validation, Encounter generation, and the M3.1 harness remain byte-compatible
  unless both sides are migrated in the same approved design.
- The product domain is a read-only imported reference catalog. External
  authored SQLite rows are not a product write-model target, and the target
  design must not add table-entry mutation behavior.
- The M3.1 harness closure freezes `encounterTableReadbackHarness` before any
  wiring or implementation work. The frozen production route covers authored
  summary lookup, weighted candidate lookup, empty selection, XP ceiling
  including `maximumXp <= 0` normalization, and storage-error publication.
- M3.2 does not authorize a wiring port or implementation. The next step is a
  judge-approved Encounter Table target design with target classes,
  representative call chains, deletion list, seam statement, and untouched-list.
