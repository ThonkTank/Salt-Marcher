package src.domain.dungeon.published;

public enum DungeonAreaKind {
    ROOM,
    CORRIDOR;

    public static DungeonAreaKind fromName(String name) {
        return "CORRIDOR".equals(name) ? CORRIDOR : ROOM;
    }

    public boolean isRoom() {
        return this == ROOM;
    }

    public boolean isCorridor() {
        return this == CORRIDOR;
    }
}
