package features.dungeon.domain.core.geometry;

public final class DungeonTopology {
    public static final DungeonTopology SQUARE = new DungeonTopology("SQUARE");
    public static final DungeonTopology HEX = new DungeonTopology("HEX");

    private final String name;

    private DungeonTopology(String name) {
        this.name = name;
    }

    public String name() {
        return name;
    }

    @Override
    public String toString() {
        return name;
    }
}
