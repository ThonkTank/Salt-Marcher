package features.world.quarantine.dungeonmap.inspector;

import java.util.List;

public record DungeonCorridorSummary(
        Long corridorId,
        Long mapId,
        List<Long> roomIds,
        List<String> roomNames,
        boolean active
) {
}
