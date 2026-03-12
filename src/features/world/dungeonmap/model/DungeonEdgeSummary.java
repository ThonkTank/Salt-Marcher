package features.world.dungeonmap.model;

public record DungeonEdgeSummary(
        int x,
        int y,
        PassageDirection direction,
        DungeonWall wall,
        DungeonPassage passage,
        DungeonSquare sideASquare,
        DungeonSquare sideBSquare
) {
    public String edgeKey() {
        return direction.edgeKey(x, y);
    }

    public boolean wallPresent() {
        return wall != null;
    }

    public boolean hasInteractiveContext() {
        return DungeonEdgeRules.hasInteractiveContext(sideASquare, sideBSquare);
    }

    public boolean isBoundary() {
        return DungeonEdgeRules.isBoundary(sideASquare, sideBSquare);
    }

    public boolean requiresTopologyWall() {
        return DungeonEdgeRules.requiresTopologyWall(sideASquare, sideBSquare);
    }

    public boolean canCreateManualWall() {
        return DungeonEdgeRules.isInterior(sideASquare, sideBSquare);
    }

    public boolean canEraseManualWall() {
        return wallPresent() && canCreateManualWall() && !requiresTopologyWall();
    }

    public boolean canCreatePassage() {
        return wallPresent() && hasInteractiveContext();
    }
}
