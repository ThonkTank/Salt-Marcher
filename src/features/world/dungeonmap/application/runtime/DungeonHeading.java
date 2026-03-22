package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.CubePoint;

public enum DungeonHeading {
    NORTH(new Point2i(0, -1), "Nord"),
    EAST(new Point2i(1, 0), "Ost"),
    SOUTH(new Point2i(0, 1), "Süd"),
    WEST(new Point2i(-1, 0), "West");

    private final Point2i delta;
    private final String label;

    DungeonHeading(Point2i delta, String label) {
        this.delta = delta;
        this.label = label;
    }

    public Point2i delta() {
        return delta;
    }

    public String label() {
        return label;
    }

    public String relativeLabel(Point2i absoluteDirection) {
        DungeonHeading direction = fromDirection(absoluteDirection);
        if (direction == null) {
            return "Unklar";
        }
        if (direction == this) {
            return "Direkt vor euch";
        }
        if (direction == rightOf(this)) {
            return "Rechts von euch";
        }
        if (direction == oppositeOf(this)) {
            return "Hinter euch";
        }
        return "Links von euch";
    }

    public static DungeonHeading defaultHeading() {
        return NORTH;
    }

    public static DungeonHeading parse(String value) {
        if (value == null || value.isBlank()) {
            return defaultHeading();
        }
        try {
            return DungeonHeading.valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return defaultHeading();
        }
    }

    public static DungeonHeading fromDirection(Point2i direction) {
        if (direction == null) {
            return null;
        }
        for (DungeonHeading heading : values()) {
            if (heading.delta.equals(direction)) {
                return heading;
            }
        }
        return null;
    }

    public static DungeonHeading fromTravel(Point2i from, Point2i to, DungeonHeading fallback) {
        if (from == null || to == null) {
            return fallback == null ? defaultHeading() : fallback;
        }
        int deltaX = to.x() - from.x();
        int deltaY = to.y() - from.y();
        if (deltaX == 0 && deltaY == 0) {
            return fallback == null ? defaultHeading() : fallback;
        }
        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
            return deltaX >= 0 ? EAST : WEST;
        }
        return deltaY >= 0 ? SOUTH : NORTH;
    }

    public static DungeonHeading fromTravel(CubePoint from, CubePoint to, DungeonHeading fallback) {
        if (from == null || to == null) {
            return fallback == null ? defaultHeading() : fallback;
        }
        return fromTravel(from.projectedCell(), to.projectedCell(), fallback);
    }

    private static DungeonHeading rightOf(DungeonHeading heading) {
        return switch (heading) {
            case NORTH -> EAST;
            case EAST -> SOUTH;
            case SOUTH -> WEST;
            case WEST -> NORTH;
        };
    }

    private static DungeonHeading oppositeOf(DungeonHeading heading) {
        return switch (heading) {
            case NORTH -> SOUTH;
            case EAST -> WEST;
            case SOUTH -> NORTH;
            case WEST -> EAST;
        };
    }
}
