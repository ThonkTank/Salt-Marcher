package features.world.dungeonmap.map.structure.model.boundary;

import features.world.dungeonmap.geometry.GridBoundary;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.geometry.GridTranslation;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Shared internal base for boundary-local single-object owners.
 */
public abstract class BoundaryObject {

    private final Long objectId;
    private final GridBoundary boundary;
    private final GridSegment anchorSegment;

    protected BoundaryObject(Long objectId, Collection<GridSegment> segments, GridSegment anchorSegment) {
        this(objectId, GridBoundary.of(segments), anchorSegment);
    }

    protected BoundaryObject(Long objectId, GridBoundary boundary, GridSegment anchorSegment) {
        this.objectId = objectId;
        this.boundary = boundary == null ? GridBoundary.empty() : boundary;
        this.anchorSegment = resolveAnchorSegment(anchorSegment, this.boundary.segments());
    }

    protected final Long objectId() {
        return objectId;
    }

    protected final GridSegment anchorSegmentInternal() {
        return anchorSegment;
    }

    public final GridSegment persistedAnchorSegment() {
        return anchorSegment != null
                ? anchorSegment
                : boundary.segments().stream().sorted(GridSegment.ORDER).findFirst().orElse(null);
    }

    public final Set<GridSegment> boundarySegments() {
        return boundary.segments();
    }

    public final List<GridSegment> orderedBoundarySegments() {
        return boundary.segments().stream().sorted(GridSegment.ORDER).toList();
    }

    public final boolean hasBoundarySegment(GridSegment segment) {
        return segment != null && boundary.contains(segment);
    }

    public final boolean hasBoundarySegments() {
        return !boundary.isEmpty();
    }

    public final Set<GridPoint> touchingCells() {
        if (!hasBoundarySegments()) {
            return Set.of();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        orderedBoundarySegments().forEach(segment -> segment.touchingCells().cells().stream()
                .sorted(GridPoint.ORDER)
                .forEach(result::add));
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public final boolean touchesAnyCell(GridArea cells) {
        if (cells == null || cells.isEmpty() || !hasBoundarySegments()) {
            return false;
        }
        return touchingCells().stream().anyMatch(cells::contains);
    }

    protected final List<GridSegment> translatedBoundarySegments(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        return orderedBoundarySegments().stream()
                .map(segment -> segment.translated(resolvedTranslation))
                .toList();
    }

    protected final GridSegment translatedAnchorSegment(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        return anchorSegment == null ? null : anchorSegment.translated(resolvedTranslation);
    }

    protected final GridBoundary clippedBoundary(Collection<GridSegment> boundarySegments) {
        if (!hasBoundarySegments()) {
            return GridBoundary.empty();
        }
        GridBoundary clippedBoundary = GridBoundary.of(boundarySegments);
        return clippedBoundary.isEmpty() ? GridBoundary.empty() : clippedBoundary.intersection(boundary);
    }

    protected final List<GridBoundary> remainingBoundaryComponents(Collection<GridSegment> removedBoundarySegments) {
        if (!hasBoundarySegments()) {
            return List.of();
        }
        GridBoundary removed = GridBoundary.of(removedBoundarySegments);
        GridBoundary remaining = boundary.without(removed);
        return remaining.components();
    }

    protected final GridSegment repairedAnchorSegment(GridBoundary boundary) {
        if (boundary == null || boundary.isEmpty()) {
            return null;
        }
        if (anchorSegment != null && boundary.contains(anchorSegment)) {
            return anchorSegment;
        }
        return boundary.segments().stream().sorted(GridSegment.ORDER).findFirst().orElse(null);
    }

    protected final boolean sameBaseState(BoundaryObject other) {
        return Objects.equals(objectId, other.objectId)
                && Objects.equals(orderedBoundarySegments(), other.orderedBoundarySegments())
                && Objects.equals(anchorSegment, other.anchorSegment);
    }

    protected final int baseHashCode() {
        return Objects.hash(objectId, orderedBoundarySegments(), anchorSegment);
    }

    protected static final List<GridBoundary> boundaryComponents(Collection<GridSegment> boundarySegments) {
        GridBoundary boundary = GridBoundary.of(boundarySegments);
        return boundary.isEmpty() ? List.of() : boundary.components();
    }

    private static GridSegment resolveAnchorSegment(GridSegment requestedAnchorSegment, Collection<GridSegment> segments) {
        if (requestedAnchorSegment != null && segments.contains(requestedAnchorSegment)) {
            return requestedAnchorSegment;
        }
        return segments.stream().sorted(GridSegment.ORDER).findFirst().orElse(null);
    }
}
