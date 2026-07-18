package features.catalog.application;

/** Complete typed input vocabulary for saved Encounter plans. */
public sealed interface SavedEncounterCatalogIntent {

    record SelectPlan(long planId) implements SavedEncounterCatalogIntent {
    }

    record OpenPlan(long planId) implements SavedEncounterCatalogIntent {
    }

    record ConfirmOpen(long confirmationRevision, long planId) implements SavedEncounterCatalogIntent {
    }

    record CancelOpen(long confirmationRevision, long planId) implements SavedEncounterCatalogIntent {
    }
}
