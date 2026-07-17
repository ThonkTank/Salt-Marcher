package features.catalog.adapter.javafx;

public record CatalogMainViewInputEvent(
        String sortKey,
        long openedCreatureId,
        long actionCreatureId,
        long sceneCreatureId,
        int pageShift
) {

    public CatalogMainViewInputEvent(String sortKey, long openedCreatureId, long actionCreatureId, int pageShift) {
        this(sortKey, openedCreatureId, actionCreatureId, 0L, pageShift);
    }

    public CatalogMainViewInputEvent {
        sortKey = sortKey == null ? "" : sortKey;
    }
}
