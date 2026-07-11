package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapCanvasPoint;

final class DungeonMapHitAreaIndex {

    private final Map<Long, List<HitCandidate>> buckets;

    private DungeonMapHitAreaIndex(Map<Long, List<HitCandidate>> buckets) {
        this.buckets = buckets;
    }

    static DungeonMapHitAreaIndex empty() {
        return new DungeonMapHitAreaIndex(Map.of());
    }

    static DungeonMapHitAreaIndex from(List<HitArea> hitAreas) {
        if (hitAreas.isEmpty()) {
            return empty();
        }
        return new DungeonMapHitAreaIndex(HitBuckets.from(hitAreas));
    }

    List<DungeonMapHitIndex.CanvasHit> hitsAt(double sceneX, double sceneY, double gridSize) {
        return HitBuckets.hitsAt(buckets, sceneX, sceneY, gridSize);
    }

    interface HitArea {

        String hitRef();

        HitBounds bounds();

        boolean matches(double sceneX, double sceneY, double tolerance);
    }

    static HitArea polygonArea(String hitRef, List<MapCanvasPoint> polygon) {
        return new PolygonHitArea(hitRef, polygon);
    }

    static HitArea polylineArea(String hitRef, List<MapCanvasPoint> polyline) {
        return new PolylineHitArea(hitRef, polyline);
    }

    static List<HitArea> doorHandleHits(DungeonMapRenderState displayModel) {
        if (displayModel == null) {
            return List.of();
        }
        List<HitArea> hitAreas = new ArrayList<>();
        for (DungeonMapRenderState.Marker marker : displayModel.markers()) {
            if (!DungeonMapSceneIdentity.includeLevel(displayModel, marker.z())
                    || !marker.isDoorMarker()
                    || marker.preview()) {
                continue;
            }
            String hitRef = DungeonMapSceneIdentity.markerHitRef(marker);
            if (hitRef.isBlank()) {
                continue;
            }
            hitAreas.add(polygonArea(
                    hitRef,
                    DungeonMapSceneGeometry.Marker.doorHandleHitShape(marker)));
        }
        return List.copyOf(hitAreas);
    }

    record HitBounds(double minX, double minY, double maxX, double maxY) {

        static HitBounds from(List<MapCanvasPoint> points) {
            if (points.isEmpty()) {
                return new HitBounds(0.0, 0.0, 0.0, 0.0);
            }
            double minX = Double.POSITIVE_INFINITY;
            double minY = Double.POSITIVE_INFINITY;
            double maxX = Double.NEGATIVE_INFINITY;
            double maxY = Double.NEGATIVE_INFINITY;
            for (MapCanvasPoint point : points) {
                minX = Math.min(minX, point.x());
                minY = Math.min(minY, point.y());
                maxX = Math.max(maxX, point.x());
                maxY = Math.max(maxY, point.y());
            }
            return new HitBounds(minX, minY, maxX, maxY);
        }

        HitBounds expand(double amount) {
            return new HitBounds(minX - amount, minY - amount, maxX + amount, maxY + amount);
        }

        boolean contains(double sceneX, double sceneY, double tolerance) {
            return sceneX >= minX - tolerance
                    && sceneX <= maxX + tolerance
                    && sceneY >= minY - tolerance
                    && sceneY <= maxY + tolerance;
        }
    }

    private record HitCandidate(HitArea area, DungeonMapHitIndex.CanvasHit hit, HitBounds bounds) {

        private static HitCandidate from(HitArea area) {
            return new HitCandidate(
                    area,
                    new DungeonMapHitIndex.CanvasHit(area.hitRef()),
                    area.bounds());
        }

        private boolean matches(double sceneX, double sceneY, double tolerance) {
            return bounds.contains(sceneX, sceneY, tolerance)
                    && area.matches(sceneX, sceneY, tolerance);
        }
    }

    private static final class PolygonHitArea implements HitArea {
        private final String hitRef;
        private final List<MapCanvasPoint> polygon;

        private PolygonHitArea(String hitRef, List<MapCanvasPoint> polygon) {
            this.hitRef = hitRef == null ? "" : hitRef;
            this.polygon = List.copyOf(polygon);
        }

        @Override
        public String hitRef() {
            return hitRef;
        }

        @Override
        public HitBounds bounds() {
            return HitBounds.from(polygon);
        }

        @Override
        public boolean matches(double sceneX, double sceneY, double tolerance) {
            return !hitRef.isBlank() && HitGeometry.pointInPolygon(sceneX, sceneY, polygon);
        }
    }

    private static final class PolylineHitArea implements HitArea {
        private final String hitRef;
        private final List<MapCanvasPoint> polyline;

        private PolylineHitArea(String hitRef, List<MapCanvasPoint> polyline) {
            this.hitRef = hitRef == null ? "" : hitRef;
            this.polyline = List.copyOf(polyline);
        }

        @Override
        public String hitRef() {
            return hitRef;
        }

        @Override
        public HitBounds bounds() {
            return HitBounds.from(polyline);
        }

        @Override
        public boolean matches(double sceneX, double sceneY, double tolerance) {
            return !hitRef.isBlank()
                    && HitGeometry.closeToPolyline(sceneX, sceneY, polyline, tolerance);
        }
    }

