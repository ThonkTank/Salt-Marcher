package src.data.sessionplanner;

import java.util.function.Function;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
import src.domain.sessionplanner.SessionPlannerLootApplicationService;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.usecase.AddSessionLootPlaceholderUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionLootPlaceholderUseCase;

final class SessionPlannerLootApplicationServiceFactory {

    private final SessionPlanRepository repository;
    private final Function<ServiceRegistry, SessionPlannerPublishedStateRepositoryAdapter> publishedStateFactory;

    SessionPlannerLootApplicationServiceFactory(
            SessionPlanRepository repository,
            Function<ServiceRegistry, SessionPlannerPublishedStateRepositoryAdapter> publishedStateFactory
    ) {
        this.repository = repository;
        this.publishedStateFactory = publishedStateFactory;
    }

    SessionPlannerLootApplicationService create(ServiceRegistry services) {
        SessionPlannerUseCaseRuntime runtime = SessionPlannerUseCaseRuntime.create(
                repository,
                publishedStateFactory,
                services);
        return new SessionPlannerLootApplicationService(
                new AddSessionLootPlaceholderUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()),
                new RemoveSessionLootPlaceholderUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()));
    }
}
