Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M3.3 target design for the Encounter architecture migration
area before any wiring-port or implementation commit.

# Encounter Migration Target Design

## Scope

This design covers the M3 Encounter product surface:

- `src/domain/encounter`
- `src/view/statetabs/encounter`

The baseline surface is 191 product Java files and 12,737 physical LOC. The
full reproducible Encounter count is 202 Java files and 13,216 physical LOC
when `src/data/encounter` is included
(`docs/project/architecture/architecture-migration-encounter-baseline.md:65`).
Data-layer code remains outside the normal M3 migration surface unless a
gateway signature adaptation is explicitly named by this design. No such data
gateway adaptation is part of this design.

This design is the step-3 artifact required by the roadmap. It does not permit
implementation or harness scenario/assertion changes. The M3.4 wiring-port
step may only update same-area construction, view binding, and harness imports
needed to run the frozen Encounter harness scenarios against the old behavior.

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

The Encounter aggregate and generation algorithms are not the defect.
`EncounterSession` already owns builder state, current mode, roster mutation,
initiative, combat turns, combat resolution, saved-plan application, and XP
award behavior (`src/domain/encounter/model/session/EncounterSession.java:36`).
The generation package owns real search, draft assembly, difficulty math,
tuning, and World Planner source constraints
(`src/domain/encounter/model/generation/EncounterDraftGenerationModel.java:1`,
`src/domain/encounter/model/generation/helper/EncounterAutoTuningHelper.java:1`).

