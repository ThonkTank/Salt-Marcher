package src.data.dungeon.model;

import org.jspecify.annotations.Nullable;

public record DungeonCorridorAnchorBindingRecord(
        long corridorId,
        long anchorId,
        long hostCorridorId,
        int cellX,
        int cellY,
        int cellZ,
        @Nullable Long topologyElementId
) {
}
