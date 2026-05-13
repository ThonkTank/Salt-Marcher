package src.data.sessionplanner.state;

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
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;

public final class SessionPlannerPublishedStateCarrier implements SessionPlannerPublishedStateRepository {

    private final SessionPlanRepository repository;
    private final AtomicReference<SessionPlannerPublishedStateRepositoryAdapter> adapter =
            new AtomicReference<>();

    public SessionPlannerPublishedStateCarrier(SessionPlanRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    @Override
    public void publishCurrentSession(SessionPlan sessionPlan) {
        adapter().publishCurrentSession(sessionPlan);
    }

    public SessionPlannerPublishedStateRepository repository(ServiceRegistry services) {
        return adapter(services);
    }

    public SessionPlannerCurrentSessionModel currentSessionModel(ServiceRegistry services) {
        return adapter(services).currentSessionModel;
    }

    public SessionPlannerParticipantsModel participantsModel(ServiceRegistry services) {
        return adapter(services).participantsModel;
    }

    public SessionPlannerEncountersModel encountersModel(ServiceRegistry services) {
        return adapter(services).encountersModel;
    }

    public SessionPlannerStatePanelModel statePanelModel(ServiceRegistry services) {
        return adapter(services).statePanelModel;
    }

    private SessionPlannerPublishedStateRepositoryAdapter adapter() {
        return Objects.requireNonNull(adapter.get(), "publishedState");
    }

    private SessionPlannerPublishedStateRepositoryAdapter adapter(ServiceRegistry services) {
        SessionPlannerPublishedStateRepositoryAdapter existing = adapter.get();
        if (existing != null) {
            return existing;
        }
        SessionPlannerPublishedStateRepositoryAdapter candidate = createAdapter(services);
        return adapter.compareAndSet(null, candidate)
                ? candidate
                : adapter();
    }

    private SessionPlannerPublishedStateRepositoryAdapter createAdapter(ServiceRegistry services) {
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
}
