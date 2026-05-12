package src.data.encounter.repository;

import java.util.List;
import src.domain.encounter.model.plan.model.EncounterPlanBudgetLoadResult;
import src.domain.encounter.model.plan.model.EncounterPlanBudgetSummaryData;
import src.domain.encounter.model.plan.model.EncounterPlanSummary;
import src.domain.encounter.model.plan.model.SavedEncounterPlansLoadResult;
import src.domain.encounter.published.EncounterPlanBudgetResult;
import src.domain.encounter.published.EncounterPlanBudgetStatus;
import src.domain.encounter.published.EncounterPlanBudgetSummary;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;

final class EncounterPlanPublishedStateMapper {

    private EncounterPlanPublishedStateMapper() {
    }

    static SavedEncounterPlanListResult toPublishedSavedPlans(SavedEncounterPlansLoadResult result) {
        return new SavedEncounterPlanListResult(
                result.loadedSuccessfully()
                        ? SavedEncounterPlanStatus.successStatus()
                        : SavedEncounterPlanStatus.storageErrorStatus(),
                result.plans().stream().map(EncounterPlanPublishedStateMapper::toPublishedSummary).toList(),
                result.message());
    }

    static SavedEncounterPlanListResult storageUnavailable(String message) {
        return new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), message);
    }

    static SavedEncounterPlanSummary toPublishedSummary(EncounterPlanSummary summary) {
        if (summary == null) {
            return new SavedEncounterPlanSummary(0L, "", "");
        }
        return new SavedEncounterPlanSummary(
                summary.id(),
                summary.name(),
                summaryText(summary.generatedLabel(), summary.creatureCount()));
    }

    static EncounterPlanBudgetResult toPublishedPlanBudget(EncounterPlanBudgetLoadResult result) {
        return new EncounterPlanBudgetResult(
                toPublishedPlanBudgetStatus(result.status()),
                toPublishedPlanBudgetSummary(result.summary()),
                result.message());
    }

    static EncounterPlanBudgetResult budgetUnavailable(String message) {
        return new EncounterPlanBudgetResult(EncounterPlanBudgetStatus.STORAGE_ERROR, null, message);
    }

    private static EncounterPlanBudgetStatus toPublishedPlanBudgetStatus(EncounterPlanBudgetLoadResult.Status status) {
        return switch (status == null ? EncounterPlanBudgetLoadResult.Status.STORAGE_ERROR : status) {
            case SUCCESS -> EncounterPlanBudgetStatus.SUCCESS;
            case NOT_FOUND -> EncounterPlanBudgetStatus.NOT_FOUND;
            case NO_ACTIVE_PARTY -> EncounterPlanBudgetStatus.NO_ACTIVE_PARTY;
            case INVALID_REQUEST -> EncounterPlanBudgetStatus.INVALID_REQUEST;
            case STORAGE_ERROR -> EncounterPlanBudgetStatus.STORAGE_ERROR;
        };
    }

    private static EncounterPlanBudgetSummary toPublishedPlanBudgetSummary(EncounterPlanBudgetSummaryData summary) {
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

    private static String summaryText(String generatedLabel, int creatureCount) {
        StringBuilder text = new StringBuilder()
                .append(Math.max(0, creatureCount))
                .append(" Kreaturen");
        String safeGeneratedLabel = generatedLabel == null ? "" : generatedLabel.trim();
        if (!safeGeneratedLabel.isBlank()) {
            text.append(" · ").append(safeGeneratedLabel);
        }
        return text.toString();
    }
}
