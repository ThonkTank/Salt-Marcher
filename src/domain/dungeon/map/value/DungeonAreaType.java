package src.domain.dungeon.map.value;

public final class DungeonAreaType {
    public static final DungeonAreaType ROOM = new DungeonAreaType("ROOM");
    public static final DungeonAreaType CORRIDOR = new DungeonAreaType("CORRIDOR");

    private final String name;

    private DungeonAreaType(String name) {
        this.name = name;
    }

    public static DungeonAreaType valueOf(String name) {
        return "CORRIDOR".equals(name) ? CORRIDOR : ROOM;
    }

    public String name() {
        return name;
    }

    @Override
    public String toString() {
        return name;
    }
}
