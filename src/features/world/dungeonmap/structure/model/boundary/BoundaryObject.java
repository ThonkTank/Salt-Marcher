package features.world.dungeonmap.structure.model.boundary;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridBoundary;
import features.world.dungeonmap.geometry.GridSegment;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Shared internal base for boundary-local single-object owners.
 *
 * <p>This type centralizes anchor, segment, and clipping mechanics that both doors and walls use. Callers should stay
 * on the concrete door and wall APIs instead of widening onto a generic shape carrier.</p>
 */
public abstract class BoundaryObject {

    private final Long objectId;
    private final GridBoundary boundaryShape;
    private final GridSegment anchorSegment2x;

    protected BoundaryObject(Long objectId, Collection<GridSegment> segments, GridSegment anchorSegment2x) {
        this.boundaryShape = GridBoundary.fromBoundarySegments(segments);
        this.objectId = objectId;
        this.anchorSegment2x = resolveAnchorSegment(anchorSegment2x, boundaryShape.segments2x());
    }

    protected BoundaryObject(Long objectId, GridBoundary shape, GridSegment anchorSegment2x) {
        this(objectId, shape == null ? List.of() : shape.segments2x(), anchorSegment2x);
    }

    protected final Long objectId() {
        return objectId;
    }

    protected final GridSegment anchorSegment2xInternal() {
        return anchorSegment2x;
    }

    public final GridSegment persistedAnchorSegment2x() {
        return anchorSegment2x == null ? boundaryShape.firstSegment2x() : anchorSegment2x;
    }

    public final Set<GridSegment> boundarySegments() {
        Set<GridSegment> segments = boundaryShape.segmentSet2x();
        return segments.isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(segments));
    }

    public final List<GridSegment> orderedBoundarySegments() {
        return boundaryShape.segments2x();
    }

    public final boolean hasBoundarySegment(GridSegment segment2x) {
        return segment2x != null && boundaryShape.contains(segment2x);
    }

    public final boolean hasBoundarySegments() {
        return !boundaryShape.isEmpty();
    }

    public final Set<GridPoint> touchingCells() {
        if (!hasBoundarySegments()) {
            return Set.of();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        orderedBoundarySegments().forEach(segment2x -> segment2x.touchingCells().stream()
                .sorted(GridPoint.ORDER)
                .forEach(result::add));
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public final boolean touchesAnyCell(Collection<GridPoint> cells) {
        if (cells == null || cells.isEmpty() || !hasBoundarySegments()) {
            return false;
        }
        Set<GridPoint> candidates = Set.copyOf(cells);
        return touchingCells().stream().anyMatch(candidates::contains);
    }

    protected final List<GridSegment> translatedBoundarySegments(GridPoint delta) {
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
        return orderedBoundarySegments().stream()
                .map(segment -> segment.translatedByCells(resolvedDelta))
                .toList();
    }

    protected final GridSegment translatedAnchorSegment2x(GridPoint delta) {
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
        return anchorSegment2x == null ? null : anchorSegment2x.translatedByCells(resolvedDelta);
    }

    protected final GridBoundary clippedBoundaryShape(Collection<GridSegment> boundarySegments) {
        if (!hasBoundarySegments()) {
            return GridBoundary.empty();
        }
        GridBoundary boundaryShape = GridBoundary.fromBoundarySegments(boundarySegments);
        return boundaryShape.isEmpty() ? GridBoundary.empty() : boundaryShape.intersection(this.boundarySegments());
    }

    protected final List<GridBoundary> remainingBoundaryComponents(Collection<GridSegment> removedBoundarySegments) {
        if (!hasBoundarySegments()) {
            return List.of();
        }
        GridBoundary remainingShape = GridBoundary.fromBoundarySegments(boundarySegments()).without(removedBoundarySegments);
        return remainingShape.connectedComponents();
    }

    protected final GridSegment repairedAnchorSegment2x(GridBoundary shape) {
        if (shape == null || shape.isEmpty()) {
            return null;
        }
        return shape.contains(anchorSegment2x) ? anchorSegment2x : shape.firstSegment2x();
    }

    protected final boolean sameBaseState(BoundaryObject other) {
        return Objects.equals(objectId, other.objectId)
                && Objects.equals(orderedBoundarySegments(), other.orderedBoundarySegments())
                && Objects.equals(anchorSegment2x, other.anchorSegment2x);
    }

    protected final int baseHashCode() {
        return Objects.hash(objectId, orderedBoundarySegments(), anchorSegment2x);
    }

    protected static final List<GridBoundary> boundaryComponents(Collection<GridSegment> boundarySegments) {
        GridBoundary shape = GridBoundary.fromBoundarySegments(boundarySegments);
        return shape.isEmpty() ? List.of() : shape.connectedComponents();
    }

    private static GridSegment resolveAnchorSegment(
            GridSegment requestedAnchorSegment2x,
            List<GridSegment> segments2x
    ) {
        if (requestedAnchorSegment2x != null && segments2x.contains(requestedAnchorSegment2x)) {
            return requestedAnchorSegment2x;
        }
        return segments2x.stream()
                .sorted(GridSegment.ORDER)
                .findFirst()
                .orElse(null);
    }
}
