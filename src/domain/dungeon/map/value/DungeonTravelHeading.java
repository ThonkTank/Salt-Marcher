package src.domain.dungeon.map.value;

import java.util.Locale;

public enum DungeonTravelHeading {
    NORTH,
    EAST,
    SOUTH,
    WEST;

    public static DungeonTravelHeading defaultHeading() {
        return SOUTH;
    }

    public static DungeonTravelHeading parse(String value) {
        if (value == null || value.isBlank()) {
            return defaultHeading();
        }
        try {
            return DungeonTravelHeading.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return defaultHeading();
        }
    }
}
