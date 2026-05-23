package src.domain.sessionplanner.model.session.port;

import src.domain.sessionplanner.model.session.model.SessionEncounterPlanListFact;
import src.domain.sessionplanner.model.session.model.SessionEncounterPlanFact;

public interface SessionEncounterFactsPort {

    SessionEncounterPlanListFact encounterPlans();

    SessionEncounterPlanFact encounterPlan(long encounterPlanId);
}
