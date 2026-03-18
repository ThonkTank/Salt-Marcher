package features.world.dungeonmap.rooms.model;
import features.world.dungeonmap.foundation.geometry.Point2i;


public record DungeonClusterVertexRef(
        long clusterId,
        Point2i point
) {
}
