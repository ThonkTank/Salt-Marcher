package features.world.dungeonmap.geometry;

import java.util.Locale;

public enum CardinalDirection {
    NORTH(0, new GridPoint(0, -1), "Nord"),
    EAST(1, new GridPoint(1, 0), "Ost"),
    SOUTH(2, new GridPoint(0, 1), "Süd"),
    WEST(3, new GridPoint(-1, 0), "West");

    private final int code;
    private final GridPoint delta;
    private final String label;

    CardinalDirection(int code, GridPoint delta, String label) {
        this.code = code;
        this.delta = delta;
        this.label = label;
    }

    public int code() {
        return code;
    }

    public GridPoint delta() {
        return delta;
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

    public String relativeLabel(GridPoint absoluteDirection) {
        CardinalDirection direction = fromDirection(absoluteDirection);
        if (direction == null) {
            return "Unklar";
        }
        if (direction == this) {
            return "Direkt vor euch";
        }
        if (direction == clockwise()) {
            return "Rechts von euch";
        }
        if (direction == opposite()) {
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

    public static CardinalDirection fromDirection(GridPoint direction) {
        if (direction == null) {
            return null;
        }
        for (CardinalDirection candidate : values()) {
            if (candidate.delta.equals(direction)) {
                return candidate;
            }
        }
        return null;
    }

    public static CardinalDirection fromTravel(GridPoint from, GridPoint to, CardinalDirection fallback) {
        return GridPoint.fromTravel(from, to, fallback);
    }
}
