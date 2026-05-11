package src.domain.sessionplanner.model.session.usecase;

import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;

public final class CreateSessionPlanUseCase {

    private static final long INITIAL_SESSION_ID = 1L;

    private final SessionPlanRepository repository;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;
    private final SeedSessionPlanUseCase seedSessionPlanUseCase;

    public CreateSessionPlanUseCase(
            SessionPlanRepository repository,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase,
            SeedSessionPlanUseCase seedSessionPlanUseCase
    ) {
        this.repository = repository;
        this.saveCurrentSessionPlanUseCase = saveCurrentSessionPlanUseCase;
        this.seedSessionPlanUseCase = seedSessionPlanUseCase;
    }

    public void execute() {
        saveCurrentSessionPlanUseCase.executeNewCurrent(
                seedSessionPlanUseCase.execute(nextSessionId()).withStatus("Neue Session erstellt."));
    }

    private long nextSessionId() {
        try {
            return Math.max(INITIAL_SESSION_ID, repository.nextSessionId());
        } catch (IllegalStateException exception) {
            return INITIAL_SESSION_ID;
        }
    }
}