The defect is the role stack around those models. State-tab and foreign-area
actions currently pass through an intent handler, command-code conversion,
application usecases, session usecase wrappers, usecase adapter repositories,
plan publication usecases, published-state repository interfaces, many
`*ServiceAssembly` projection/readback classes, and proxy published models
before observable publication. The baseline measured 13 meaningful hops to
first Encounter state publication for generation and saved-plan readback,
8 hops for combat progression, 6 hops for plan-budget refresh, 10
product/published forwarding or proxy candidates plus 2 data candidates, and
3 product String boundary families
(`docs/project/architecture/architecture-migration-encounter-baseline.md:77`,
`docs/project/architecture/architecture-migration-encounter-baseline.md:117`,
`docs/project/architecture/architecture-migration-encounter-baseline.md:146`).

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `src.domain.encounter.EncounterServiceContribution` | Keep the byte-compatible domain service-registry entrypoint for `EncounterApplicationService` and the five Encounter published models. |
| `src.domain.encounter.EncounterServiceAssembly` | Become the single Encounter composition root for `EncounterPlanRepository`, foreign facts, stateful published models, root application service, and optional World Planner source reads. |
| `src.domain.encounter.EncounterApplicationService` | Keep the public methods `applyState`, `updateBuilderInputs`, and `refreshPlanBudget` while directly owning command normalization, action-code mapping, session mutation, saved-plan republish decisions, plan-budget refresh, storage-error fallback, and publication. |
| `src.domain.encounter.EncounterSessionRuntimeAccess` | New package-private adapter implementing `EncounterSession.SessionRepository`; owns active-party reads, party XP award, generation calls, creature-detail lookup, and old session-runtime error/fallback messages without a usecase/repository indirection layer. |
| `src.domain.encounter.EncounterForeignFacts` | New package-private adapter over Party, Creature, Encounter Table, and World Planner public seams for budget facts, active-party facts, creature candidate/detail reads, encounter-table candidate reads, world-source resolution, and NPC identity constraints. |
| `src.domain.encounter.EncounterPlanGateway` | New package-private gateway around `EncounterPlanRepository` for save/load/list, plan-budget calculation, saved-plan summary status handling, old validation messages, and storage-error fallback. |
| `src.domain.encounter.EncounterProjection` | New package-private projector from Encounter session, plan, budget, saved-plan, builder-input, and tuning data into byte-compatible published records. It replaces the role-named projection assemblies but keeps their mapping semantics. |
| `src.domain.encounter.EncounterPublishedState` | New package-private owner for the five stateful published models using `src.domain.shared.published.PublishedState`, including initial values, `publishSession`, `publishSavedPlans`, and `publishPlanBudget`. |
| `src.domain.encounter.model.generation.EncounterGenerator` | New generation orchestration service replacing `model/generation/usecase/**`; it keeps current party load, locked/unlocked candidate preparation, search, assembly, diagnostics, fallback, and World Planner source behavior without usecase role names. |
| `src.domain.encounter.model.session.CombatantId` | New typed internal value for combatant identity parsing/matching while preserving published and UI command String ids. |
| `src.domain.encounter.model.generation.EncounterCreatureFilters` | New typed internal value for Creature taxonomy filter keys at the Encounter boundary; Creature catalog values stay byte-compatible Strings at the imported seam. |
| `src.domain.encounter.model.session.EncounterSession` | Stay the aggregate for builder state, combat mode transitions, initiative, HP mutation, combat result state, saved-plan application, XP award command, and status text. |
| `src.domain.encounter.model.session.EncounterSessionCommand` | Stay the typed internal session command, but `EncounterApplicationService` owns the mapping from published `ApplyEncounterStateCommand` action codes to this enum. |
| `src.domain.encounter.model.plan.EncounterPlan`, `EncounterPlanCreature`, `EncounterPlanSummary`, `EncounterPlanBudgetLoadResult`, `SavedEncounterPlansLoadResult` | Stay as plan-owned value/result types used by domain logic and the unchanged data repository seam. |
| `src.domain.encounter.model.plan.repository.EncounterPlanRepository` | Stay the unchanged saved-plan data gateway seam for `src/data/encounter.repository.SqliteEncounterPlanRepository`. |
| `src.domain.encounter.model.reference.EncounterCreatureReference`, `EncounterCreatureCandidateCriteria`, `EncounterTableCandidateCriteria` | Stay as Encounter-owned request/reference values for foreign catalog facts; they are not service ports. |
| `src/domain/encounter/published/**` command, result, snapshot, enum, and carrier records | Stay byte-compatible public Encounter language consumed by views, Worldplanner, Session Planner, Creature details, Encounter Table, harnesses, and future migrated areas. |
| `src.domain.encounter.published.EncounterStateModel`, `EncounterBuilderInputsModel`, `EncounterTuningPreviewModel`, `SavedEncounterPlanListModel`, `EncounterPlanBudgetModel` | Become stateful published models backed by shared `PublishedState` while preserving `current()`, `subscribe(...)`, existing compatibility constructors, defaults, and null behavior. |
| `src.view.statetabs.encounter.EncounterStateContribution` | Keep the shell state-tab contribution id `encounter`, title `Encounter`, order `30`, slot `COCKPIT_STATE`, and visible state-tab registration behavior. |
| `src.view.statetabs.encounter.EncounterStateBinder` | Stay the state-tab composition point for service/model lookup, state subscriptions, view construction, inspector creature-detail integration, and optional World Planner result side effect. |
| `src.view.statetabs.encounter.EncounterStateViewModel` | New single typed view model replacing the contribution/content-model/input-event/intent-handler stack; owns active pane projection, builder controls projection, initiative projection, combat projection, result-selection draft state, direct Encounter command callbacks, Creature details callback, and World Planner defeated-NPC callback. |
| `src.view.statetabs.encounter.EncounterStateVocabulary` | New view vocabulary for visible labels, active-pane mapping, widget action wiring, HP/initiative text parsing, and published/UI String conversion at the JavaFX edge only. |
| `src.view.statetabs.encounter.EncounterStateView`, `EncounterBuilderStateView`, `EncounterInitiativeStateView`, `EncounterCombatStateView`, `EncounterResultsStateView` | Keep JavaFX view class names and visible layout roles while binding to `EncounterStateViewModel` projections and typed callbacks instead of role-named content models and input-event records. |

The target must reuse `src.domain.shared.published.PublishedState` for
listener/current-state ownership. Duplicating the old
`EncounterPublishedStateChannelServiceAssembly` logic in renamed files is a
design defect and a CPD/check-gaming risk.

