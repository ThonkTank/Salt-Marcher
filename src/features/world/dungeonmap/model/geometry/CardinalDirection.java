package features.world.dungeonmap.model.geometry;

public enum CardinalDirection {
    NORTH(0, new Point2i(0, -1), "Nord"),
    EAST(1, new Point2i(1, 0), "Ost"),
    SOUTH(2, new Point2i(0, 1), "Süd"),
    WEST(3, new Point2i(-1, 0), "West");

    private final int code;
    private final Point2i delta;
    private final String label;

    CardinalDirection(int code, Point2i delta, String label) {
        this.code = code;
        this.delta = delta;
        this.label = label;
    }

    public int code() {
        return code;
    }

    public Point2i delta() {
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

    public String relativeLabel(Point2i absoluteDirection) {
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
            return CardinalDirection.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
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

    public static CardinalDirection fromDirection(Point2i direction) {
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

    public static CardinalDirection fromTravel(Point2i from, Point2i to, CardinalDirection fallback) {
        if (from == null || to == null) {
            return fallback == null ? defaultDirection() : fallback;
        }
        int deltaX = to.x() - from.x();
        int deltaY = to.y() - from.y();
        if (deltaX == 0 && deltaY == 0) {
            return fallback == null ? defaultDirection() : fallback;
        }
        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
            return deltaX >= 0 ? EAST : WEST;
        }
        return deltaY >= 0 ? SOUTH : NORTH;
    }

    public static CardinalDirection fromTravel(CubePoint from, CubePoint to, CardinalDirection fallback) {
        if (from == null || to == null) {
            return fallback == null ? defaultDirection() : fallback;
        }
        return fromTravel(from.projectedCell(), to.projectedCell(), fallback);
    }
}
