package features.world.dungeonmap.structure.model.boundary;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Shared internal base for boundary-local single-object owners.
 *
 * <p>This type centralizes anchor, segment, and clipping mechanics that both doors and walls use. Callers should stay
 * on the concrete door and wall APIs instead of widening onto this base.</p>
 */
public abstract class BoundaryObject extends EdgeShape {

    private final Long objectId;
    private final GridSegment2x anchorSegment2x;

    protected BoundaryObject(Long objectId, Collection<GridSegment2x> segments, GridSegment2x anchorSegment2x) {
        super(EdgeShape.normalizeBoundarySegments(segments));
        this.objectId = objectId;
        this.anchorSegment2x = resolveAnchorSegment(anchorSegment2x, segments2x());
    }

    protected BoundaryObject(Long objectId, EdgeShape shape, GridSegment2x anchorSegment2x) {
        this(objectId, shape == null ? List.of() : shape.segments2x(), anchorSegment2x);
    }

    protected final Long objectId() {
        return objectId;
    }

    protected final GridSegment2x anchorSegment2xInternal() {
        return anchorSegment2x;
    }

    public final GridSegment2x persistedAnchorSegment2x() {
        return anchorSegment2x == null ? firstSegment2x() : anchorSegment2x;
    }

    public final Set<GridSegment2x> boundarySegments() {
        Set<GridSegment2x> segments = segmentSet2x();
        return segments.isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(segments));
    }

    public final List<GridSegment2x> orderedBoundarySegments() {
        return boundarySegments().stream()
                .sorted(GridSegment2x.ORDER)
                .toList();
    }

    public final boolean hasBoundarySegment(GridSegment2x segment2x) {
        return segment2x != null && contains(segment2x);
    }

    public final boolean hasBoundarySegments() {
        return !isEmpty();
    }

    protected final List<GridSegment2x> translatedBoundarySegments(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        return segments2x().stream()
                .map(segment -> segment.translatedByCells(resolvedDelta))
                .toList();
    }

    protected final GridSegment2x translatedAnchorSegment2x(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        return anchorSegment2x == null ? null : anchorSegment2x.translatedByCells(resolvedDelta);
    }

    protected final EdgeShape clippedBoundaryShape(Collection<GridSegment2x> boundarySegments) {
        if (!hasBoundarySegments()) {
            return EdgeShape.empty();
        }
        EdgeShape boundaryShape = EdgeShape.fromBoundarySegments(boundarySegments);
        return boundaryShape.isEmpty() ? EdgeShape.empty() : boundaryShape.intersection(boundarySegments());
    }

    protected final List<EdgeShape> remainingBoundaryComponents(Collection<GridSegment2x> removedBoundarySegments) {
        if (!hasBoundarySegments()) {
            return List.of();
        }
        EdgeShape remainingShape = EdgeShape.fromBoundarySegments(boundarySegments()).without(removedBoundarySegments);
        return remainingShape.connectedComponents();
    }

    protected final GridSegment2x repairedAnchorSegment2x(EdgeShape shape) {
        if (shape == null || shape.isEmpty()) {
            return null;
        }
        return shape.contains(anchorSegment2x) ? anchorSegment2x : shape.firstSegment2x();
    }

    protected final boolean sameBaseState(BoundaryObject other) {
        return Objects.equals(objectId, other.objectId)
                && Objects.equals(segments2x(), other.segments2x())
                && Objects.equals(anchorSegment2x, other.anchorSegment2x);
    }

    protected final int baseHashCode() {
        return Objects.hash(objectId, segments2x(), anchorSegment2x);
    }

    protected static final List<EdgeShape> boundaryComponents(Collection<GridSegment2x> boundarySegments) {
        EdgeShape shape = EdgeShape.fromBoundarySegments(boundarySegments);
        return shape.isEmpty() ? List.of() : shape.connectedComponents();
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
}
