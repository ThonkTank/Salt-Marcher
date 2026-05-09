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
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;

final class SessionPlannerEncounterFactsPublishedReadback {

    private SessionEncounterFactsLookup.EncounterPlanListFact currentEncounterPlans;
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

    SessionEncounterFactsLookup.EncounterPlanListFact listEncounterPlans() {
        return currentEncounterPlans;
    }

    SessionEncounterFactsLookup.EncounterPlanFact currentEncounterPlan(long encounterPlanId) {
        EncounterPlanBudgetResult result = currentPlanBudget;
        if (result == null || result.status() != EncounterPlanBudgetStatus.SUCCESS || result.summary() == null) {
            String message = result == null || result.message().isBlank()
                    ? "Encounter-Plan konnte nicht geladen werden."
                    : result.message();
            return SessionEncounterFactsLookup.EncounterPlanFact.unavailable(encounterPlanId, message);
        }
        return new SessionEncounterFactsLookup.EncounterPlanFact(
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

    private static SessionEncounterFactsLookup.EncounterPlanListFact toEncounterPlanListFact(
            SavedEncounterPlanListResult result
    ) {
        if (result == null || result.status() != SavedEncounterPlanStatus.SUCCESS) {
            return new SessionEncounterFactsLookup.EncounterPlanListFact(
                    false,
                    List.of(),
                    result == null ? "" : result.message());
        }
        return new SessionEncounterFactsLookup.EncounterPlanListFact(
                true,
                result.plans().stream().map(SessionPlannerEncounterFactsPublishedReadback::toSavedEncounterPlanFact).toList(),
                "");
    }

    private static SessionEncounterFactsLookup.SavedEncounterPlanFact toSavedEncounterPlanFact(SavedEncounterPlanSummary plan) {
        return new SessionEncounterFactsLookup.SavedEncounterPlanFact(
                plan == null ? 0L : plan.planId(),
                plan == null ? "" : plan.name(),
                plan == null ? "" : plan.summaryText());
    }
}
