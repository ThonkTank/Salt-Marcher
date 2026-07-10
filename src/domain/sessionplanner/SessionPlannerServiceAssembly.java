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
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

final class SessionPlannerServiceAssembly {

    private final SessionPlanRepository repository;
    private final AtomicReference<Runtime> runtime = new AtomicReference<>();

    SessionPlannerServiceAssembly(SessionPlanRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    SessionPlannerApplicationService createSessionPlanner(ServiceRegistry services) {
        return runtime(services).applicationService();
    }

    SessionPlannerCurrentSessionModel currentSessionModel(ServiceRegistry services) {
        return runtime(services).publishedState().currentSessionModel();
    }

    SessionPlannerCatalogModel catalogModel(ServiceRegistry services) {
        return runtime(services).publishedState().catalogModel();
    }

    SessionPlannerParticipantsModel participantsModel(ServiceRegistry services) {
        return runtime(services).publishedState().participantsModel();
    }

    SessionPlannerSceneTimelineModel sceneTimelineModel(ServiceRegistry services) {
        return runtime(services).publishedState().sceneTimelineModel();
    }

    SessionPlannerStatePanelModel statePanelModel(ServiceRegistry services) {
        return runtime(services).publishedState().statePanelModel();
    }

    private Runtime runtime(ServiceRegistry services) {
        Runtime existing = runtime.get();
        if (existing != null) {
            return existing;
        }
        Runtime candidate = createRuntime(services);
        return runtime.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(runtime.get(), "runtime");
    }

    private Runtime createRuntime(ServiceRegistry services) {
        ServiceRegistry registry = Objects.requireNonNull(services, "services");
        SessionPlannerForeignFacts facts = new SessionPlannerForeignFacts(
                registry.require(PartyApplicationService.class),
                registry.require(ActivePartyModel.class),
                registry.require(AdventuringDayCalculationModel.class),
                registry.require(EncounterApplicationService.class),
                registry.require(SavedEncounterPlanListModel.class),
                registry.require(EncounterPlanBudgetModel.class),
                registry.find(WorldPlannerSnapshotModel.class).orElse(null));
        SessionPlannerPublishedState publishedState =
                new SessionPlannerPublishedState(repository, facts, new SessionPlannerProjection());
        facts.subscribeLocationRefresh(publishedState::publishLoadedCurrentSession);
        return new Runtime(
                publishedState,
                new SessionPlannerApplicationService(repository, facts, publishedState));
    }

    private record Runtime(
            SessionPlannerPublishedState publishedState,
            SessionPlannerApplicationService applicationService
    ) {
    }
}
