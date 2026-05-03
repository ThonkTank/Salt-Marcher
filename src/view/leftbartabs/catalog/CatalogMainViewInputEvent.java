package src.view.leftbartabs.catalog;

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
