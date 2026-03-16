package features.world.dungeonmap.model;

import java.util.List;

public record DungeonCorridor(
        Long corridorId,
        long mapId,
        List<Long> roomIds
) {
    public DungeonCorridor {
        roomIds = roomIds == null ? List.of() : List.copyOf(roomIds);
    }
}
