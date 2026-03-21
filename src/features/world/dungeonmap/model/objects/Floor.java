package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;

/**
 * A floor is the object-level owner of walkable room area.
 *
 * <p>All reusable area math stays in {@link TileShape}. Floor only exposes that geometry as a room-facing object
 * so structures do not depend directly on geometry primitives more than necessary.</p>
 */
public record Floor(TileShape shape) {

    public Floor {
        shape = shape == null ? TileShape.singleCell(null) : shape;
    }

    public Floor movedBy(Point2i delta) {
        return new Floor(shape.translated(delta));
    }

    public Floor withShape(TileShape shape) {
        return new Floor(shape);
    }
}
