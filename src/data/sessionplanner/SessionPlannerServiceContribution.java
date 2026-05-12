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
import src.domain.sessionplanner.SessionPlannerEncounterApplicationService;
import src.domain.sessionplanner.SessionPlannerLootApplicationService;
import src.domain.sessionplanner.SessionPlannerParticipantApplicationService;
import src.domain.sessionplanner.SessionPlannerRestApplicationService;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
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
                new SessionPlannerApplicationServiceFactory(repository, publishedStateFactory)::create);
        builder.registerFactory(
                SessionPlannerParticipantApplicationService.class,
                new SessionPlannerParticipantApplicationServiceFactory(repository, publishedStateFactory)::create);
        builder.registerFactory(
                SessionPlannerEncounterApplicationService.class,
                new SessionPlannerEncounterApplicationServiceFactory(repository, publishedStateFactory)::create);
        builder.registerFactory(
                SessionPlannerRestApplicationService.class,
                new SessionPlannerRestApplicationServiceFactory(repository, publishedStateFactory)::create);
        builder.registerFactory(
                SessionPlannerLootApplicationService.class,
                new SessionPlannerLootApplicationServiceFactory(repository, publishedStateFactory)::create);
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
