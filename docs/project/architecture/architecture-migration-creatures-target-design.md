Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-09
Source of Truth: M3.3 target design for the Creature architecture migration
area before any wiring-port or implementation commit.

# Creature Migration Target Design

## Scope

This design covers the M3 Creature product surface:

- `src/domain/creatures`

The baseline surface is 35 product Java files and 2,060 physical LOC; the full
reproducible Creature count is 90 Java files and 4,587 LOC when
`src/data/creatures` is included
(`docs/project/architecture/architecture-migration-creatures-baseline.md:55`).
Data-layer code remains outside the normal M3 migration surface unless a
gateway signature adaptation is explicitly named by this design.

This design is the step-3 artifact required by the roadmap. It does not permit
implementation or harness scenario/assertion changes. The M3.4 wiring-port
commit may only update references and construction needed to run frozen
Creature-adjacent harness scenarios against the old behavior.

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

The Creature catalog is not an authored write model. The feature is a read-only
reference catalog over imported creature truth and exposes search, filtering,
detail lookup, and encounter-candidate lookup without owning lifecycle or
encounter policy (`docs/creatures/domain/domain-creatures.md:8`,
`docs/creatures/domain/domain-creatures.md:42`).

The defect is the role stack around that lookup boundary. Catalog and Encounter
requests currently pass through forwarding application-service methods,
per-route use cases, an internal string-status repository, projection
assemblies, and proxy published models before observable publication. The
baseline measured up to 7 meaningful hops to first Creature publication and
found 7 product/published forwarding or proxy candidates plus 4 String boundary
families
(`docs/project/architecture/architecture-migration-creatures-baseline.md:82`,
`docs/project/architecture/architecture-migration-creatures-baseline.md:105`).

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `src.domain.creatures.CreaturesServiceContribution` | Keep the byte-compatible domain service-registry entrypoint for `CreaturesApplicationService`, the four published Creature models, and the shared per-registry assembly resolver. |
| `src.domain.creatures.CreaturesServiceAssembly` | Be the single Creature composition root for `CreatureCatalogPort`, stateful published models, and `CreaturesApplicationService`. |
| `src.domain.creatures.CreaturesApplicationService` | Keep all current public command methods while directly owning query normalization, CR-to-XP validation, lookup calls, storage-failure handling, result-status selection, and publication. |
| `src.domain.creatures.CreatureCatalogProjection` | New package-private mapper from `CreatureCatalogData` lookup records to byte-compatible published catalog, detail, filter, and encounter-candidate records without internal status strings. |
| `src.domain.creatures.model.catalog.CreatureCatalogData` | Stay the domain-facing lookup data carrier and add typed catalog sort-field meaning while retaining compatibility accessors needed by harness/data consumers. |
| `src.domain.creatures.model.catalog.port.CreatureCatalogPort` | Stay the four-method read-only lookup seam for `src/data/creatures.query.SqliteCreatureCatalogQueryAdapter`. |
| `src.domain.creatures.published.CreatureCatalogModel` | Become a stateful published catalog model that owns current page/listeners while keeping `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.creatures.published.CreatureDetailModel` | Become a stateful published detail model that owns current detail/listeners while keeping `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.creatures.published.CreatureFilterOptionsModel` | Become a stateful published filter model that owns current options/listeners while keeping `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src.domain.creatures.published.CreatureEncounterCandidatesModel` | Become a stateful published encounter-candidates model that owns current candidates/listeners while keeping `current()`, `subscribe(...)`, and the existing compatibility constructor. |
| `src/domain/creatures/published/**` command records, result records, carrier records, and status enums | Stay byte-compatible public Creature surfaces consumed by catalog view, Encounter, Worldplanner, harnesses, and future migrated areas. |

## Target Call Chains

Counting rule: count named class boundaries from the foreign caller entering the
Creature API to first Creature publication. Catalog JavaFX views and
`CatalogIntentHandler` remain outside the M3 Creature denominator and are
recorded as M5 shared-view debt, not as hidden Creature target work.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Catalog search or page refresh | `CatalogIntentHandler.refreshCatalog` -> `CreaturesApplicationService.refreshCatalog` -> `CreatureCatalogPort.searchCatalog` -> `CreatureCatalogModel.publish` | 3 Creature-owned hops after the existing catalog-view caller. |
| Open creature detail | `CatalogIntentHandler.openCreatureDetail`, `WorldPlannerServiceContribution`, or `EncounterStateIntentHandler` -> `CreaturesApplicationService.selectCreatureDetail` -> `CreatureCatalogPort.loadCreatureDetail` -> `CreatureDetailModel.publish` | 3 Creature-owned hops after the foreign caller. |
| Encounter candidate request | `EncounterCreatureRequestServiceAssembly.requestCandidates` -> `CreaturesApplicationService.refreshEncounterCandidates` -> `CreatureCatalogPort.loadEncounterCandidates` -> `CreatureEncounterCandidatesModel.publish` | 3 Creature-owned hops; Encounter's later `CreatureEncounterCandidatesModel.current()` read remains a foreign consumer seam. |

