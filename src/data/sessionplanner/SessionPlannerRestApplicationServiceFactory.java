package src.data.sessionplanner;

import java.util.function.Function;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
import src.domain.sessionplanner.SessionPlannerRestApplicationService;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.usecase.ClearSessionRestGapUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionRestGapUseCase;

final class SessionPlannerRestApplicationServiceFactory {

    private final SessionPlanRepository repository;
    private final Function<ServiceRegistry, SessionPlannerPublishedStateRepositoryAdapter> publishedStateFactory;

    SessionPlannerRestApplicationServiceFactory(
            SessionPlanRepository repository,
            Function<ServiceRegistry, SessionPlannerPublishedStateRepositoryAdapter> publishedStateFactory
    ) {
        this.repository = repository;
        this.publishedStateFactory = publishedStateFactory;
    }

    SessionPlannerRestApplicationService create(ServiceRegistry services) {
        SessionPlannerUseCaseRuntime runtime = SessionPlannerUseCaseRuntime.create(
                repository,
                publishedStateFactory,
                services);
        return new SessionPlannerRestApplicationService(
                new SetSessionRestGapUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()),
                new ClearSessionRestGapUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()));
    }
}
