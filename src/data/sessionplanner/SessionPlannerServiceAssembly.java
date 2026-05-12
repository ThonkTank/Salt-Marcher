package src.data.sessionplanner;

import shell.api.ServiceRegistry;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
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

final class SessionPlannerServiceAssembly {

    private final SessionPlanRepository repository;
    private final SessionPlannerPublishedStateFactory publishedStateFactory;

    SessionPlannerServiceAssembly(SessionPlanRepository repository) {
        this.repository = repository;
        this.publishedStateFactory = new SessionPlannerPublishedStateFactory(repository);
    }

    void register(ServiceRegistry.Builder builder) {
        builder.registerFactory(
                SessionPlannerApplicationService.class,
                new SessionPlannerApplicationServiceFactory(repository, publishedStateFactory::create)::create);
        builder.registerFactory(
                SessionPlannerParticipantApplicationService.class,
                new SessionPlannerParticipantApplicationServiceFactory(repository, publishedStateFactory::create)::create);
        builder.registerFactory(
                SessionPlannerEncounterApplicationService.class,
                new SessionPlannerEncounterApplicationServiceFactory(repository, publishedStateFactory::create)::create);
        builder.registerFactory(
                SessionPlannerRestApplicationService.class,
                new SessionPlannerRestApplicationServiceFactory(repository, publishedStateFactory::create)::create);
        builder.registerFactory(
                SessionPlannerLootApplicationService.class,
                new SessionPlannerLootApplicationServiceFactory(repository, publishedStateFactory::create)::create);
        builder.registerFactory(
                SessionPlannerCurrentSessionModel.class,
                services -> resolvedPublishedState(services).currentSessionModel);
        builder.registerFactory(
                SessionPlannerParticipantsModel.class,
                services -> resolvedPublishedState(services).participantsModel);
        builder.registerFactory(
                SessionPlannerEncountersModel.class,
                services -> resolvedPublishedState(services).encountersModel);
        builder.registerFactory(
                SessionPlannerStatePanelModel.class,
                services -> resolvedPublishedState(services).statePanelModel);
    }

    private SessionPlannerPublishedStateRepositoryAdapter resolvedPublishedState(ServiceRegistry services) {
        return publishedStateFactory.create(services);
    }
}
