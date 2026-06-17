package src.domain.sessionplanner;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import shell.api.ServiceRegistry;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;

final class SessionPlannerApplicationServicesServiceAssembly {

    private final SessionPlanRepository repository;
    private final SessionPlannerPublishedStateServiceAssembly publishedState;
    private final AtomicReference<UseCaseRuntime> runtime = new AtomicReference<>();

    SessionPlannerApplicationServicesServiceAssembly(
            SessionPlanRepository repository,
            SessionPlannerPublishedStateServiceAssembly publishedState
    ) {
        this.repository = repository;
        this.publishedState = publishedState;
    }

    SessionPlannerApplicationService createSessionPlanner(ServiceRegistry services) {
        UseCaseRuntime runtime = runtime(services);
        return new SessionPlannerApplicationService(
                new src.domain.sessionplanner.model.session.usecase.CreateSessionPlanUseCase(
                        runtime.repository,
                        runtime.saveCurrentSessionPlanUseCase,
                        runtime.seedSessionPlanUseCase),
                new src.domain.sessionplanner.model.session.usecase.SelectSessionPlanUseCase(
                        runtime.repository,
                        runtime.publishedStateRepository),
                new src.domain.sessionplanner.model.session.usecase.RenameSessionPlanUseCase(
                        runtime.repository,
                        runtime.publishedStateRepository),
                new src.domain.sessionplanner.model.session.usecase.DeleteSessionPlanUseCase(
                        runtime.repository,
                        runtime.saveCurrentSessionPlanUseCase,
                        runtime.seedSessionPlanUseCase,
                        runtime.publishedStateRepository));
    }

    SessionPlannerParticipantApplicationService createParticipants(ServiceRegistry services) {
        UseCaseRuntime runtime = runtime(services);
        return new SessionPlannerParticipantApplicationService(
                new src.domain.sessionplanner.model.session.usecase.AddSessionParticipantUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase),
                new src.domain.sessionplanner.model.session.usecase.RemoveSessionParticipantUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase));
    }

    SessionPlannerEncounterApplicationService createEncounters(ServiceRegistry services) {
        UseCaseRuntime runtime = runtime(services);
        return new SessionPlannerEncounterApplicationService(
                new src.domain.sessionplanner.model.session.usecase.SetSessionEncounterDaysUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase),
                new src.domain.sessionplanner.model.session.usecase.AttachSessionEncounterUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase),
                new src.domain.sessionplanner.model.session.usecase.RemoveSessionEncounterUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase),
                new src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterUpUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase),
                new src.domain.sessionplanner.model.session.usecase.MoveSessionEncounterDownUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase),
                new src.domain.sessionplanner.model.session.usecase.SetSessionEncounterAllocationUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase),
                new src.domain.sessionplanner.model.session.usecase.SelectSessionEncounterUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase));
    }

    SessionPlannerRestApplicationService createRests(ServiceRegistry services) {
        UseCaseRuntime runtime = runtime(services);
        return new SessionPlannerRestApplicationService(
                new src.domain.sessionplanner.model.session.usecase.SetSessionRestGapUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase),
                new src.domain.sessionplanner.model.session.usecase.ClearSessionRestGapUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase));
    }

    SessionPlannerLootApplicationService createLoot(ServiceRegistry services) {
        UseCaseRuntime runtime = runtime(services);
        return new SessionPlannerLootApplicationService(
                new src.domain.sessionplanner.model.session.usecase.AddSessionLootPlaceholderUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase),
                new src.domain.sessionplanner.model.session.usecase.RemoveSessionLootPlaceholderUseCase(
                        runtime.loadCurrentSessionPlanUseCase,
                        runtime.saveCurrentSessionPlanUseCase));
    }

    private UseCaseRuntime runtime(ServiceRegistry services) {
        UseCaseRuntime existing = runtime.get();
        if (existing != null) {
            return existing;
        }
        UseCaseRuntime candidate = runtimeCandidate(services);
        return runtime.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(runtime.get(), "runtime");
    }

    private UseCaseRuntime runtimeCandidate(ServiceRegistry services) {
        SessionPartyFactsPort partyFacts = new SessionPlannerPartyFactsReadbackServiceAssembly(
                services.require(ActivePartyModel.class),
                services.require(AdventuringDayCalculationModel.class));
        src.domain.sessionplanner.model.session.usecase.SeedSessionPlanUseCase seedSessionPlanUseCase =
                new src.domain.sessionplanner.model.session.usecase.SeedSessionPlanUseCase(partyFacts);
        src.domain.sessionplanner.model.session.usecase.LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase =
                new src.domain.sessionplanner.model.session.usecase.LoadCurrentSessionPlanUseCase(
                        repository,
                        seedSessionPlanUseCase);
        src.domain.sessionplanner.model.session.usecase.SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase =
                new src.domain.sessionplanner.model.session.usecase.SaveCurrentSessionPlanUseCase(
                        repository,
                        publishedState.create(services));
        return new UseCaseRuntime(
                repository,
                loadCurrentSessionPlanUseCase,
                saveCurrentSessionPlanUseCase,
                seedSessionPlanUseCase,
                publishedState.create(services));
    }

    private static final class UseCaseRuntime {

        private final SessionPlanRepository repository;
        private final src.domain.sessionplanner.model.session.usecase.LoadCurrentSessionPlanUseCase
                loadCurrentSessionPlanUseCase;
        private final src.domain.sessionplanner.model.session.usecase.SaveCurrentSessionPlanUseCase
                saveCurrentSessionPlanUseCase;
        private final src.domain.sessionplanner.model.session.usecase.SeedSessionPlanUseCase seedSessionPlanUseCase;
        private final src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository
                publishedStateRepository;

        private UseCaseRuntime(
                SessionPlanRepository repository,
                src.domain.sessionplanner.model.session.usecase.LoadCurrentSessionPlanUseCase
                        loadCurrentSessionPlanUseCase,
                src.domain.sessionplanner.model.session.usecase.SaveCurrentSessionPlanUseCase
                        saveCurrentSessionPlanUseCase,
                src.domain.sessionplanner.model.session.usecase.SeedSessionPlanUseCase seedSessionPlanUseCase,
                src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository
                        publishedStateRepository
        ) {
            this.repository = repository;
            this.loadCurrentSessionPlanUseCase = loadCurrentSessionPlanUseCase;
            this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
            this.seedSessionPlanUseCase = seedSessionPlanUseCase;
            this.publishedStateRepository = publishedStateRepository;
        }
    }
}