## Target Call Chains

Counting rule: count named production class boundaries from user or
foreign-area intent source to first Encounter-owned publication. View-local
JavaFX controls and same-class private helpers are not counted; foreign public
readback seams are named separately.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Generate encounter from the state tab | `EncounterBuilderStateView` direct callback -> `EncounterStateViewModel.generate` -> `EncounterApplicationService.applyState` -> `EncounterSession.apply` using `EncounterSessionRuntimeAccess` -> `EncounterGenerator.generate` -> `EncounterPublishedState.publishSession` | At most 5 meaningful boundaries from view callback to publication; at most 4 Encounter-domain boundaries after the view-model edge. |
| Open saved plan from the state tab | `EncounterBuilderStateView` saved-plan callback -> `EncounterStateViewModel.openSavedPlan` -> `EncounterApplicationService.applyState` -> `EncounterSession.apply` using `EncounterPlanGateway.loadPlan` -> `EncounterPublishedState.publishSession` and `publishSavedPlans` | At most 4 meaningful boundaries to state publication; saved-plan list republish remains on the same command. |
| Combat HP, initiative, turn, and result progression | `EncounterCombatStateView` or `EncounterResultsStateView` direct callback -> `EncounterStateViewModel` -> `EncounterApplicationService.applyState` -> `EncounterSession.apply` -> `EncounterPublishedState.publishSession` | At most 4 meaningful boundaries to publication; World Planner defeated-NPC marking remains a view-model side effect before return-to-builder publication, matching current behavior. |
| Builder-input update from Worldplanner or state tab | `WorldPlannerEncounterHarness` / state-tab callback -> `EncounterApplicationService.updateBuilderInputs` -> `EncounterSession.apply(UPDATE_BUILDER_INPUTS)` -> `EncounterPublishedState.publishSession` | At most 3 Encounter-domain boundaries to publication; Creature taxonomy keys and world source ids remain published input seams. |
| Saved-plan budget refresh for Session Planner | `SessionPlannerApplicationService` or harness caller -> `EncounterApplicationService.refreshPlanBudget` -> `EncounterPlanGateway.loadBudget` -> `EncounterPublishedState.publishPlanBudget` | At most 3 Encounter-owned boundaries to plan-budget publication; Party/Creature reads are foreign fact reads inside the gateway through `EncounterForeignFacts`. |

`EncounterProjection` and `EncounterForeignFacts` are package-private helpers
called inside `EncounterApplicationService`, `EncounterPublishedState`,
`EncounterSessionRuntimeAccess`, or `EncounterPlanGateway`. They are target
responsibilities, not new forwarding hops between caller and publication.

## Frozen Parity Inventory

The selected M3 Encounter parity tasks are:

- `./gradlew encounterStateTabHarness --console=plain`
- `./gradlew worldPlannerEncounterHarness --console=plain`

The frozen scenario and assertion inventory is the union below. M3.4 and M3.5
may port wiring references, but MUST NOT add, remove, rename, split, merge,
weaken, or reinterpret these scenarios or their pass/fail oracles.

