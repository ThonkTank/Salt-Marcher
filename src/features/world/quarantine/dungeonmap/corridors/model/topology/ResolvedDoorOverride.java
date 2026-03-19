package features.world.quarantine.dungeonmap.corridors.model.topology;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;

public record ResolvedDoorOverride(
        Point2i absoluteCell,
        DungeonRoomCluster.EdgeDirection edgeDirection
) {
}
