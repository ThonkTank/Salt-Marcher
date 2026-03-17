package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.domain.model.DungeonCorridor;

import java.util.List;

public record CorridorDoorHit(
        List<Long> corridorIds,
        long roomId
) {
    public CorridorDoorHit {
        corridorIds = corridorIds == null ? List.of() : List.copyOf(corridorIds);
    }

    public Long primaryCorridorId() {
        return corridorIds.isEmpty() ? null : corridorIds.get(0);
    }

    public boolean isEmpty() {
        return corridorIds.isEmpty();
    }
}