Filter option refresh follows the same shape:
`CatalogIntentHandler.refreshCatalogSources` ->
`CreaturesApplicationService.refreshFilterOptions` ->
`CreatureCatalogPort.loadFilterValues` -> `CreatureFilterOptionsModel.publish`.

## Frozen Parity Inventory

The selected M3 Creature parity task and adjacent harness touched by the M3.4
wiring port are:

- `./gradlew creatureCatalogHarness --console=plain`
- `./gradlew encounterStateTabHarness --console=plain` for the harness setup
  port only; this does not close the existing Encounter production-route gap.

The frozen scenario and assertion inventory is the union below. M3.4 and M3.5
may port wiring references, but MUST NOT add, remove, rename, split, merge,
weaken, or reinterpret these scenarios or their pass/fail oracles.

| Harness evidence | Frozen scenario/assertion families |
| --- | --- |
| `test/src/domain/creatures/CreatureCatalogHarness.java:50-79` | Fixture create/edit setup, filter-option publication, normalized catalog query/readback, detail readback, edited fixture readback, invalid catalog query, missing/null/storage detail statuses, encounter-candidate readback, invalid candidate query, and catalog storage-error publication. |
| `test/src/domain/creatures/CreatureCatalogHarness.java:130-270` | Assertion labels `CREATURE-CATALOG-001` through `CREATURE-CATALOG-009`: filter values and CR options, catalog rows/page/defaults/normalized lookup spec, detail facts/action facts, edited readback, invalid query bypasses lookup, lookup statuses, encounter-candidate defaults, invalid candidate bypasses lookup, and storage-error empty page. |
| `tools/quality/config/harness-map.json:66`; `build.gradle.kts:662` | `src/domain/creatures/**` is mapped to `creatureCatalogHarness`, whose main class is `src.domain.creatures.CreatureCatalogHarness`. |
| `docs/project/architecture/migration-ledger.md:89` | M3.1 recorded the green old-structure proof: `creatureCatalogHarness` passed with 9 proof items, harness map/topology passed, focused handoff passed, documentation gate passed, and Phase 1 approved. |
| `test/src/view/statetabs/encounter/EncounterStateTabHarness.java:60-86` | Adjacent wiring-port inventory only: proof IDs `ENCOUNTER-STATE-TAB-001` and `ENCOUNTER-STATE-TAB-002`, shell-bound state tab title `Encounter`, empty roster text `Monster per +Add hinzufuegen...`, saved plan title `Gate Ambush`, adjusted XP `Adj. XP: 100`, creature name `Goblin Ambusher`, creature facts `CR 1/4  |  50 XP  |  humanoid`, and creature count `2`. |
| `tools/quality/config/harness-map.json:56`; `build.gradle.kts:649`; `docs/project/verification/harness-gaps.md:24` | `src/view/statetabs/encounter/**` maps to `encounterStateTabHarness`; the existing P1 Encounter state-tab production-route gap remains open and is not closed by this Creature wiring port. |

## Deletion List

The implementation step is incomplete until these classes no longer exist:

- `src/domain/creatures/CreaturesPublicationProjectionServiceAssembly.java`
- `src/domain/creatures/CreaturesPublishedModelChannelServiceAssembly.java`
- `src/domain/creatures/CreaturesPublishedStateServiceAssembly.java`
- `src/domain/creatures/model/catalog/helper/CreatureCatalogTextHelper.java`
- `src/domain/creatures/model/catalog/repository/CreaturesPublishedStateRepository.java`
- `src/domain/creatures/model/catalog/usecase/LoadCreatureDetailUseCase.java`
- `src/domain/creatures/model/catalog/usecase/LoadCreatureEncounterCandidatesUseCase.java`
- `src/domain/creatures/model/catalog/usecase/LoadCreatureFilterOptionsUseCase.java`
- `src/domain/creatures/model/catalog/usecase/SearchCreatureCatalogUseCase.java`

`src/domain/creatures/model/catalog/usecase/`,
`src/domain/creatures/model/catalog/repository/`, and
`src/domain/creatures/model/catalog/helper/` must be empty or gone after
implementation. Deleting comments or compressing code without executing this
list is not migration.

## Seam Statement

These surfaces stay byte-compatible in M3 until their consumer sides migrate:

- `src.domain.creatures.CreaturesApplicationService`: class name, package,
  public method names, and published command parameter types.
- `src.domain.creatures.CreaturesServiceContribution`: service-registry
  registration of `CreaturesApplicationService`, `CreatureFilterOptionsModel`,
  `CreatureCatalogModel`, `CreatureDetailModel`, and
  `CreatureEncounterCandidatesModel`. It may delegate runtime construction to
  `CreaturesServiceAssembly` like the pilot reference, but it must not
  introduce a behavior-forwarding hop.
