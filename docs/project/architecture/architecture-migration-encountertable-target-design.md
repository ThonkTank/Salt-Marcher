Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M3.3 target design for the Encounter Table architecture
migration area before any wiring-port or implementation commit.

# Encounter Table Migration Target Design

## Scope

This design covers the M3 Encounter Table product surface:

- `src/domain/encountertable`

The baseline surface is 18 product Java files and 558 physical LOC; the full
reproducible Encounter Table count is 28 Java files and 954 physical LOC when
`src/data/encountertable` is included
(`docs/project/architecture/architecture-migration-encountertable-baseline.md:68`).
Data-layer code remains outside the normal M3 migration surface unless a
gateway signature adaptation is explicitly named by this design.

This design is the step-3 artifact required by the roadmap. It does not permit
implementation or harness scenario/assertion changes. The M3.4 wiring-port
commit may only update references and construction needed to run frozen
Encounter Table harness scenarios against the old behavior.

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

Encounter Table is a read-only reference catalog. It publishes authored table
summaries and weighted creature candidates; it does not own creature truth,
loot truth, or runtime table-entry mutation
(`docs/encountertable/domain/domain-encountertable.md:14-18`,
`docs/encountertable/domain/domain-encountertable.md:47-52`).

The defect is the role stack around that lookup boundary. Catalog and Encounter
requests currently pass through forwarding application-service methods,
per-route use cases, an internal String-status repository, and a nested
published-state adapter before observable publication. The baseline measured
5 meaningful hops to first Encounter Table publication, 7 including foreign
readback, 4 product/published forwarding or proxy candidates, and 1 product
String boundary family
(`docs/project/architecture/architecture-migration-encountertable-baseline.md:77`,
`docs/project/architecture/architecture-migration-encountertable-baseline.md:108`,
`docs/project/architecture/architecture-migration-encountertable-baseline.md:143`).

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `src.domain.encountertable.EncounterTableServiceContribution` | Keep the byte-compatible domain service-registry entrypoint for `EncounterTableApplicationService`, `EncounterTableCatalogModel`, `EncounterTableCandidatesModel`, and the shared per-registry assembly resolver. |
| `src.domain.encountertable.EncounterTableServiceAssembly` | Be the single Encounter Table composition root for `EncounterTableCatalogPort`, stateful published models, and `EncounterTableApplicationService`; it no longer owns a nested published-state repository adapter. |
| `src.domain.encountertable.EncounterTableApplicationService` | Keep both public command methods while directly owning lookup calls, null-command behavior, storage-failure handling, XP-ceiling normalization, result-status selection, and publication. |
| `src.domain.encountertable.EncounterTableCatalogProjection` | New package-private mapper from `EncounterTableSummaryData` and `EncounterTableCandidateData` lookup records to byte-compatible published summary/candidate records and result payloads without internal status strings. |
| `src.domain.encountertable.model.catalog.EncounterTableCandidateData` | Stay the domain-facing candidate data carrier and preserve current null/default/weight normalization. |
| `src.domain.encountertable.model.catalog.EncounterTableSummaryData` | Stay the domain-facing table-summary data carrier with current table ID, name, and linked-loot accessors. |
| `src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort` | Stay the two-method read-only lookup seam for `src/data/encountertable.query.SqliteEncounterTableCatalogAdapter`, harness fixtures, and adjacent harnesses. |
| `src.domain.encountertable.published.EncounterTableCatalogModel` | Become a stateful published catalog model backed by `src.domain.shared.published.PublishedState` while keeping `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.encountertable.published.EncounterTableCandidatesModel` | Become a stateful published candidates model backed by `src.domain.shared.published.PublishedState` while keeping `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src/domain/encountertable/published/**` command records, result records, carrier records, and `EncounterTableReadStatus` | Stay byte-compatible public Encounter Table surfaces consumed by Catalog controls, Worldplanner, Encounter, harnesses, and future migrated areas. |

## Target Call Chains

Counting rule: count named class boundaries from the foreign caller entering the
Encounter Table API to first Encounter Table publication. Catalog JavaFX views,
Worldplanner validation, and Encounter generation remain foreign consumers and
are recorded as seam consumers, not as hidden Encounter Table target work.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Catalog table-source refresh | `CatalogIntentHandler.refreshCatalogSources` -> `EncounterTableApplicationService.refreshCatalog` -> `EncounterTableCatalogPort.loadSummaries` -> `EncounterTableCatalogModel.publish` | 3 Encounter Table-owned hops after the existing catalog-view caller. |
| Worldplanner encounter-table validation | `WorldPlannerServiceContribution.PublishedReferenceValidator.encounterTableExists` -> `EncounterTableApplicationService.refreshCatalog` -> `EncounterTableCatalogPort.loadSummaries` -> `EncounterTableCatalogModel.publish`; the existing validator then reads `EncounterTableCatalogModel.current()` and matches the typed table ID. | 3 Encounter Table-owned hops to publication; 5 including the foreign validation readback. |
| Encounter generation candidate request | `EncounterTableCandidateRequestServiceAssembly.requestCandidates` -> `EncounterTableApplicationService.refreshCandidates` -> `EncounterTableCatalogPort.loadGenerationCandidates` -> `EncounterTableCandidatesModel.publish`; Encounter later reads `EncounterTableCandidatesModel.current()` through `EncounterTableCandidateServiceAssembly.loadCandidates`. | 3 Encounter Table-owned hops to publication; 5 including the foreign Encounter readback. |

