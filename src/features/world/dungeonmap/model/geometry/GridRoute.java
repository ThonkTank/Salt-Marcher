package features.world.dungeonmap.model.geometry;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Ordered guide route over grid anchors.
 *
 * <p>This is intentionally not a committed wall/path raster. It stores the ordered route intent that later
 * systems such as corridor planning, editor handles, or render projection can refine into concrete tile or
 * edge geometry.</p>
 *
 * <p>TODO: Add route simplification helpers once waypoint editing creates redundant collinear anchors.</p>
 * <p>TODO: Add route splitting/merging once corridors can branch or be cut interactively.</p>
 */
public final class GridRoute {

    private final List<GridAnchor> anchors;

    public GridRoute(Collection<? extends GridAnchor> anchors) {
        this.anchors = normalizeAnchors(anchors);
    }

    public static GridRoute empty() {
        return new GridRoute(List.of());
    }

    public List<GridAnchor> anchors() {
        return anchors;
    }

    public boolean isEmpty() {
        return anchors.isEmpty();
    }

    public int anchorCount() {
        return anchors.size();
    }

    public GridAnchor start() {
        return anchors.isEmpty() ? null : anchors.getFirst();
    }

    public GridAnchor end() {
        return anchors.isEmpty() ? null : anchors.getLast();
    }

    public List<GridAnchor> waypoints() {
        if (anchors.size() <= 2) {
            return List.of();
        }
        return List.copyOf(anchors.subList(1, anchors.size() - 1));
    }

    public List<Segment> segments() {
        List<Segment> result = new ArrayList<>();
        for (int index = 1; index < anchors.size(); index++) {
            result.add(new Segment(anchors.get(index - 1), anchors.get(index)));
        }
        return List.copyOf(result);
    }

    public boolean containsAnchor(GridAnchor anchor) {
        return anchor != null && anchors.contains(anchor);
    }

    public boolean containsKind(GridAnchor.Kind kind) {
        if (kind == null) {
            return false;
        }
        for (GridAnchor anchor : anchors) {
            if (anchor.kind() == kind) {
                return true;
            }
        }
        return false;
    }

    public boolean isLoop() {
        return anchors.size() > 1 && anchors.getFirst().equals(anchors.getLast());
    }

    public boolean isOrthogonal() {
        for (Segment segment : segments()) {
            if (!segment.isAxisAligned()) {
                return false;
            }
        }
        return true;
    }

    public int minGridX2() {
        return anchors.stream().map(GridAnchor::doubledGridPoint).mapToInt(Point2i::x).min().orElse(0);
    }

    public int maxGridX2() {
        return anchors.stream().map(GridAnchor::doubledGridPoint).mapToInt(Point2i::x).max().orElse(0);
    }

    public int minGridY2() {
        return anchors.stream().map(GridAnchor::doubledGridPoint).mapToInt(Point2i::y).min().orElse(0);
    }

    public int maxGridY2() {
        return anchors.stream().map(GridAnchor::doubledGridPoint).mapToInt(Point2i::y).max().orElse(0);
    }

    public GridRoute translated(Point2i delta) {
        List<GridAnchor> translated = anchors.stream()
                .map(anchor -> anchor.translated(delta))
                .toList();
        return new GridRoute(translated);
    }

    public GridRoute reversed() {
        List<GridAnchor> reversed = new ArrayList<>(anchors);
        java.util.Collections.reverse(reversed);
        return new GridRoute(reversed);
    }

    public GridRoute withInsertedAnchor(int index, GridAnchor anchor) {
        List<GridAnchor> updated = new ArrayList<>(anchors);
        int insertionIndex = Math.max(0, Math.min(index, updated.size()));
        updated.add(insertionIndex, anchor);
        return new GridRoute(updated);
    }

    public GridRoute withMovedAnchor(int index, GridAnchor anchor) {
        if (index < 0 || index >= anchors.size()) {
            return this;
        }
        List<GridAnchor> updated = new ArrayList<>(anchors);
        updated.set(index, anchor);
        return new GridRoute(updated);
    }

    public GridRoute withRemovedAnchor(int index) {
        if (index < 0 || index >= anchors.size()) {
            return this;
        }
        List<GridAnchor> updated = new ArrayList<>(anchors);
        updated.remove(index);
        return new GridRoute(updated);
    }

    private static List<GridAnchor> normalizeAnchors(Collection<? extends GridAnchor> anchors) {
        List<GridAnchor> normalized = new ArrayList<>();
        if (anchors == null) {
            return List.of();
        }
        GridAnchor previous = null;
        for (GridAnchor anchor : anchors) {
            if (anchor == null) {
                continue;
            }
            if (anchor.equals(previous)) {
                continue;
            }
            normalized.add(anchor);
            previous = anchor;
        }
        return List.copyOf(normalized);
    }

    public record Segment(GridAnchor start, GridAnchor end) {
        public Segment {
            start = start == null ? GridAnchor.atVertex(new Point2i(0, 0)) : start;
            end = end == null ? start : end;
        }

        public Point2i startGridPoint2() {
            return start.doubledGridPoint();
        }

        public Point2i endGridPoint2() {
            return end.doubledGridPoint();
        }

        public boolean isAxisAligned() {
            return startGridPoint2().x() == endGridPoint2().x() || startGridPoint2().y() == endGridPoint2().y();
        }

        public boolean isHorizontal() {
            return startGridPoint2().y() == endGridPoint2().y();
        }

        public boolean isVertical() {
            return startGridPoint2().x() == endGridPoint2().x();
        }

        public int manhattanLengthOnDoubledGrid() {
            return startGridPoint2().distanceTo(endGridPoint2());
        }

        public Segment translated(Point2i delta) {
            return new Segment(start.translated(delta), end.translated(delta));
        }
    }
}
