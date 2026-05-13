package src.domain.dungeon.published;

public enum DungeonBoundaryKind {
    WALL,
    DOOR;

    public boolean isDoor() {
        return this == DOOR;
    }
}
