Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M3.3 target design for the Session Planner architecture
migration area before any wiring-port or implementation commit.

# Session Planner Migration Target Design

## Scope

This design covers the M3 Session Planner product surface:

- `src/domain/sessionplanner`
- `src/view/leftbartabs/sessionplanner`

The baseline surface is 103 product Java files and 6,664 physical LOC. The
full reproducible Session Planner count is 121 Java files and 7,831 LOC when
`src/data/sessionplanner` is included
(`docs/project/architecture/architecture-migration-sessionplanner-baseline.md:67`).
Data-layer code remains outside the normal M3 migration surface unless a
gateway signature adaptation is explicitly named by this design. No such data
gateway adaptation is part of this design.

This design is the step-3 artifact required by the roadmap. It does not permit
implementation or harness scenario/assertion changes. The M3.4 wiring-port
step may only update harness, view construction, adapter construction, imports,
and callbacks needed to run the frozen Session Planner harness scenarios
against the old behavior.

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

The Session Planner aggregate is not the defect. `SessionPlan` owns
participant references, encounter-day input, ordered scenes, scene metadata,
allocations, selected-scene state, rest placement, loot placeholders, status
text, and next ids
(`src/domain/sessionplanner/model/session/SessionPlan.java:27`,
`src/domain/sessionplanner/model/session/SessionPlan.java:95`,
`src/domain/sessionplanner/model/session/SessionPlan.java:129`,
`src/domain/sessionplanner/model/session/SessionPlan.java:213`,
`src/domain/sessionplanner/model/session/SessionPlan.java:250`).

