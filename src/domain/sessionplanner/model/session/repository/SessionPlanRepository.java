package src.domain.sessionplanner.model.session.repository;

import java.util.List;
import java.util.Optional;
import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.SessionPlanSummary;

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
