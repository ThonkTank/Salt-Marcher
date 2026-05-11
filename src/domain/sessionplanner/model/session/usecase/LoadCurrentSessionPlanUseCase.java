package src.domain.sessionplanner.model.session.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;

public final class LoadCurrentSessionPlanUseCase {

    private static final long INITIAL_SESSION_ID = 1L;
    private static final String LOAD_FAILURE_STATUS = "Session konnte nicht geladen werden.";

    private final SessionPlanRepository repository;
    private final SeedSessionPlanUseCase seedSessionPlanUseCase;

    public LoadCurrentSessionPlanUseCase(
            SessionPlanRepository repository,
            SeedSessionPlanUseCase seedSessionPlanUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.seedSessionPlanUseCase = Objects.requireNonNull(seedSessionPlanUseCase, "seedSessionPlanUseCase");
    }

    public SessionPlan execute() {
        return loadCurrentOrSeed();
    }

    private SessionPlan loadCurrentOrSeed() {
        try {
            Optional<SessionPlan> currentSession = repository.loadCurrent();
            if (currentSession.isPresent()) {
                return currentSession.get().clearStatus();
            }
            return seedSessionPlanUseCase.execute(INITIAL_SESSION_ID);
        } catch (IllegalStateException exception) {
            return fallbackSession(LOAD_FAILURE_STATUS);
        }
    }

    private SessionPlan fallbackSession(String statusText) {
        return seedSessionPlanUseCase.execute(INITIAL_SESSION_ID).withStatus(statusText);
    }
}
