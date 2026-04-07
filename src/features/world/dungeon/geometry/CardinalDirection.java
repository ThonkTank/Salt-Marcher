package features.world.dungeon.geometry;

import java.util.Locale;

public enum CardinalDirection {
    NORTH(0, 0, -1, "Nord"),
    EAST(1, 1, 0, "Ost"),
    SOUTH(2, 0, 1, "Süd"),
    WEST(3, -1, 0, "West");

    private final int code;
    private final int dxCells;
    private final int dyCells;
    private final String label;

    CardinalDirection(int code, int dxCells, int dyCells, String label) {
        this.code = code;
        this.dxCells = dxCells;
        this.dyCells = dyCells;
        this.label = label;
    }

    public int code() {
        return code;
    }

    public int dxCells() {
        return dxCells;
    }

    public int dyCells() {
        return dyCells;
    }

    public String label() {
        return label;
    }

    public CardinalDirection clockwise() {
        return switch (this) {
            case NORTH -> EAST;
            case EAST -> SOUTH;
            case SOUTH -> WEST;
            case WEST -> NORTH;
        };
    }

    public CardinalDirection opposite() {
        return switch (this) {
            case NORTH -> SOUTH;
            case EAST -> WEST;
            case SOUTH -> NORTH;
            case WEST -> EAST;
        };
    }

    public String relativeLabel(CardinalDirection absoluteDirection) {
        if (absoluteDirection == null) {
            return "Unklar";
        }
        if (absoluteDirection == this) {
            return "Direkt vor euch";
        }
        if (absoluteDirection == clockwise()) {
            return "Rechts von euch";
        }
        if (absoluteDirection == opposite()) {
            return "Hinter euch";
        }
        return "Links von euch";
    }

    public static CardinalDirection defaultDirection() {
        return NORTH;
    }

    public static CardinalDirection parse(String value) {
        if (value == null || value.isBlank()) {
            return defaultDirection();
        }
        try {
            return CardinalDirection.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return defaultDirection();
        }
    }

    public static CardinalDirection fromCode(int code) {
        for (CardinalDirection direction : values()) {
            if (direction.code == code) {
                return direction;
            }
        }
        return defaultDirection();
    }

    public static CardinalDirection fromTravel(GridPoint from, GridPoint to, CardinalDirection fallback) {
        if (from == null || to == null) {
            return fallback;
        }
        CardinalDirection direction = from.cardinalDirectionTo(to);
        return direction == null ? fallback : direction;
    }
}
