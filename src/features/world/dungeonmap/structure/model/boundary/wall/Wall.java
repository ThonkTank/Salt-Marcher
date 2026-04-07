package features.world.dungeonmap.structure.model.boundary.wall;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical single-wall owner beneath {@code boundary}.
 *
 * <p>Wall-specific clipping, split-on-delete behavior, anchor repair, and persistence-facing segment access stay here
 * so aggregate callers do not reconstruct wall behavior from raw segment lists.</p>
 */

public final class Wall extends EdgeShape {

    private final Long wallId;
    private final GridSegment2x anchorSegment2x;
    private final WallKind wallKind;

    public Wall(Collection<GridSegment2x> segments) {
        this(null, segments, null, WallKind.solid());
    }

    public Wall(EdgeShape shape) {
        this(null, shape, null, WallKind.solid());
    }

    public Wall(Long wallId, Collection<GridSegment2x> segments, GridSegment2x anchorSegment2x, WallKind wallKind) {
        super(EdgeShape.normalizeBoundarySegments(segments));
        this.wallId = wallId;
        this.anchorSegment2x = resolveAnchorSegment(anchorSegment2x, segments2x());
        this.wallKind = wallKind == null ? WallKind.solid() : wallKind;
    }

    public Wall(Long wallId, EdgeShape shape, GridSegment2x anchorSegment2x, WallKind wallKind) {
        this(wallId, shape == null ? List.of() : shape.segments2x(), anchorSegment2x, wallKind);
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
        return wallId;
    }

    public GridSegment2x anchorSegment2x() {
        return anchorSegment2x;
    }

    public GridSegment2x persistedAnchorSegment2x() {
        return anchorSegment2x == null ? firstSegment2x() : anchorSegment2x;
    }

    public Set<GridSegment2x> boundarySegments() {
        Set<GridSegment2x> segments = segmentSet2x();
        return segments.isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(segments));
    }

    public List<GridSegment2x> orderedBoundarySegments() {
        return boundarySegments().stream()
                .sorted(GridSegment2x.ORDER)
                .toList();
    }

    public boolean hasBoundarySegment(GridSegment2x segment2x) {
        return segment2x != null && contains(segment2x);
    }

    public boolean hasBoundarySegments() {
        return !isEmpty();
    }

    public WallKind wallKind() {
        return wallKind;
    }

    public Wall movedBy(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new Wall(wallId, segments2x().stream()
                .map(segment -> segment.translatedByCells(resolvedDelta))
                .toList(),
                anchorSegment2x == null ? null : anchorSegment2x.translatedByCells(resolvedDelta),
                wallKind);
    }

    public Wall withWallId(Long wallId) {
        if (Objects.equals(this.wallId, wallId)) {
            return this;
        }
        return new Wall(wallId, segments2x(), anchorSegment2x, wallKind);
    }

    public Wall withWallKind(WallKind wallKind) {
        WallKind resolvedWallKind = wallKind == null ? WallKind.solid() : wallKind;
        if (Objects.equals(this.wallKind, resolvedWallKind)) {
            return this;
        }
        return new Wall(wallId, segments2x(), anchorSegment2x, resolvedWallKind);
    }

    public Wall clippedToBoundary(Collection<GridSegment2x> boundarySegments) {
        if (!hasBoundarySegments()) {
            return null;
        }
        EdgeShape boundaryShape = EdgeShape.fromBoundarySegments(boundarySegments);
        if (boundaryShape.isEmpty()) {
            return null;
        }
        EdgeShape clippedShape = boundaryShape.intersection(boundarySegments());
        if (clippedShape.isEmpty()) {
            return null;
        }
        GridSegment2x clippedAnchor = clippedShape.contains(anchorSegment2x)
                ? anchorSegment2x
                : clippedShape.firstSegment2x();
        return Wall.fromShape(wallId, clippedShape, clippedAnchor, wallKind);
    }

    public List<Wall> withoutBoundarySegments(Collection<GridSegment2x> removedBoundarySegments) {
        if (!hasBoundarySegments()) {
            return List.of();
        }
        EdgeShape remainingShape = EdgeShape.fromBoundarySegments(boundarySegments()).without(removedBoundarySegments);
        List<EdgeShape> components = remainingShape.connectedComponents();
        if (components.isEmpty()) {
            return List.of();
        }
        int idRetainingIndex = retainingComponentIndex(components, anchorSegment2x);
        ArrayList<Wall> result = new ArrayList<>();
        for (int index = 0; index < components.size(); index++) {
            EdgeShape component = components.get(index);
            GridSegment2x repairedAnchor = component.contains(anchorSegment2x)
                    ? anchorSegment2x
                    : component.firstSegment2x();
            result.add(Wall.fromShape(
                    index == idRetainingIndex ? wallId : null,
                    component,
                    repairedAnchor,
                    wallKind));
        }
        result.sort(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    public static List<Wall> fromBoundaryComponents(
            Collection<GridSegment2x> boundarySegments,
            WallKind wallKind
    ) {
        EdgeShape shape = EdgeShape.fromBoundarySegments(boundarySegments);
        if (shape.isEmpty()) {
            return List.of();
        }
        ArrayList<Wall> result = new ArrayList<>();
        for (EdgeShape component : shape.connectedComponents()) {
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

    private static GridSegment2x resolveAnchorSegment(
            GridSegment2x requestedAnchorSegment2x,
            List<GridSegment2x> segments2x
    ) {
        if (requestedAnchorSegment2x != null && segments2x.contains(requestedAnchorSegment2x)) {
            return requestedAnchorSegment2x;
        }
        return segments2x.stream()
                .sorted(GridSegment2x.ORDER)
                .findFirst()
                .orElse(null);
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
        return Objects.equals(wallId, wall.wallId)
                && Objects.equals(segments2x(), wall.segments2x())
                && Objects.equals(anchorSegment2x, wall.anchorSegment2x)
                && Objects.equals(wallKind, wall.wallKind);
    }

    @Override
    public int hashCode() {
        return Objects.hash(wallId, segments2x(), anchorSegment2x, wallKind);
    }
}
