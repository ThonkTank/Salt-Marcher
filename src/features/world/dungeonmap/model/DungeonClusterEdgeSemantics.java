package features.world.dungeonmap.model;

import java.util.Map;

public final class DungeonClusterEdgeSemantics {

    private DungeonClusterEdgeSemantics() {
    }

    public static boolean providesWall(DungeonRoomCluster.EdgeType edgeType) {
        return edgeType == DungeonRoomCluster.EdgeType.WALL || edgeType == DungeonRoomCluster.EdgeType.DOOR;
    }

    public static boolean hasWallAt(
            Map<DungeonRoomCluster.EdgeKey, DungeonRoomCluster.EdgeOverride> overrides,
            DungeonRoomCluster.EdgeOverride override
    ) {
        if (overrides == null || override == null) {
            return false;
        }
        DungeonRoomCluster.EdgeOverride existing = overrides.get(override.key());
        return existing != null && providesWall(existing.type());
    }

    public static DungeonRoomCluster.EdgeOverride restoreWall(
            DungeonRoomCluster.EdgeOverride override
    ) {
        if (override == null) {
            return null;
        }
        return DungeonRoomCluster.EdgeOverride.of(override.cell(), override.direction(), DungeonRoomCluster.EdgeType.WALL);
    }
}
