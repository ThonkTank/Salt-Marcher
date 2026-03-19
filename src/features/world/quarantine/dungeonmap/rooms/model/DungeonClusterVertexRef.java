package features.world.quarantine.dungeonmap.rooms.model;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;


public record DungeonClusterVertexRef(
        long clusterId,
        Point2i point
) {
}
