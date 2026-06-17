package src.domain.sessionplanner.model.session.usecase;

import java.util.Objects;
import java.util.Optional;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.model.session.repository.SessionPlannerPublishedStateRepository;

public final class RenameSessionPlanUseCase {

    private final SessionPlanRepository repository;
    private final SessionPlannerPublishedStateRepository publishedStateRepository;

    public RenameSessionPlanUseCase(
            SessionPlanRepository repository,
            SessionPlannerPublishedStateRepository publishedStateRepository
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(long sessionId, String displayName) {
        if (sessionId <= 0L || displayName == null || displayName.isBlank()) {
            return;
        }
        repository.rename(sessionId, displayName);
        Optional<SessionPlan> loaded = repository.loadById(sessionId);
        if (loaded.isPresent()) {
            publishedStateRepository.publishCurrentSession(
                    loaded.get().clearStatus().withStatus("Session umbenannt."));
        }
    }
}