| Harness evidence | Frozen scenario/assertion families |
| --- | --- |
| `test/src/view/statetabs/encounter/EncounterStateTabHarness.java:51-63` | Proof output remains `Encounter state tab harness passed: 2 proof item(s).`; `ENCOUNTER-STATE-TAB-001` opens the shell-bound Encounter state tab and verifies the title plus empty roster text. |
| `test/src/view/statetabs/encounter/EncounterStateTabHarness.java:69-76` | `ENCOUNTER-STATE-TAB-002` opens a saved plan through real `EncounterApplicationService.applyState`, then verifies visible `Gate Ambush`, adjusted XP `100`, `Goblin Ambusher`, `CR 1/4  |  100 XP  |  humanoid`, and creature count `2`. |
| `test/src/view/statetabs/encounter/EncounterStateTabHarness.java:183-207` | Harness setup keeps isolated Party/Encounter persistence, real Party and Encounter service contributions, fixture Creature/Encounter Table ports, and direct saved-plan repository seeding. |
| `test/src/domain/worldplanner/WorldPlannerEncounterHarness.java:46-64` | World Planner location/faction source constraints request Encounter Table ids `[301, 302, 201]` and enforce finite faction stock in generated roster publication. |
| `test/src/domain/worldplanner/WorldPlannerEncounterHarness.java:66-83` | Explicit table ids intersect with World Planner source tables; invalid sources block table matches; finite/unlimited stock caps retain current behavior. |
| `test/src/domain/worldplanner/WorldPlannerEncounterHarness.java:85-116` | Direct generation model finite-cap assertions and World NPC identity survive builder, initiative, combat, HP mutation, end-combat, and result publication. |
| `tools/quality/config/harness-map.json:56`, `tools/quality/config/harness-map.json:83`; `build.gradle.kts:651-662`, `build.gradle.kts:764-775` | `src/view/statetabs/encounter/**` maps to `encounterStateTabHarness`; `src/domain/encounter/**` maps to `worldPlannerEncounterHarness`; both tasks isolate `XDG_DATA_HOME`. |
| `docs/project/architecture/migration-ledger.md:137` | M3.1 recorded the green old-structure proof set: selected static/harness run, mapped Encounter harness set, production handoff, documentation gate, Phase 1, and Phase 2. |

## Deletion List

The implementation step is incomplete until these classes no longer exist:

- `src/domain/encounter/EncounterApplicationServiceFactoryServiceAssembly.java`
- `src/domain/encounter/EncounterBuilderInputsProjectionServiceAssembly.java`
- `src/domain/encounter/EncounterCreatureCatalogServiceAssembly.java`
- `src/domain/encounter/EncounterCreatureRequestServiceAssembly.java`
- `src/domain/encounter/EncounterPartyFactsApplicationServiceAssembly.java`
- `src/domain/encounter/EncounterPartyFactsReadbackServiceAssembly.java`
- `src/domain/encounter/EncounterPlanBudgetProjectionServiceAssembly.java`
- `src/domain/encounter/EncounterPlanProjectionServiceAssembly.java`
- `src/domain/encounter/EncounterPlanPublishedStateServiceAssembly.java`
- `src/domain/encounter/EncounterPublishedStateChannelServiceAssembly.java`
- `src/domain/encounter/EncounterPublishedStateServiceAssembly.java`
- `src/domain/encounter/EncounterSavedPlanProjectionServiceAssembly.java`
- `src/domain/encounter/EncounterSessionPublishedStateServiceAssembly.java`
- `src/domain/encounter/EncounterSessionSnapshotProjectionServiceAssembly.java`
- `src/domain/encounter/EncounterTableCandidateRequestServiceAssembly.java`
- `src/domain/encounter/EncounterTableCandidateServiceAssembly.java`
- `src/domain/encounter/EncounterTuningPreviewProjectionServiceAssembly.java`
- `src/domain/encounter/EncounterWorldPlannerSourceServiceAssembly.java`
- `src/domain/encounter/application/ApplyEncounterStateUseCase.java`
- `src/domain/encounter/model/generation/usecase/AssembleEncounterResultUseCase.java`
- `src/domain/encounter/model/generation/usecase/EncounterGenerationLockedCreatureUseCase.java`
- `src/domain/encounter/model/generation/usecase/EncounterGenerationPartyLoadUseCase.java`
- `src/domain/encounter/model/generation/usecase/EncounterGenerationPreparationUseCase.java`
- `src/domain/encounter/model/generation/usecase/EncounterGenerationSearchUseCase.java`
- `src/domain/encounter/model/generation/usecase/EncounterGenerationUnlockedCandidateUseCase.java`
- `src/domain/encounter/model/generation/usecase/EncounterGenerationUseCase.java`
- `src/domain/encounter/model/generation/usecase/PrepareEncounterGenerationUseCase.java`
- `src/domain/encounter/model/plan/repository/EncounterPlanPublishedStateRepository.java`
- `src/domain/encounter/model/plan/usecase/ListSavedEncounterPlansUseCase.java`
- `src/domain/encounter/model/plan/usecase/LoadEncounterPlanBudgetUseCase.java`
- `src/domain/encounter/model/plan/usecase/LoadSavedEncounterPlanUseCase.java`
- `src/domain/encounter/model/plan/usecase/PublishEncounterPlanBudgetUseCase.java`
- `src/domain/encounter/model/plan/usecase/PublishEncounterSavedPlansUseCase.java`
- `src/domain/encounter/model/plan/usecase/SaveEncounterPlanUseCase.java`
- `src/domain/encounter/model/reference/port/ApplicationEncounterCreatureCatalogPort.java`
- `src/domain/encounter/model/reference/port/ApplicationEncounterTableCandidatePort.java`
- `src/domain/encounter/model/reference/repository/EncounterCreatureRepository.java`
- `src/domain/encounter/model/reference/repository/EncounterTableCandidateRepository.java`
- `src/domain/encounter/model/session/repository/EncounterGenerationRepository.java`
- `src/domain/encounter/model/session/repository/EncounterPartyFactsRepository.java`
- `src/domain/encounter/model/session/repository/EncounterSessionCreatureDataRepository.java`
- `src/domain/encounter/model/session/repository/EncounterSessionDataMapperRepository.java`
- `src/domain/encounter/model/session/repository/EncounterSessionPublishedStateRepository.java`
- `src/domain/encounter/model/session/repository/EncounterSessionRepository.java`
- `src/domain/encounter/model/session/repository/EncounterSessionUseCaseAdaptersRepository.java`
- `src/domain/encounter/model/session/usecase/ApplyEncounterSessionUseCase.java`
- `src/domain/encounter/model/session/usecase/EncounterTuningPreviewPublicationUseCase.java`
- `src/domain/encounter/model/session/usecase/LoadEncounterBudgetUseCase.java`
- `src/domain/encounter/model/session/usecase/PublishEncounterSessionUseCase.java`
- `src/domain/encounter/model/session/usecase/UpdateEncounterBuilderInputsUseCase.java`
- `src/view/statetabs/encounter/EncounterBuilderStateContentModel.java`
- `src/view/statetabs/encounter/EncounterBuilderStateViewInputEvent.java`
- `src/view/statetabs/encounter/EncounterCombatStateContentModel.java`
- `src/view/statetabs/encounter/EncounterCombatStateViewInputEvent.java`
- `src/view/statetabs/encounter/EncounterInitiativeStateContentModel.java`
- `src/view/statetabs/encounter/EncounterInitiativeStateViewInputEvent.java`
- `src/view/statetabs/encounter/EncounterResultsStateContentModel.java`
- `src/view/statetabs/encounter/EncounterResultsStateViewInputEvent.java`
- `src/view/statetabs/encounter/EncounterStateContentModel.java`
- `src/view/statetabs/encounter/EncounterStateContributionModel.java`
- `src/view/statetabs/encounter/EncounterStateIntentHandler.java`

`src/domain/encounter/application/`, `src/domain/encounter/model/generation/usecase/`,
`src/domain/encounter/model/plan/usecase/`,
`src/domain/encounter/model/reference/port/`,
`src/domain/encounter/model/reference/repository/`,
and `src/domain/encounter/model/session/usecase/` must be empty or gone after
implementation. Deleting comments, compressing code, cosmetically renaming
wrappers, or rephrasing duplicated helper logic without executing this list is
not migration.

## Seam Statement

These surfaces stay byte-compatible in M3 until their consumer sides migrate:

- `src.domain.encounter.EncounterApplicationService`: class name, package,
  public method names, and command parameter types for `applyState`,
  `updateBuilderInputs`, and `refreshPlanBudget`.
- `src.domain.encounter.EncounterServiceContribution`: service-registry
  registration of `EncounterApplicationService`, `EncounterStateModel`,
  `EncounterBuilderInputsModel`, `EncounterTuningPreviewModel`,
  `SavedEncounterPlanListModel`, and `EncounterPlanBudgetModel`.