`EncounterTableCatalogProjection` is a same-package mapping helper called inside
`EncounterTableApplicationService` before the model `publish(...)` call. Like
the migrated Creature reference, it is not a behavior-forwarding hop.

## Frozen Parity Inventory

The selected M3 Encounter Table parity task is:

- `./gradlew encounterTableReadbackHarness --console=plain`

The frozen scenario and assertion inventory is the union below. M3.4 and M3.5
may port wiring references, but MUST NOT add, remove, rename, split, merge,
weaken, or reinterpret these scenarios or their pass/fail oracles.

| Harness evidence | Frozen scenario/assertion families |
| --- | --- |
| `test/src/domain/encountertable/EncounterTableReadbackHarness.java:34-61` | Production-route setup with isolated SQLite `XDG_DATA_HOME`, real data and domain `EncounterTableServiceContribution`, `EncounterTableApplicationService`, `EncounterTableCatalogModel`, and `EncounterTableCandidatesModel`; proof output remains `Encounter table readback harness passed: 5 proof item(s).` |
| `test/src/domain/encountertable/EncounterTableReadbackHarness.java:225-234` | `ENCOUNTER-TABLE-001`: catalog status `SUCCESS`, two summaries, authored table IDs/names, first linked loot table `901`, second null linked loot table. |
| `test/src/domain/encountertable/EncounterTableReadbackHarness.java:237-267` and `test/src/domain/encountertable/EncounterTableReadbackHarness.java:292-310` | `ENCOUNTER-TABLE-002`: weighted candidate lookup status/count/order, candidate IDs, names, types, CR, XP, HP, weights, and source label `Encounter table`. |
| `test/src/domain/encountertable/EncounterTableReadbackHarness.java:269-289` | `ENCOUNTER-TABLE-003` empty selection, `ENCOUNTER-TABLE-004` XP ceiling and `maximumXp <= 0` unbounded normalization, and `ENCOUNTER-TABLE-005` storage-error publication. |
| `tools/quality/config/harness-map.json:67-68`; `build.gradle.kts:664-676` | `src/data/encountertable/**` and `src/domain/encountertable/**` map to `encounterTableReadbackHarness`, whose main class is `src.domain.encountertable.EncounterTableReadbackHarness`. |
| `docs/project/architecture/migration-ledger.md:125` | M3.1 recorded the green old-structure proof: `encounterTableReadbackHarness` plus harness map/topology passed, focused handoff passed, documentation gate passed, and Phase 1/Phase 2 approved. |

## Deletion List

The implementation step is incomplete until these classes no longer exist:

- `src/domain/encountertable/model/catalog/repository/EncounterTablePublishedStateRepository.java`
- `src/domain/encountertable/model/catalog/usecase/LoadEncounterTableCandidatesUseCase.java`
- `src/domain/encountertable/model/catalog/usecase/LoadEncounterTableSummariesUseCase.java`

`src/domain/encountertable/model/catalog/repository/` and
`src/domain/encountertable/model/catalog/usecase/` must be empty or gone after
implementation. Deleting comments, compressing code, or moving the String
status protocol into differently named classes without executing this list is
not migration.

## Seam Statement

These surfaces stay byte-compatible in M3 until their consumer sides migrate:

- `src.domain.encountertable.EncounterTableApplicationService`: class name,
  package, public method names, and published command parameter types.
- `src.domain.encountertable.EncounterTableServiceContribution`:
  service-registry registration of `EncounterTableApplicationService`,
  `EncounterTableCatalogModel`, and `EncounterTableCandidatesModel`.
- `src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort`:
  method names, parameter types, return types, empty-selection behavior, XP
  ceiling meaning, and read-only lookup semantics for data adapters and
  harness fixtures.
- `src.domain.encountertable.model.catalog.EncounterTableCandidateData` and
  `EncounterTableSummaryData`: constructors, accessors, and current
  null/default/weight normalization used by data adapters and harness fixtures.
- Every record and enum in `src/domain/encountertable/published/**`: record
  component order, component types, accessor names, enum constants, current
  null/default handling, and candidate `sourceLabel` value.
