package features.world.dungeonmap.api;

import java.util.List;

public record DungeonRoomClusterSummary(
        Long clusterId,
        Long mapId,
        List<Long> roomIds,
        List<String> roomNames,
        List<Long> corridorIds,
        int centerX,
        int centerY,
        boolean active
) {
}
