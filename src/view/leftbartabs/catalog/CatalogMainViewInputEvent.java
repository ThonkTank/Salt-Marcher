package src.view.leftbartabs.catalog;

public record CatalogMainViewInputEvent(
        Source source,
        long creatureId,
        String sortKey
) {

    public CatalogMainViewInputEvent {
        source = source == null ? Source.PREVIOUS_PAGE_BUTTON : source;
        sortKey = sortKey == null ? "" : sortKey;
    }

    enum Source {
        SORT_SELECTION,
        PREVIOUS_PAGE_BUTTON,
        NEXT_PAGE_BUTTON,
        ROW_OPEN_REQUEST,
        ROW_ACTION_BUTTON
    }
}
