package src.data.sessionplanner;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateFactory;
import src.data.sessionplanner.repository.SqliteSessionPlanRepository;
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
        SessionPlannerPublishedStateFactory publishedState = new SessionPlannerPublishedStateFactory(repository);
        builder.registerFactory(
                SessionPlannerApplicationService.class,
                new SessionPlannerApplicationServiceFactory(repository, publishedState::create)::create);
        builder.registerFactory(
                SessionPlannerParticipantApplicationService.class,
                new SessionPlannerParticipantApplicationServiceFactory(repository, publishedState::create)::create);
        builder.registerFactory(
                SessionPlannerEncounterApplicationService.class,
                new SessionPlannerEncounterApplicationServiceFactory(repository, publishedState::create)::create);
        builder.registerFactory(
                SessionPlannerRestApplicationService.class,
                new SessionPlannerRestApplicationServiceFactory(repository, publishedState::create)::create);
        builder.registerFactory(
                SessionPlannerLootApplicationService.class,
                new SessionPlannerLootApplicationServiceFactory(repository, publishedState::create)::create);
        builder.registerFactory(
                SessionPlannerCurrentSessionModel.class,
                publishedState::currentSessionModel);
        builder.registerFactory(
                SessionPlannerParticipantsModel.class,
                publishedState::participantsModel);
        builder.registerFactory(
                SessionPlannerEncountersModel.class,
                publishedState::encountersModel);
        builder.registerFactory(
                SessionPlannerStatePanelModel.class,
                publishedState::statePanelModel);
    }
}
