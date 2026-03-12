package features.world.dungeonmap.model;

public final class DungeonEdgeRules {

    private DungeonEdgeRules() {
        throw new AssertionError("No instances");
    }

    public static boolean hasInteractiveContext(DungeonSquare sideA, DungeonSquare sideB) {
        return sideA != null || sideB != null;
    }

    public static boolean isInterior(DungeonSquare sideA, DungeonSquare sideB) {
        return sideA != null && sideB != null;
    }

    public static boolean isBoundary(DungeonSquare sideA, DungeonSquare sideB) {
        return sideA != null ^ sideB != null;
    }

    /*
     * Boundary walls are topology-owned and must persist around one-sided edges.
     * Manual wall edits stay interior-only.
     * Passages require a persisted wall plus at least one adjacent square.
     */
    public static boolean requiresTopologyWall(DungeonSquare sideA, DungeonSquare sideB) {
        if (!hasInteractiveContext(sideA, sideB)) {
            return false;
        }
        if (isBoundary(sideA, sideB)) {
            return true;
        }
        if (sideA.roomId() == null || sideB.roomId() == null) {
            return false;
        }
        return !sideA.roomId().equals(sideB.roomId());
    }
}
