package src.domain.sessionplanner.session.port;

import src.domain.sessionplanner.session.aggregate.SessionPlan;

public interface SessionPlannerPublishedStateRepository {

    void publishCurrentSession(SessionPlan sessionPlan);
}
