package features.world.quarantine.dungeonmap.inspector;

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
