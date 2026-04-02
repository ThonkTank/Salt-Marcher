package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import javafx.geometry.Point2D;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

public final class DungeonHitCollector {

    private static final Comparator<DungeonHitCandidate> CANDIDATE_ORDER =
            Comparator.comparingLong(DungeonHitCandidate::effectivePriority).reversed()
                    .thenComparingDouble(DungeonHitCandidate::distancePx)
                    .thenComparing(candidate -> candidate.descriptor().subject().targetKey())
                    .thenComparing(candidate -> candidate.descriptor().subject().partKey());

    private final List<DungeonHitSource> sources;

    public DungeonHitCollector() {
        this(List.of(
                new DungeonSpatialHitSource(),
                new DungeonBoundaryHitSource(),
                new DungeonCorridorGraphHitSource(),
                new DungeonLabelHitSource(),
                new DungeonVertexHitSource(),
                new DungeonFloorHitSource()));
    }

    public DungeonHitCollector(List<DungeonHitSource> sources) {
        List<DungeonHitSource> sourceList = List.copyOf(Objects.requireNonNull(sources, "sources"));
        if (sourceList.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("sources must not contain null");
        }
        this.sources = sourceList;
    }

    public DungeonHitSnapshot collect(DungeonLayout layout, DungeonHitProbe probe) {
        DungeonHitProbe resolvedProbe = Objects.requireNonNull(probe, "probe");
        DungeonLayout resolvedLayout = layout == null ? DungeonLayout.empty() : layout;
        ArrayList<DungeonHitCandidate> candidates = new ArrayList<>();
        for (DungeonHitSource source : sources) {
            for (DungeonHitDescriptor descriptor : source.describe(resolvedLayout, resolvedProbe)) {
                if (descriptor == null) {
                    continue;
                }
                SurfaceMatch bestMatch = bestMatch(descriptor, resolvedProbe);
                if (bestMatch == null) {
                    continue;
                }
                long basePriority = DungeonHitConventions.basePriority(descriptor.kind());
                candidates.add(new DungeonHitCandidate(
                        descriptor,
                        bestMatch.surface(),
                        bestMatch.distancePx(),
                        basePriority,
                        basePriority));
            }
        }
        candidates.sort(CANDIDATE_ORDER);
        return new DungeonHitSnapshot(resolvedProbe, candidates);
    }

    private static SurfaceMatch bestMatch(DungeonHitDescriptor descriptor, DungeonHitProbe probe) {
        SurfaceMatch bestMatch = null;
        for (DungeonHitSurface surface : descriptor.surfaces()) {
            SurfaceMatch match = match(surface, probe);
            if (match == null) {
                continue;
            }
            if (bestMatch == null || match.distancePx() < bestMatch.distancePx()) {
                bestMatch = match;
            }
        }
        return bestMatch;
    }

    private static SurfaceMatch match(DungeonHitSurface surface, DungeonHitProbe probe) {
        if (surface == null || probe == null || surface.levelZ() != probe.levelZ()) {
            return null;
        }
        return switch (surface) {
            case DungeonHitSurface.TileSurface tileSurface -> matchTile(tileSurface, probe);
            case DungeonHitSurface.SegmentSurface segmentSurface -> matchSegment(segmentSurface, probe);
            case DungeonHitSurface.PointSurface pointSurface -> matchPoint(pointSurface, probe);
            case DungeonHitSurface.LabelSurface labelSurface -> matchLabel(labelSurface, probe);
        };
    }

    private static SurfaceMatch matchTile(DungeonHitSurface.TileSurface surface, DungeonHitProbe probe) {
        return surface.cells().contains(CellCoord.fromPoint(probe.gridCell())) ? new SurfaceMatch(surface, 0.0) : null;
    }

    private static SurfaceMatch matchSegment(DungeonHitSurface.SegmentSurface surface, DungeonHitProbe probe) {
        double distance = distanceToSegment(surface.segment2x(), probe);
        return distance <= DungeonHitConventions.edgeTolerancePx(probe.gridSizePx())
                ? new SurfaceMatch(surface, distance)
                : null;
    }

    private static SurfaceMatch matchPoint(DungeonHitSurface.PointSurface surface, DungeonHitProbe probe) {
        double distance = distanceToPoint(surface.point2x(), probe);
        return distance <= DungeonHitConventions.pointTolerancePx(probe.gridSizePx())
                ? new SurfaceMatch(surface, distance)
                : null;
    }

    private static SurfaceMatch matchLabel(DungeonHitSurface.LabelSurface surface, DungeonHitProbe probe) {
        if (!surface.bounds().contains(probe.canvasPoint())) {
            return null;
        }
        return new SurfaceMatch(surface, DungeonHitConventions.labelDistancePx(
                probe.canvasPoint(),
                surface.anchorPoint()));
    }

    private static double distanceToSegment(Point2D point, Point2D start, Point2D end) {
        double dx = end.getX() - start.getX();
        double dy = end.getY() - start.getY();
        double lengthSquared = dx * dx + dy * dy;
        if (lengthSquared <= 0.0) {
            return point.distance(start);
        }
        double projection = ((point.getX() - start.getX()) * dx + (point.getY() - start.getY()) * dy) / lengthSquared;
        double clamped = Math.max(0.0, Math.min(1.0, projection));
        double nearestX = start.getX() + clamped * dx;
        double nearestY = start.getY() + clamped * dy;
        return point.distance(nearestX, nearestY);
    }

    private static double distanceToSegment(GridSegment2x segment2x, DungeonHitProbe probe) {
        Point2D start = probe.canvasPointForPoint2x(segment2x.start());
        Point2D end = probe.canvasPointForPoint2x(segment2x.end());
        return distanceToSegment(probe.canvasPoint(), start, end);
    }

    private static double distanceToPoint(GridPoint2x point2x, DungeonHitProbe probe) {
        return probe.canvasPoint().distance(probe.canvasPointForPoint2x(point2x));
    }

    private record SurfaceMatch(DungeonHitSurface surface, double distancePx) {
        private SurfaceMatch {
            Objects.requireNonNull(surface, "surface");
            if (!Double.isFinite(distancePx) || distancePx < 0.0) {
                throw new IllegalArgumentException("distancePx must be finite and >= 0");
            }
        }
    }
}
