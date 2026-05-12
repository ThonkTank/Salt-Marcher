package src.domain.sessionplanner.model.session.repository;

import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;

public interface SessionEncounterFactsRepository {

    SessionEncounterFactsPort.EncounterPlanFact loadEncounterPlan(long encounterPlanId);
}
