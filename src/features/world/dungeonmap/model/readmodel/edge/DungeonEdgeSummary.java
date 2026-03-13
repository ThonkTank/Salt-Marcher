package features.world.dungeonmap.model.readmodel.edge;

import features.world.dungeonmap.model.domain.DungeonPassage;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.domain.DungeonWall;
import features.world.dungeonmap.model.topology.DungeonEdgeRules;
import features.world.dungeonmap.model.domain.PassageDirection;

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
        return DungeonEdgeRules.canPersistManualWall(sideASquare, sideBSquare);
    }

    public boolean canEraseManualWall() {
        return wallPresent() && canCreateManualWall() && !requiresTopologyWall();
    }

    public boolean canCreatePassage() {
        return DungeonEdgeRules.canCreatePassage(sideASquare, sideBSquare, canEraseManualWall());
    }
}
