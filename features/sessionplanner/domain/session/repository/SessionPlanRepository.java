package features.sessionplanner.domain.session.repository;

import java.util.List;
import java.util.Optional;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionPlanSummary;
import features.sessionplanner.domain.session.SessionRevision;

public interface SessionPlanRepository {

    Optional<SessionPlan> loadCurrent();

    Optional<SessionPlan> loadById(long sessionId);

    List<SessionPlanSummary> listSessions();

    SessionPlanSaveResult insert(SessionPlan sessionPlan);

    SessionPlanSaveResult save(SessionPlan sessionPlan);

    SessionPlanDeleteResult deleteGuarded(
            long sessionId,
            SessionRevision expectedRevision,
            List<Long> replacementParticipantRefs
    );

    long nextSessionId();

    void setCurrentSessionId(long sessionId);
}
