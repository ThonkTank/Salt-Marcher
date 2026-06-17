package src.domain.sessionplanner;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import shell.api.ServiceRegistry;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;

final class SessionPlannerPublishedStateServiceAssembly {

    private final SessionPlanRepository repository;
    private final AtomicReference<SessionPlannerPublishedStateRepositoryServiceAssembly> publishedState =
            new AtomicReference<>();

    SessionPlannerPublishedStateServiceAssembly(SessionPlanRepository repository) {
        this.repository = repository;
    }

    SessionPlannerPublishedStateRepositoryServiceAssembly create(ServiceRegistry services) {
        SessionPlannerPublishedStateRepositoryServiceAssembly existing = publishedState.get();
        if (existing != null) {
            return existing;
        }
        SessionPlannerPublishedStateRepositoryServiceAssembly candidate = createCandidate(services);
        return publishedState.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(publishedState.get(), "publishedState");
    }

    SessionPlannerCurrentSessionModel currentSessionModel(ServiceRegistry services) {
        return create(services).currentSessionModel();
    }

    SessionPlannerCatalogModel catalogModel(ServiceRegistry services) {
        return create(services).catalogModel();
    }

    SessionPlannerParticipantsModel participantsModel(ServiceRegistry services) {
        return create(services).participantsModel();
    }

    SessionPlannerEncountersModel encountersModel(ServiceRegistry services) {
        return create(services).encountersModel();
    }

    SessionPlannerStatePanelModel statePanelModel(ServiceRegistry services) {
        return create(services).statePanelModel();
    }

    private SessionPlannerPublishedStateRepositoryServiceAssembly createCandidate(ServiceRegistry services) {
        ServiceRegistry registry = Objects.requireNonNull(services, "services");
        SessionPartyFactsPort partyFacts = new SessionPlannerPartyFactsReadbackServiceAssembly(
                registry.require(ActivePartyModel.class),
                registry.require(AdventuringDayCalculationModel.class));
        SessionEncounterFactsPort encounterFacts = new SessionPlannerEncounterFactsReadbackServiceAssembly(
                registry.require(SavedEncounterPlanListModel.class),
                registry.require(EncounterPlanBudgetModel.class));
        return new SessionPlannerPublishedStateRepositoryServiceAssembly(
                repository,
                partyFacts,
                new SessionPlannerPartyFactsInvokerServiceAssembly(
                        registry.require(PartyApplicationService.class),
                        partyFacts),
                encounterFacts,
                new SessionPlannerEncounterFactsInvokerServiceAssembly(
                        registry.require(EncounterApplicationService.class),
                        encounterFacts));
    }
}
