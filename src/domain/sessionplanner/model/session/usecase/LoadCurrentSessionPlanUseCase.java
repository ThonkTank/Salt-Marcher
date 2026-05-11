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
    private final CurrentSessionPlanState currentState = new CurrentSessionPlanState();

    public LoadCurrentSessionPlanUseCase(
            SessionPlanRepository repository,
            SeedSessionPlanUseCase seedSessionPlanUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.seedSessionPlanUseCase = Objects.requireNonNull(seedSessionPlanUseCase, "seedSessionPlanUseCase");
    }

    public SessionPlan execute() {
        SessionPlan currentSession = currentState.currentSession();
        if (currentSession == null) {
            currentSession = loadCurrentOrSeed();
            currentState.replace(currentSession);
        }
        return currentSession;
    }

    void replaceCached(SessionPlan sessionPlan) {
        currentState.replace(Objects.requireNonNull(sessionPlan, "sessionPlan"));
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
        SessionPlan currentSession = currentState.currentSession();
        SessionPlan base = currentSession == null
                ? seedSessionPlanUseCase.execute(INITIAL_SESSION_ID)
                : currentSession.clearStatus();
        return base.withStatus(statusText);
    }

    private static final class CurrentSessionPlanState {

        private @Nullable SessionPlan currentSession;

        private @Nullable SessionPlan currentSession() {
            return currentSession;
        }

        private void replace(SessionPlan sessionPlan) {
            currentSession = sessionPlan;
        }
    }
}