    private static final class HitBuckets {
        private static final double MINIMUM_HIT_TOLERANCE = 0.22;
        private static final double HIT_TOLERANCE_PIXELS = 7.0;
        private static final double HIT_BUCKET_SIZE_SCENE = 4.0;

        private static Map<Long, List<HitCandidate>> from(List<HitArea> hitAreas) {
            Map<Long, List<HitCandidate>> nextBuckets = new LinkedHashMap<>();
            for (HitArea hitArea : hitAreas) {
                if (hitArea.hitRef().isBlank()) {
                    continue;
                }
                HitCandidate candidate = HitCandidate.from(hitArea);
                HitBounds bounds = hitArea.bounds().expand(maximumHitIndexTolerance());
                int minBucketX = bucket(bounds.minX());
                int maxBucketX = bucket(bounds.maxX());
                int minBucketY = bucket(bounds.minY());
                int maxBucketY = bucket(bounds.maxY());
                for (int bucketX = minBucketX; bucketX <= maxBucketX; bucketX++) {
                    for (int bucketY = minBucketY; bucketY <= maxBucketY; bucketY++) {
                        nextBuckets.computeIfAbsent(key(bucketX, bucketY), ignored -> new ArrayList<>()).add(candidate);
                    }
                }
            }
            return copyBuckets(nextBuckets);
        }

        private static List<DungeonMapHitIndex.CanvasHit> hitsAt(
                Map<Long, List<HitCandidate>> buckets,
                double sceneX,
                double sceneY,
                double gridSize
        ) {
            List<HitCandidate> candidates = buckets.get(key(bucket(sceneX), bucket(sceneY)));
            if (candidates == null) {
                return List.of();
            }
            double tolerance = Math.max(HIT_TOLERANCE_PIXELS / gridSize, MINIMUM_HIT_TOLERANCE);
            List<DungeonMapHitIndex.CanvasHit> hits = new ArrayList<>();
            Set<String> seenHitRefs = new LinkedHashSet<>();
            for (HitCandidate candidate : candidates) {
                if (candidate.matches(sceneX, sceneY, tolerance)
                        && seenHitRefs.add(candidate.hit().hitRef())) {
                    hits.add(candidate.hit());
                }
            }
            return List.copyOf(hits);
        }

        private static int bucket(double sceneCoordinate) {
            return (int) Math.floor(sceneCoordinate / HIT_BUCKET_SIZE_SCENE);
        }

        private static long key(int bucketX, int bucketY) {
            return ((long) bucketX << Integer.SIZE) ^ (bucketY & 0xffff_ffffL);
        }

        private static Map<Long, List<HitCandidate>> copyBuckets(Map<Long, List<HitCandidate>> buckets) {
            Map<Long, List<HitCandidate>> result = new LinkedHashMap<>();
            for (Map.Entry<Long, List<HitCandidate>> entry : buckets.entrySet()) {
                result.put(entry.getKey(), List.copyOf(entry.getValue()));
            }
            return Map.copyOf(result);
        }

        private static double maximumHitIndexTolerance() {
            return HIT_TOLERANCE_PIXELS
                    / (DungeonMapViewportScale.baseGrid()
                    * DungeonMapViewportScale.minimumZoom());
        }
    }

    private static final class HitGeometry {
        private static final int MINIMUM_POLYLINE_POINTS = 2;

        private static boolean pointInPolygon(double x, double y, List<MapCanvasPoint> polygon) {
            boolean inside = false;
            int previous = polygon.size() - 1;
            for (int index = 0; index < polygon.size(); index++) {
                MapCanvasPoint current = polygon.get(index);
                MapCanvasPoint before = polygon.get(previous);
                if (((current.y() > y) != (before.y() > y))
                        && (x < (before.x() - current.x()) * (y - current.y()) / (before.y() - current.y()) + current.x())) {
                    inside = !inside;
                }
                previous = index;
            }
            return inside;
        }

        private static boolean closeToPolyline(
                double x,
                double y,
                List<MapCanvasPoint> polyline,
                double tolerance
        ) {
            return polyline.size() >= MINIMUM_POLYLINE_POINTS
                    && distanceToPolyline(x, y, polyline) <= tolerance;
        }

        private static double distanceToPolyline(double x, double y, List<MapCanvasPoint> polyline) {
            double best = Double.POSITIVE_INFINITY;
            for (int index = 1; index < polyline.size(); index++) {
                MapCanvasPoint start = polyline.get(index - 1);
                MapCanvasPoint end = polyline.get(index);
                best = Math.min(best, distanceToSegment(x, y, start, end));
            }
            return best;
        }

        private static double distanceToSegment(double x, double y, MapCanvasPoint start, MapCanvasPoint end) {
            double dx = end.x() - start.x();
            double dy = end.y() - start.y();
            double lengthSquared = dx * dx + dy * dy;
            double degenerateSegmentLengthSquared = 0.0;
            if (lengthSquared <= degenerateSegmentLengthSquared) {
                return Math.hypot(x - start.x(), y - start.y());
            }
            double t = ((x - start.x()) * dx + (y - start.y()) * dy) / lengthSquared;
            double clamped = Math.max(0.0, Math.min(1.0, t));
            double projectionX = start.x() + clamped * dx;
            double projectionY = start.y() + clamped * dy;
            return Math.hypot(x - projectionX, y - projectionY);
        }
    }
}