- `src.domain.encounter.model.plan.repository.EncounterPlanRepository`: method
  names, parameter types, return types, saved-plan persistence semantics, and
  error behavior for `src/data/encounter/**`.
- Every record and enum in `src/domain/encounter/published/**`: record
  component order, component types, accessor names, enum constants, static
  factories, null/default handling, numeric action-code values, status enum
  constants, and current visible strings.
- The five Encounter published model classes: class/package names,
  `current()`, `subscribe(Consumer<...>)`, existing constructor signatures,
  initial default values, listener delivery, and compatibility with harness
  fake models.
- Party, Creature, Encounter Table, and World Planner public seams consumed by
  Encounter: `PartyApplicationService`, `ActivePartyModel`,
  `AdventuringDayCalculationModel`, `CreaturesApplicationService`,
  `CreatureDetailModel`, `CreatureEncounterCandidatesModel`,
  `EncounterTableApplicationService`, `EncounterTableCandidatesModel`, and
  `WorldPlannerSnapshotModel`.
- `src.view.statetabs.encounter.EncounterStateContribution`: contribution id
  `encounter`, title `Encounter`, order `30`, returned shell slot, and shell
  binding behavior.
- `src.view.statetabs.encounter.EncounterStateBinder` and the five JavaFX view
  classes keep class/package names, visible layout roles, and harness import
  compatibility while their binding contracts move to `EncounterStateViewModel`.
- `src/data/encounter/**`, SQLite schemas, saved-plan persistence, Creature
  catalog persistence, Encounter Table data adapters, Party data, World
  Planner data, Session Planner behavior, shell APIs, and shared view controls
  stay unchanged.

The target must preserve these current behavior points exactly:

- `applyState(null)` still behaves as refresh and publishes the current or
  unavailable Encounter state.
- Unknown `ApplyEncounterStateCommand` action codes still throw
  `IllegalArgumentException("Unknown encounter state action code.")`.
- `updateBuilderInputs(null)` still resets to empty/default builder inputs and
  republishes state.
- `refreshPlanBudget(null)` still behaves as plan id `0` and publishes the
  current invalid-request/storage fallback behavior.
- Saved-plan save/open/list behavior, including positive id validation,
  storage-error messages, saved-plan summary text, and same-command saved-plan
  list republish, stays as currently proven.
- Generation fallback, invalid World Planner source behavior, finite stock
  caps, explicit table/source intersection, creature candidate fallback,
  tuning preview labels, and party budget status mapping stay as currently
  proven.
- Combatant ids, world NPC ids, HP mutation, initiative edits, party-member
  join, combat result selection, XP award, and defeated World NPC marking stay
  as currently proven.

## Wiring-Port Boundary

M3.4 must be a separate compatibility wiring commit before deletion. It may:

- Introduce `EncounterStateViewModel` as a compatibility facade over the
  current content models and `EncounterStateIntentHandler`.
- Route `EncounterStateBinder`, JavaFX views, `encounterStateTabHarness`, and
  same-area state-tab wiring through that view-model boundary without changing
  visible text, fixture values, proof labels, assertions, or pass/fail logic.
- Port `test/src/view/leftbartabs/sessionplanner/SessionPlannerCatalogHarness.java`
  away from the deletion-list Encounter usecases and published-state
  repository interfaces toward the retained `EncounterApplicationService` and
  published-model seams. That harness currently constructs fake Encounter
  services with `ApplyEncounterStateUseCase`, `UpdateEncounterBuilderInputsUseCase`,
  `PublishEncounterSessionUseCase`, `PublishEncounterSavedPlansUseCase`,
  `PublishEncounterPlanBudgetUseCase`, `EncounterSessionPublishedStateRepository`,
  and `EncounterPlanPublishedStateRepository` imports.

M3.4 must not delete production behavior classes, change a harness scenario,
change an assertion label, alter a fixture value, alter visible Encounter text,
or move old behavior into the implementation target early. M3.5 owns the
production deletion list and target implementation.

