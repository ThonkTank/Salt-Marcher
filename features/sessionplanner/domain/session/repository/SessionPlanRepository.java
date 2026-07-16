package features.sessionplanner.domain.session.repository;

import java.util.List;
import java.util.Optional;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionPlanSummary;

public interface SessionPlanRepository {

    Optional<SessionPlan> loadCurrent();

    Optional<SessionPlan> loadById(long sessionId);

    List<SessionPlanSummary> listSessions();

    SessionPlan save(SessionPlan sessionPlan);

    void rename(long sessionId, String displayName);

    void delete(long sessionId);

    long nextSessionId();

    void setCurrentSessionId(long sessionId);
}
