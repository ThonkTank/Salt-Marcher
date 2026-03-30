package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.Point2i;

public final class DungeonPersistenceDirections {

    private DungeonPersistenceDirections() {
    }

    public static String toPersistedEdgeDirection(Point2i direction) {
        if (direction == null) {
            throw new IllegalArgumentException("Kantenrichtung darf nicht null sein");
        }
        CardinalDirection cardinalDirection = CardinalDirection.fromDirection(direction);
        if (cardinalDirection != null) {
            return cardinalDirection.name();
        }
        throw new IllegalArgumentException("Unbekannte persistierte Kantenrichtung: " + direction);
    }

    public static Point2i fromPersistedEdgeDirection(String persistedDirection) {
        if (persistedDirection == null || persistedDirection.isBlank()) {
            throw new IllegalArgumentException("Kantenrichtung fehlt");
        }
        try {
            return CardinalDirection.valueOf(persistedDirection.trim().toUpperCase(java.util.Locale.ROOT)).delta();
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unbekannte persistierte Kantenrichtung: " + persistedDirection, ex);
        }
    }
}
