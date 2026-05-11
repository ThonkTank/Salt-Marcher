package src.domain.sessionplanner.model.session.usecase;

import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;

public final class LoadCurrentSessionPlanUseCase {

    private static final long INITIAL_SESSION_ID = 1L;
    private static final String LOAD_FAILURE_STATUS = "Session konnte nicht geladen werden.";

    private final SessionPlanRepository repository;
    private final SeedSessionPlanUseCase seedSessionPlanUseCase;
    private @Nullable SessionPlan currentSession;

    public LoadCurrentSessionPlanUseCase(
            SessionPlanRepository repository,
            SeedSessionPlanUseCase seedSessionPlanUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.seedSessionPlanUseCase = Objects.requireNonNull(seedSessionPlanUseCase, "seedSessionPlanUseCase");
    }

    public SessionPlan execute() {
        if (currentSession == null) {
            currentSession = loadCurrentOrSeed();
        }
        return currentSession;
    }

    void replaceCached(SessionPlan sessionPlan) {
        currentSession = Objects.requireNonNull(sessionPlan, "sessionPlan");
    }

    private SessionPlan loadCurrentOrSeed() {
        try {
            return loadCurrent().orElseGet(() -> createSeeded(INITIAL_SESSION_ID));
        } catch (IllegalStateException exception) {
            return fallbackSession(LOAD_FAILURE_STATUS);
        }
    }

    private Optional<SessionPlan> loadCurrent() {
        return repository.loadCurrent().map(SessionPlan::clearStatus);
    }

    private SessionPlan createSeeded(long sessionId) {
        return seedSessionPlanUseCase.execute(sessionId);
    }

    private SessionPlan fallbackSession(String statusText) {
        SessionPlan base = currentSession == null
                ? createSeeded(INITIAL_SESSION_ID)
                : currentSession.clearStatus();
        return base.withStatus(statusText);
    }
}
