package src.view.leftbartabs.catalog;

public record CatalogMainViewInputEvent(
        Kind kind,
        long creatureId,
        String sortKey
) {

    public CatalogMainViewInputEvent {
        kind = kind == null ? Kind.PREVIOUS_PAGE : kind;
        sortKey = sortKey == null ? "" : sortKey;
    }

    static CatalogMainViewInputEvent sortChanged(String sortKey) {
        return new CatalogMainViewInputEvent(Kind.SORT_CHANGED, 0L, sortKey);
    }

    static CatalogMainViewInputEvent previousPage() {
        return new CatalogMainViewInputEvent(Kind.PREVIOUS_PAGE, 0L, "");
    }

    static CatalogMainViewInputEvent nextPage() {
        return new CatalogMainViewInputEvent(Kind.NEXT_PAGE, 0L, "");
    }

    static CatalogMainViewInputEvent rowOpened(long creatureId) {
        return new CatalogMainViewInputEvent(Kind.ROW_OPENED, creatureId, "");
    }

    static CatalogMainViewInputEvent rowActionTriggered(long creatureId) {
        return new CatalogMainViewInputEvent(Kind.ROW_ACTION_TRIGGERED, creatureId, "");
    }

    enum Kind {
        SORT_CHANGED,
        PREVIOUS_PAGE,
        NEXT_PAGE,
        ROW_OPENED,
        ROW_ACTION_TRIGGERED
    }
}
