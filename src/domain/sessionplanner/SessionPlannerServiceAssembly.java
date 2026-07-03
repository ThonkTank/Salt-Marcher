package src.domain.sessionplanner;

import java.util.Objects;
import shell.api.ServiceRegistry;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;

final class SessionPlannerServiceAssembly {

    private final SessionPlannerRuntimeServiceAssembly runtime;

    SessionPlannerServiceAssembly(SessionPlanRepository repository) {
        runtime = new SessionPlannerRuntimeServiceAssembly(Objects.requireNonNull(repository, "repository"));
    }

    SessionPlannerApplicationService createSessionPlanner(ServiceRegistry services) {
        return runtime.createSessionPlanner(services);
    }

    SessionPlannerParticipantApplicationService createParticipants(ServiceRegistry services) {
        return runtime.createParticipants(services);
    }

    SessionPlannerEncounterApplicationService createEncounters(ServiceRegistry services) {
        return runtime.createEncounters(services);
    }

    SessionPlannerRestApplicationService createRests(ServiceRegistry services) {
        return runtime.createRests(services);
    }

    SessionPlannerLootApplicationService createLoot(ServiceRegistry services) {
        return runtime.createLoot(services);
    }

    SessionPlannerCurrentSessionModel currentSessionModel(ServiceRegistry services) {
        return runtime.currentSessionModel(services);
    }

    SessionPlannerCatalogModel catalogModel(ServiceRegistry services) {
        return runtime.catalogModel(services);
    }

    SessionPlannerParticipantsModel participantsModel(ServiceRegistry services) {
        return runtime.participantsModel(services);
    }

    SessionPlannerSceneTimelineModel sceneTimelineModel(ServiceRegistry services) {
        return runtime.sceneTimelineModel(services);
    }

    SessionPlannerStatePanelModel statePanelModel(ServiceRegistry services) {
        return runtime.statePanelModel(services);
    }
}