- `src.domain.creatures.model.catalog.port.CreatureCatalogPort`: method names
  and read-only lookup semantics for data adapters and harness fixtures.
- `src.domain.creatures.model.catalog.CreatureCatalogData`: lookup profile,
  page, row, filter, and candidate carrier accessors used by data adapters and
  harness fixtures. Typed sort-field additions must keep the existing
  `CatalogSearchSpec.sortField()` string accessor until consumers migrate.
- Every record and enum in `src/domain/creatures/published/**`: record
  component order, component types, accessor names, enum constants, and null/
  default handling.
- `src/view/leftbartabs/catalog/**`, `src/view/slotcontent/details/creature/**`,
  `src/domain/encounter/**`, `src/view/statetabs/encounter/**`,
  `src/domain/worldplanner/**`, shared search/catalog controls, shell APIs, and
  SQLite schema/persistence semantics.

M3.4 may port harness construction away from deleted usecase/repository classes
and may update type references required by typed internal sort fields. It must
not change a harness scenario, assertion label, fixture value, visible text,
or pass/fail oracle.

## Wiring-Port Boundary

`CreatureCatalogHarness` is already routed through `CreaturesServiceContribution`
and published models, so it should not require scenario or assertion changes.
If `CatalogSearchSpec` gains typed sort-field state, M3.4 may keep the current
`sortField()` string accessor for harness compatibility or mechanically port
only references while preserving the `CREATURE-CATALOG-002 XP sort field`
oracle.

`EncounterStateTabHarness` currently constructs `CreaturesApplicationService`
from the four Creature use cases and a no-op `CreaturesPublishedStateRepository`
(`test/src/view/statetabs/encounter/EncounterStateTabHarness.java:149`).
Because this design deletes those classes, M3.4 MUST port that harness setup to
the service-registry plus `CreatureCatalogPort` seam before M3.5 deletes the old
usecase/repository files. The harness must keep its existing Encounter state-tab
scenarios and visible assertions.

No production wiring change is expected in M3.4. Catalog view, Encounter,
Worldplanner, and data adapters already consume the published application,
model, and port seams that remain byte-compatible.

## Metric Targets And Exceptions

| Metric | Target for implementation | Design exception |
| --- | --- | --- |
| LOC | Product subset should attempt the roadmap target: 2,060 physical LOC to 1,236 or less. If byte-compatible published records plus `CreatureCatalogData` make that impossible, M3.6 may request a reviewed exception capped at 1,750 physical LOC with a class-by-class LOC breakdown. | Full 90-file LOC reduction is a data-layer exception unless a gateway signature adaptation becomes necessary. The 1,750 cap is not pre-approval; it is the maximum design-bounded exception candidate. |
| File count | Product subset should fall from 35 Java files to about 27 by deleting 9 files and adding only `CreatureCatalogProjection`. | More files require a design amendment before implementation. |
| Forwarding-only classes | Zero product behavior-forwarding classes: application service owns route logic, published models own state/listeners, and the usecase/repository/publication stack is deleted. | `CreaturesServiceContribution` and `CreaturesServiceAssembly` remain service-registry composition seams like the pilot reference, but must not add a behavior-forwarding hop between caller and `CreaturesApplicationService`. Data-layer contribution and query adapter remain outside the product migration surface. |
| Intent-to-publication chain | Creature-owned chains from current foreign callers to first publication use at most 3 meaningful class-boundary hops. | Full user-to-publication catalog view chains remain longer until the shared catalog view is migrated in M5; this is an out-of-scope shared-view exception, not a Creature-domain allowance. |
| String round-trips | Internal publication status strings are eliminated; sort-field meaning is typed inside Creature lookup specs while keeping compatibility accessors where required. | Published command sort strings, CR display values, taxonomy filters, and imported catalog text stay String seams because shared catalog view, data vocabulary, and published API consumers are outside this M3 area. Data persistence/filter text remains a data-layer serialization concern. |

The exceptions are individually justified by existing consumer seams, not by
preference. The conformance review must reject any additional unexplained
metric miss.

## Untouched Surfaces

- `src/data/creatures/**` persistence, schema, mapper, gateway, and query
  stores stay unchanged except for the named sort-field gateway-signature
  adaptation if implementation needs it.
- `src/view/leftbartabs/catalog/**` and
  `src/view/slotcontent/details/creature/**` stay unchanged; shared catalog
  view migration belongs to M5.
- `src/domain/encounter/**` and `src/view/statetabs/encounter/**` stay
  unchanged except for the M3.4 harness-only setup port.
- `src/domain/worldplanner/**` stays unchanged and continues using
  `CreaturesApplicationService` plus `CreatureDetailModel`.
- `src/domain/creatures/published/**` record and enum semantics stay
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
