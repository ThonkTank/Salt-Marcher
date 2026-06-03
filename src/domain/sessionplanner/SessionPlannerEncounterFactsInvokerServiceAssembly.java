package src.domain.sessionplanner;

import java.util.Objects;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.sessionplanner.model.session.SessionEncounterPlanFact;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;

final class SessionPlannerEncounterFactsInvokerServiceAssembly implements SessionEncounterFactsRepository {

    private final EncounterApplicationService encounters;
    private final SessionEncounterFactsPort encounterFacts;

    SessionPlannerEncounterFactsInvokerServiceAssembly(
            EncounterApplicationService encounters,
            SessionEncounterFactsPort encounterFacts
    ) {
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.encounterFacts = Objects.requireNonNull(encounterFacts, "encounterFacts");
    }

    @Override
    public SessionEncounterPlanFact loadEncounterPlan(long encounterPlanId) {
        encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(encounterPlanId));
        return encounterFacts.encounterPlan(encounterPlanId);
    }
}
