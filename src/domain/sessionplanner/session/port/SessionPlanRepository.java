package src.domain.sessionplanner.session.port;

import java.util.Optional;
import src.domain.sessionplanner.session.aggregate.SessionPlan;

public interface SessionPlanRepository {

    Optional<SessionPlan> loadCurrent();

    SessionPlan save(SessionPlan sessionPlan);

    long nextSessionId();

    void setCurrentSessionId(long sessionId);
}