The defect is the ceremony around that model. User actions currently flow
through `SessionPlannerIntentHandler`, five split application-service facades,
per-verb use cases, repository/publication interfaces, readback invokers,
projection assemblies, channel assemblies, and proxy published models before
observable publication. The baseline measured dominant timeline chains at 6
meaningful hops to the first `SessionPlan` mutation, with 7-hop
active-party-facts seeding and nonzero World Planner location-validation paths
(`docs/project/architecture/architecture-migration-sessionplanner-baseline.md:77`).
The same baseline identified 30 product/published forwarding or proxy
candidates plus 3 product String boundary families
(`docs/project/architecture/architecture-migration-sessionplanner-baseline.md:117`,
`docs/project/architecture/architecture-migration-sessionplanner-baseline.md:192`).

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `src.domain.sessionplanner.SessionPlannerServiceContribution` | Keep the byte-compatible domain service-registry entrypoint, but register only the retained root `SessionPlannerApplicationService` and the five published Session Planner models after the same-area wiring port removes split-service consumers. |
| `src.domain.sessionplanner.SessionPlannerServiceAssembly` | Become the single Session Planner composition root for repository, foreign facts, stateful published models, root application service, and World Planner refresh subscription. |
| `src.domain.sessionplanner.SessionPlannerApplicationService` | Keep existing catalog command methods and absorb participant, encounter, rest, and loot command methods; directly own command normalization, current-session load/seed, repository save/current-pointer behavior, storage-error status, location validation, typed rest mapping, and publication. |
| `src.domain.sessionplanner.SessionPlannerPublishedState` | New package-private owner for lazy loaded state, catalog/current/participants/timeline/state-panel publication, loaded-current refresh, and publication calls after successful or failed session mutations. |
| `src.domain.sessionplanner.SessionPlannerProjection` | New package-private projector for current-session snapshot, participant projection, scene timeline, state panel, location references, XP/rest budget, encounter-plan summaries, and status resolution. |
| `src.domain.sessionplanner.SessionPlannerForeignFacts` | New package-private adapter over Party, Encounter, and World Planner public seams for active-party facts, adventuring-day calculation, saved encounter-plan list/budget readback, and location list/existence reads. |
| `src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel` | Become a stateful published model using `src.domain.shared.published.PublishedState`, while preserving `current()`, `subscribe(...)`, default/null behavior, and the current compatibility constructor. |
| `src.domain.sessionplanner.published.SessionPlannerCatalogModel` | Become a stateful catalog model using the shared `PublishedState` helper while preserving `current()`, `subscribe(...)`, default/null behavior, and the current compatibility constructor. |
| `src.domain.sessionplanner.published.SessionPlannerParticipantsModel` | Become a stateful participants model using the shared `PublishedState` helper while preserving `current()`, `subscribe(...)`, default/null behavior, and the current compatibility constructor. |
| `src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel` | Become a stateful timeline model using the shared `PublishedState` helper while preserving `current()`, `subscribe(...)`, default/null behavior, and the current compatibility constructor. |
| `src.domain.sessionplanner.published.SessionPlannerStatePanelModel` | Become a stateful state-panel model using the shared `PublishedState` helper while preserving `current()`, `subscribe(...)`, default/null behavior, and the current compatibility constructor. |
| `src.domain.sessionplanner.model.session.repository.SessionPlanRepository` | Stay the unchanged data gateway seam for `src/data/sessionplanner.repository.SqliteSessionPlanRepository`. |
| `src.domain.sessionplanner.model.session.SessionPlan` | Stay the aggregate for session-local participant refs, encounter days, ordered scenes, allocations, selected scene, rests, loot placeholders, status text, and next ids. |
| `src.domain.sessionplanner.model.session.EncounterDays`, `SessionEncounter`, `SessionEncounterAllocation`, `SessionRestPlacement`, `SessionLootPlaceholder`, `SessionPlanSummary`, `SessionLocationReference` | Stay as session-owned value, summary, and persistence-facing types used by domain and data code. |
| `src.domain.sessionplanner.model.session.SessionActivePartyMembersFact`, `SessionPartyMemberProfile`, `SessionAdventuringDayBudgetFact`, `SessionEncounterPlanFact`, `SessionEncounterPlanListFact`, `SessionSavedEncounterPlanFact` | Stay as planner-owned fact carriers copied from foreign public read models, not as foreign truth. |
| `src/domain/sessionplanner/published/**` command, snapshot, projection, enum, and carrier records | Stay byte-compatible public Session Planner language consumed by views, harnesses, shell, and future migrated areas. |
| `src.view.leftbartabs.sessionplanner.SessionPlannerContribution` | Keep the shell contribution id, title, group, nav icon, runtime mode, and returned cockpit slots. |
| `src.view.leftbartabs.sessionplanner.SessionPlannerBinder` | Stay the tab composition point for service/model lookup, shared catalog controls, views, subscriptions, view-model construction, and direct callbacks without becoming a forwarding controller. |
| `src.view.leftbartabs.sessionplanner.SessionPlannerViewModel` | New single typed view model replacing the contribution/content-model stack; owns catalog projection, controls projection, timeline setup, scene drafts, widget/action lookup, participant choices, location choices, and state-panel projection. |
| `src.view.leftbartabs.sessionplanner.SessionPlannerVocabulary` | New view vocabulary for visible labels, rest labels, widget action codes, catalog String id conversion at the shared-control seam, location/participant option display, and encounter-days text parsing at the UI edge. |
| `src.view.leftbartabs.sessionplanner.SessionPlannerControlsView` | Keep the JavaFX controls view and visible layout while binding to `SessionPlannerViewModel` controls projections and emitting direct typed attach callbacks. |
| `src.view.leftbartabs.sessionplanner.SessionPlannerTimelineMainView` | Keep the JavaFX timeline view and visible layout while binding to `SessionPlannerViewModel` timeline projections and emitting direct typed timeline callbacks. |
| `src.view.leftbartabs.sessionplanner.SessionPlannerStateView` | Keep the JavaFX state view and visible layout while binding to `SessionPlannerViewModel` state projections. |

The target must reuse `src.domain.shared.published.PublishedState` for
published-model listener/current-state ownership. Duplicating the Party or
Creature stateful-model helper logic inside Session Planner would be a design
defect, not a CPD workaround.

## Target Call Chains

