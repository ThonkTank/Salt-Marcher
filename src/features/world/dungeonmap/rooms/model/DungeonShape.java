package features.world.dungeonmap.rooms.model;
import features.world.dungeonmap.foundation.geometry.Point2i;


import java.util.List;

public interface DungeonShape {

    Point2i center();

    List<Point2i> relativeVertices();
}
