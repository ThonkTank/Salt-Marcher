package src.domain.dungeon.model.worldspace.model;

import java.util.Locale;

public final class DungeonClusterBoundaryKind {
    public static final DungeonClusterBoundaryKind WALL = new DungeonClusterBoundaryKind("WALL", "wall");
    public static final DungeonClusterBoundaryKind DOOR = new DungeonClusterBoundaryKind("DOOR", "door");

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
        return "DOOR".equals(value.trim().toUpperCase(Locale.ROOT)) ? DOOR : WALL;
    }

    public String primitiveKind() {
        return primitiveKind;
    }

    public String name() {
        return name;
    }

    @Override
    public String toString() {
        return name;
    }
}
