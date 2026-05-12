package src.data.sessionplanner.repository;

import java.util.Objects;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.sessionplanner.model.session.model.SessionEncounterPlanFact;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;

public final class SessionPlannerEncounterFactsRepositoryAdapter implements SessionEncounterFactsRepository {

    private final EncounterApplicationService encounters;
    private final SessionEncounterFactsPort encounterFacts;

    public SessionPlannerEncounterFactsRepositoryAdapter(
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
