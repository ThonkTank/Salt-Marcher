package src.domain.sessionplanner.model.session.usecase;

import java.util.Objects;
import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository;

public final class SaveCurrentSessionPlanUseCase {

    private static final String SAVE_FAILURE_STATUS = "Session konnte nicht gespeichert werden.";

    private final SessionPlanRepository repository;
    private final SessionPlannerPublishedStateRepository publishedStateRepository;

    public SaveCurrentSessionPlanUseCase(
            SessionPlanRepository repository,
            SessionPlannerPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public SessionPlan execute(SessionPlan sessionPlan) {
        SessionPlan persisted = persist(Objects.requireNonNull(sessionPlan, "sessionPlan"), false);
        publishedStateRepository.publishCurrentSession(persisted);
        return persisted;
    }

    public SessionPlan executeNewCurrent(SessionPlan sessionPlan) {
        SessionPlan persisted = persist(Objects.requireNonNull(sessionPlan, "sessionPlan"), true);
        publishedStateRepository.publishCurrentSession(persisted);
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
