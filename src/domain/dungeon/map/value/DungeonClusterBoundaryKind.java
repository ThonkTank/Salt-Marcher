package src.domain.dungeon.map.value;

import java.util.Locale;

public enum DungeonClusterBoundaryKind {
    WALL("wall"),
    DOOR("door");

    private final String primitiveKind;

    DungeonClusterBoundaryKind(String primitiveKind) {
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
}
