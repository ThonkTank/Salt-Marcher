package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.Point2i;

public final class DungeonPersistenceDirections {

    private static final Point2i NORTH = new Point2i(0, -1);
    private static final Point2i EAST = new Point2i(1, 0);
    private static final Point2i SOUTH = new Point2i(0, 1);
    private static final Point2i WEST = new Point2i(-1, 0);

    private DungeonPersistenceDirections() {
    }

    public static String toPersistedEdgeDirection(Point2i direction) {
        if (direction == null) {
            throw new IllegalArgumentException("Kantenrichtung darf nicht null sein");
        }
        if (direction.equals(NORTH)) {
            return "NORTH";
        }
        if (direction.equals(EAST)) {
            return "EAST";
        }
        if (direction.equals(SOUTH)) {
            return "SOUTH";
        }
        if (direction.equals(WEST)) {
            return "WEST";
        }
        throw new IllegalArgumentException("Unbekannte persistierte Kantenrichtung: " + direction);
    }

    public static Point2i fromPersistedEdgeDirection(String persistedDirection) {
        if (persistedDirection == null || persistedDirection.isBlank()) {
            throw new IllegalArgumentException("Kantenrichtung fehlt");
        }
        return switch (persistedDirection.trim().toUpperCase(java.util.Locale.ROOT)) {
            case "NORTH" -> NORTH;
            case "EAST" -> EAST;
            case "SOUTH" -> SOUTH;
            case "WEST" -> WEST;
            default -> throw new IllegalArgumentException("Unbekannte persistierte Kantenrichtung: " + persistedDirection);
        };
    }
}
