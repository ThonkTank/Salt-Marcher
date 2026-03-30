package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.Point2i;

public final class DungeonPersistenceDirections {

    private DungeonPersistenceDirections() {
    }

    public static String toPersistedEdgeDirection(Point2i direction) {
        if (direction == null) {
            throw new IllegalArgumentException("Kantenrichtung darf nicht null sein");
        }
        if (direction.equals(new Point2i(0, -1))) {
            return "NORTH";
        }
        if (direction.equals(new Point2i(1, 0))) {
            return "EAST";
        }
        if (direction.equals(new Point2i(0, 1))) {
            return "SOUTH";
        }
        if (direction.equals(new Point2i(-1, 0))) {
            return "WEST";
        }
        throw new IllegalArgumentException("Unbekannte persistierte Kantenrichtung: " + direction);
    }

    public static Point2i fromPersistedEdgeDirection(String persistedDirection) {
        if (persistedDirection == null || persistedDirection.isBlank()) {
            throw new IllegalArgumentException("Kantenrichtung fehlt");
        }
        return switch (persistedDirection.trim().toUpperCase(java.util.Locale.ROOT)) {
            case "NORTH" -> new Point2i(0, -1);
            case "EAST" -> new Point2i(1, 0);
            case "SOUTH" -> new Point2i(0, 1);
            case "WEST" -> new Point2i(-1, 0);
            default -> throw new IllegalArgumentException("Unbekannte persistierte Kantenrichtung: " + persistedDirection);
        };
    }
}
