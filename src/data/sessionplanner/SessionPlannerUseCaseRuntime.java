package src.data.sessionplanner;

import java.util.Objects;
import java.util.function.Function;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.query.SessionPlannerPartyFactsQueryAdapter;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.usecase.LoadCurrentSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.SaveCurrentSessionPlanUseCase;
import src.domain.sessionplanner.model.session.usecase.SeedSessionPlanUseCase;

final class SessionPlannerUseCaseRuntime {

    private final SessionPlanRepository repository;
    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;
    private final SeedSessionPlanUseCase seedSessionPlanUseCase;

    private SessionPlannerUseCaseRuntime(
            SessionPlanRepository repository,
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase,
            SeedSessionPlanUseCase seedSessionPlanUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadCurrentSessionPlanUseCase =
                Objects.requireNonNull(loadCurrentSessionPlanUseCase, "loadCurrentSessionPlanUseCase");
        this.saveCurrentSessionPlanUseCase =
                Objects.requireNonNull(saveCurrentSessionPlanUseCase, "saveCurrentSessionPlanUseCase");
        this.seedSessionPlanUseCase = Objects.requireNonNull(seedSessionPlanUseCase, "seedSessionPlanUseCase");
    }

    static SessionPlannerUseCaseRuntime create(
            SessionPlanRepository repository,
            Function<ServiceRegistry, SessionPlannerPublishedStateRepositoryAdapter> publishedStateFactory,
            ServiceRegistry services
    ) {
        SessionPlannerPartyFactsQueryAdapter partyFacts = new SessionPlannerPartyFactsQueryAdapter(
                services.require(ActivePartyModel.class),
                services.require(AdventuringDayCalculationModel.class));
        SeedSessionPlanUseCase seedSessionPlanUseCase = new SeedSessionPlanUseCase(partyFacts);
        LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase = new LoadCurrentSessionPlanUseCase(
                repository,
                seedSessionPlanUseCase);
        SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase = new SaveCurrentSessionPlanUseCase(
                repository,
                publishedStateFactory.apply(services));
        return new SessionPlannerUseCaseRuntime(
                repository,
                loadCurrentSessionPlanUseCase,
                saveCurrentSessionPlanUseCase,
                seedSessionPlanUseCase);
    }

    SessionPlanRepository repository() {
        return repository;
    }

    LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase() {
        return loadCurrentSessionPlanUseCase;
    }

    SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase() {
        return saveCurrentSessionPlanUseCase;
    }

    SeedSessionPlanUseCase seedSessionPlanUseCase() {
        return seedSessionPlanUseCase;
    }
}
