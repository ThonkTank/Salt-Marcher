package src.data.sessionplanner;

import java.util.function.Function;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
import src.domain.sessionplanner.SessionPlannerParticipantApplicationService;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.usecase.AddSessionParticipantUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionParticipantUseCase;

@SuppressWarnings("DataServiceContributionConstructionPurity")
final class SessionPlannerParticipantApplicationServiceFactory {

    private final SessionPlanRepository repository;
    private final Function<ServiceRegistry, SessionPlannerPublishedStateRepositoryAdapter> publishedStateFactory;

    SessionPlannerParticipantApplicationServiceFactory(
            SessionPlanRepository repository,
            Function<ServiceRegistry, SessionPlannerPublishedStateRepositoryAdapter> publishedStateFactory
    ) {
        this.repository = repository;
        this.publishedStateFactory = publishedStateFactory;
    }

    SessionPlannerParticipantApplicationService create(ServiceRegistry services) {
        SessionPlannerUseCaseRuntime runtime = SessionPlannerUseCaseRuntime.create(
                repository,
                publishedStateFactory,
                services);
        return new SessionPlannerParticipantApplicationService(
                new AddSessionParticipantUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()),
                new RemoveSessionParticipantUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()));
    }
}
