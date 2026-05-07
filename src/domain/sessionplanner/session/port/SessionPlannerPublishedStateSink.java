package src.domain.sessionplanner.session.port;

import src.domain.sessionplanner.session.aggregate.SessionPlan;

public interface SessionPlannerPublishedStateSink {

    void publishCurrentSession(SessionPlan sessionPlan);
}
