package src.domain.dungeon.model.runtime.travel.projection;


public final class TravelHeading {
    public static final TravelHeading NORTH = new TravelHeading("NORTH");
    public static final TravelHeading EAST = new TravelHeading("EAST");
    public static final TravelHeading SOUTH = new TravelHeading("SOUTH");
    public static final TravelHeading WEST = new TravelHeading("WEST");

    private final String name;

    private TravelHeading(String name) {
        this.name = name;
    }

    public static TravelHeading defaultHeading() {
        return SOUTH;
    }

    public static TravelHeading valueOf(String name) {
        return switch (name) {
            case "NORTH" -> NORTH;
            case "EAST" -> EAST;
            case "WEST" -> WEST;
            default -> SOUTH;
        };
    }

    public static TravelHeading fromName(String name) {
        return switch (name == null ? "" : name.trim()) {
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
