package src.domain.sessionplanner;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;
import shell.api.ServiceRegistry;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayPlanningSummary;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;
import src.domain.sessionplanner.model.session.model.SessionAdventuringDayBudgetFact;
import src.domain.sessionplanner.model.session.model.SessionActivePartyMembersFact;
import src.domain.sessionplanner.model.session.model.SessionEncounter;
import src.domain.sessionplanner.model.session.model.SessionEncounterPlanListFact;
import src.domain.sessionplanner.model.session.model.SessionEncounterPlanFact;
import src.domain.sessionplanner.model.session.model.SessionPartyMemberProfile;
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.model.SessionRestPlacement;
import src.domain.sessionplanner.model.session.model.SessionSavedEncounterPlanFact;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;

@SuppressWarnings("PMD.CouplingBetweenObjects")
final class SessionPlannerServiceAssembly {

    private final ApplicationServicesServiceAssembly applicationServices;
    private final PublishedStateServiceAssembly publishedState;

    SessionPlannerServiceAssembly(SessionPlanRepository repository) {
        SessionPlanRepository requiredRepository = Objects.requireNonNull(repository, "repository");
        this.publishedState = new PublishedStateServiceAssembly(requiredRepository);
        this.applicationServices = new ApplicationServicesServiceAssembly(requiredRepository, publishedState);
    }

    void register(ServiceRegistry.Builder builder) {
        builder.registerFactory(
                SessionPlannerApplicationService.class,
                applicationServices::createSessionPlanner);
        builder.registerFactory(
                SessionPlannerParticipantApplicationService.class,
                applicationServices::createParticipants);
        builder.registerFactory(
                SessionPlannerEncounterApplicationService.class,
                applicationServices::createEncounters);
        builder.registerFactory(
                SessionPlannerRestApplicationService.class,
                applicationServices::createRests);
        builder.registerFactory(
                SessionPlannerLootApplicationService.class,
                applicationServices::createLoot);
        builder.registerFactory(
                SessionPlannerCurrentSessionModel.class,
                publishedState::currentSessionModel);
        builder.registerFactory(
                SessionPlannerParticipantsModel.class,
                publishedState::participantsModel);
        builder.registerFactory(
                SessionPlannerEncountersModel.class,
                publishedState::encountersModel);
        builder.registerFactory(
                SessionPlannerStatePanelModel.class,
                publishedState::statePanelModel);
    }

    SessionPlannerApplicationService createSessionPlanner(ServiceRegistry services) {
        return applicationServices.createSessionPlanner(services);
    }

    SessionPlannerParticipantApplicationService createParticipants(ServiceRegistry services) {
        return applicationServices.createParticipants(services);
    }

    SessionPlannerEncounterApplicationService createEncounters(ServiceRegistry services) {
        return applicationServices.createEncounters(services);
    }

    SessionPlannerRestApplicationService createRests(ServiceRegistry services) {
        return applicationServices.createRests(services);
    }

    SessionPlannerLootApplicationService createLoot(ServiceRegistry services) {
        return applicationServices.createLoot(services);
    }

    SessionPlannerCurrentSessionModel currentSessionModel(ServiceRegistry services) {
        return publishedState.currentSessionModel(services);
    }

    SessionPlannerParticipantsModel participantsModel(ServiceRegistry services) {
        return publishedState.participantsModel(services);
    }

    SessionPlannerEncountersModel encountersModel(ServiceRegistry services) {
        return publishedState.encountersModel(services);
    }

    SessionPlannerStatePanelModel statePanelModel(ServiceRegistry services) {
        return publishedState.statePanelModel(services);
    }

    private static final class ApplicationServicesServiceAssembly {

        private final SessionPlanRepository repository;
        private final PublishedStateServiceAssembly publishedState;
        private final AtomicReference<UseCaseRuntime> runtime = new AtomicReference<>();

        private ApplicationServicesServiceAssembly(
                SessionPlanRepository repository,
                PublishedStateServiceAssembly publishedState
        ) {
            this.repository = repository;
            this.publishedState = publishedState;
        }

        private SessionPlannerApplicationService createSessionPlanner(ServiceRegistry services) {
            UseCaseRuntime runtime = runtime(services);
            return new SessionPlannerApplicationService(
                    new src.domain.sessionplanner.model.session.usecase.CreateSessionPlanUseCase(
                            runtime.repository,
                            runtime.saveCurrentSessionPlanUseCase,
                            runtime.seedSessionPlanUseCase));
        }

