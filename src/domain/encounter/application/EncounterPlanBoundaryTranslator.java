package src.domain.encounter.application;

import src.domain.encounter.plan.value.EncounterPlanSummary;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;

public final class EncounterPlanBoundaryTranslator {

    private EncounterPlanBoundaryTranslator() {
    }

    public static SavedEncounterPlanStatus toPublishedListPlansStatus(
            ListSavedEncounterPlansUseCase.Status status
    ) {
        return SavedEncounterPlanStatus.valueOf(
                status != null && status.loadedSuccessfully() ? "SUCCESS" : "STORAGE_ERROR");
    }

    public static SavedEncounterPlanSummary toPublishedSummary(EncounterPlanSummary summary) {
        return new SavedEncounterPlanSummary(
                summary.id(),
                summary.name(),
                summary.generatedLabel(),
                summary.creatureCount());
    }
}
