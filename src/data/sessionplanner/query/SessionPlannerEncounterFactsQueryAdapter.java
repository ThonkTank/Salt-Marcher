package src.data.sessionplanner.query;

import java.util.Objects;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.RefreshEncounterPlanBudgetCommand;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;

public final class SessionPlannerEncounterFactsQueryAdapter
        implements SessionEncounterFactsPort, SessionEncounterFactsRepository {

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
    public EncounterPlanListFact encounterPlans() {
        return encounterReadback.encounterPlans();
    }

    @Override
    public EncounterPlanFact encounterPlan(long encounterPlanId) {
        return encounterReadback.currentEncounterPlan(encounterPlanId);
    }

    @Override
    public EncounterPlanDetailFact loadEncounterPlan(long encounterPlanId) {
        encounters.refreshPlanBudget(new RefreshEncounterPlanBudgetCommand(encounterPlanId));
        EncounterPlanFact fact = encounterPlan(encounterPlanId);
        return new EncounterPlanDetailFact(
                fact.available(),
                fact.planId(),
                fact.name(),
                fact.generatedLabel(),
                fact.creatureCount(),
                fact.totalBaseXp(),
                fact.adjustedXp(),
                fact.xpMultiplier(),
                fact.difficultyLabel(),
                fact.statusText());
    }
}
