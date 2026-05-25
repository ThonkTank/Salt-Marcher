package src.domain.encounter;

import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.plan.model.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.model.EncounterPlanBudgetSummaryData;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;

final class EncounterPlanBudgetProjectionServiceAssembly {

    private EncounterPlanBudgetProjectionServiceAssembly() {
    }

    static src.domain.encounter.published.EncounterPlanBudgetResult toPublishedPlanBudget(
            EncounterPlanBudgetLoadResult result
    ) {
        return new src.domain.encounter.published.EncounterPlanBudgetResult(
                toPublishedPlanBudgetStatus(result),
                toPublishedPlanBudgetSummary(result.summary()),
                result.message());
    }

    static src.domain.encounter.published.EncounterPlanBudgetResult budgetUnavailable(String message) {
        return new src.domain.encounter.published.EncounterPlanBudgetResult(
                EncounterPlanBudgetStatus.STORAGE_ERROR,
                null,
                message);
    }

    static src.domain.encounter.published.EncounterPlanBudgetResult emptyPlanBudget() {
        return new src.domain.encounter.published.EncounterPlanBudgetResult(
                EncounterPlanBudgetStatus.STORAGE_ERROR,
                null,
                "");
    }

    static EncounterPlanBudgetStatus toPublishedPlanBudgetStatus(EncounterPlanBudgetLoadResult result) {
        if (result == null || result.storageFailed()) {
            return EncounterPlanBudgetStatus.STORAGE_ERROR;
        }
        if (result.loadedSuccessfully()) {
            return EncounterPlanBudgetStatus.SUCCESS;
        }
        if (result.planMissing()) {
            return EncounterPlanBudgetStatus.NOT_FOUND;
        }
        if (result.activePartyMissing()) {
            return EncounterPlanBudgetStatus.NO_ACTIVE_PARTY;
        }
        if (result.requestRejected()) {
            return EncounterPlanBudgetStatus.INVALID_REQUEST;
        }
        return EncounterPlanBudgetStatus.STORAGE_ERROR;
    }

    static @Nullable EncounterPlanBudgetSummary toPublishedPlanBudgetSummary(
            @Nullable EncounterPlanBudgetSummaryData summary
    ) {
        if (summary == null) {
            return null;
        }
        return new EncounterPlanBudgetSummary(
                summary.planId(),
                summary.planName(),
                summary.generatedLabel(),
                summary.creatureCount(),
                summary.baseXp(),
                summary.adjustedXp(),
                summary.multiplier(),
                summary.difficultyLabel());
    }
}
