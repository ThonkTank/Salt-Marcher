package src.domain.sessionplanner.model.session.usecase;

import java.util.Objects;
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;

public final class SaveCurrentSessionPlanUseCase {

    private static final String SAVE_FAILURE_STATUS = "Session konnte nicht gespeichert werden.";

    private final SessionPlanRepository repository;
    private final LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase;

    public SaveCurrentSessionPlanUseCase(
            SessionPlanRepository repository,
            LoadCurrentSessionPlanUseCase loadCurrentSessionPlanUseCase
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.loadCurrentSessionPlanUseCase = Objects.requireNonNull(loadCurrentSessionPlanUseCase, "loadCurrentSessionPlanUseCase");
    }

    public SessionPlan execute(SessionPlan sessionPlan) {
        SessionPlan persisted = persist(Objects.requireNonNull(sessionPlan, "sessionPlan"), false);
        loadCurrentSessionPlanUseCase.replaceCached(persisted);
        return persisted;
    }

    public SessionPlan executeNewCurrent(SessionPlan sessionPlan) {
        SessionPlan persisted = persist(Objects.requireNonNull(sessionPlan, "sessionPlan"), true);
        loadCurrentSessionPlanUseCase.replaceCached(persisted);
        return persisted;
    }

    private SessionPlan persist(SessionPlan candidate, boolean persistAsCurrent) {
        try {
            SessionPlan saved = repository.save(candidate);
            if (persistAsCurrent) {
                repository.setCurrentSessionId(saved.sessionId());
            }
            return saved;
        } catch (IllegalStateException exception) {
            return candidate.clearStatus().withStatus(SAVE_FAILURE_STATUS);
        }
    }
}