        private SessionPlannerParticipantApplicationService createParticipants(ServiceRegistry services) {
            UseCaseRuntime runtime = runtime(services);
            return new SessionPlannerParticipantApplicationService(
                    new src.domain.sessionplanner.model.session.usecase.AddSessionParticipantUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase),
                    new src.domain.sessionplanner.model.session.usecase.RemoveSessionParticipantUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase));
        }

        private SessionPlannerEncounterApplicationService createEncounters(ServiceRegistry services) {
            UseCaseRuntime runtime = runtime(services);
            return new SessionPlannerEncounterApplicationService(
                    new src.domain.sessionplanner.model.session.usecase.SetSessionEncounterDaysUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase),
                    new src.domain.sessionplanner.model.session.usecase.AttachSessionEncounterUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase),
                    new src.domain.sessionplanner.model.session.usecase.RemoveSessionEncounterUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase),
                    new src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterUpUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase),
                    new src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterDownUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase),
                    new src.domain.sessionplanner.model.session.usecase.SetSessionEncounterAllocationUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase),
                    new src.domain.sessionplanner.model.session.usecase.SelectSessionEncounterUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase));
        }

        private SessionPlannerRestApplicationService createRests(ServiceRegistry services) {
            UseCaseRuntime runtime = runtime(services);
            return new SessionPlannerRestApplicationService(
                    new src.domain.sessionplanner.model.session.usecase.SetSessionRestGapUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase),
                    new src.domain.sessionplanner.model.session.usecase.ClearSessionRestGapUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase));
        }

        private SessionPlannerLootApplicationService createLoot(ServiceRegistry services) {
            UseCaseRuntime runtime = runtime(services);
            return new SessionPlannerLootApplicationService(
                    new src.domain.sessionplanner.model.session.usecase.AddSessionLootPlaceholderUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase),
                    new src.domain.sessionplanner.model.session.usecase.RemoveSessionLootPlaceholderUseCase(
                            runtime.loadCurrentSessionPlanUseCase,
                            runtime.saveCurrentSessionPlanUseCase));
        }

        private UseCaseRuntime runtime(ServiceRegistry services) {
            UseCaseRuntime existing = runtime.get();
            if (existing != null) {
                return existing;
            }
            UseCaseRuntime candidate = runtimeCandidate(services);
            return runtime.compareAndSet(null, candidate)
                    ? candidate
                    : Objects.requireNonNull(runtime.get(), "runtime");
        }

        private UseCaseRuntime runtimeCandidate(ServiceRegistry services) {
            SessionPartyFactsPort partyFacts = new PartyFactsReadback(
                    services.require(ActivePartyModel.class),
                    services.require(AdventuringDayCalculationModel.class));
            src.domain.sessionplanner.model.session.usecase.SeedSessionPlanUseCase seedSessionPlanUseCase =
                    new src.domain.sessionplanner.model.session.usecase.SeedSessionPlanUseCase(partyFacts);
            src.domain.sessionplanner.model.session.usecase.LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase =
                    new src.domain.sessionplanner.model.session.usecase.LoadCurrentSessionPlanUseCase(
                    repository,
                    seedSessionPlanUseCase);
            src.domain.sessionplanner.model.session.usecase.SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase =
                    new src.domain.sessionplanner.model.session.usecase.SaveCurrentSessionPlanUseCase(
                    repository,
                    publishedState.create(services));
            return new UseCaseRuntime(
                    repository,
                    loadCurrentSessionPlanUseCase,
                    saveCurrentSessionPlanUseCase,
                    seedSessionPlanUseCase);
        }
    }

    private static final class PublishedStateServiceAssembly {

        private final SessionPlanRepository repository;
        private final AtomicReference<PublishedState> publishedState =
                new AtomicReference<>();

        private PublishedStateServiceAssembly(SessionPlanRepository repository) {
            this.repository = repository;
        }

        private PublishedState create(ServiceRegistry services) {
            PublishedState existing = publishedState.get();
            if (existing != null) {
                return existing;
            }
            PublishedState candidate = createCandidate(services);
            return publishedState.compareAndSet(null, candidate)
                    ? candidate
                    : Objects.requireNonNull(publishedState.get(), "publishedState");
        }

        private PublishedState createCandidate(ServiceRegistry services) {
            ServiceRegistry registry = Objects.requireNonNull(services, "services");
            SessionPartyFactsPort partyFacts = new PartyFactsReadback(
                    registry.require(ActivePartyModel.class),
                    registry.require(AdventuringDayCalculationModel.class));
            SessionEncounterFactsPort encounterFacts = new EncounterFactsReadback(
                    registry.require(SavedEncounterPlanListModel.class),
                    registry.require(EncounterPlanBudgetModel.class));
            return new PublishedState(
                    repository,
                    partyFacts,
                    new PartyFactsInvoker(
                            registry.require(PartyApplicationService.class),
                            partyFacts),
                    encounterFacts,
                    new EncounterFactsInvoker(
                            registry.require(EncounterApplicationService.class),
                            encounterFacts));
        }

        private SessionPlannerCurrentSessionModel currentSessionModel(ServiceRegistry services) {
            return create(services).currentSessionModel();
        }

        private SessionPlannerParticipantsModel participantsModel(ServiceRegistry services) {
            return create(services).participantsModel();
        }

        private SessionPlannerEncountersModel encountersModel(ServiceRegistry services) {
            return create(services).encountersModel();
        }

        private SessionPlannerStatePanelModel statePanelModel(ServiceRegistry services) {
            return create(services).statePanelModel();
        }
    }

    private static final class UseCaseRuntime {

        private final SessionPlanRepository repository;
        private final src.domain.sessionplanner.model.session.usecase.LoadCurrentSessionPlanUseCase
                loadCurrentSessionPlanUseCase;
        private final src.domain.sessionplanner.model.session.usecase.SaveCurrentSessionPlanUseCase
                saveCurrentSessionPlanUseCase;
        private final src.domain.sessionplanner.model.session.usecase.SeedSessionPlanUseCase seedSessionPlanUseCase;

        private UseCaseRuntime(
                SessionPlanRepository repository,
                src.domain.sessionplanner.model.session.usecase.LoadCurrentSessionPlanUseCase
                        loadCurrentSessionPlanUseCase,
                src.domain.sessionplanner.model.session.usecase.SaveCurrentSessionPlanUseCase
                        saveCurrentSessionPlanUseCase,
                src.domain.sessionplanner.model.session.usecase.SeedSessionPlanUseCase seedSessionPlanUseCase
        ) {
            this.repository = repository;
            this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
            this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
            this.seedSessionPlanUseCase = seedSessionPlanUseCase;
        }
    }

    private static final class PartyFactsReadback implements SessionPartyFactsPort {

        private SessionActivePartyMembersFact currentActivePartyMembers;
        private SessionAdventuringDayBudgetFact currentAdventuringDayFact;

        private PartyFactsReadback(
                ActivePartyModel activePartyModel,
                AdventuringDayCalculationModel adventuringDayCalculationModel
        ) {
            ActivePartyModel activeParty = Objects.requireNonNull(activePartyModel, "activePartyModel");
            AdventuringDayCalculationModel adventuringDay =
                    Objects.requireNonNull(adventuringDayCalculationModel, "adventuringDayCalculationModel");
            this.currentActivePartyMembers = toActivePartyMembersFact(activeParty.current());
            this.currentAdventuringDayFact = toAdventuringDayFact(adventuringDay.current());
            activeParty.subscribe(result -> currentActivePartyMembers = toActivePartyMembersFact(result));
            adventuringDay.subscribe(result -> currentAdventuringDayFact = toAdventuringDayFact(result));
        }

        @Override
        public SessionActivePartyMembersFact activePartyMembers() {
            return currentActivePartyMembers;
        }

        @Override
        public SessionAdventuringDayBudgetFact adventuringDayFact() {
            return currentAdventuringDayFact;
        }

        private static SessionActivePartyMembersFact toActivePartyMembersFact(ActivePartyResult result) {
            if (result == null || result.status() != ReadStatus.SUCCESS) {
                return new SessionActivePartyMembersFact(
                        false,
                        List.of(),
                        "Aktive Party konnte nicht geladen werden.");
            }
            return new SessionActivePartyMembersFact(
                    true,
                    result.members().stream().map(PartyFactsReadback::toPartyMemberFact).toList(),
                    "");
        }

        private static SessionAdventuringDayBudgetFact toAdventuringDayFact(
                AdventuringDayCalculationResult result
        ) {
            AdventuringDayPlanningSummary summary = result == null ? null : result.planningSummary();
            if (result == null || result.status() != ReadStatus.SUCCESS || summary == null) {
                return SessionAdventuringDayBudgetFact.unavailable();
            }
            return new SessionAdventuringDayBudgetFact(
                    true,
                    summary.totalBudgetXp(),
                    summary.firstShortRestXp(),
                    summary.secondShortRestXp(),
                    summary.recommendedShortRests(),
                    summary.recommendedLongRests());
        }

        private static SessionPartyMemberProfile toPartyMemberFact(PartyMemberSummary member) {
            return new SessionPartyMemberProfile(
                    member == null || member.id() == null ? 0L : member.id(),
                    member == null ? "" : member.name(),
                    member == null ? 0 : member.level());
        }
    }

    private static final class EncounterFactsReadback implements SessionEncounterFactsPort {

        private SessionEncounterPlanListFact currentEncounterPlans;
        private EncounterPlanBudgetResult currentPlanBudget;

        private EncounterFactsReadback(
                SavedEncounterPlanListModel savedPlansModel,
                EncounterPlanBudgetModel planBudgetModel
        ) {
            SavedEncounterPlanListModel savedPlans =
                    Objects.requireNonNull(savedPlansModel, "savedPlansModel");
            EncounterPlanBudgetModel planBudget =
                    Objects.requireNonNull(planBudgetModel, "planBudgetModel");
            this.currentEncounterPlans = toEncounterPlanListFact(savedPlans.current());
            this.currentPlanBudget = planBudget.current();
            savedPlans.subscribe(result -> currentEncounterPlans = toEncounterPlanListFact(result));
            planBudget.subscribe(result -> currentPlanBudget = result);
        }

        @Override
        public SessionEncounterPlanListFact encounterPlans() {
            return currentEncounterPlans;
        }

        @Override
        public SessionEncounterPlanFact encounterPlan(long encounterPlanId) {
            EncounterPlanBudgetResult result = currentPlanBudget;
            if (result == null || result.status() != EncounterPlanBudgetStatus.SUCCESS || result.summary() == null) {
                String message = result == null || result.message().isBlank()
                        ? "Encounter-Plan konnte nicht geladen werden."
                        : result.message();
                return SessionEncounterPlanFact.unavailable(encounterPlanId, message);
            }
            EncounterPlanBudgetSummary summary = result.summary();
            return new SessionEncounterPlanFact(
                    true,
                    summary.planId(),
                    summary.name(),
                    summary.generatedLabel(),
                    summary.creatureCount(),
                    summary.totalBaseXp(),
                    summary.adjustedXp(),
                    summary.xpMultiplier(),
                    summary.difficultyLabel(),
                    "Adj. XP " + summary.adjustedXp() + " · " + summary.difficultyLabel());
        }

        private static SessionEncounterPlanListFact toEncounterPlanListFact(SavedEncounterPlanListResult result) {
            if (result == null || result.status() != SavedEncounterPlanStatus.SUCCESS) {
                return new SessionEncounterPlanListFact(
                        false,
                        List.of(),
                        result == null ? "" : result.message());
            }
            return new SessionEncounterPlanListFact(
                    true,
                    result.plans().stream().map(EncounterFactsReadback::toSavedEncounterPlanFact).toList(),
                    "");
        }

        private static SessionSavedEncounterPlanFact toSavedEncounterPlanFact(SavedEncounterPlanSummary plan) {
            return new SessionSavedEncounterPlanFact(
                    plan == null ? 0L : plan.planId(),
                    plan == null ? "" : plan.name(),
                    plan == null ? "" : plan.summaryText());
        }
    }

    private static final class PartyFactsInvoker implements SessionPartyFactsRepository {

        private final PartyApplicationService party;
        private final SessionPartyFactsPort partyFacts;

        private PartyFactsInvoker(
                PartyApplicationService party,
                SessionPartyFactsPort partyFacts
        ) {
            this.party = Objects.requireNonNull(party, "party");
            this.partyFacts = Objects.requireNonNull(partyFacts, "partyFacts");
        }

        @Override
        public SessionAdventuringDayBudgetFact calculateAdventuringDay(
                List<Integer> levels,
                int plannedEncounterXp
        ) {
            party.calculateAdventuringDay(new CalculateAdventuringDayCommand(levels, plannedEncounterXp));
            return partyFacts.adventuringDayFact();
        }
    }

    private static final class EncounterFactsInvoker implements SessionEncounterFactsRepository {

        private final EncounterApplicationService encounters;
        private final SessionEncounterFactsPort encounterFacts;

        private EncounterFactsInvoker(
                EncounterApplicationService encounters,
                SessionEncounterFactsPort encounterFacts
        ) {
            this.encounters = Objects.requireNonNull(encounters, "encounters");
            this.encounterFacts = Objects.requireNonNull(encounterFacts, "encounterFacts");
        }

        @Override
        public SessionEncounterPlanFact loadEncounterPlan(long encounterPlanId) {
            encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(encounterPlanId));
            return encounterFacts.encounterPlan(encounterPlanId);
        }
    }

    @SuppressWarnings({
            "PMD.CouplingBetweenObjects",
            "PMD.TooManyMethods"
    })
    private static final class PublishedState implements SessionPlannerPublishedStateRepository {

        private static final String LISTENER_PARAMETER = "listener";

        private final SessionPlanRepository repository;
        private final SessionPartyFactsPort partyFactsPort;
        private final SessionPartyFactsRepository partyFactsRepository;
        private final SessionEncounterFactsPort encounterFactsPort;
        private final SessionEncounterFactsRepository encounterFactsRepository;
        private final PublicationMapper publication = new PublicationMapper();
        private final List<Consumer<SessionPlannerSessionSnapshot>> sessionListeners = new ArrayList<>();
        private final List<Consumer<SessionPlannerParticipantsProjection>> participantsListeners = new ArrayList<>();
        private final List<Consumer<SessionPlannerEncountersProjection>> encountersListeners = new ArrayList<>();
        private final List<Consumer<SessionPlannerStatePanelProjection>> statePanelListeners = new ArrayList<>();
        private final SessionPlannerCurrentSessionModel currentSessionModel = new SessionPlannerCurrentSessionModel(
                this::currentSessionSnapshot,
                this::subscribeSessionListener);
        private final SessionPlannerParticipantsModel participantsModel = new SessionPlannerParticipantsModel(
                this::currentParticipantsProjection,
                this::subscribeParticipantsListener);
        private final SessionPlannerEncountersModel encountersModel = new SessionPlannerEncountersModel(
                this::currentEncountersProjection,
                this::subscribeEncountersListener);
        private final SessionPlannerStatePanelModel statePanelModel = new SessionPlannerStatePanelModel(
                this::currentStatePanelProjection,
                this::subscribeStatePanelListener);
        private @Nullable SessionPlannerSessionSnapshot currentSessionSnapshot;
        private @Nullable SessionPlannerParticipantsProjection currentParticipantsProjection;
        private @Nullable SessionPlannerEncountersProjection currentEncountersProjection;
        private @Nullable SessionPlannerStatePanelProjection currentStatePanelProjection;

        private PublishedState(
                SessionPlanRepository repository,
                SessionPartyFactsPort partyFacts,
                SessionPartyFactsRepository partyFactsRepository,
                SessionEncounterFactsPort encounterFacts,
                SessionEncounterFactsRepository encounterFactsRepository
        ) {
            this.repository = Objects.requireNonNull(repository, "repository");
            this.partyFactsPort = Objects.requireNonNull(partyFacts, "partyFacts");
            this.partyFactsRepository = Objects.requireNonNull(partyFactsRepository, "partyFactsRepository");
            this.encounterFactsPort = Objects.requireNonNull(encounterFacts, "encounterFacts");
            this.encounterFactsRepository = Objects.requireNonNull(encounterFactsRepository, "encounterFactsRepository");
        }

        @Override
        public void publishCurrentSession(SessionPlan sessionPlan) {
            SessionPlan safeSession = Objects.requireNonNull(sessionPlan, "sessionPlan");
            currentSessionSnapshot = publication.projectSession(
                    safeSession,
                    partyFactsPort,
                    partyFactsRepository,
                    encounterFactsPort,
                    encounterFactsRepository);
            currentParticipantsProjection = publication.projectParticipants(safeSession, partyFactsPort);
            currentEncountersProjection = publication.projectEncounters(
                    safeSession,
                    partyFactsPort,
                    partyFactsRepository,
                    encounterFactsPort,
                    encounterFactsRepository);
            currentStatePanelProjection = publication.projectStatePanel(
                    safeSession,
                    partyFactsPort,
                    partyFactsRepository,
                    encounterFactsPort,
                    encounterFactsRepository);
            notifySessionListeners(currentSessionSnapshot);
            notifyParticipantsListeners(currentParticipantsProjection);
            notifyEncountersListeners(currentEncountersProjection);
            notifyStatePanelListeners(currentStatePanelProjection);
        }

        private SessionPlannerCurrentSessionModel currentSessionModel() {
            return currentSessionModel;
        }

        private SessionPlannerParticipantsModel participantsModel() {
            return participantsModel;
        }

        private SessionPlannerEncountersModel encountersModel() {
            return encountersModel;
        }

        private SessionPlannerStatePanelModel statePanelModel() {
            return statePanelModel;
        }

        private SessionPlannerSessionSnapshot currentSessionSnapshot() {
            loadPublishedState();
            return Objects.requireNonNull(currentSessionSnapshot, "currentSessionSnapshot");
        }

        private SessionPlannerParticipantsProjection currentParticipantsProjection() {
            loadPublishedState();
            return Objects.requireNonNull(currentParticipantsProjection, "currentParticipantsProjection");
        }

        private SessionPlannerEncountersProjection currentEncountersProjection() {
            loadPublishedState();
            return Objects.requireNonNull(currentEncountersProjection, "currentEncountersProjection");
        }

        private SessionPlannerStatePanelProjection currentStatePanelProjection() {
            loadPublishedState();
            return Objects.requireNonNull(currentStatePanelProjection, "currentStatePanelProjection");
        }

        private void loadPublishedState() {
            if (currentSessionSnapshot != null
                    && currentParticipantsProjection != null
                    && currentEncountersProjection != null
                    && currentStatePanelProjection != null) {
                return;
            }
            Optional<SessionPlan> currentSession = repository.loadCurrent();
            if (currentSession.isEmpty()) {
                currentSessionSnapshot = SessionPlannerSessionSnapshot.empty("Session ist noch nicht geladen.");
                currentParticipantsProjection = SessionPlannerParticipantsProjection.empty();
                currentEncountersProjection = SessionPlannerEncountersProjection.empty();
                currentStatePanelProjection = SessionPlannerStatePanelProjection.empty();
                return;
            }
            publishCurrentSession(currentSession.get());
        }

        private Runnable subscribeSessionListener(Consumer<SessionPlannerSessionSnapshot> listener) {
            Consumer<SessionPlannerSessionSnapshot> safeListener =
                    Objects.requireNonNull(listener, LISTENER_PARAMETER);
            sessionListeners.add(safeListener);
            return () -> sessionListeners.remove(safeListener);
        }

        private Runnable subscribeParticipantsListener(Consumer<SessionPlannerParticipantsProjection> listener) {
            Consumer<SessionPlannerParticipantsProjection> safeListener =
                    Objects.requireNonNull(listener, LISTENER_PARAMETER);
            participantsListeners.add(safeListener);
            return () -> participantsListeners.remove(safeListener);
        }

        private Runnable subscribeEncountersListener(Consumer<SessionPlannerEncountersProjection> listener) {
            Consumer<SessionPlannerEncountersProjection> safeListener =
                    Objects.requireNonNull(listener, LISTENER_PARAMETER);
            encountersListeners.add(safeListener);
            return () -> encountersListeners.remove(safeListener);
        }

        private Runnable subscribeStatePanelListener(Consumer<SessionPlannerStatePanelProjection> listener) {
            Consumer<SessionPlannerStatePanelProjection> safeListener =
                    Objects.requireNonNull(listener, LISTENER_PARAMETER);
            statePanelListeners.add(safeListener);
            return () -> statePanelListeners.remove(safeListener);
        }

        private void notifySessionListeners(SessionPlannerSessionSnapshot snapshot) {
            for (Consumer<SessionPlannerSessionSnapshot> listener : List.copyOf(sessionListeners)) {
                listener.accept(snapshot);
            }
        }

        private void notifyParticipantsListeners(SessionPlannerParticipantsProjection projection) {
            for (Consumer<SessionPlannerParticipantsProjection> listener : List.copyOf(participantsListeners)) {
                listener.accept(projection);
            }
        }

        private void notifyEncountersListeners(SessionPlannerEncountersProjection projection) {
            for (Consumer<SessionPlannerEncountersProjection> listener : List.copyOf(encountersListeners)) {
                listener.accept(projection);
            }
        }

        private void notifyStatePanelListeners(SessionPlannerStatePanelProjection projection) {
            for (Consumer<SessionPlannerStatePanelProjection> listener : List.copyOf(statePanelListeners)) {
                listener.accept(projection);
            }
        }
    }

    @SuppressWarnings({
            "PMD.CouplingBetweenObjects",
            "PMD.GodClass",
            "PMD.TooManyMethods"
    })
    private static final class PublicationMapper {

        private static final BigDecimal HUNDRED = new BigDecimal("100");

        private SessionPlannerSessionSnapshot projectSession(
                SessionPlan session,
                SessionPartyFactsPort partyFacts,
                SessionPartyFactsRepository partyFactsRepository,
                SessionEncounterFactsPort encounterFacts,
                SessionEncounterFactsRepository encounterFactsRepository
        ) {
            ProjectionContext context = buildContext(
                    session,
                    partyFacts,
                    partyFactsRepository,
                    encounterFactsRepository);
            SessionEncounterPlanListFact encounterPlansFact = encounterFacts.encounterPlans();
            List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> availablePlans =
                    buildAvailablePlans(encounterPlansFact, context.loadedEncounters(), encounterFactsRepository);
            return new SessionPlannerSessionSnapshot(
                    new SessionPlannerSessionSnapshot.SessionState(
                            session.sessionId(),
                            session.encounterDays().value(),
                            session.encounterDays().displayText(),
                            session.selectedEncounterId(),
                            session.selectedEncounterId() > 0L),
                    buildXpBudgetState(session, context.budgetFact(), context.scaledBudgetXp(), context.loadedEncounters()),
                    buildRestAdviceState(
                            context.budgetFact(),
                            countShortRests(session.restPlacements()),
                            countLongRests(session.restPlacements())),
                    SessionPlannerSessionSnapshot.GoldBudgetState.placeholder(session.lootPlaceholders().size()),
                    availablePlans,
                    resolveStatus(context.participants(), context.partyMembersFact(), encounterPlansFact, session.statusText()));
        }

        private SessionPlannerParticipantsProjection projectParticipants(
                SessionPlan session,
                SessionPartyFactsPort partyFacts
        ) {
            ProjectionContext context = buildParticipantContext(session, partyFacts);
            return new SessionPlannerParticipantsProjection(
                    buildPartyState(session, context.resolvedLevels(), context.participants(), context.partyMembersFact()),
                    buildActivePartyMembers(context.partyMembersFact().members()),
                    context.participants());
        }

        private SessionPlannerEncountersProjection projectEncounters(
                SessionPlan session,
                SessionPartyFactsPort partyFacts,
                SessionPartyFactsRepository partyFactsRepository,
                SessionEncounterFactsPort encounterFacts,
                SessionEncounterFactsRepository encounterFactsRepository
        ) {
            ProjectionContext context = buildContext(
                    session,
                    partyFacts,
                    partyFactsRepository,
                    encounterFactsRepository);
            return new SessionPlannerEncountersProjection(
                    buildPlannedEncounters(
                            session,
                            context.scaledBudgetXp(),
                            context.loadedEncounters(),
                            encounterFactsRepository),
                    buildRestGaps(session),
                    session.lootPlaceholders().stream()
                            .map(loot -> new SessionPlannerEncountersProjection.LootPlaceholder(
                                    loot.lootId(),
                                    loot.label()))
                            .toList());
        }

        private SessionPlannerStatePanelProjection projectStatePanel(
                SessionPlan session,
                SessionPartyFactsPort partyFacts,
                SessionPartyFactsRepository partyFactsRepository,
                SessionEncounterFactsPort encounterFacts,
                SessionEncounterFactsRepository encounterFactsRepository
        ) {
            ProjectionContext context = buildContext(
                    session,
                    partyFacts,
                    partyFactsRepository,
                    encounterFactsRepository);
            SessionPlannerSessionSnapshot sessionSnapshot = projectSession(
                    session,
                    partyFacts,
                    partyFactsRepository,
                    encounterFacts,
                    encounterFactsRepository);
            return buildStatePanel(
                    sessionSnapshot,
                    buildPlannedEncounters(
                            session,
                            context.scaledBudgetXp(),
                            context.loadedEncounters(),
                            encounterFactsRepository));
        }

        private static ProjectionContext buildContext(
                SessionPlan session,
                SessionPartyFactsPort partyFacts,
                SessionPartyFactsRepository partyFactsRepository,
                SessionEncounterFactsRepository encounterFactsRepository
        ) {
            ProjectionContext participantContext = buildParticipantContext(session, partyFacts);
            boolean sessionReady = !participantContext.participants().isEmpty()
                    && participantContext.participants().stream()
                    .allMatch(SessionPlannerParticipantsProjection.SessionParticipant::available);
            Map<Long, SessionEncounterPlanFact> loadedEncounters =
                    loadSessionEncounterFacts(session, encounterFactsRepository);
            SessionAdventuringDayBudgetFact budgetFact = sessionReady
                    ? partyFactsRepository.calculateAdventuringDay(
                            participantContext.resolvedLevels(),
                            plannedEncounterXp(session, loadedEncounters))
                    : SessionAdventuringDayBudgetFact.unavailable();
            int scaledBudgetXp = budgetFact.available() ? session.encounterDays().scaleBudget(budgetFact.totalBudgetXp()) : 0;
            return new ProjectionContext(
                    participantContext.partyMembersFact(),
                    participantContext.participants(),
                    participantContext.resolvedLevels(),
                    loadedEncounters,
                    budgetFact,
                    scaledBudgetXp);
        }

        private static ProjectionContext buildParticipantContext(
                SessionPlan session,
                SessionPartyFactsPort partyFacts
        ) {
            SessionActivePartyMembersFact partyMembersFact = partyFacts.activePartyMembers();
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants =
                    buildParticipants(session, partyMembersFact);
            List<Integer> resolvedLevels = participants.stream()
                    .filter(SessionPlannerParticipantsProjection.SessionParticipant::available)
                    .map(SessionPlannerParticipantsProjection.SessionParticipant::level)
                    .toList();
            return new ProjectionContext(
                    partyMembersFact,
                    participants,
                    resolvedLevels,
                    new HashMap<>(),
                    SessionAdventuringDayBudgetFact.unavailable(),
                    0);
        }

        private static SessionPlannerParticipantsProjection.PartyState buildPartyState(
                SessionPlan session,
                List<Integer> resolvedLevels,
                List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
                SessionActivePartyMembersFact partyMembersFact
        ) {
            int sessionSize = session.participantRefs().size();
            int averageLevel = resolvedLevels.isEmpty()
                    ? 0
                    : (int) Math.round(resolvedLevels.stream().mapToInt(Integer::intValue).average().orElse(0.0));
            String headline = sessionSize <= 0
                    ? "Keine Session-Teilnehmer"
                    : sessionSize + " Session-Teilnehmer";
            String detail;
            if (sessionSize <= 0) {
                detail = "Session hat noch keine Teilnehmer.";
            } else if (!partyMembersFact.available()) {
                detail = partyMembersFact.statusText().isBlank()
                        ? "Aktive Party ist derzeit nicht lesbar."
                        : partyMembersFact.statusText();
            } else {
                long missing = participants.stream().filter(participant -> !participant.available()).count();
                if (missing > 0) {
                    detail = resolvedLevels.size() + " aufgeloest · " + missing + " fehlend";
                } else {
                    detail = "Durchschnittsstufe " + averageLevel + " · Level " + joinLevels(resolvedLevels);
                }
            }
            return new SessionPlannerParticipantsProjection.PartyState(
                    resolvedLevels,
                    sessionSize,
                    averageLevel,
                    sessionSize > 0
                            && participants.stream()
                            .allMatch(SessionPlannerParticipantsProjection.SessionParticipant::available),
                    headline,
                    detail);
        }

        private static SessionPlannerSessionSnapshot.XpBudgetState buildXpBudgetState(
                SessionPlan session,
                SessionAdventuringDayBudgetFact budgetFact,
                int scaledBudgetXp,
                Map<Long, SessionEncounterPlanFact> loadedEncounters
        ) {
            if (!budgetFact.available()) {
                return SessionPlannerSessionSnapshot.XpBudgetState.empty();
            }
            int plannedXp = plannedEncounterXp(session, loadedEncounters);
            int remainingXp = Math.max(0, scaledBudgetXp - plannedXp);
            int overBudgetXp = Math.max(0, plannedXp - scaledBudgetXp);
            boolean overBudget = overBudgetXp > 0;
            return new SessionPlannerSessionSnapshot.XpBudgetState(
                    true,
                    scaledBudgetXp,
                    plannedXp,
                    remainingXp,
                    overBudgetXp,
                    session.encounterDays().scaleBudget(budgetFact.firstShortRestXp()),
                    session.encounterDays().scaleBudget(budgetFact.secondShortRestXp()),
                    scaledBudgetXp <= 0 ? 0.0 : plannedXp / (double) scaledBudgetXp,
                    overBudget,
                    overBudget ? overBudgetXp + " XP ueber Budget" : remainingXp + " XP verbleibend");
        }

        private static SessionPlannerSessionSnapshot.RestAdviceState buildRestAdviceState(
                SessionAdventuringDayBudgetFact budgetFact,
                int placedShortRests,
                int placedLongRests
        ) {
            if (!budgetFact.available()) {
                return SessionPlannerSessionSnapshot.RestAdviceState.empty();
            }
            return new SessionPlannerSessionSnapshot.RestAdviceState(
                    true,
                    budgetFact.recommendedShortRests(),
                    budgetFact.recommendedLongRests(),
                    placedShortRests,
                    placedLongRests,
                    "Empfohlen " + budgetFact.recommendedShortRests() + " SR / " + budgetFact.recommendedLongRests()
                            + " LR · platziert " + placedShortRests + " SR / " + placedLongRests + " LR");
        }

        private static List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> buildAvailablePlans(
                SessionEncounterPlanListFact encounterPlansFact,
                Map<Long, SessionEncounterPlanFact> loadedEncounters,
                SessionEncounterFactsRepository encounterFactsRepository
        ) {
            if (!encounterPlansFact.available()) {
                return List.of();
            }
            List<SessionPlannerSessionSnapshot.AvailableEncounterPlan> availablePlans = new ArrayList<>();
            for (SessionSavedEncounterPlanFact plan : encounterPlansFact.plans()) {
                SessionEncounterPlanFact detail =
                        encounterFactsRepository.loadEncounterPlan(plan.planId());
                loadedEncounters.put(plan.planId(), detail);
                availablePlans.add(new SessionPlannerSessionSnapshot.AvailableEncounterPlan(
                        plan.planId(),
                        detail.name().isBlank() ? plan.name() : detail.name(),
                        plan.summaryText(),
                        detail.adjustedXp(),
                        detail.difficultyLabel(),
                        detail.statusText(),
                        detail.available()));
            }
            return List.copyOf(availablePlans);
        }

        private static Map<Long, SessionEncounterPlanFact> loadSessionEncounterFacts(
                SessionPlan session,
                SessionEncounterFactsRepository encounterFactsRepository
        ) {
            Map<Long, SessionEncounterPlanFact> loadedEncounters = new HashMap<>();
            for (SessionEncounter encounter : session.encounters()) {
                loadedEncounters.computeIfAbsent(encounter.encounterPlanId(), encounterFactsRepository::loadEncounterPlan);
            }
            return loadedEncounters;
        }

        private static List<SessionPlannerParticipantsProjection.SessionParticipant> buildParticipants(
                SessionPlan session,
                SessionActivePartyMembersFact activeMembers
        ) {
            List<SessionPlannerParticipantsProjection.SessionParticipant> participants = new ArrayList<>();
            for (Long participantRef : session.participantRefs()) {
                SessionPartyMemberProfile member = activeMembers.resolve(participantRef);
                if (member == null) {
                    participants.add(new SessionPlannerParticipantsProjection.SessionParticipant(
                            participantRef,
                            "Charakter #" + participantRef,
                            0,
                            false,
                            "Nicht mehr in der aktiven Party verfuegbar."));
                } else {
                    participants.add(new SessionPlannerParticipantsProjection.SessionParticipant(
                            member.characterId(),
                            member.displayName(),
                            member.currentLevel(),
                            true,
                            ""));
                }
            }
            return List.copyOf(participants);
        }

        private static List<SessionPlannerParticipantsProjection.ActivePartyMember> buildActivePartyMembers(
                List<SessionPartyMemberProfile> members
        ) {
            List<SessionPlannerParticipantsProjection.ActivePartyMember> activePartyMembers = new ArrayList<>();
            for (SessionPartyMemberProfile member
                    : members == null ? List.<SessionPartyMemberProfile>of() : members) {
                activePartyMembers.add(new SessionPlannerParticipantsProjection.ActivePartyMember(
                        member.characterId(),
                        member.displayName(),
                        member.currentLevel()));
            }
            return List.copyOf(activePartyMembers);
        }

        private static List<SessionPlannerEncountersProjection.PlannedEncounter> buildPlannedEncounters(
                SessionPlan session,
                int scaledBudgetXp,
                Map<Long, SessionEncounterPlanFact> loadedEncounters,
                SessionEncounterFactsRepository encounterFactsRepository
        ) {
            List<SessionPlannerEncountersProjection.PlannedEncounter> plannedEncounters = new ArrayList<>();
            for (SessionEncounter encounter : session.encounters()) {
                SessionEncounterPlanFact detail = loadedEncounters.computeIfAbsent(
                        encounter.encounterPlanId(),
                        encounterFactsRepository::loadEncounterPlan);
                int targetXp = encounter.allocation().budgetPercentage()
                        .multiply(BigDecimal.valueOf(scaledBudgetXp))
                        .divide(HUNDRED, 0, RoundingMode.HALF_UP)
                        .intValue();
                plannedEncounters.add(new SessionPlannerEncountersProjection.PlannedEncounter(
                        encounter.encounterId(),
                        encounter.encounterPlanId(),
                        detail.name(),
                        detail.generatedLabel(),
                        detail.creatureCount(),
                        detail.totalBaseXp(),
                        detail.adjustedXp(),
                        detail.xpMultiplier(),
                        detail.difficultyLabel(),
                        encounter.allocation().budgetPercentage(),
                        targetXp,
                        session.selectedEncounterId() == encounter.encounterId()));
            }
            return List.copyOf(plannedEncounters);
        }

        private static List<SessionPlannerEncountersProjection.RestGap> buildRestGaps(SessionPlan session) {
            List<SessionPlannerEncountersProjection.RestGap> gaps = new ArrayList<>();
            List<SessionEncounter> encounters = session.encounters();
            for (int index = 0; index < encounters.size() - 1; index++) {
                SessionEncounter left = encounters.get(index);
                SessionEncounter right = encounters.get(index + 1);
                gaps.add(new SessionPlannerEncountersProjection.RestGap(
                        index,
                        left.encounterId(),
                        right.encounterId(),
                        restKindForGap(left.encounterId(), right.encounterId(), session.restPlacements())));
            }
            return List.copyOf(gaps);
        }

        private static SessionPlannerStatePanelProjection buildStatePanel(
                SessionPlannerSessionSnapshot session,
                List<SessionPlannerEncountersProjection.PlannedEncounter> encounters
        ) {
            SessionPlannerEncountersProjection.PlannedEncounter selectedEncounter = encounters.stream()
                    .filter(SessionPlannerEncountersProjection.PlannedEncounter::selected)
                    .findFirst()
                    .orElse(null);
            if (selectedEncounter == null) {
                return new SessionPlannerStatePanelProjection(
                        false,
                        "Kein Session-Encounter ausgewaehlt",
                        "Waehle im Planner einen Encounter aus, um den vorbereitenden State-Kontext zu sehen.",
                        "",
                        session.session().hasSelectedEncounter()
                                ? "Encounter fuer State-Panel ausgewaehlt"
                                : "Noch kein Encounter fuer State-Panel ausgewaehlt",
                        "Katalog-Vorbereitung",
                        "Der generische Katalog folgt spaeter. Dieser Slice reserviert nur die planner-eigene read-only Flaeche.");
            }
            String detail = selectedEncounter.creatureCount() + " Kreaturen"
                    + (selectedEncounter.generatedLabel().isBlank() ? "" : " · " + selectedEncounter.generatedLabel());
            String xpSummary = selectedEncounter.budgetPercentage().stripTrailingZeros().toPlainString()
                    + "% Budget · Ziel " + selectedEncounter.targetXp() + " XP · Ist "
                    + selectedEncounter.adjustedXp() + " XP";
            return new SessionPlannerStatePanelProjection(
                    true,
                    selectedEncounter.name(),
                    detail,
                    xpSummary,
                    "Ausgewaehlter Encounter #" + selectedEncounter.token(),
                    "Katalog-Vorbereitung",
                    "Read-only Placeholder fuer spaetere Monster-, Spell- und Loot-Aktionen. Noch keine echte Catalog-Boundary und keine Mutation.");
        }

        private static String resolveStatus(
                List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
                SessionActivePartyMembersFact partyMembersFact,
                SessionEncounterPlanListFact encounterPlansFact,
                String sessionStatusText
        ) {
            if (sessionStatusText != null && !sessionStatusText.isBlank()) {
                return sessionStatusText;
            }
            if (participants.isEmpty()) {
                return "Session hat noch keine Teilnehmer.";
            }
            if (hasMissingParticipants(participants)) {
                return "Session enthaelt nicht mehr aufloesbare Teilnehmer-Referenzen.";
            }
            String partyStatus = unavailableStatus(
                    partyMembersFact.available(),
                    partyMembersFact.statusText(),
                    "Aktive Party konnte nicht geladen werden.");
            if (!partyStatus.isBlank()) {
                return partyStatus;
            }
            String encounterStatus = unavailableStatus(
                    encounterPlansFact.available(),
                    encounterPlansFact.statusText(),
                    "Encounter-Plaene konnten nicht geladen werden.");
            if (!encounterStatus.isBlank()) {
                return encounterStatus;
            }
            if (encounterPlansFact.plans().isEmpty()) {
                return "Keine gespeicherten Encounter-Plaene gefunden.";
            }
            return "";
        }

        private static int plannedEncounterXp(
                SessionPlan session,
                Map<Long, SessionEncounterPlanFact> loadedEncounters
        ) {
            return session.encounters().stream()
                    .mapToInt(encounter -> loadedEncounters.getOrDefault(
                            encounter.encounterPlanId(),
                            SessionEncounterPlanFact.unavailable(
                                    encounter.encounterPlanId(),
                                    "Encounter-Plan fehlt.")).adjustedXp())
                    .sum();
        }

        private static int countShortRests(List<SessionRestPlacement> placements) {
            return (int) placements.stream()
                    .filter(SessionRestPlacement::isShortRest)
                    .count();
        }

        private static int countLongRests(List<SessionRestPlacement> placements) {
            return (int) placements.stream()
                    .filter(SessionRestPlacement::isLongRest)
                    .count();
        }

        private static SessionPlannerRestKind restKindForGap(
                long leftEncounterId,
                long rightEncounterId,
                List<SessionRestPlacement> placements
        ) {
            return placements.stream()
                    .filter(placement -> placement.matchesGap(leftEncounterId, rightEncounterId))
                    .findFirst()
                    .map(PublicationMapper::toRestKind)
                    .orElse(SessionPlannerRestKind.NONE);
        }

        private static String joinLevels(List<Integer> levels) {
            return levels.stream()
                    .map(String::valueOf)
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("-");
        }

        private static boolean hasMissingParticipants(
                List<SessionPlannerParticipantsProjection.SessionParticipant> participants
        ) {
            return participants.stream().anyMatch(participant -> !participant.available());
        }

        private static String unavailableStatus(boolean available, String statusText, String fallbackMessage) {
            if (available) {
                return "";
            }
            return statusText == null || statusText.isBlank() ? fallbackMessage : statusText;
        }

        private static SessionPlannerRestKind toRestKind(SessionRestPlacement placement) {
            return placement.isLongRest() ? SessionPlannerRestKind.LONG_REST : SessionPlannerRestKind.SHORT_REST;
        }

        private record ProjectionContext(
                SessionActivePartyMembersFact partyMembersFact,
                List<SessionPlannerParticipantsProjection.SessionParticipant> participants,
                List<Integer> resolvedLevels,
                Map<Long, SessionEncounterPlanFact> loadedEncounters,
                SessionAdventuringDayBudgetFact budgetFact,
                int scaledBudgetXp
        ) {
        }
    }
}
