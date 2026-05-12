package src.data.sessionplanner.query;

import java.util.Objects;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.sessionplanner.model.session.model.SessionEncounterPlanFact;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;

public final class SessionPlannerEncounterFactsQueryAdapter implements SessionEncounterFactsPort {

    private final SessionPlannerEncounterFactsPublishedReadback encounterReadback;

    public SessionPlannerEncounterFactsQueryAdapter(
            SavedEncounterPlanListModel savedPlansModel,
            EncounterPlanBudgetModel planBudgetModel
    ) {
        this.encounterReadback = new SessionPlannerEncounterFactsPublishedReadback(
                savedPlansModel,
                planBudgetModel);
    }

    @Override
    public EncounterPlanListFact encounterPlans() {
        return encounterReadback.encounterPlans();
    }

    @Override
    public SessionEncounterPlanFact encounterPlan(long encounterPlanId) {
        return encounterReadback.currentEncounterPlan(encounterPlanId);
    }
}
