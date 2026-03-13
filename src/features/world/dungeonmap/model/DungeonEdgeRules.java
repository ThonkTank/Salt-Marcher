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
     * Boundary walls are topology-owned only for one-sided edges with a square on exactly one side.
     * Interior walls between two squares stay manual, including room-to-room separators created by
     * square paint, so explicitly deleting that shared wall can merge adjacent rooms on demand.
     * Passages can sit on either a derived one-sided boundary or a persisted interior wall.
     */
    public static boolean requiresTopologyWall(DungeonSquare sideA, DungeonSquare sideB) {
        if (!hasInteractiveContext(sideA, sideB)) {
            return false;
        }
        return isBoundary(sideA, sideB);
    }

    public static boolean canPersistManualWall(DungeonSquare sideA, DungeonSquare sideB) {
        return isInterior(sideA, sideB);
    }

    public static boolean hasBarrier(DungeonSquare sideA, DungeonSquare sideB, boolean manualWallPresent) {
        if (!hasInteractiveContext(sideA, sideB)) {
            return false;
        }
        return requiresTopologyWall(sideA, sideB) || manualWallPresent;
    }

    public static boolean canCreatePassage(DungeonSquare sideA, DungeonSquare sideB, boolean manualWallPresent) {
        return hasBarrier(sideA, sideB, manualWallPresent);
    }
}
