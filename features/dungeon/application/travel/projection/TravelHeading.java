package features.dungeon.application.travel.projection;

import java.util.Locale;
import org.jspecify.annotations.Nullable;

public enum TravelHeading {
    NORTH,
    EAST,
    SOUTH,
    WEST;

    public static TravelHeading defaultHeading() {
        return SOUTH;
    }

    public static TravelHeading fromName(@Nullable String name) {
        return switch (name == null ? "" : name.trim().toUpperCase(Locale.ROOT)) {
            case "NORTH" -> NORTH;
            case "EAST" -> EAST;
            case "WEST" -> WEST;
            default -> SOUTH;
        };
    }

    public String displayLabel() {
        return switch (this) {
            case NORTH -> "Norden";
            case EAST -> "Osten";
            case WEST -> "Westen";
            case SOUTH -> "Sueden";
        };
    }

    public int turnOrder() {
        return switch (this) {
            case NORTH -> 0;
            case EAST -> 1;
            case SOUTH -> 2;
            case WEST -> 3;
        };
    }
}