Counting rule: count named production class boundaries from user or foreign
intent source to first Session Planner-owned domain or durable mutation.
`SessionPlannerBinder` callback registration and `SessionPlannerViewModel`
local projection/draft state are wiring, not command-forwarding controllers.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Create a session from the catalog controls | `CatalogCrudControlsView` submit action -> `SessionPlannerApplicationService.createSession` -> `SessionPlan.seeded` / `SessionPlan.rename` / `SessionPlanRepository.save` | At most 3 meaningful hops to new `SessionPlan` construction or durable save; active-party seeding is a retained foreign read inside the service. |
| Add a blank scene | `SessionPlannerTimelineMainView` add-scene action -> `SessionPlannerApplicationService.addScene` -> `SessionPlan.addScene` / `SessionPlanRepository.save` | At most 3 meaningful hops to first `SessionPlan` mutation and durable save. |
| Attach a saved Encounter plan | `SessionPlannerControlsView` attach action -> `SessionPlannerApplicationService.attachEncounter` -> `SessionPlan.attachEncounter` / `SessionPlanRepository.save` | At most 3 meaningful hops to session-owned scene/reference mutation; the saved-plan list remains a foreign published read seam. |
| Save scene title, notes, and World Planner location | `SessionPlannerTimelineMainView` scene-save action -> `SessionPlannerApplicationService.updateEncounterScene` -> optional `SessionPlannerForeignFacts.locationExists` -> `SessionPlan.updateEncounterScene` / `SessionPlanRepository.save` | At most 3 Session Planner-owned hops; the location existence check is a foreign readback seam, not a Session Planner mutation hop. |
| Set a rest gap | `SessionPlannerTimelineMainView` rest action -> `SessionPlannerApplicationService.setRestGap` -> `SessionRestPlacement.shortRestBetween` or `longRestBetween` -> `SessionPlan.setRestPlacement` / `SessionPlanRepository.save` | At most 3 meaningful Session Planner-owned hops; `SessionPlannerRestKind` stays typed and is not converted through `String`. |

Catalog item ids remain a shared `CatalogCrudControlsView` seam: the shared
control emits String ids and `SessionPlannerVocabulary` parses them at the
view edge until the shared catalog controls migrate. That conversion must not
move deeper into Session Planner application or domain logic.

## Frozen Parity Inventory

The selected M3 Session Planner parity tasks are:

- `./gradlew sessionPlannerCatalogHarness --console=plain`
- `./gradlew sessionPlannerShellLayoutHarness --console=plain`

The frozen scenario and assertion inventory is the union below. M3.4 and M3.5
may port wiring references, but MUST NOT add, remove, rename, split, merge,
weaken, or reinterpret these scenarios or their pass/fail oracles.

| Harness evidence | Frozen scenario/assertion families |
| --- | --- |
| `test/src/view/leftbartabs/sessionplanner/SessionPlannerCatalogHarness.java:112` | Initial empty catalog, no implicit visible `Session #0`, disabled session mutation before create, encounter-days action before create does not seed a session. |
| `test/src/view/leftbartabs/sessionplanner/SessionPlannerCatalogHarness.java:121` | Catalog create, rename, select, delete fallback to remaining session, delete-last replacement session, create after delete-last, stable selected/current publication, and persisted encounter-days preservation. |
| `test/src/view/leftbartabs/sessionplanner/SessionPlannerCatalogHarness.java:134` | Blank scene add/remove, no false linked encounter data, selected-scene readback, and rendered scene target text. |
| `test/src/view/leftbartabs/sessionplanner/SessionPlannerCatalogHarness.java:233` | Supplemental session-owned loot target/prune checks, legacy loot mapper compatibility, World Planner location labels, direct timeline projection checks, and session-scoped unsaved scene drafts. |
| `test/src/view/leftbartabs/sessionplanner/SessionPlannerCatalogHarness.java:368` | Production-route participant add/remove, saved Encounter plan attach, scene title/notes/location save, loot add/remove, allocation increase/decrease, scene select, rest set/clear, scene move, and scene remove through rendered controls. |
| `test/shell/host/SessionPlannerShellLayoutHarness.java:59` | Shell controls growth, inserted contribution controls growth, scroll policies, visible planner controls/main height, compact setup strip, and state-scroll behavior. |
| `test/shell/host/SessionPlannerShellLayoutHarness.java:124` | Sidebar ordering, separators, icon-only navigation buttons, accessible text/tooltips, Session Planner navigation icon path, malformed icon fallback, and adjacent Hex shell-layout regression checks. |
| `tools/quality/config/harness-map.json:69`; `build.gradle.kts:675` | `src/domain/sessionplanner/**` and `src/view/leftbartabs/sessionplanner/**` route to both selected harnesses. |
| `docs/project/architecture/migration-ledger.md:113` | M3.1 recorded the old-structure proof: `compileTestJava`, selected Session Planner harnesses, harness map/topology, focused handoff, diff checks, Phase 1, and Phase 2 were green after production-route closure. |

