package src.data.sessionplanner;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.query.SessionPlannerEncounterFactsQueryAdapter;
import src.data.sessionplanner.query.SessionPlannerPartyFactsQueryAdapter;
import src.data.sessionplanner.repository.SessionPlannerEncounterFactsRepositoryAdapter;
import src.data.sessionplanner.repository.SessionPlannerPartyFactsRepositoryAdapter;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.SessionPlannerEncounterApplicationService;
import src.domain.sessionplanner.SessionPlannerLootApplicationService;
import src.domain.sessionplanner.SessionPlannerParticipantApplicationService;
import src.domain.sessionplanner.SessionPlannerRestApplicationService;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;

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
            SessionPlannerPartyFactsQueryAdapter partyFacts = new SessionPlannerPartyFactsQueryAdapter(
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
        private final AtomicReference<SessionPlannerPublishedStateRepositoryAdapter> publishedState =
                new AtomicReference<>();

        private PublishedStateServiceAssembly(SessionPlanRepository repository) {
            this.repository = repository;
        }

        private SessionPlannerPublishedStateRepositoryAdapter create(ServiceRegistry services) {
            SessionPlannerPublishedStateRepositoryAdapter existing = publishedState.get();
            if (existing != null) {
                return existing;
            }
            SessionPlannerPublishedStateRepositoryAdapter candidate = createCandidate(services);
            return publishedState.compareAndSet(null, candidate)
                    ? candidate
                    : Objects.requireNonNull(publishedState.get(), "publishedState");
        }

        private SessionPlannerPublishedStateRepositoryAdapter createCandidate(ServiceRegistry services) {
            ServiceRegistry registry = Objects.requireNonNull(services, "services");
            SessionPlannerPartyFactsQueryAdapter partyFacts = new SessionPlannerPartyFactsQueryAdapter(
                    registry.require(ActivePartyModel.class),
                    registry.require(AdventuringDayCalculationModel.class));
            SessionPlannerEncounterFactsQueryAdapter encounterFacts = new SessionPlannerEncounterFactsQueryAdapter(
                    registry.require(SavedEncounterPlanListModel.class),
                    registry.require(EncounterPlanBudgetModel.class));
            return new SessionPlannerPublishedStateRepositoryAdapter(
                    repository,
                    partyFacts,
                    new SessionPlannerPartyFactsRepositoryAdapter(
                            registry.require(PartyApplicationService.class),
                            partyFacts),
                    encounterFacts,
                    new SessionPlannerEncounterFactsRepositoryAdapter(
                            registry.require(EncounterApplicationService.class),
                            encounterFacts));
        }

        private SessionPlannerCurrentSessionModel currentSessionModel(ServiceRegistry services) {
            return create(services).currentSessionModel;
        }

        private SessionPlannerParticipantsModel participantsModel(ServiceRegistry services) {
            return create(services).participantsModel;
        }

        private SessionPlannerEncountersModel encountersModel(ServiceRegistry services) {
            return create(services).encountersModel;
        }

        private SessionPlannerStatePanelModel statePanelModel(ServiceRegistry services) {
            return create(services).statePanelModel;
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
}
