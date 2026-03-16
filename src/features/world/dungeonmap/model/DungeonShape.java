package features.world.dungeonmap.model;

import java.util.List;

public interface DungeonShape {

    Point2i center();

    List<Point2i> relativeVertices();
}
