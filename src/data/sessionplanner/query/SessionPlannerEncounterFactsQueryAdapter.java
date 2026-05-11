package src.data.sessionplanner.query;

import java.util.Objects;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsLookup;

public final class SessionPlannerEncounterFactsQueryAdapter implements SessionEncounterFactsLookup {

    private final EncounterApplicationService encounters;
    private final SessionPlannerEncounterFactsPublishedReadback encounterReadback;

    public SessionPlannerEncounterFactsQueryAdapter(
            EncounterApplicationService encounters,
            SavedEncounterPlanListModel savedPlansModel,
            EncounterPlanBudgetModel planBudgetModel
    ) {
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.encounterReadback = new SessionPlannerEncounterFactsPublishedReadback(
                savedPlansModel,
                planBudgetModel);
    }

    @Override
    public EncounterPlanListFact listEncounterPlans() {
        return encounterReadback.listEncounterPlans();
    }

    @Override
    public EncounterPlanFact loadEncounterPlan(long encounterPlanId) {
        encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(encounterPlanId));
        return encounterReadback.currentEncounterPlan(encounterPlanId);
    }
}
