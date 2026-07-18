package features.catalog.application;

public record CatalogRequestToken(long lifecycleEpoch, RequestKind kind, long revision) {
    public enum RequestKind {
        ITEMS_FILTER_OPTIONS,
        ITEMS_SEARCH,
        ITEMS_DETAIL,
        SAVED_ENCOUNTER_OPEN
    }
}
