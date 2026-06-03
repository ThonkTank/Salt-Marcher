package src.domain.dungeon.model.worldspace;

import java.util.Locale;

public final class DungeonClusterBoundaryKind {
    private static final String WALL_NAME = "WALL";
    private static final String DOOR_NAME = "DOOR";
    private static final String OPEN_NAME = "OPEN";

    public static final DungeonClusterBoundaryKind WALL = new DungeonClusterBoundaryKind(WALL_NAME, "wall");
    public static final DungeonClusterBoundaryKind DOOR = new DungeonClusterBoundaryKind(DOOR_NAME, "door");
    public static final DungeonClusterBoundaryKind OPEN = new DungeonClusterBoundaryKind(OPEN_NAME, "open");

    private final String name;
    private final String primitiveKind;

    private DungeonClusterBoundaryKind(String name, String primitiveKind) {
        this.name = name;
        this.primitiveKind = primitiveKind;
    }

    public static DungeonClusterBoundaryKind parse(String value) {
        if (value == null || value.isBlank()) {
            return WALL;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (DOOR_NAME.equals(normalized)) {
            return DOOR;
        }
        if (OPEN_NAME.equals(normalized)) {
            return OPEN;
        }
        return WALL;
    }

    public String primitiveKind() {
        return primitiveKind;
    }

    public String name() {
        return name;
    }

    public boolean renderable() {
        return this != OPEN;
    }

    @Override
    public String toString() {
        return name;
    }
}
