package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexPath;

public final class Door extends VertexPath {

    public Door(Point2i roomCell, Point2i delta) {
        super(roomCell, delta);
    }
}
