package features.world.dungeon.dungeonmap.structure.model.boundary;

import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridOccupant;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridTranslation;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Shared internal base for boundary-local single-object owners.
 */
public abstract class BoundaryObject implements GridOccupant {

    private final Long objectId;
    private final GridBoundary boundary;
    private final GridSegment anchorSegment;

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

    @Override
    public final GridArea cellFootprint() {
        if (!hasBoundarySegments()) {
            return GridArea.empty();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        orderedBoundarySegments().forEach(segment -> segment.cellFootprint().cells().stream()
                .sorted(GridPoint.ORDER)
                .forEach(result::add));
        return result.isEmpty() ? GridArea.empty() : GridArea.of(result);
    }

    public final boolean touchesAnyCell(GridArea cells) {
        if (cells == null || cells.isEmpty() || !hasBoundarySegments()) {
            return false;
        }
        return cellFootprint().overlaps(cells);
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

    protected final GridBoundary clippedBoundary(GridBoundary boundarySegments) {
        if (!hasBoundarySegments()) {
            return GridBoundary.empty();
        }
        GridBoundary clippedBoundary = boundarySegments == null ? GridBoundary.empty() : boundarySegments;
        return clippedBoundary.isEmpty() ? GridBoundary.empty() : clippedBoundary.intersection(boundary);
    }

    protected final List<GridBoundary> remainingBoundaryComponents(GridBoundary removedBoundarySegments) {
        if (!hasBoundarySegments()) {
            return List.of();
        }
        GridBoundary removed = removedBoundarySegments == null ? GridBoundary.empty() : removedBoundarySegments;
        GridBoundary remaining = boundary.without(removed);
        return remaining.components();
    }

    protected final GridSegment repairedAnchorSegment(GridBoundary boundary) {
        return canonicalAnchorSegment(boundary == null ? Set.of() : boundary.segments(), anchorSegment);
    }

    protected final boolean sameBaseState(BoundaryObject other) {
        return Objects.equals(objectId, other.objectId)
                && Objects.equals(orderedBoundarySegments(), other.orderedBoundarySegments())
                && Objects.equals(anchorSegment, other.anchorSegment);
    }

    protected final int baseHashCode() {
        return Objects.hash(objectId, orderedBoundarySegments(), anchorSegment);
    }

    protected static final List<GridBoundary> boundaryComponents(GridBoundary boundarySegments) {
        GridBoundary boundary = boundarySegments == null ? GridBoundary.empty() : boundarySegments;
        return boundary.isEmpty() ? List.of() : boundary.components();
    }

    protected static final GridSegment canonicalAnchorSegment(
            Set<GridSegment> segments,
            GridSegment preferredAnchorSegment
    ) {
        if (preferredAnchorSegment != null && segments.contains(preferredAnchorSegment)) {
            return preferredAnchorSegment;
        }
        return segments.stream().sorted(GridSegment.ORDER).findFirst().orElse(null);
    }

    private static GridSegment resolveAnchorSegment(GridSegment requestedAnchorSegment, Set<GridSegment> segments) {
        return canonicalAnchorSegment(segments, requestedAnchorSegment);
    }
}
