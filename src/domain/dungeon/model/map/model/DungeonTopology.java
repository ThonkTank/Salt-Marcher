package src.domain.dungeon.model.map.model;

public final class DungeonTopology {
    public static final DungeonTopology SQUARE = new DungeonTopology("SQUARE");
    public static final DungeonTopology HEX = new DungeonTopology("HEX");

    private final String name;

    private DungeonTopology(String name) {
        this.name = name;
    }

    public static DungeonTopology valueOf(String name) {
        return "HEX".equals(name) ? HEX : SQUARE;
    }

    public String name() {
        return name;
    }

    public boolean isHex() {
        return this == HEX;
    }

    @Override
    public String toString() {
        return name;
    }
}