- `src/data/encountertable/**`, `src/view/leftbartabs/catalog/**`,
  `src/domain/worldplanner/**`, `src/view/leftbartabs/worldplanner/**`,
  `src/domain/encounter/**`, shared catalog/search controls, shell APIs, and
  SQLite schema/persistence semantics.

The target must preserve these current behavior points exactly:

- `refreshCatalog(null)` still throws through the current `Objects.requireNonNull`
  command guard.
- `refreshCandidates(null)` still publishes `STORAGE_ERROR` with an empty
  candidate list.
- An empty selected table list still publishes `SUCCESS` with an empty
  candidate list.
- `maximumXp <= 0` still normalizes to an unbounded lookup.
- Storage failures still publish `STORAGE_ERROR` and empty result lists instead
  of leaking adapter exceptions.
- Candidate ordering, weights, IDs, creature snapshot fields, linked-loot IDs,
  and source label stay as proven by `encounterTableReadbackHarness`.

## Wiring-Port Boundary

No production or harness code change is expected in M3.4. The frozen
`encounterTableReadbackHarness` already routes through `EncounterTableServiceContribution`,
`EncounterTableApplicationService`, `EncounterTableCatalogModel`, and
`EncounterTableCandidatesModel`; it does not import the deletion-list
usecase/repository classes. Catalog, Worldplanner, Encounter, data adapters,
and adjacent harness fixtures already consume the service, model, and port
seams that remain byte-compatible.

M3.4 is therefore a no-code verification commit unless implementation
preparation finds a stale deletion-list import. If a stale import appears,
M3.4 may only mechanically port construction or imports to the retained seams
above. It must not change a harness scenario, assertion label, fixture value,
visible text, candidate ordering, storage-error oracle, or pass/fail condition.

## Metric Targets And Exceptions

| Metric | Target for implementation | Design exception |
| --- | --- | --- |
| LOC | Product subset should attempt the roadmap target: 558 physical LOC to 335 or less. If byte-compatible published records, data carrier seams, service-registry seams, and stateful-model compatibility constructors make that impossible, M3.6 may request a reviewed exception capped at 460 physical LOC with a class-by-class LOC breakdown. | Full 28-file measured LOC reduction is a data-layer exception unless a gateway signature adaptation becomes necessary. The 460 cap is not pre-approval; it is the maximum design-bounded exception candidate. |
| File count | Product subset should fall from 18 Java files to 16 by deleting 3 files and adding only `EncounterTableCatalogProjection`. | More files require a design amendment before implementation. |
| Forwarding-only classes | Zero product behavior-forwarding classes: application service owns route logic, published models own state/listeners, and the usecase/repository stack is deleted. | `EncounterTableServiceContribution` and `EncounterTableServiceAssembly` remain service-registry composition seams like the pilot reference, but must not add a behavior-forwarding hop between caller and `EncounterTableApplicationService`. Data-layer contribution and query adapter remain outside the product migration surface. |
| Intent-to-publication chain | Encounter Table-owned chains from current foreign callers to first publication use at most 3 meaningful class-boundary hops. | Full user-to-publication catalog/worldplanner/encounter chains remain longer because those foreign consumers are out of scope for this M3 area. |
| String round-trips | Internal publication status strings are eliminated; statuses are carried as `EncounterTableReadStatus` inside product code and published directly. | Imported creature snapshot text, table names, source labels, shared UI chip keys, and data persistence/schema text stay String seams because they are display, adjacent UI, or data-layer concerns outside this M3 product area. |

The exceptions are individually justified by existing consumer seams, not by
preference. The conformance review must reject any additional unexplained
metric miss.

## Untouched Surfaces

- `src/data/encountertable/**` persistence, schema, mapper, gateway, and query
  stores stay unchanged; this design names no data-layer gateway signature
  adaptation.
- `src/view/leftbartabs/catalog/**` and shared catalog/search controls stay
  unchanged; shared catalog view migration belongs to M5.
- `src/domain/worldplanner/**` and `src/view/leftbartabs/worldplanner/**` stay
  unchanged and continue using `EncounterTableApplicationService` plus
  `EncounterTableCatalogModel`.
- `src/domain/encounter/**` stays unchanged and continues using
  `EncounterTableApplicationService` plus `EncounterTableCandidatesModel`.
- `src/domain/encountertable/published/**` record and enum semantics stay
  byte-compatible; model classes may gain stateful publication methods but must
  preserve `current()`, `subscribe(...)`, and compatibility constructors.
- Harness scenarios and assertions stay frozen. Any behavior anomaly found
  during implementation is an R2 issue or area revert, not an in-pass fix.

## Required Reviews

Phase 1 and Phase 2 must approve this artifact before M3.4 starts. Reviewers
must check that the design names target classes, representative call chains,
the full deletion list, seam compatibility, untouched surfaces, frozen parity
inventory, wiring-port boundary, and each metric exception above. A vague
implementation-only answer is rework.
