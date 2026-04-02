package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileFaceShape;
import java.util.Set;

/**
 * A floor is the object-level owner of walkable cells plus explicit 2x anchor semantics.
 */
public record Floor(TileFaceShape faceShape, GridPoint2x anchor2x) {

    public static Floor empty() {
        return new Floor(null, null);
    }

    public Floor {
        faceShape = faceShape == null ? new TileFaceShape(Set.of()) : faceShape;
        anchor2x = normalizeAnchor(anchor2x, faceShape);
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

    public Point2i centerCell() {
        return cells().isEmpty() ? null : StructureDescriptor.bestCenterCell(cells());
    }

    public boolean contains(Point2i cell) {
        return faceShape.contains(cell);
    }

    public Floor movedBy(Point2i delta) {
        Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Floor(faceShape.translatedByCells(resolvedDelta), anchor2x.translatedByCells(resolvedDelta));
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
        return GridPoint2x.fromTileCenter(StructureDescriptor.bestCenterCell(faceShape.cells()));
    }
}
