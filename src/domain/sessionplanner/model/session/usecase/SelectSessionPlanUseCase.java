package src.domain.sessionplanner.model.session.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository;

public final class SelectSessionPlanUseCase {

    private static final long NO_SESSION_ID = 0L;

    private final SessionPlanRepository repository;
    private final SessionPlannerPublishedStateRepository publishedStateRepository;

    public SelectSessionPlanUseCase(
            SessionPlanRepository repository,
            SessionPlannerPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(long sessionId) {
        if (sessionId <= NO_SESSION_ID) {
            return;
        }
        Optional<SessionPlan> loaded = repository.loadById(sessionId);
        if (loaded.isPresent()) {
            publishSelected(loaded.get());
        }
    }

    private void publishSelected(SessionPlan sessionPlan) {
        repository.setCurrentSessionId(sessionPlan.sessionId());
        publishedStateRepository.publishCurrentSession(sessionPlan.clearStatus().withStatus("Session geoeffnet."));
    }
}
