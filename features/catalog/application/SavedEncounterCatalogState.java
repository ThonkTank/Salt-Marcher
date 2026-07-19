package features.catalog.application;

import features.encounter.api.SavedEncounterPlanSummary;
import java.util.Objects;

/** Temporary M3 presentation projection for saved-Encounter browse and action state. */
public record SavedEncounterCatalogState(
        long revision,
        CatalogResultState<SavedEncounterPlanSummary> results,
        long selectedPlanId,
        Confirmation confirmation,
        String actionMessage
) {
    public SavedEncounterCatalogState {
        revision = Math.max(0L, revision);
        results = Objects.requireNonNull(results, "results");
        selectedPlanId = Math.max(0L, selectedPlanId);
        confirmation = Objects.requireNonNull(confirmation, "confirmation");
        actionMessage = Objects.requireNonNullElse(actionMessage, "");
    }

    static SavedEncounterCatalogState initial() {
        return new SavedEncounterCatalogState(
                0L, CatalogResultState.uninitialized(), 0L, Confirmation.none(), "");
    }

    public record Confirmation(long revision, long planId, String planName, boolean required) {
        public Confirmation {
            revision = Math.max(0L, revision);
            planId = Math.max(0L, planId);
            planName = Objects.requireNonNullElse(planName, "");
        }

        static Confirmation none() { return new Confirmation(0L, 0L, "", false); }
        Confirmation clear() { return new Confirmation(revision + 1L, 0L, "", false); }
    }
}
