package src.data.sessionplanner.query;

import java.util.List;
import java.util.Objects;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;

final class SessionPlannerEncounterFactsPublishedReadback {

    private SessionEncounterFactsPort.EncounterPlanListFact currentEncounterPlans;
    private EncounterPlanBudgetResult currentPlanBudget;

    SessionPlannerEncounterFactsPublishedReadback(
            SavedEncounterPlanListModel savedPlansModel,
            EncounterPlanBudgetModel planBudgetModel
    ) {
        SavedEncounterPlanListModel savedPlans =
                Objects.requireNonNull(savedPlansModel, "savedPlansModel");
        EncounterPlanBudgetModel planBudget =
                Objects.requireNonNull(planBudgetModel, "planBudgetModel");
        this.currentEncounterPlans = toEncounterPlanListFact(savedPlans.current());
        this.currentPlanBudget = planBudget.current();
        savedPlans.subscribe(result -> currentEncounterPlans = toEncounterPlanListFact(result));
        planBudget.subscribe(result -> currentPlanBudget = result);
    }

    SessionEncounterFactsPort.EncounterPlanListFact listEncounterPlans() {
        return currentEncounterPlans;
    }

    SessionEncounterFactsPort.EncounterPlanFact currentEncounterPlan(long encounterPlanId) {
        EncounterPlanBudgetResult result = currentPlanBudget;
        if (result == null || result.status() != EncounterPlanBudgetStatus.SUCCESS || result.summary() == null) {
            String message = result == null || result.message().isBlank()
                    ? "Encounter-Plan konnte nicht geladen werden."
                    : result.message();
            return SessionEncounterFactsPort.EncounterPlanFact.unavailable(encounterPlanId, message);
        }
        return new SessionEncounterFactsPort.EncounterPlanFact(
                true,
                result.summary().planId(),
                result.summary().name(),
                result.summary().generatedLabel(),
                result.summary().creatureCount(),
                result.summary().totalBaseXp(),
                result.summary().adjustedXp(),
                result.summary().xpMultiplier(),
                result.summary().difficultyLabel(),
                "Adj. XP " + result.summary().adjustedXp() + " · " + result.summary().difficultyLabel());
    }

    private static SessionEncounterFactsPort.EncounterPlanListFact toEncounterPlanListFact(
            SavedEncounterPlanListResult result
    ) {
        if (result == null || result.status() != SavedEncounterPlanStatus.SUCCESS) {
            return new SessionEncounterFactsPort.EncounterPlanListFact(
                    false,
                    List.of(),
                    result == null ? "" : result.message());
        }
        return new SessionEncounterFactsPort.EncounterPlanListFact(
                true,
                result.plans().stream().map(SessionPlannerEncounterFactsPublishedReadback::toSavedEncounterPlanFact).toList(),
                "");
    }

    private static SessionEncounterFactsPort.SavedEncounterPlanFact toSavedEncounterPlanFact(SavedEncounterPlanSummary plan) {
        return new SessionEncounterFactsPort.SavedEncounterPlanFact(
                plan == null ? 0L : plan.planId(),
                plan == null ? "" : plan.name(),
                plan == null ? "" : plan.summaryText());
    }
}
