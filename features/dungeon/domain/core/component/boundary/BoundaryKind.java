package features.dungeon.domain.core.component.boundary;

public enum BoundaryKind {
    WALL,
    DOOR,
    OPEN;

    public boolean isDoor() {
        return this == DOOR;
    }

    public boolean renderable() {
        return this != OPEN;
    }
}
