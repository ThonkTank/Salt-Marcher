package features.sessionplanner.domain.session.repository;

import java.util.List;
import java.util.Optional;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionPlanSummary;

public interface SessionPlanRepository {

    Optional<SessionPlan> loadCurrent();

    Optional<SessionPlan> loadById(long sessionId);

    List<SessionPlanSummary> listSessions();

    SessionPlanSaveResult insert(SessionPlan sessionPlan);

    SessionPlanSaveResult save(SessionPlan sessionPlan);

    void delete(long sessionId);

    long nextSessionId();

    void setCurrentSessionId(long sessionId);
}
