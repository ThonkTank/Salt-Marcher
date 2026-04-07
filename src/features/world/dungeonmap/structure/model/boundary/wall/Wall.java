package features.world.dungeonmap.structure.model.boundary.wall;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.structure.model.boundary.BoundaryObject;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Canonical single-wall owner beneath {@code boundary}.
 *
 * <p>Wall-specific clipping, split-on-delete behavior, anchor repair, and persistence-facing segment access stay here
 * so aggregate callers do not reconstruct wall behavior from raw segment lists.</p>
 */

public final class Wall extends BoundaryObject {

    private final WallKind wallKind;

    public Wall(Collection<GridSegment2x> segments) {
        this(null, segments, null, WallKind.solid());
    }

    public Wall(EdgeShape shape) {
        this(null, shape, null, WallKind.solid());
    }

    public Wall(Long wallId, Collection<GridSegment2x> segments, GridSegment2x anchorSegment2x, WallKind wallKind) {
        super(wallId, segments, anchorSegment2x);
        this.wallKind = wallKind == null ? WallKind.solid() : wallKind;
    }

    public Wall(Long wallId, EdgeShape shape, GridSegment2x anchorSegment2x, WallKind wallKind) {
        super(wallId, shape, anchorSegment2x);
        this.wallKind = wallKind == null ? WallKind.solid() : wallKind;
    }

    public static Wall fromSegments(Collection<GridSegment2x> segments) {
        return new Wall(segments);
    }

    public static Wall fromSegments(
            Long wallId,
            Collection<GridSegment2x> segments,
            GridSegment2x anchorSegment2x,
            WallKind wallKind
    ) {
        return new Wall(wallId, segments, anchorSegment2x, wallKind);
    }

    public static Wall fromShape(EdgeShape shape) {
        return new Wall(shape);
    }

    public static Wall fromShape(Long wallId, EdgeShape shape, GridSegment2x anchorSegment2x, WallKind wallKind) {
        return new Wall(wallId, shape, anchorSegment2x, wallKind);
    }

    public Long wallId() {
        return objectId();
    }

    public GridSegment2x anchorSegment2x() {
        return anchorSegment2xInternal();
    }

    public WallKind wallKind() {
        return wallKind;
    }

    public Wall movedBy(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Wall(wallId(), translatedBoundarySegments(resolvedDelta), translatedAnchorSegment2x(resolvedDelta),
                wallKind);
    }

    public Wall withWallId(Long wallId) {
        if (Objects.equals(wallId(), wallId)) {
            return this;
        }
        return new Wall(wallId, orderedBoundarySegments(), anchorSegment2x(), wallKind);
    }

    public Wall withWallKind(WallKind wallKind) {
        WallKind resolvedWallKind = wallKind == null ? WallKind.solid() : wallKind;
        if (Objects.equals(this.wallKind, resolvedWallKind)) {
            return this;
        }
        return new Wall(wallId(), orderedBoundarySegments(), anchorSegment2x(), resolvedWallKind);
    }

    public Wall clippedToBoundary(Collection<GridSegment2x> boundarySegments) {
        EdgeShape clippedShape = clippedBoundaryShape(boundarySegments);
        if (clippedShape.isEmpty()) {
            return null;
        }
        return Wall.fromShape(wallId(), clippedShape, repairedAnchorSegment2x(clippedShape), wallKind);
    }

    public List<Wall> withoutBoundarySegments(Collection<GridSegment2x> removedBoundarySegments) {
        List<EdgeShape> components = remainingBoundaryComponents(removedBoundarySegments);
        if (components.isEmpty()) {
            return List.of();
        }
        int idRetainingIndex = retainingComponentIndex(components, anchorSegment2x());
        ArrayList<Wall> result = new ArrayList<>();
        for (int index = 0; index < components.size(); index++) {
            EdgeShape component = components.get(index);
            result.add(Wall.fromShape(
                    index == idRetainingIndex ? wallId() : null,
                    component,
                    repairedAnchorSegment2x(component),
                    wallKind));
        }
        result.sort(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public static List<Wall> fromBoundaryComponents(
            Collection<GridSegment2x> boundarySegments,
            WallKind wallKind
    ) {
        ArrayList<Wall> result = new ArrayList<>();
        for (EdgeShape component : boundaryComponents(boundarySegments)) {
            if (!component.isEmpty()) {
                result.add(Wall.fromShape(null, component, component.firstSegment2x(), wallKind));
            }
        }
        result.sort(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public boolean blocksPassage() {
        return wallKind.blocksPassage();
    }

    public boolean blocksSight() {
        return wallKind.blocksSight();
    }

    public boolean supportsDoorAttachments() {
        return wallKind.supportsDoorAttachments();
    }

    private static int retainingComponentIndex(
            List<EdgeShape> components,
            GridSegment2x preferredAnchorSegment2x
    ) {
        for (int index = 0; index < components.size(); index++) {
            if (components.get(index).contains(preferredAnchorSegment2x)) {
                return index;
            }
        }
        return 0;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Wall wall)) {
            return false;
        }
        return sameBaseState(wall) && Objects.equals(wallKind, wall.wallKind);
    }

    @Override
    public int hashCode() {
        return Objects.hash(baseHashCode(), wallKind);
    }
}
