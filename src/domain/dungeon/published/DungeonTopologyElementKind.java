package src.domain.dungeon.published;

public enum DungeonTopologyElementKind {
    EMPTY,
    ROOM,
    CORRIDOR,
    CORRIDOR_ANCHOR,
    DOOR,
    WALL,
    STAIR,
    TRANSITION;

    public static DungeonTopologyElementKind fromName(String name) {
        try {
            return valueOf(name == null ? EMPTY.name() : name);
        } catch (IllegalArgumentException ignored) {
            return EMPTY;
        }
    }

    public boolean isRoom() {
        return this == ROOM;
    }

    public boolean isCorridor() {
        return this == CORRIDOR;
    }
}
