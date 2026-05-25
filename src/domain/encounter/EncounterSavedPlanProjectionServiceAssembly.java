package src.domain.encounter;

import java.util.List;
import src.domain.encounter.model.plan.model.SavedEncounterPlansLoadResult;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;

final class EncounterSavedPlanProjectionServiceAssembly {

    private EncounterSavedPlanProjectionServiceAssembly() {
    }

    static SavedEncounterPlanListResult toPublishedSavedPlans(SavedEncounterPlansLoadResult result) {
        return new SavedEncounterPlanListResult(
                result.loadedSuccessfully()
                        ? SavedEncounterPlanStatus.SUCCESS
                        : SavedEncounterPlanStatus.STORAGE_ERROR,
                result.plans().stream()
                        .map(EncounterPlanProjectionServiceAssembly::toPublishedSummary)
                        .toList(),
                result.message());
    }

    static SavedEncounterPlanListResult storageUnavailable(String message) {
        return new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), message);
    }

    static SavedEncounterPlanListResult emptySavedPlans() {
        return new SavedEncounterPlanListResult(SavedEncounterPlanStatus.STORAGE_ERROR, List.of(), "");
    }
}
