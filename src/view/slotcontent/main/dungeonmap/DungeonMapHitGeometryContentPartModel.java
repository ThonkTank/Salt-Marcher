package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.BoundaryPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.GlyphPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapCanvasPoint;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapCanvasPolygonPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.RelationPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.RenderScene;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.TextPrimitive;

final class DungeonMapHitGeometryContentPartModel {
    private static final String CLUSTER_LABEL_KIND = "CLUSTER_LABEL";

    private HitIndex hitIndex = HitIndex.empty();

    void update(
            DungeonMapRenderSceneContentPartModel.SceneBuckets buckets,
            @Nullable DungeonMapRenderState displayModel,
            RenderScene renderScene
    ) {
        hitIndex = renderScene != null && renderScene.containsRenderablePrimitives() && buckets != null
                ? HitIndex.from(projectRenderSceneHitAreas(buckets, displayModel))
                : HitIndex.empty();
    }

    List<CanvasHit> hitsAt(double sceneX, double sceneY, double gridSize) {
        return hitIndex.hitsAt(sceneX, sceneY, gridSize);
    }

    static boolean pointInPolygon(double x, double y, List<MapCanvasPoint> polygon) {
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

    private static List<HitArea> projectRenderSceneHitAreas(
            DungeonMapRenderSceneContentPartModel.SceneBuckets buckets,
            @Nullable DungeonMapRenderState displayModel
    ) {
        if (displayModel != null && displayModel.isGraphView()) {
            return HitAreaProjector.graphHitAreas(buckets.texts(), buckets.relations(), buckets.surfaces());
        }
        return HitAreaProjector.gridHitAreas(
                buckets.actors(),
                buckets.glyphs(),
                buckets.texts(),
                buckets.boundaries(),
                buckets.surfaces(),
                displayModel);
    }

    record CanvasHit(
            String hitRef
    ) {

        CanvasHit {
            hitRef = hitRef == null ? "" : hitRef;
        }
    }

    private sealed interface HitArea permits PolygonHitArea, PolylineHitArea {

        String hitRef();

        HitBounds bounds();

        boolean matches(double sceneX, double sceneY, double tolerance);
    }

    private static final class PolygonHitArea implements HitArea {
        private final String hitRef;
        private final List<MapCanvasPoint> polygon;

        private PolygonHitArea(
                String hitRef,
                List<MapCanvasPoint> polygon
        ) {
            this.hitRef = hitRef == null ? "" : hitRef;
            this.polygon = copyOf(polygon);
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
            return !hitRef.isBlank() && pointInPolygon(sceneX, sceneY, polygon);
        }
    }

    private static final class PolylineHitArea implements HitArea {
        private final String hitRef;
        private final List<MapCanvasPoint> polyline;

        private PolylineHitArea(
                String hitRef,
                List<MapCanvasPoint> polyline
        ) {
            this.hitRef = hitRef == null ? "" : hitRef;
            this.polyline = copyOf(polyline);
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
                    && polyline.size() >= minimumPolylinePoints()
                    && distanceToPolyline(sceneX, sceneY, polyline) <= tolerance;
        }
    }

    private record HitIndex(Map<Long, List<HitCandidate>> buckets) {

        private static HitIndex empty() {
            return new HitIndex(Map.of());
        }

        private static HitIndex from(List<HitArea> hitAreas) {
            if (hitAreas.isEmpty()) {
                return empty();
            }
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
            return new HitIndex(copyBuckets(nextBuckets));
        }

        private List<CanvasHit> hitsAt(double sceneX, double sceneY, double gridSize) {
            List<HitCandidate> candidates = buckets.get(key(bucket(sceneX), bucket(sceneY)));
            if (candidates == null) {
                return List.of();
            }
            double tolerance = Math.max(hitTolerancePixels() / gridSize, minimumHitTolerance());
            List<CanvasHit> hits = new ArrayList<>();
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
            return (int) Math.floor(sceneCoordinate / hitBucketSizeScene());
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
    }

    private record HitCandidate(HitArea area, CanvasHit hit, HitBounds bounds) {

        private static HitCandidate from(HitArea area) {
            return new HitCandidate(
                    area,
                    new CanvasHit(area.hitRef()),
                    area.bounds());
        }

        private boolean matches(double sceneX, double sceneY, double tolerance) {
            return bounds.contains(sceneX, sceneY, tolerance)
                    && area.matches(sceneX, sceneY, tolerance);
        }
    }

    private record HitBounds(double minX, double minY, double maxX, double maxY) {

        private static HitBounds from(List<MapCanvasPoint> points) {
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

        private HitBounds expand(double amount) {
            return new HitBounds(minX - amount, minY - amount, maxX + amount, maxY + amount);
        }

        private boolean contains(double sceneX, double sceneY, double tolerance) {
            return sceneX >= minX - tolerance
                    && sceneX <= maxX + tolerance
                    && sceneY >= minY - tolerance
                    && sceneY <= maxY + tolerance;
        }
    }

    private static final class HitAreaProjector {

        private static List<HitArea> gridHitAreas(
                List<MapCanvasPolygonPrimitive> actors,
                List<GlyphPrimitive> glyphs,
                List<TextPrimitive> texts,
                List<BoundaryPrimitive> boundaries,
                List<MapCanvasPolygonPrimitive> surfaces,
                @Nullable DungeonMapRenderState displayModel
        ) {
            List<HitArea> hitAreas = new ArrayList<>();
            addPolygonHits(hitAreas, actors, MapCanvasPolygonPrimitive::hitRef,
                    MapCanvasPolygonPrimitive::polygon);
            addPolygonHits(hitAreas, glyphs, GlyphPrimitive::hitRef,
                    GlyphPrimitive::polygon);
            addTextHits(hitAreas, texts);
            addPolylineHits(hitAreas, boundaries, BoundaryPrimitive::hitRef,
                    BoundaryPrimitive::polyline);
            addDoorHandleHits(hitAreas, displayModel);
            addPolygonHits(hitAreas, surfaces, MapCanvasPolygonPrimitive::hitRef,
                    MapCanvasPolygonPrimitive::polygon);
            return List.copyOf(hitAreas);
        }

        private static List<HitArea> graphHitAreas(
                List<TextPrimitive> texts,
                List<RelationPrimitive> relations,
                List<MapCanvasPolygonPrimitive> surfaces
        ) {
            List<HitArea> hitAreas = new ArrayList<>();
            addTextHits(hitAreas, texts);
            addPolylineHits(hitAreas, relations, RelationPrimitive::hitRef, RelationPrimitive::polyline);
            addPolygonHits(hitAreas, surfaces, MapCanvasPolygonPrimitive::hitRef,
                    MapCanvasPolygonPrimitive::polygon);
            return List.copyOf(hitAreas);
        }

        private static <T> void addPolygonHits(
                List<HitArea> target,
                List<T> source,
                Function<T, String> hitRefReader,
                Function<T, List<MapCanvasPoint>> polygonReader
        ) {
            for (T item : source) {
                String hitRef = hitRefReader.apply(item);
                List<MapCanvasPoint> polygon = polygonReader.apply(item);
                if (hitRef.isBlank() || polygon.isEmpty()) {
                    continue;
                }
                target.add(new PolygonHitArea(
                        hitRef,
                        polygon));
            }
        }

        private static <T> void addPolylineHits(
                List<HitArea> target,
                List<T> source,
                Function<T, String> hitRefReader,
                Function<T, List<MapCanvasPoint>> polylineReader
        ) {
            for (T item : source) {
                String hitRef = hitRefReader.apply(item);
                List<MapCanvasPoint> polyline = polylineReader.apply(item);
                if (hitRef.isBlank() || polyline.isEmpty()) {
                    continue;
                }
                target.add(new PolylineHitArea(
                        hitRef,
                        polyline));
            }
        }

        private static void addTextHits(
                List<HitArea> target,
                List<TextPrimitive> texts
        ) {
            for (TextPrimitive text : texts) {
                if (clusterLabelText(text)) {
                    addTextHit(target, text);
                }
            }
            for (TextPrimitive text : texts) {
                if (!clusterLabelText(text)) {
                    addTextHit(target, text);
                }
            }
        }

        private static void addTextHit(List<HitArea> target, TextPrimitive text) {
            if (text.hitRef().isBlank() || text.text().isBlank()) {
                return;
            }
            target.add(new PolygonHitArea(
                    text.hitRef(),
                    DungeonMapRenderSceneContentPartModel.SceneGeometry.rotatedCenteredRect(
                            text.centerX(),
                            text.centerY(),
                            text.width(),
                            text.height(),
                            text.rotationDegrees())));
        }

        private static boolean clusterLabelText(TextPrimitive text) {
            return text != null && text.hitRef().endsWith(":" + CLUSTER_LABEL_KIND);
        }

        private static void addDoorHandleHits(List<HitArea> target, @Nullable DungeonMapRenderState displayModel) {
            if (displayModel == null) {
                return;
            }
            for (DungeonMapRenderState.Marker marker : displayModel.markers()) {
                if (!DungeonMapRenderSceneContentPartModel.LevelFilter.includeLevel(displayModel, marker.z())
                        || !marker.isDoorMarker()
                        || marker.preview()) {
                    continue;
                }
                String hitRef = DungeonMapRenderSceneContentPartModel.SceneIdentity.markerHitRef(marker);
                if (hitRef.isBlank()) {
                    continue;
                }
                target.add(new PolygonHitArea(
                        hitRef,
                        DungeonMapRenderSceneContentPartModel.SceneGeometry.Marker.doorHandleHitShape(marker)));
            }
        }
    }

    private static double minimumHitTolerance() {
        return 0.22;
    }

    private static double hitTolerancePixels() {
        return 7.0;
    }

    private static double hitBucketSizeScene() {
        return 4.0;
    }

    private static double maximumHitIndexTolerance() {
        return hitTolerancePixels()
                / (DungeonMapViewportContentPartModel.baseGrid()
                * DungeonMapViewportContentPartModel.minimumZoom());
    }

    private static int minimumPolylinePoints() {
        return 2;
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

    private static <T> List<T> copyOf(@Nullable List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
