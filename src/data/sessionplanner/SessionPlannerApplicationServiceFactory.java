package src.data.sessionplanner;

import java.util.function.Function;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.usecase.CreateSessionPlanUseCase;

@SuppressWarnings("DataServiceContributionConstructionPurity")
final class SessionPlannerApplicationServiceFactory {

    private final SessionPlanRepository repository;
    private final Function<ServiceRegistry, SessionPlannerPublishedStateRepositoryAdapter> publishedStateFactory;

    SessionPlannerApplicationServiceFactory(
            SessionPlanRepository repository,
            Function<ServiceRegistry, SessionPlannerPublishedStateRepositoryAdapter> publishedStateFactory
    ) {
        this.repository = repository;
        this.publishedStateFactory = publishedStateFactory;
    }

    SessionPlannerApplicationService create(ServiceRegistry services) {
        SessionPlannerUseCaseRuntime runtime = SessionPlannerUseCaseRuntime.create(
                repository,
                publishedStateFactory,
                services);
        return new SessionPlannerApplicationService(new CreateSessionPlanUseCase(
                runtime.repository(),
                runtime.saveCurrentSessionPlanUseCase(),
                runtime.seedSessionPlanUseCase()));
    }
}
