package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileFaceShape;
import features.world.dungeonmap.model.geometry.TileShape;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * A floor is the object-level owner of walkable room area.
 *
 * <p>All reusable area math stays in {@link TileShape}. Floor only exposes that geometry as a room-facing object
 * so structures do not depend directly on geometry primitives more than necessary.</p>
 */
public record Floor(TileFaceShape faceShape, GridPoint2x anchor2x) {

    public Floor {
        faceShape = faceShape == null ? new TileFaceShape(Set.of()) : faceShape;
        anchor2x = normalizeAnchor(anchor2x, faceShape);
    }

    public Floor(TileShape shape) {
        this(
                shape == null ? new TileFaceShape(Set.of(new Point2i(0, 0))) : new TileFaceShape(shape.absoluteCells()),
                GridPoint2x.fromTileCenter(shape == null ? new Point2i(0, 0) : shape.anchor()));
    }

    public TileFaceShape shape2x() {
        return faceShape;
    }

    public Point2i anchorCell() {
        return anchor2x.toCellCenter().orElse(new Point2i(0, 0));
    }

    public Set<Point2i> cells() {
        return faceShape.cells();
    }

    public boolean contains(Point2i cell) {
        return faceShape.contains(cell);
    }

    public TileShape shape() {
        return TileShape.fromAbsoluteCells(anchorCell(), faceShape.cells());
    }

    public Floor movedBy(Point2i delta) {
        Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Floor(faceShape.translatedByCells(resolvedDelta), anchor2x.translatedByCells(resolvedDelta));
    }

    public Floor withShape(TileShape shape) {
        return new Floor(shape);
    }

    private static GridPoint2x normalizeAnchor(GridPoint2x anchor2x, TileFaceShape faceShape) {
        if (anchor2x != null) {
            if (!anchor2x.isTileCenter()) {
                throw new IllegalArgumentException("Floor anchor must be a tile center");
            }
            return anchor2x;
        }
        if (faceShape == null || faceShape.cells().isEmpty()) {
            return GridPoint2x.fromTileCenter(new Point2i(0, 0));
        }
        TileShape shape = TileShape.fromAbsoluteCells(new LinkedHashSet<>(faceShape.cells()));
        return GridPoint2x.fromTileCenter(shape.anchor());
    }
}
