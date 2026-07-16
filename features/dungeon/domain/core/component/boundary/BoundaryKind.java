package features.dungeon.domain.core.component.boundary;

public enum BoundaryKind {
    WALL,
    DOOR,
    OPEN;

    public static BoundaryKind wall() {
        return WALL;
    }

    public static BoundaryKind door() {
        return DOOR;
    }

    public static BoundaryKind open() {
        return OPEN;
    }
}
