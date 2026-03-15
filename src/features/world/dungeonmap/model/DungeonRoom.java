package features.world.dungeonmap.model;

import java.util.List;

public record DungeonRoom(
        Long roomId,
        long mapId,
        String name,
        Point2i center,
        List<Point2i> relativeVertices
) {
}
