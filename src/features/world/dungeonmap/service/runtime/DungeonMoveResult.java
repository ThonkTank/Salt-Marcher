package features.world.dungeonmap.service.runtime;

import java.util.List;

public record DungeonMoveResult(
        DungeonMoveStatus status,
        Long squareId,
        List<Long> triggeredTableIds,
        String message
) {
    public DungeonMoveResult {
        triggeredTableIds = triggeredTableIds == null ? List.of() : List.copyOf(triggeredTableIds);
    }
}
