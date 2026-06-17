package src.domain.sessionplanner.model.session.usecase;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.SessionPlanSummary;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository;

public final class DeleteSessionPlanUseCase {

    private static final long NO_SESSION_ID = 0L;

    private final SessionPlanRepository repository;
    private final SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase;
    private final SeedSessionPlanUseCase seedSessionPlanUseCase;
    private final SessionPlannerPublishedStateRepository publishedStateRepository;

    public DeleteSessionPlanUseCase(
            SessionPlanRepository repository,
            SaveCurrentSessionPlanUseCase saveCurrentSessionPlanUseCase,
            SeedSessionPlanUseCase seedSessionPlanUseCase,
            SessionPlannerPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.saveCurrentSessionPlanUseCase = Objects.requireNonNull(
                saveCurrentSessionPlanUseCase,
                "saveCurrentSessionPlanUseCase");
        this.seedSessionPlanUseCase = Objects.requireNonNull(seedSessionPlanUseCase, "seedSessionPlanUseCase");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(long sessionId) {
        if (sessionId <= NO_SESSION_ID) {
            return;
        }
        repository.delete(sessionId);
        List<SessionPlanSummary> remaining = repository.listSessions();
        if (remaining.isEmpty()) {
            saveCurrentSessionPlanUseCase.executeNewCurrent(
                    seedSessionPlanUseCase.execute(repository.nextSessionId()).withStatus("Session geloescht."));
            return;
        }
        Optional<SessionPlan> fallback = repository.loadById(remaining.get(0).sessionId());
        if (fallback.isPresent()) {
            selectFallback(fallback.get().clearStatus().withStatus("Session geloescht."));
        }
    }

    private void selectFallback(SessionPlan sessionPlan) {
        repository.setCurrentSessionId(sessionPlan.sessionId());
        publishedStateRepository.publishCurrentSession(sessionPlan);
    }
}
