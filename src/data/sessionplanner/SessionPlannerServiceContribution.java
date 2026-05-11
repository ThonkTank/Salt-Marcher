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
import src.domain.sessionplanner.SessionPlannerApplicationServiceFactory;
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
                services -> new SessionPlannerApplicationServiceFactory().create(
                        repository,
                        new SessionPlannerPartyFactsQueryAdapter(
                                services.require(PartyApplicationService.class),
                                services.require(ActivePartyModel.class),
                                services.require(AdventuringDayCalculationModel.class)),
                        publishedStateFactory.apply(services)));
        builder.registerFactory(
                SessionPlannerCurrentSessionModel.class,
                services -> publishedStateFactory.apply(services).currentSessionModel);
        builder.registerFactory(
                SessionPlannerParticipantsModel.class,
                services -> publishedStateFactory.apply(services).participantsModel);
        builder.registerFactory(
                SessionPlannerEncountersModel.class,
                services -> publishedStateFactory.apply(services).encountersModel);
        builder.registerFactory(
                SessionPlannerStatePanelModel.class,
                services -> publishedStateFactory.apply(services).statePanelModel);
    }
}
