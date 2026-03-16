package features.world.dungeonmap.model;

import java.util.List;
import java.util.Set;

public record RoomShape(
        Point2i center,
        List<Point2i> relativeVertices,
        List<Point2i> absoluteVertices,
        Set<Point2i> cells
) implements DungeonShape {
}
