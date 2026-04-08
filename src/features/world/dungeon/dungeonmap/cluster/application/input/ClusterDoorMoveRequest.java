package features.world.dungeon.dungeonmap.cluster.application.input;

public record ClusterDoorMoveRequest(
        long mapId,
        long clusterId,
        int levelZ,
        features.world.dungeon.geometry.GridSegment sourceBoundarySegment,
        features.world.dungeon.geometry.GridSegment targetBoundarySegment
) {
}