## Metric Targets And Exceptions

| Metric | Target for implementation | Design exception |
| --- | --- | --- |
| LOC | Product subset should attempt the roadmap target: 12,737 physical LOC to 7,642 or less. If byte-compatible published records, JavaFX view layout classes, the retained `EncounterSession` aggregate, and the retained generation model make that impossible, M3.6 may request a reviewed exception capped at 9,500 physical LOC with a class-by-class LOC breakdown. | Full 202-file measured LOC reduction is a data-layer exception unless a gateway signature adaptation becomes necessary. The 9,500 cap is not pre-approval; it is the maximum design-bounded exception candidate. |
| File count | Product subset should fall from 191 Java files to 140 or fewer by executing the deletion list and adding only the target helper/view-model classes named above. | More files require a design amendment before implementation. |
| Forwarding-only classes | Zero product behavior-forwarding classes: application service owns route logic, published models own state/listeners, view model owns state-tab action routing, and the usecase/repository/publication assembly stack is deleted. | `EncounterServiceContribution` and `EncounterServiceAssembly` remain service-registry composition seams like the pilot reference, but must not add a behavior-forwarding hop between caller and `EncounterApplicationService`. Data-layer contribution and repository adapter remain outside the product migration surface. |
| Intent-to-publication chain | Encounter-owned state-tab generation/open-saved chains use at most 5 meaningful boundaries from view callback to first publication, combat uses at most 4, builder-input update uses at most 3 Encounter-domain boundaries, and plan-budget refresh uses at most 3 Encounter-owned boundaries. | Full user-to-publication chains through foreign World Planner, Session Planner, Party, Creature, Encounter Table, JavaFX, shell, and SQLite surfaces remain longer because those consumers are out of scope for this M3 area. |
| String round-trips | The state-tab active-mode `.name()` / `valueOf(...)` bridge is eliminated by sharing `EncounterStateSnapshot.Mode` or an explicit typed mapping in `EncounterStateViewModel`; internal combat identity uses `CombatantId`; Creature taxonomy filters use `EncounterCreatureFilters` after the imported/public seam. No new internal String decoding is introduced. | Combatant ids remain byte-compatible published/UI command strings; Creature taxonomy filters remain imported Creature catalog String keys; display text, labels, generated names, and SQLite text stay String seams until their owner areas migrate. |

The exceptions are individually justified by retained public seams and real
algorithm/view code, not by preference. The conformance review must reject any
additional unexplained metric miss or any apparent metric hit created by code
compression, comment deletion, or check-gaming.

## Untouched Surfaces

- `src/data/encounter/**` persistence, schema, mapper, gateway, and repository
  adapter stay unchanged; this design names no data-layer gateway signature
  adaptation.
- `src/domain/encounter/model/plan/repository/EncounterPlanRepository` stays
  the data seam for saved plans.
- Party, Creature, Encounter Table, World Planner, Session Planner, Catalog,
  shell APIs, shared controls, and SQLite schema/persistence semantics stay
  unchanged except for the M3.4 Session Planner harness wiring import port
  named above.
- `src/domain/encounter/model/generation/**` algorithm model/helper classes
  outside `model/generation/usecase/**` stay as the generation core unless
  implementation proves a same-behavior consolidation inside the named
  `EncounterGenerator` target.
- `src/domain/encounter/model/session/**` aggregate, combat, builder, roster,
  result, and data value classes outside the deletion-list repository/usecase
  files stay as Encounter session logic.
- Harness scenarios and assertions stay frozen. Any behavior anomaly found
  during implementation is an R2 issue or area revert, not an in-pass fix.

## Required Reviews

Phase 1 and Phase 2 must approve this artifact before M3.4 starts. Reviewers
must check that the design names target classes, representative call chains,
the full deletion list, seam compatibility, untouched surfaces, frozen parity
inventory, wiring-port boundary, and each metric exception above. A vague
implementation-only answer is rework.
