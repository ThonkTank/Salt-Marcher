package src.domain.sessionplanner.model.session.port;

import src.domain.sessionplanner.model.session.SessionEncounterPlanListFact;
import src.domain.sessionplanner.model.session.SessionEncounterPlanFact;

public interface SessionEncounterFactsPort {

    SessionEncounterPlanListFact encounterPlans();

    SessionEncounterPlanFact encounterPlan(long encounterPlanId);
}
