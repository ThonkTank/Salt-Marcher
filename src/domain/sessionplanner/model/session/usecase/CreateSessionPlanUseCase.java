package src.domain.sessionplanner.model.session.usecase;

import java.util.Objects;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;

public final class CreateSessionPlanUseCase {

    private static final long INITIAL_SESSION_ID = 1L;

    private final SessionIdReader nextSessionIdReader;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;
    private final SeedSessionPlanUseCase seedSessionPlanUseCase;

    public CreateSessionPlanUseCase(
            SessionPlanRepository repository,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase,
            SeedSessionPlanUseCase seedSessionPlanUseCase
    ) {
        nextSessionIdReader = Objects.requireNonNull(repository, "repository")::nextSessionId;
        this.saveCurrentSessionPlanUseCase = Objects.requireNonNull(
                saveCurrentSessionPlanUseCase,
                "saveCurrentSessionPlanUseCase");
        this.seedSessionPlanUseCase = Objects.requireNonNull(seedSessionPlanUseCase, "seedSessionPlanUseCase");
    }

    public void execute() {
        saveCurrentSessionPlanUseCase.executeNewCurrent(
                seedSessionPlanUseCase.execute(nextSessionId()).withStatus("Neue Session erstellt."));
    }

    private long nextSessionId() {
        try {
            return Math.max(INITIAL_SESSION_ID, nextSessionIdReader.nextSessionId());
        } catch (IllegalStateException exception) {
            return INITIAL_SESSION_ID;
        }
    }

    private interface SessionIdReader {
        long nextSessionId();
    }
}
