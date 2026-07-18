package features.catalog.application;

import features.encounter.api.SavedEncounterPlanSummary;
import java.util.Objects;

public record SavedEncounterCatalogState(
        CatalogResultState<SavedEncounterPlanSummary> results,
        long selectedPlanId
) {
    public SavedEncounterCatalogState {
        results = Objects.requireNonNull(results, "results");
        selectedPlanId = Math.max(0L, selectedPlanId);
    }

    static SavedEncounterCatalogState initial() {
        return new SavedEncounterCatalogState(CatalogResultState.loading(), 0L);
    }
}
