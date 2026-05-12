package src.data.sessionplanner;

import java.util.function.Function;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
import src.domain.sessionplanner.SessionPlannerEncounterApplicationService;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.usecase.AttachSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterDownUseCase;
import src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterUpUseCase;
import src.domain.sessionplanner.model.session.usecase.RemoveSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.SelectSessionEncounterUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterAllocationUseCase;
import src.domain.sessionplanner.model.session.usecase.SetSessionEncounterDaysUseCase;

@SuppressWarnings("DataServiceContributionConstructionPurity")
final class SessionPlannerEncounterApplicationServiceFactory {

    private final SessionPlanRepository repository;
    private final Function<ServiceRegistry, SessionPlannerPublishedStateRepositoryAdapter> publishedStateFactory;

    SessionPlannerEncounterApplicationServiceFactory(
            SessionPlanRepository repository,
            Function<ServiceRegistry, SessionPlannerPublishedStateRepositoryAdapter> publishedStateFactory
    ) {
        this.repository = repository;
        this.publishedStateFactory = publishedStateFactory;
    }

    SessionPlannerEncounterApplicationService create(ServiceRegistry services) {
        SessionPlannerUseCaseRuntime runtime = SessionPlannerUseCaseRuntime.create(
                repository,
                publishedStateFactory,
                services);
        return new SessionPlannerEncounterApplicationService(
                new SetSessionEncounterDaysUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()),
                new AttachSessionEncounterUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()),
                new RemoveSessionEncounterUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()),
                new MoveSessionEncounterUpUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()),
                new MoveSessionEncounterDownUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()),
                new SetSessionEncounterAllocationUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()),
                new SelectSessionEncounterUseCase(
                        runtime.loadCurrentSessionPlanUseCase(),
                        runtime.saveCurrentSessionPlanUseCase()));
    }
}
