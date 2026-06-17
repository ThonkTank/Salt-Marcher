package src.domain.sessionplanner;

import java.util.Objects;
import shell.api.ServiceRegistry;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;

final class SessionPlannerRuntimeServiceAssembly {

    private final SessionPlannerApplicationServicesServiceAssembly applicationServices;
    private final SessionPlannerPublishedStateServiceAssembly publishedState;

    SessionPlannerRuntimeServiceAssembly(SessionPlanRepository repository) {
        SessionPlanRepository requiredRepository = Objects.requireNonNull(repository, "repository");
        this.publishedState = new SessionPlannerPublishedStateServiceAssembly(requiredRepository);
        this.applicationServices =
                new SessionPlannerApplicationServicesServiceAssembly(requiredRepository, publishedState);
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

    SessionPlannerCatalogModel catalogModel(ServiceRegistry services) {
        return publishedState.catalogModel(services);
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
}
