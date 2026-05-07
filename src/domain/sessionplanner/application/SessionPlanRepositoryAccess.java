package src.domain.sessionplanner.application;

import java.util.Objects;
import java.util.Optional;
import src.domain.sessionplanner.session.aggregate.SessionPlan;
import src.domain.sessionplanner.session.port.SessionPlanRepository;

final class SessionPlanRepositoryAccess {

    private final SessionPlanRepository repository;

    SessionPlanRepositoryAccess(SessionPlanRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    Optional<SessionPlan> loadCurrent() {
        return repository.loadCurrent().map(SessionPlan::clearStatus);
    }

    SessionPlan save(SessionPlan candidate) {
        return repository.save(candidate);
    }

    SessionPlan saveAsCurrent(SessionPlan candidate) {
        SessionPlan saved = repository.save(candidate);
        repository.setCurrentSessionId(saved.sessionId());
        return saved;
    }

    long nextSessionId() {
        return repository.nextSessionId();
    }
}
