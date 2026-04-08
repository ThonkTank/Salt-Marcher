package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridSegment;

import java.util.Objects;

public record PreviewMovedLocalDoorRequest(
        DungeonMap map,
        Long clusterId,
        int levelZ,
        GridSegment sourceBoundarySegment,
        GridSegment targetBoundarySegment
) {
    public PreviewMovedLocalDoorRequest {
        map = Objects.requireNonNull(map, "map");
        sourceBoundarySegment = Objects.requireNonNull(sourceBoundarySegment, "sourceBoundarySegment");
        targetBoundarySegment = Objects.requireNonNull(targetBoundarySegment, "targetBoundarySegment");
    }
}
