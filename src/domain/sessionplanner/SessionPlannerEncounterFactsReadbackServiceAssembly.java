package src.domain.sessionplanner;

import java.util.List;
import java.util.Objects;
import src.domain.encounter.published.EncounterPlanBudgetModel;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.published.SavedEncounterPlanListModel;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.sessionplanner.model.session.model.SessionEncounterPlanFact;
import src.domain.sessionplanner.model.session.model.SessionEncounterPlanListFact;
import src.domain.sessionplanner.model.session.model.SessionSavedEncounterPlanFact;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;

final class SessionPlannerEncounterFactsReadbackServiceAssembly implements SessionEncounterFactsPort {

    private SessionEncounterPlanListFact currentEncounterPlans;
    private EncounterPlanBudgetResult currentPlanBudget;

    SessionPlannerEncounterFactsReadbackServiceAssembly(
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

    @Override
    public SessionEncounterPlanListFact encounterPlans() {
        return currentEncounterPlans;
    }

    @Override
    public SessionEncounterPlanFact encounterPlan(long encounterPlanId) {
        EncounterPlanBudgetResult result = currentPlanBudget;
        if (result == null || result.status() != EncounterPlanBudgetStatus.SUCCESS || result.summary() == null) {
            String message = result == null || result.message().isBlank()
                    ? "Encounter-Plan konnte nicht geladen werden."
                    : result.message();
            return SessionEncounterPlanFact.unavailable(encounterPlanId, message);
        }
        EncounterPlanBudgetSummary summary = result.summary();
        return new SessionEncounterPlanFact(
                true,
                summary.planId(),
                summary.name(),
                summary.generatedLabel(),
                summary.creatureCount(),
                summary.totalBaseXp(),
                summary.adjustedXp(),
                summary.xpMultiplier(),
                summary.difficultyLabel(),
                "Adj. XP " + summary.adjustedXp() + " · " + summary.difficultyLabel());
    }

    private static SessionEncounterPlanListFact toEncounterPlanListFact(SavedEncounterPlanListResult result) {
        if (result == null || result.status() != SavedEncounterPlanStatus.SUCCESS) {
            return new SessionEncounterPlanListFact(
                    false,
                    List.of(),
                    result == null ? "" : result.message());
        }
        return new SessionEncounterPlanListFact(
                true,
                result.plans().stream()
                        .map(SessionPlannerEncounterFactsReadbackServiceAssembly::toSavedEncounterPlanFact)
                        .toList(),
                "");
    }

    private static SessionSavedEncounterPlanFact toSavedEncounterPlanFact(SavedEncounterPlanSummary plan) {
        return new SessionSavedEncounterPlanFact(
                plan == null ? 0L : plan.planId(),
                plan == null ? "" : plan.name(),
                plan == null ? "" : plan.summaryText());
    }
}
