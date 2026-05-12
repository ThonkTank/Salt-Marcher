package src.data.sessionplanner.repository;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.query.SessionPlannerEncounterFactsQueryAdapter;
import src.data.sessionplanner.query.SessionPlannerPartyFactsQueryAdapter;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;

@SuppressWarnings("DataServiceContributionConstructionPurity")
public final class SessionPlannerPublishedStateFactory {

    private final SessionPlanRepository repository;
    private final AtomicReference<SessionPlannerPublishedStateRepositoryAdapter> publishedState =
            new AtomicReference<>();

    public SessionPlannerPublishedStateFactory(SessionPlanRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public SessionPlannerPublishedStateRepositoryAdapter create(ServiceRegistry services) {
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

    public SessionPlannerCurrentSessionModel currentSessionModel(ServiceRegistry services) {
        return create(services).currentSessionModel;
    }

    public SessionPlannerParticipantsModel participantsModel(ServiceRegistry services) {
        return create(services).participantsModel;
    }

    public SessionPlannerEncountersModel encountersModel(ServiceRegistry services) {
        return create(services).encountersModel;
    }

    public SessionPlannerStatePanelModel statePanelModel(ServiceRegistry services) {
        return create(services).statePanelModel;
    }
}
