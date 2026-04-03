package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.geometry.CardinalDirection;

public final class DungeonPersistenceDirections {

    private DungeonPersistenceDirections() {
    }

    public static String toPersistedEdgeDirection(CardinalDirection direction) {
        if (direction == null) {
            throw new IllegalArgumentException("Kantenrichtung darf nicht null sein");
        }
        return direction.name();
    }

    public static CardinalDirection fromPersistedEdgeDirection(String persistedDirection) {
        if (persistedDirection == null || persistedDirection.isBlank()) {
            throw new IllegalArgumentException("Kantenrichtung fehlt");
        }
        try {
            return CardinalDirection.valueOf(persistedDirection.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unbekannte persistierte Kantenrichtung: " + persistedDirection, ex);
        }
    }
}