## Deletion List

The implementation step is incomplete until these classes no longer exist:

- `src/domain/sessionplanner/SessionPlannerApplicationServicesServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerEncounterApplicationService.java`
- `src/domain/sessionplanner/SessionPlannerEncounterFactsInvokerServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerEncounterFactsReadbackServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerLocationReferenceReadbackServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerLootApplicationService.java`
- `src/domain/sessionplanner/SessionPlannerParticipantApplicationService.java`
- `src/domain/sessionplanner/SessionPlannerParticipantsProjectionServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerPartyFactsInvokerServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerPartyFactsReadbackServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerProjectionContextServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerPublishedModelChannelServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerPublishedModelsServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerPublishedStateRepositoryServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerPublishedStateServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerRestApplicationService.java`
- `src/domain/sessionplanner/SessionPlannerRuntimeServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerSceneTimelineProjectionServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerSessionLocationProjectionServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerSessionProjectionServiceAssembly.java`
- `src/domain/sessionplanner/SessionPlannerStatePanelProjectionServiceAssembly.java`
- `src/domain/sessionplanner/model/session/helper/SessionPlanSeedHelper.java`
- `src/domain/sessionplanner/model/session/port/SessionEncounterFactsPort.java`
- `src/domain/sessionplanner/model/session/port/SessionLocationReferencePort.java`
- `src/domain/sessionplanner/model/session/port/SessionPartyFactsPort.java`
- `src/domain/sessionplanner/model/session/repository/SessionEncounterFactsRepository.java`
- `src/domain/sessionplanner/model/session/repository/SessionPartyFactsRepository.java`
- `src/domain/sessionplanner/model/session/repository/SessionPlannerPublishedStateRepository.java`
- `src/domain/sessionplanner/model/session/usecase/AddSessionLootPlaceholderUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/AddSessionParticipantUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/AddSessionSceneUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/AttachSessionEncounterUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/ClearSessionRestGapUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/CreateSessionPlanUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/DeleteSessionPlanUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/LoadCurrentSessionPlanUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/MoveSessionEncounterDownUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/MoveSessionEncounterUpUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/RemoveSessionEncounterUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/RemoveSessionLootPlaceholderUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/RemoveSessionParticipantUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/RenameSessionPlanUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/SaveCurrentSessionPlanUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/SeedSessionPlanUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/SelectSessionEncounterUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/SelectSessionPlanUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/SetSessionEncounterAllocationUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/SetSessionEncounterDaysUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/SetSessionRestGapUseCase.java`
- `src/domain/sessionplanner/model/session/usecase/UpdateSessionEncounterSceneUseCase.java`
- `src/view/leftbartabs/sessionplanner/SessionPlannerContributionModel.java`
- `src/view/leftbartabs/sessionplanner/SessionPlannerControlsContentModel.java`
- `src/view/leftbartabs/sessionplanner/SessionPlannerControlsViewInputEvent.java`
- `src/view/leftbartabs/sessionplanner/SessionPlannerIntentHandler.java`
- `src/view/leftbartabs/sessionplanner/SessionPlannerStateContentModel.java`
- `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainContentModel.java`
- `src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainViewInputEvent.java`

`src/domain/sessionplanner/model/session/usecase/`,
`src/domain/sessionplanner/model/session/port/`, and the two foreign-facts
repository interfaces must be empty or gone after implementation. Deleting
comments, compressing code, cosmetically renaming wrappers, or rephrasing
duplicated helper logic without executing this list is not migration.

## Seam Statement

These surfaces stay byte-compatible in M3 until their consumer sides migrate:

- `src.domain.sessionplanner.SessionPlannerApplicationService`: class name,
  package, and existing public catalog method names/parameter types stay
  unchanged. The root service gains participant, encounter, rest, and loot
  command methods using the existing published command records before the
  split service classes are deleted.
- `src.domain.sessionplanner.SessionPlannerServiceContribution`: class name,
  package, service-registry entrypoint, and registration of the five published
  Session Planner models stay intact. Registration of the four split
  application-service classes may be removed only after M3.4 ports same-area
  wiring away from them; no foreign consumer exists in the current codebase.
- The five published model classes: `SessionPlannerCurrentSessionModel`,
  `SessionPlannerCatalogModel`, `SessionPlannerParticipantsModel`,
  `SessionPlannerSceneTimelineModel`, and `SessionPlannerStatePanelModel` keep
  class/package names, service-registry keys, `current()`,
  `subscribe(Consumer<...>)`, existing constructor signatures, default/null
  behavior, listener delivery, and readback result semantics.
- Every record, enum, and carrier in `src/domain/sessionplanner/published/**`:
  record component order, component types, accessor names, enum constants,
  static factories, normalization, empty factories, and default behavior.
- `src.domain.sessionplanner.model.session.repository.SessionPlanRepository`
  and the domain value types it exposes to `src/data/sessionplanner`.
- `SessionRestPlacement.persistenceKind()` and
  `SessionRestPlacement.fromPersistence(...)` because data serialization still
  stores rest kind names outside the normal product migration surface.
- Party, Encounter, and World Planner public seams consumed by Session Planner:
  `PartyApplicationService`, `ActivePartyModel`,
  `AdventuringDayCalculationModel`, `EncounterApplicationService`,
  `SavedEncounterPlanListModel`, `EncounterPlanBudgetModel`, and
  `WorldPlannerSnapshotModel`.
- `src.view.leftbartabs.sessionplanner.SessionPlannerContribution`:
  contribution id `session-planner`, group `planning`, order `15`, title
  `Session Planner`, nav icon path, runtime mode, returned cockpit slots, and
  shell binding behavior.
- `src.view.leftbartabs.sessionplanner.SessionPlannerControlsView`,
  `SessionPlannerTimelineMainView`, and `SessionPlannerStateView`: class names,
  packages, public constructors, visible layout roles, and shell-harness import
  compatibility.
- Shared `CatalogCrudControlsView` and `CatalogCrudControlsViewInputEvent`
  stay unchanged; Session Planner adapts to their String item-id seam at the
  view edge only.
- Shell APIs, shared catalog controls, Party, Encounter, World Planner,
  Creature, future Loot, and SQLite schema/persistence semantics stay
  unchanged.

M3.4 may port same-area harness and Session Planner view wiring references
away from the deleted content-model/input-event/split-service classes. It must
not change a harness scenario, assertion, fixture value, visible text, or
pass/fail oracle.

## Wiring-Port Boundary

`SessionPlannerCatalogHarness` currently imports and instantiates
`SessionPlannerTimelineMainContentModel` and observes
`SessionPlannerTimelineMainViewInputEvent` while checking supplemental draft
and legacy-loot behavior
(`test/src/view/leftbartabs/sessionplanner/SessionPlannerCatalogHarness.java:275`,
`test/src/view/leftbartabs/sessionplanner/SessionPlannerCatalogHarness.java:299`).
`SessionPlannerBinder` constructs the content-model stack and
`SessionPlannerIntentHandler`
(`src/view/leftbartabs/sessionplanner/SessionPlannerBinder.java:54`), and the
views expose the deleted content/input-event types
(`src/view/leftbartabs/sessionplanner/SessionPlannerControlsView.java:21`,
`src/view/leftbartabs/sessionplanner/SessionPlannerTimelineMainView.java:30`,
`src/view/leftbartabs/sessionplanner/SessionPlannerStateView.java:26`).

Therefore M3.4 MUST port the same scenarios to a compatibility
`SessionPlannerViewModel` and direct callback boundary before M3.5 deletes the
old view mediation classes. The allowed M3.4 shape is narrow:

- introduce `SessionPlannerViewModel` as a compatibility facade over the
  existing content models and readback subscriptions;
- introduce `SessionPlannerVocabulary` for view-edge parsing/labels/action
  codes without changing visible text;
