package src.domain.sessionplanner.model.session.repository;

import src.domain.sessionplanner.model.session.model.SessionEncounterPlanFact;

public interface SessionEncounterFactsRepository {

    SessionEncounterPlanFact loadEncounterPlan(long encounterPlanId);
}
