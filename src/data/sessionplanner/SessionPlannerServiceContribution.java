package src.data.sessionplanner;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.query.SessionPlannerEncounterFactsQueryAdapter;
import src.data.sessionplanner.query.SessionPlannerPartyFactsQueryAdapter;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
import src.data.sessionplanner.repository.SqliteSessionPlanRepository;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository;
import src.domain.sessionplanner.model.session.usecase.AddSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.model.session.usecase.AddSessionParticipantUseCase;
import src.domain.sessionplanner.model.session.usecase.AttachSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.ClearSessionRestGapUseCase;
import src.domain.sessionplanner.model.session.usecase.CreateSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.LoadCurrentSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterDownUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterUpUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionParticipantUseCase;
import src.domain.sessionplanner.model.session.usecase.SaveCurrentSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.SeedSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.SelectSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterAllocationUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterDaysUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionRestGapUseCase;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;

public final class SessionPlannerServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public SessionPlannerServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        SessionPlanRepository repository = new SqliteSessionPlanRepository();
        AtomicReference<SessionPlannerPublishedStateRepositoryAdapter> publishedState = new AtomicReference<>();
        Function<ServiceRegistry, SessionPlannerPublishedStateRepositoryAdapter> publishedStateFactory = services -> {
            SessionPlannerPublishedStateRepositoryAdapter existing = publishedState.get();
            if (existing != null) {
                return existing;
            }
            ServiceRegistry registry = Objects.requireNonNull(services, "services");
            SessionPlannerPublishedStateRepositoryAdapter candidate = new SessionPlannerPublishedStateRepositoryAdapter(
                    repository,
                    new SessionPlannerPartyFactsQueryAdapter(
                            registry.require(PartyApplicationService.class),
                            registry.require(ActivePartyModel.class),
                            registry.require(AdventuringDayCalculationModel.class)),
                    new SessionPlannerEncounterFactsQueryAdapter(
                            registry.require(EncounterApplicationService.class),
                            registry.require(SavedEncounterPlanListModel.class),
                            registry.require(EncounterPlanBudgetModel.class)));
            return publishedState.compareAndSet(null, candidate)
                    ? candidate
                    : Objects.requireNonNull(publishedState.get(), "publishedState");
        };
        builder.registerFactory(
                SessionPlannerApplicationService.class,
                services -> createApplicationService(
                        repository,
                        new SessionPlannerPartyFactsQueryAdapter(
                                services.require(PartyApplicationService.class),
                                services.require(ActivePartyModel.class),
                                services.require(AdventuringDayCalculationModel.class)),
                        publishedStateFactory.apply(services)));
        builder.registerFactory(
                SessionPlannerCurrentSessionModel.class,
                services -> {
                    SessionPlannerPublishedStateRepositoryAdapter adapter = publishedStateFactory.apply(services);
                    return adapter.currentSessionModel();
                });
        builder.registerFactory(
                SessionPlannerParticipantsModel.class,
                services -> {
                    SessionPlannerPublishedStateRepositoryAdapter adapter = publishedStateFactory.apply(services);
                    return adapter.participantsModel();
                });
        builder.registerFactory(
                SessionPlannerEncountersModel.class,
                services -> {
                    SessionPlannerPublishedStateRepositoryAdapter adapter = publishedStateFactory.apply(services);
                    return adapter.encountersModel();
                });
        builder.registerFactory(
                SessionPlannerStatePanelModel.class,
                services -> {
                    SessionPlannerPublishedStateRepositoryAdapter adapter = publishedStateFactory.apply(services);
                    return adapter.statePanelModel();
                });
    }

    private static SessionPlannerApplicationService createApplicationService(
            SessionPlanRepository repository,
            SessionPartyFactsPort partyFacts,
            SessionPlannerPublishedStateRepository publishedStateRepository
    ) {
        SessionPlanRepository sessionRepository = Objects.requireNonNull(repository, "repository");
        SessionPartyFactsPort partyFactsPort = Objects.requireNonNull(partyFacts, "partyFacts");
        SessionPlannerPublishedStateRepository publishedState =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        SeedSessionPlanUseCase seedSessionPlanUseCase = new SeedSessionPlanUseCase(partyFactsPort);
        LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase =
                new LoadCurrentSessionPlanUseCase(sessionRepository, seedSessionPlanUseCase);
        SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase =
                new SaveCurrentSessionPlanUseCase(sessionRepository, publishedState);
        return new SessionPlannerApplicationService(
                new CreateSessionPlanUseCase(sessionRepository, saveCurrentSessionPlanUseCase, seedSessionPlanUseCase),
                new AddSessionParticipantUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new RemoveSessionParticipantUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new SetSessionEncounterDaysUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new AttachSessionEncounterUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new RemoveSessionEncounterUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new MoveSessionEncounterUpUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new MoveSessionEncounterDownUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new SetSessionEncounterAllocationUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new SelectSessionEncounterUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new SetSessionRestGapUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new ClearSessionRestGapUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new AddSessionLootPlaceholderUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase),
                new RemoveSessionLootPlaceholderUseCase(loadCurrentSessionPlanUseCase, saveCurrentSessionPlanUseCase));
    }
}
