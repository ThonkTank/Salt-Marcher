package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
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
            case DungeonHitSurface.TileCellSurface tileCellSurface -> matchTileCell(tileCellSurface, probe);
            case DungeonHitSurface.TileShapeSurface tileShapeSurface -> matchTileShape(tileShapeSurface, probe);
            case DungeonHitSurface.EdgeSurface edgeSurface -> matchEdge(edgeSurface, probe);
            case DungeonHitSurface.DoubledPointSurface doubledPointSurface -> matchDoubledPoint(doubledPointSurface, probe);
            case DungeonHitSurface.DoubledEdgeSurface doubledEdgeSurface -> matchDoubledEdge(doubledEdgeSurface, probe);
            case DungeonHitSurface.LabelSurface labelSurface -> matchLabel(labelSurface, probe);
        };
    }

    private static SurfaceMatch matchTileCell(DungeonHitSurface.TileCellSurface surface, DungeonHitProbe probe) {
        if (!surface.cell().equals(probe.gridCell())) {
            return null;
        }
        return new SurfaceMatch(surface, 0.0);
    }

    private static SurfaceMatch matchTileShape(DungeonHitSurface.TileShapeSurface surface, DungeonHitProbe probe) {
        if (!surface.shape().contains(probe.gridCell())) {
            return null;
        }
        return new SurfaceMatch(surface, 0.0);
    }

    private static SurfaceMatch matchEdge(DungeonHitSurface.EdgeSurface surface, DungeonHitProbe probe) {
        Point2D start = probe.canvasPointForGrid(surface.edge().start());
        Point2D end = probe.canvasPointForGrid(surface.edge().end());
        double distance = distanceToSegment(probe.canvasPoint(), start, end);
        return distance <= DungeonHitConventions.edgeTolerancePx(probe.gridSizePx())
                ? new SurfaceMatch(surface, distance)
                : null;
    }

    private static SurfaceMatch matchDoubledPoint(DungeonHitSurface.DoubledPointSurface surface, DungeonHitProbe probe) {
        double distance = probe.canvasPoint().distance(probe.canvasPointForDoubled(surface.point()));
        return distance <= DungeonHitConventions.pointTolerancePx(probe.gridSizePx())
                ? new SurfaceMatch(surface, distance)
                : null;
    }

    private static SurfaceMatch matchDoubledEdge(DungeonHitSurface.DoubledEdgeSurface surface, DungeonHitProbe probe) {
        Point2D start = probe.canvasPointForDoubled(surface.edge().start());
        Point2D end = probe.canvasPointForDoubled(surface.edge().end());
        double distance = distanceToSegment(probe.canvasPoint(), start, end);
        return distance <= DungeonHitConventions.edgeTolerancePx(probe.gridSizePx())
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

    private record SurfaceMatch(DungeonHitSurface surface, double distancePx) {
        private SurfaceMatch {
            Objects.requireNonNull(surface, "surface");
            if (!Double.isFinite(distancePx) || distancePx < 0.0) {
                throw new IllegalArgumentException("distancePx must be finite and >= 0");
            }
        }
    }
}
