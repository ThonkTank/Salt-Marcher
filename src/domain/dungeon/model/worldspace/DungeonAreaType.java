package src.domain.dungeon.model.worldspace;

public enum DungeonAreaType {
    ROOM,
    CORRIDOR;

    public boolean isRoom() {
        return this == ROOM;
    }

    public boolean isCorridor() {
        return this == CORRIDOR;
    }
}
