package src.domain.sessionplanner.model.session.repository;

import src.domain.sessionplanner.model.session.model.SessionPlan;

public interface SessionPlannerPublishedStateRepository {

    void publishCurrentSession(SessionPlan sessionPlan);
}
