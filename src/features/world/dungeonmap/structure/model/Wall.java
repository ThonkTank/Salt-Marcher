package features.world.dungeonmap.structure.model;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.Collection;
import java.util.List;
import java.util.Objects;

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
