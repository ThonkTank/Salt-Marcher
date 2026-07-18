package features.catalog.application;

import features.encounter.api.SavedEncounterPlanSummary;
import java.util.Objects;

/** The single immutable saved-Encounter truth rendered by Catalog. */
public record SavedEncounterCatalogState(
        long revision,
        long lifecycleRevision,
        long openRequestRevision,
        Lifecycle lifecycle,
        CatalogResultState<SavedEncounterPlanSummary> results,
        long selectedPlanId,
        Confirmation confirmation,
        String actionMessage
) {
    public SavedEncounterCatalogState {
        revision = Math.max(0L, revision);
        lifecycleRevision = Math.max(0L, lifecycleRevision);
        openRequestRevision = Math.max(0L, openRequestRevision);
        lifecycle = Objects.requireNonNull(lifecycle, "lifecycle");
        results = Objects.requireNonNull(results, "results");
        selectedPlanId = Math.max(0L, selectedPlanId);
        confirmation = Objects.requireNonNull(confirmation, "confirmation");
        actionMessage = actionMessage == null ? "" : actionMessage;
    }

    static SavedEncounterCatalogState initial() {
        return new SavedEncounterCatalogState(
                0L, 0L, 0L, Lifecycle.INACTIVE, CatalogResultState.loading(), 0L,
                Confirmation.none(), "");
    }

    public enum Lifecycle {
        INACTIVE,
        ACTIVE,
        CLOSED
    }

    public record Confirmation(long revision, long planId, String planName, boolean required) {
        public Confirmation {
            revision = Math.max(0L, revision);
            planId = Math.max(0L, planId);
            planName = planName == null ? "" : planName;
        }

        static Confirmation none() {
            return new Confirmation(0L, 0L, "", false);
        }

        Confirmation clear() {
            return new Confirmation(revision + 1L, 0L, "", false);
        }
    }
}
