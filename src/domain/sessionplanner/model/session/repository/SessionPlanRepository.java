package src.domain.sessionplanner.model.session.repository;

import java.util.Optional;
import src.domain.sessionplanner.model.session.SessionPlan;

public interface SessionPlanRepository {

    Optional<SessionPlan> loadCurrent();

    SessionPlan save(SessionPlan sessionPlan);

    long nextSessionId();

    void setCurrentSessionId(long sessionId);
}
