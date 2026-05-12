package src.data.sessionplanner;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.query.SessionPlannerEncounterFactsQueryAdapter;
import src.data.sessionplanner.query.SessionPlannerPartyFactsQueryAdapter;
import src.data.sessionplanner.repository.SessionPlannerEncounterFactsRepositoryAdapter;
import src.data.sessionplanner.repository.SessionPlannerPartyFactsRepositoryAdapter;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
import src.data.sessionplanner.repository.SqliteSessionPlanRepository;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.SessionPlannerApplicationService.EncounterUseCases;
import src.domain.sessionplanner.SessionPlannerApplicationService.LootUseCases;
import src.domain.sessionplanner.SessionPlannerApplicationService.ParticipantUseCases;
import src.domain.sessionplanner.SessionPlannerApplicationService.RestUseCases;
import src.domain.sessionplanner.SessionPlannerApplicationService.SessionUseCases;
import src.domain.sessionplanner.SessionPlannerApplicationService.UseCases;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
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
            PartyApplicationService party = registry.require(PartyApplicationService.class);
            EncounterApplicationService encounters = registry.require(EncounterApplicationService.class);
            SessionPlannerPartyFactsQueryAdapter partyFacts = new SessionPlannerPartyFactsQueryAdapter(
                    registry.require(ActivePartyModel.class),
                    registry.require(AdventuringDayCalculationModel.class));
            SessionPlannerPartyFactsRepositoryAdapter partyFactsRepository =
                    new SessionPlannerPartyFactsRepositoryAdapter(party, partyFacts);
            SessionPlannerEncounterFactsQueryAdapter encounterFacts = new SessionPlannerEncounterFactsQueryAdapter(
                    registry.require(SavedEncounterPlanListModel.class),
                    registry.require(EncounterPlanBudgetModel.class));
            SessionPlannerEncounterFactsRepositoryAdapter encounterFactsRepository =
                    new SessionPlannerEncounterFactsRepositoryAdapter(encounters, encounterFacts);
            SessionPlannerPublishedStateRepositoryAdapter candidate = new SessionPlannerPublishedStateRepositoryAdapter(
                    repository,
                    partyFacts,
                    partyFactsRepository,
                    encounterFacts,
                    encounterFactsRepository);
            return publishedState.compareAndSet(null, candidate)
                    ? candidate
                    : Objects.requireNonNull(publishedState.get(), "publishedState");
        };
        Function<ServiceRegistry, ResolvedPublishedState> resolvedPublishedStateFactory = services -> {
            SessionPlannerPublishedStateRepositoryAdapter adapter = publishedStateFactory.apply(services);
            return new ResolvedPublishedState(
                    adapter.currentSessionModel,
                    adapter.participantsModel,
                    adapter.encountersModel,
                    adapter.statePanelModel);
        };
        builder.registerFactory(
                SessionPlannerApplicationService.class,
                services -> {
                    SessionPlannerPartyFactsQueryAdapter partyFacts = new SessionPlannerPartyFactsQueryAdapter(
                            services.require(ActivePartyModel.class),
                            services.require(AdventuringDayCalculationModel.class));
                    SessionPlannerPublishedStateRepositoryAdapter publishedStateRepository =
                            publishedStateFactory.apply(services);
                    SeedSessionPlanUseCase seedSessionPlanUseCase = new SeedSessionPlanUseCase(partyFacts);
                    LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase = new LoadCurrentSessionPlanUseCase(
                            repository,
                            seedSessionPlanUseCase);
                    SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase = new SaveCurrentSessionPlanUseCase(
                            repository,
                            publishedStateRepository);
                    return new SessionPlannerApplicationService(new UseCases(
                            new SessionUseCases(new CreateSessionPlanUseCase(
                                    repository,
                                    saveCurrentSessionPlanUseCase,
                                    seedSessionPlanUseCase)),
                            new ParticipantUseCases(
                                    new AddSessionParticipantUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase),
                                    new RemoveSessionParticipantUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase)),
                            new EncounterUseCases(
                                    new SetSessionEncounterDaysUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase),
                                    new AttachSessionEncounterUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase),
                                    new RemoveSessionEncounterUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase),
                                    new MoveSessionEncounterUpUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase),
                                    new MoveSessionEncounterDownUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase),
                                    new SetSessionEncounterAllocationUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase),
                                    new SelectSessionEncounterUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase)),
                            new RestUseCases(
                                    new SetSessionRestGapUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase),
                                    new ClearSessionRestGapUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase)),
                            new LootUseCases(
                                    new AddSessionLootPlaceholderUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase),
                                    new RemoveSessionLootPlaceholderUseCase(
                                            loadCurrentSessionPlanUseCase,
                                            saveCurrentSessionPlanUseCase))));
                });
        builder.registerFactory(
                SessionPlannerCurrentSessionModel.class,
                services -> {
                    ResolvedPublishedState resolved = resolvedPublishedStateFactory.apply(services);
                    return resolved.currentSessionModel;
                });
        builder.registerFactory(
                SessionPlannerParticipantsModel.class,
                services -> {
                    ResolvedPublishedState resolved = resolvedPublishedStateFactory.apply(services);
                    return resolved.participantsModel;
                });
        builder.registerFactory(
                SessionPlannerEncountersModel.class,
                services -> {
                    ResolvedPublishedState resolved = resolvedPublishedStateFactory.apply(services);
                    return resolved.encountersModel;
                });
        builder.registerFactory(
                SessionPlannerStatePanelModel.class,
                services -> {
                    ResolvedPublishedState resolved = resolvedPublishedStateFactory.apply(services);
                    return resolved.statePanelModel;
                });
    }

    private static final class ResolvedPublishedState {

        private final SessionPlannerCurrentSessionModel currentSessionModel;
        private final SessionPlannerParticipantsModel participantsModel;
        private final SessionPlannerEncountersModel encountersModel;
        private final SessionPlannerStatePanelModel statePanelModel;

        private ResolvedPublishedState(
                SessionPlannerCurrentSessionModel currentSessionModel,
                SessionPlannerParticipantsModel participantsModel,
                SessionPlannerEncountersModel encountersModel,
                SessionPlannerStatePanelModel statePanelModel
        ) {
            this.currentSessionModel = Objects.requireNonNull(currentSessionModel, "currentSessionModel");
            this.participantsModel = Objects.requireNonNull(participantsModel, "participantsModel");
            this.encountersModel = Objects.requireNonNull(encountersModel, "encountersModel");
            this.statePanelModel = Objects.requireNonNull(statePanelModel, "statePanelModel");
        }
    }
}
