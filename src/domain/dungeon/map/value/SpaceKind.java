package src.domain.dungeon.map.value;

public final class SpaceKind {
    public static final SpaceKind ROOM = new SpaceKind("ROOM");
    public static final SpaceKind CORRIDOR = new SpaceKind("CORRIDOR");

    private final String name;

    private SpaceKind(String name) {
        this.name = name;
    }

    public static SpaceKind valueOf(String name) {
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
