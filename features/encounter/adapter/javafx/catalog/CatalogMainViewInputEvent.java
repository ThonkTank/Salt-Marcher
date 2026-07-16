package features.encounter.adapter.javafx.catalog;

public record CatalogMainViewInputEvent(
        String sortKey,
        long openedCreatureId,
        long actionCreatureId,
        int pageShift
) {

    public CatalogMainViewInputEvent {
        sortKey = sortKey == null ? "" : sortKey;
    }
}
