package features.dungeon.adapter.sqlite.model;

import org.jspecify.annotations.Nullable;

public record DungeonCorridorAnchorRefRecord(
        long corridorId,
        long hostCorridorId,
        @Nullable Long topologyElementId
) {
}
