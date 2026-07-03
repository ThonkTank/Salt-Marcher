package src.domain.dungeon.model.runtime.travel.projection;


public enum TraversalSourceKind {
    DOOR,
    CORRIDOR,
    STAIR;

    static TraversalSourceKind defaultKind() {
        return DOOR;
    }

    static TraversalSourceKind door() {
        return DOOR;
    }

    static TraversalSourceKind corridor() {
        return CORRIDOR;
    }

    static TraversalSourceKind stair() {
        return STAIR;
    }

    boolean isDoor() {
        return this == DOOR;
    }

    boolean isStair() {
        return this == STAIR;
    }

    boolean isCorridor() {
        return this == CORRIDOR;
    }

    String defaultLabel(long id) {
        if (isStair()) {
            return "Treppe " + id;
        }
        if (isCorridor()) {
            return "Gang " + id;
        }
        return "Tür " + id;
    }

    int sortOrder() {
        if (isDoor()) {
            return 0;
        }
        return isCorridor() ? 1 : 2;
    }
}
