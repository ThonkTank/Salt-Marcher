package src.domain.sessionplanner.session.port;

import src.domain.sessionplanner.session.aggregate.SessionPlan;

public interface SessionPlannerRuntimeRepository
        extends SessionPlanRepository, SessionPartyFactsLookup, SessionEncounterFactsLookup {

    void publishCurrentSession(SessionPlan sessionPlan);
}
