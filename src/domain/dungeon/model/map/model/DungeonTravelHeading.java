package src.domain.dungeon.model.map.model;

import java.util.Locale;

public final class DungeonTravelHeading {
    public static final DungeonTravelHeading NORTH = new DungeonTravelHeading("NORTH");
    public static final DungeonTravelHeading EAST = new DungeonTravelHeading("EAST");
    public static final DungeonTravelHeading SOUTH = new DungeonTravelHeading("SOUTH");
    public static final DungeonTravelHeading WEST = new DungeonTravelHeading("WEST");

    private final String name;

    private DungeonTravelHeading(String name) {
        this.name = name;
    }

    public static DungeonTravelHeading defaultHeading() {
        return SOUTH;
    }

    public static DungeonTravelHeading parse(String value) {
        if (value == null || value.isBlank()) {
            return defaultHeading();
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return defaultHeading();
        }
    }

    public static DungeonTravelHeading valueOf(String name) {
        return switch (name) {
            case "NORTH" -> NORTH;
            case "EAST" -> EAST;
            case "WEST" -> WEST;
            default -> SOUTH;
        };
    }

    public String name() {
        return name;
    }

    public String displayLabel() {
        if (this == NORTH) {
            return "Norden";
        }
        if (this == EAST) {
            return "Osten";
        }
        if (this == SOUTH) {
            return "Sueden";
        }
        return "Westen";
    }

    public int turnOrder() {
        if (this == NORTH) {
            return 0;
        }
        if (this == EAST) {
            return 1;
        }
        if (this == SOUTH) {
            return 2;
        }
        return 3;
    }

    @Override
    public String toString() {
        return name;
    }
}
