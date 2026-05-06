package src.domain.sessionplanner.session.port;

import src.domain.sessionplanner.session.aggregate.SessionPlan;

public interface SessionPlannerPublishedStatePort {

    void publishCurrentSession(SessionPlan sessionPlan);

    void refreshPublishedState();
}
