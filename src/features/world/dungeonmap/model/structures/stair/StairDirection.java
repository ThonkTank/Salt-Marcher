package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.Point2i;

public enum StairDirection {
    NORTH(0, new Point2i(0, -1), "Nord"),
    EAST(1, new Point2i(1, 0), "Ost"),
    SOUTH(2, new Point2i(0, 1), "Süd"),
    WEST(3, new Point2i(-1, 0), "West");

    private final int code;
    private final Point2i delta;
    private final String label;

    StairDirection(int code, Point2i delta, String label) {
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

    public StairDirection clockwise() {
        return switch (this) {
            case NORTH -> EAST;
            case EAST -> SOUTH;
            case SOUTH -> WEST;
            case WEST -> NORTH;
        };
    }

    public static StairDirection defaultDirection() {
        return NORTH;
    }

    public static StairDirection fromCode(int code) {
        for (StairDirection direction : values()) {
            if (direction.code == code) {
                return direction;
            }
        }
        return defaultDirection();
    }
}
