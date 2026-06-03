package src.domain.dungeon.model.runtime.travel.projection;


public enum TraversalSourceKind {
    DOOR,
    STAIR;

    static TraversalSourceKind defaultKind() {
        return DOOR;
    }

    boolean isDoor() {
        return this == DOOR;
    }

    boolean isStair() {
        return this == STAIR;
    }

    String defaultLabel(long id) {
        return isStair() ? "Treppe " + id : "Tür " + id;
    }

    int sortOrder() {
        return isDoor() ? 0 : 1;
    }
}