- port `SessionPlannerCatalogHarness` direct content-model checks to the
  compatibility `SessionPlannerViewModel`;
- port `SessionPlannerControlsView`, `SessionPlannerTimelineMainView`,
  `SessionPlannerStateView`, and `SessionPlannerBinder` construction references
  to the view-model/callback boundary where required;
- keep `SessionPlannerIntentHandler`, the old content models, the old input
  event records, the split application services, and the old use cases until
  M3.5 executes the deletion list.

`SessionPlannerShellLayoutHarness` imports only the contribution and retained
public view classes. It is expected to need no harness scenario change. Its
Hex shell-layout regression section is unrelated to Session Planner migration
and must remain untouched except for mechanical imports if required.

## Metric Targets And Exceptions

| Metric | Target for implementation | Design exception |
| --- | --- | --- |
| LOC | Product subset falls from 6,664 physical LOC to 3,998 or less. | Full-set LOC reduction is a data-layer exception because `src/data/sessionplanner/**` is ledger-excluded unless a gateway signature adaptation becomes necessary. No product LOC exception is accepted by this design; any miss requires a later reviewed amendment with class-by-class rationale. |
| File count | Product subset should fall from 103 Java files to 55 or fewer after deleting the 57 listed files and adding only `SessionPlannerPublishedState`, `SessionPlannerProjection`, `SessionPlannerForeignFacts`, `SessionPlannerViewModel`, and `SessionPlannerVocabulary`. | More files require a design amendment before implementation. |
| Forwarding-only classes | Zero product behavior-forwarding classes: the root service owns route logic, published models own state/listeners via `PublishedState`, and the split service/usecase/repository/publication/content/input/intent-handler stack is deleted. | `SessionPlannerServiceContribution` and `SessionPlannerServiceAssembly` remain service-registry composition seams like the pilot reference, but must not add behavior-forwarding hops. Data-layer contribution/repository wrappers remain outside the product migration surface. |
| Intent-to-mutation chain | Session Planner-owned mutations use at most 3 meaningful class-boundary hops to first `SessionPlan` or repository mutation. | World Planner location existence, Party active-member readback, and Encounter budget/list readback are foreign read seams and are not counted as Session Planner mutation hops. |
| String round-trips | Zero non-seam internal Session Planner String round-trips: service internals, projections, view model, and domain state use typed values or numeric ids. | Shared catalog controls still carry item ids as Strings; Session Planner conversion must stay centralized in `SessionPlannerVocabulary`. Encounter-days text input is user-entered visible text and must be parsed once at the view edge. Persistence enum/name storage remains a data-layer serialization concern. Rest-kind `.name()` conversion and String switching inside Session Planner product code must be removed. |

The exceptions are individually justified by existing consumer seams, not by
preference. The conformance review must reject any additional unexplained
metric miss, and it must reject any apparent metric hit achieved through code
compression, comment deletion, cosmetic renaming, or duplicated helper
rephrasing.

### M3.5 LOC Exception Amendment
The implemented M3.5 product subset lands at 51 Java files and 5,170 physical
LOC. Phase 1 and Phase 2 must explicitly accept or reject the bounded 5,200
LOC cap and review conditions in
`docs/project/architecture/architecture-migration-sessionplanner-loc-exception.md`;
no other target, seam, deletion-list, `PublishedState`, or harness-freeze rule
is relaxed.

## Untouched Surfaces

- `src/data/sessionplanner/**` persistence, schema, mapper, gateway, and
  repository semantics stay unchanged.
- `src/domain/party/**`, `src/domain/encounter/**`,
  `src/domain/worldplanner/**`, `src/domain/creatures/**`, future Loot code,
  and their harnesses stay unchanged; Session Planner consumes their current
  public seams.
- `src/view/slotcontent/controls/catalogcrud/**` stays unchanged as the shared
  catalog CRUD control seam.
- Shell workspace/sidebar behavior stays unchanged: same contribution id,
  title, group, order, icon path, runtime mode, cockpit slots, scroll behavior,
  sidebar order, separators, and navigation fallback behavior.
- `src/domain/sessionplanner/published/**` record and enum semantics stay
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
