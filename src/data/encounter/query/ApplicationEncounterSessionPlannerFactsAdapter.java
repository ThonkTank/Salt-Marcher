package src.data.encounter.query;

import java.util.List;
import java.util.Objects;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.application.EncounterPlanBoundaryTranslator;
import src.domain.encounter.application.ListSavedEncounterPlansUseCase;
import src.domain.encounter.application.LoadEncounterPlanBudgetUseCase;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.plan.value.EncounterPlanSummary;
import src.domain.encounter.session.port.EncounterPartyFactsRepository;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;

public final class ApplicationEncounterSessionPlannerFactsAdapter implements SessionEncounterFactsLookup {

    private static final String PLAN_LIST_UNAVAILABLE = "Encounter-Plaene konnten nicht geladen werden.";
    private static final String PLAN_UNAVAILABLE = "Encounter-Plan konnte nicht geladen werden.";

    private final ListSavedEncounterPlansUseCase listSavedPlansUseCase;
    private final LoadEncounterPlanBudgetUseCase loadPlanBudgetUseCase;

    public ApplicationEncounterSessionPlannerFactsAdapter(
            EncounterPlanRepository plans,
            EncounterPartyFactsRepository party,
            CreaturesApplicationService creatures
    ) {
        this.listSavedPlansUseCase = new ListSavedEncounterPlansUseCase(Objects.requireNonNull(plans, "plans"));
        this.loadPlanBudgetUseCase = new LoadEncounterPlanBudgetUseCase(
                plans,
                Objects.requireNonNull(party, "party"),
                Objects.requireNonNull(creatures, "creatures"));
    }

    @Override
    public EncounterPlanListFact listEncounterPlans() {
        ListSavedEncounterPlansUseCase.Result result = listSavedPlansUseCase.execute();
        if (result.status() != ListSavedEncounterPlansUseCase.Status.SUCCESS) {
            return new EncounterPlanListFact(false, List.of(), fallbackMessage(result.message(), PLAN_LIST_UNAVAILABLE));
        }
        return new EncounterPlanListFact(
                true,
                result.plans().stream().map(ApplicationEncounterSessionPlannerFactsAdapter::toSavedEncounterPlanFact).toList(),
                "");
    }

    @Override
    public EncounterPlanFact loadEncounterPlan(long encounterPlanId) {
        try {
            LoadEncounterPlanBudgetUseCase.Result result = loadPlanBudgetUseCase.execute(encounterPlanId);
            if (result.status() != LoadEncounterPlanBudgetUseCase.Status.SUCCESS || result.summary() == null) {
                return EncounterPlanFact.unavailable(
                        encounterPlanId,
                        fallbackMessage(result.message(), PLAN_UNAVAILABLE));
            }
            LoadEncounterPlanBudgetUseCase.PlanBudgetSummary summary = result.summary();
            return new EncounterPlanFact(
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
        } catch (IllegalStateException exception) {
            return EncounterPlanFact.unavailable(encounterPlanId, PLAN_UNAVAILABLE);
        }
    }

    private static SavedEncounterPlanFact toSavedEncounterPlanFact(EncounterPlanSummary plan) {
        return new SavedEncounterPlanFact(
                plan == null ? 0L : plan.id(),
                plan == null ? "" : plan.name(),
                plan == null ? "" : EncounterPlanBoundaryTranslator.summaryText(
                        plan.generatedLabel(),
                        plan.creatureCount()));
    }

    private static String fallbackMessage(String message, String fallback) {
        return message == null || message.isBlank() ? fallback : message;
    }
}
