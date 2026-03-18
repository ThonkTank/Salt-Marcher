package features.world.dungeonmap.rooms.model;
import features.world.dungeonmap.foundation.geometry.Point2i;


import java.util.List;
import java.util.Set;

public record RoomShape(
        Point2i center,
        List<Point2i> relativeVertices,
        List<Point2i> absoluteVertices,
        Set<Point2i> cells
) implements DungeonShape {
}
