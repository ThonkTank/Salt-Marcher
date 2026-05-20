package src.view.slotcontent.primitives.mapcanvas;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import javafx.beans.property.ReadOnlyDoubleProperty;
import javafx.beans.property.ReadOnlyDoubleWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasViewInputEvent.CanvasHit;

public final class MapCanvasContentModel {

    private static final double BASE_GRID = 32.0;
    private static final double DEFAULT_ZOOM = 1.0;
    private static final double MIN_ZOOM = 0.1;
    private static final double MAX_ZOOM = 4.0;
    private static final double ZERO_LENGTH = 0.0;
    private static final double MIN_HIT_TOLERANCE = 0.22;
    private static final double HIT_TOLERANCE_PIXELS = 7.0;
    private static final double HIT_BUCKET_SIZE_SCENE = 4.0;
    private static final double MAX_HIT_INDEX_TOLERANCE = HIT_TOLERANCE_PIXELS / (BASE_GRID * MIN_ZOOM);
    private static final int MIN_POLYLINE_POINTS = 2;

    private final String defaultTitle;
    private final ReadOnlyObjectWrapper<CanvasState> canvasState;
    private final ReadOnlyDoubleWrapper zoom = new ReadOnlyDoubleWrapper(DEFAULT_ZOOM);

    public MapCanvasContentModel(String defaultTitle) {
        this.defaultTitle = RenderScene.normalizeTitle(defaultTitle);
        canvasState = new ReadOnlyObjectWrapper<>(CanvasState.initial(RenderScene.empty(this.defaultTitle)));
    }

    public ReadOnlyObjectProperty<CanvasState> canvasStateProperty() {
        return canvasState.getReadOnlyProperty();
    }

    public ReadOnlyDoubleProperty zoomProperty() {
        return zoom.getReadOnlyProperty();
    }

    public void showRenderScene(@Nullable RenderScene renderScene) {
        CanvasState current = canvasState.get();
        setState(current.withRenderScene(renderScene == null ? RenderScene.empty(defaultTitle) : renderScene));
    }

    public void resetCamera() {
        setState(canvasState.get().withViewport(Viewport.initial()));
    }

    public void panByPixels(double deltaX, double deltaY) {
        setState(canvasState.get().withViewport(canvasState.get().viewport().panByPixels(deltaX, deltaY)));
    }

    public void zoomAround(double canvasX, double canvasY, double factor) {
        setState(canvasState.get().withViewport(canvasState.get().viewport().zoomAround(canvasX, canvasY, factor)));
    }

    public Viewport currentViewport() {
        return canvasState.get().viewport();
    }

    public @Nullable CanvasHit hitAt(double sceneX, double sceneY) {
        return canvasState.get().hitAt(sceneX, sceneY);
    }

    private void setState(CanvasState nextState) {
        canvasState.set(nextState);
        zoom.set(nextState.viewport().zoom());
    }

    public record CanvasState(
            RenderScene renderScene,
            Viewport viewport,
            HitIndex hitIndex
    ) {

        private static CanvasState initial(RenderScene renderScene) {
            return new CanvasState(renderScene, Viewport.initial(), HitIndex.from(renderScene.hitAreas()));
        }

        private CanvasState withRenderScene(RenderScene nextRenderScene) {
            return new CanvasState(nextRenderScene, viewport, HitIndex.from(nextRenderScene.hitAreas()));
        }

        private CanvasState withViewport(Viewport nextViewport) {
            return new CanvasState(renderScene, nextViewport, hitIndex);
        }

        private @Nullable CanvasHit hitAt(double sceneX, double sceneY) {
            return hitIndex.hitAt(sceneX, sceneY, viewport.gridSize());
        }
    }

    public record KeyboardTarget(
            boolean visible,
            double sceneX,
            double sceneY,
            @Nullable CanvasHit hit,
            String accessibleText,
            String accessibleHelp,
            String accessibleValue
    ) {

        private static final KeyboardTarget HIDDEN = new KeyboardTarget(
                false,
                0.0,
                0.0,
                null,
                "Dungeon map",
                "Arrow keys move the map focus. Enter or Space activates the current target.",
                "No keyboard target.");

        public static KeyboardTarget hidden() {
            return HIDDEN;
        }

        static KeyboardTarget visible(KeyboardTarget current, double sceneX, double sceneY, @Nullable CanvasHit hit) {
            String value = current.visible()
                    && sameRoundedPosition(current, sceneX, sceneY)
                    && sameHit(current.hit(), hit)
                    ? current.accessibleValue()
                    : targetValue(sceneX, sceneY, hit);
            return new KeyboardTarget(
                    true,
                    sceneX,
                    sceneY,
                    hit,
                    "Dungeon map keyboard target",
                    "Arrow keys move the map focus. Enter or Space activates the current target.",
                    value);
        }

        private static String targetValue(double sceneX, double sceneY, @Nullable CanvasHit hit) {
            String location = "Scene " + roundedTenths(sceneX) + ", " + roundedTenths(sceneY);
            if (hit == null || hit.hitRef().isBlank()) {
                return location + "; no target.";
            }
            return location + "; " + hit.primitive().name().toLowerCase(Locale.ROOT)
                    + " " + hit.hitRef() + ".";
        }

        private static boolean sameRoundedPosition(KeyboardTarget current, double sceneX, double sceneY) {
            return roundedTenthsValue(current.sceneX()) == roundedTenthsValue(sceneX)
                    && roundedTenthsValue(current.sceneY()) == roundedTenthsValue(sceneY);
        }

        private static boolean sameHit(@Nullable CanvasHit before, @Nullable CanvasHit after) {
            if (before == after) {
                return true;
            }
            if (before == null || after == null) {
                return false;
            }
            return before.primitive() == after.primitive()
                    && Objects.equals(before.hitRef(), after.hitRef())
                    && Objects.equals(before.selectionRef(), after.selectionRef());
        }

        private static String roundedTenths(double value) {
            long rounded = roundedTenthsValue(value);
            String sign = rounded < 0 ? "-" : "";
            long absolute = Math.abs(rounded);
            return sign + absolute / 10L + "." + absolute % 10L;
        }

        private static long roundedTenthsValue(double value) {
            return Math.round(value * 10.0);
        }
    }

    public record Viewport(
            double panX,
            double panY,
            double zoom
    ) {

        private static Viewport initial() {
            return new Viewport(0.0, 0.0, DEFAULT_ZOOM);
        }

        public Viewport {
            zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
        }

        private Viewport panByPixels(double deltaX, double deltaY) {
            return new Viewport(panX + deltaX, panY + deltaY, zoom);
        }

        private Viewport zoomAround(double canvasX, double canvasY, double factor) {
            double nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
            double scale = nextZoom / zoom;
            return new Viewport(
                    canvasX - (canvasX - panX) * scale,
                    canvasY - (canvasY - panY) * scale,
                    nextZoom);
        }

        public double gridSize() {
            return BASE_GRID * zoom;
        }

        public double sceneToScreenX(double sceneX) {
            return panX + sceneX * gridSize();
        }

        public double sceneToScreenY(double sceneY) {
            return panY + sceneY * gridSize();
        }

        public double screenToSceneX(double screenX) {
            return (screenX - panX) / gridSize();
        }

        public double screenToSceneY(double screenY) {
            return (screenY - panY) / gridSize();
        }

        public double normalizedOffset(double spacing, boolean horizontal) {
            double pan = horizontal ? panX : panY;
            double offset = pan % spacing;
            return offset < 0.0 ? offset + spacing : offset;
        }
    }

    public enum ViewMode {
        GRID,
        GRAPH;

        public static ViewMode graph() {
            return GRAPH;
        }

        public static ViewMode grid() {
            return GRID;
        }
    }

    public record SceneColor(
            double red,
            double green,
            double blue,
            double opacity
    ) {

        public SceneColor {
            red = clamp(red);
            green = clamp(green);
            blue = clamp(blue);
            opacity = clamp(opacity);
        }

        public static SceneColor color(int red, int green, int blue, double opacity) {
            return new SceneColor(red / 255.0, green / 255.0, blue / 255.0, opacity);
        }

        public static SceneColor blend(SceneColor base, SceneColor tint, double weight) {
            double clampedWeight = Math.max(0.0, Math.min(1.0, weight));
            double inverseWeight = 1.0 - clampedWeight;
            return new SceneColor(
                    base.red() * inverseWeight + tint.red() * clampedWeight,
                    base.green() * inverseWeight + tint.green() * clampedWeight,
                    base.blue() * inverseWeight + tint.blue() * clampedWeight,
                    base.opacity() * inverseWeight + tint.opacity() * clampedWeight);
        }

        private static double clamp(double value) {
            return Math.max(0.0, Math.min(1.0, value));
        }
    }

    public record RenderScene(
            String title,
            String subtitle,
            String modeLabel,
            String statusLabel,
            String summaryLabel,
            boolean sceneLoaded,
            String overlayMessage,
            ViewMode viewMode,
            List<MapCanvasPolygonPrimitive> surfaces,
            List<BoundaryPrimitive> boundaries,
            List<GlyphPrimitive> glyphs,
            List<TextPrimitive> texts,
            List<RelationPrimitive> relations,
            List<MapCanvasPolygonPrimitive> actors,
            List<HitArea> hitAreas,
            List<OverlayPrimitive> overlays
    ) {

        public RenderScene {
            title = normalizeTitle(title);
            subtitle = subtitle == null ? "" : subtitle;
            modeLabel = modeLabel == null ? "" : modeLabel;
            statusLabel = statusLabel == null ? "" : statusLabel;
            summaryLabel = summaryLabel == null ? "" : summaryLabel;
            overlayMessage = overlayMessage == null ? "" : overlayMessage;
            viewMode = viewMode == null ? ViewMode.GRID : viewMode;
            surfaces = copyOf(surfaces);
            boundaries = copyOf(boundaries);
            glyphs = copyOf(glyphs);
            texts = copyOf(texts);
            relations = copyOf(relations);
            actors = copyOf(actors);
            hitAreas = copyOf(hitAreas);
            overlays = copyOf(overlays);
        }

        public static RenderScene empty(String title) {
            return new RenderScene(
                    title,
                    "",
                    "",
                    "",
                    "",
                    false,
                    "No map scene loaded.",
                    ViewMode.GRID,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of());
        }

        public boolean gridView() {
            return viewMode == ViewMode.GRID;
        }

        private static String normalizeTitle(@Nullable String title) {
            return title == null || title.isBlank() ? "Map" : title;
        }

    }

    public record PaintStyle(
            @Nullable SceneColor fill,
            @Nullable SceneColor stroke,
            double strokeWidth,
            double alpha,
            boolean dashed
    ) {

        public PaintStyle {
            strokeWidth = Math.max(0.0, strokeWidth);
            alpha = Math.max(0.0, Math.min(1.0, alpha));
        }
    }

    public record MapCanvasPoint(double x, double y) {
    }

    public record MapCanvasPolygonPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            List<MapCanvasPoint> polygon,
            PaintStyle style
    ) {

        public MapCanvasPolygonPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            polygon = copyOf(polygon);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
        }
    }

    public record BoundaryPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            List<MapCanvasPoint> polyline,
            PaintStyle style
    ) {

        public BoundaryPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            polyline = copyOf(polyline);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
        }
    }

    public record GlyphPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            List<MapCanvasPoint> polygon,
            PaintStyle style,
            String label,
            @Nullable SceneColor labelColor
    ) {

        public GlyphPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            polygon = copyOf(polygon);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
            label = label == null ? "" : label;
            labelColor = labelColor == null ? SceneColor.color(255, 255, 255, 1.0) : labelColor;
        }
    }

    public record TextPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            String text,
            double centerX,
            double centerY,
            double width,
            double height,
            PaintStyle style,
            @Nullable SceneColor textColor
    ) {

        public TextPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            text = text == null ? "" : text;
            width = Math.max(0.0, width);
            height = Math.max(0.0, height);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
            textColor = textColor == null ? SceneColor.color(255, 255, 255, 1.0) : textColor;
        }
    }

    public record RelationPrimitive(
            String hitRef,
            int z,
            List<MapCanvasPoint> polyline,
            PaintStyle style
    ) {

        public RelationPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            polyline = copyOf(polyline);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
        }
    }

    public sealed interface HitArea permits PolygonHitArea, PolylineHitArea {

        String hitRef();

        MapCanvasViewInputEvent.CanvasPrimitive primitive();

        String selectionRef();

        HitBounds bounds();

        boolean matches(double sceneX, double sceneY, double tolerance);
    }

    public record PolygonHitArea(
            String hitRef,
            MapCanvasViewInputEvent.CanvasPrimitive primitive,
            String selectionRef,
            List<MapCanvasPoint> polygon
    ) implements HitArea {

        public PolygonHitArea {
            hitRef = hitRef == null ? "" : hitRef;
            primitive = MapCanvasViewInputEvent.defaultPrimitive(primitive);
            selectionRef = selectionRef == null ? "" : selectionRef;
            polygon = copyOf(polygon);
        }

        @Override
        public HitBounds bounds() {
            return HitBounds.from(polygon);
        }

        @Override
        public boolean matches(double sceneX, double sceneY, double tolerance) {
            return !hitRef.isBlank() && Geometry.pointInPolygon(sceneX, sceneY, polygon);
        }
    }

    public record PolylineHitArea(
            String hitRef,
            MapCanvasViewInputEvent.CanvasPrimitive primitive,
            String selectionRef,
            List<MapCanvasPoint> polyline
    ) implements HitArea {

        public PolylineHitArea {
            hitRef = hitRef == null ? "" : hitRef;
            primitive = MapCanvasViewInputEvent.defaultPrimitive(primitive);
            selectionRef = selectionRef == null ? "" : selectionRef;
            polyline = copyOf(polyline);
        }

        @Override
        public HitBounds bounds() {
            return HitBounds.from(polyline);
        }

        @Override
        public boolean matches(double sceneX, double sceneY, double tolerance) {
            return !hitRef.isBlank()
                    && polyline.size() >= MIN_POLYLINE_POINTS
                    && Geometry.distanceToPolyline(sceneX, sceneY, polyline) <= tolerance;
        }
    }

    private record HitIndex(Map<Long, List<HitCandidate>> buckets) {

        private static HitIndex from(List<HitArea> hitAreas) {
            if (hitAreas.isEmpty()) {
                return new HitIndex(Map.of());
            }
            Map<Long, List<HitCandidate>> nextBuckets = new LinkedHashMap<>();
            for (HitArea hitArea : hitAreas) {
                if (hitArea.hitRef().isBlank()) {
                    continue;
                }
                HitCandidate candidate = HitCandidate.from(hitArea);
                HitBounds bounds = hitArea.bounds().expand(MAX_HIT_INDEX_TOLERANCE);
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

        private @Nullable CanvasHit hitAt(double sceneX, double sceneY, double gridSize) {
            List<HitCandidate> candidates = buckets.get(key(bucket(sceneX), bucket(sceneY)));
            if (candidates == null) {
                return null;
            }
            double tolerance = Math.max(HIT_TOLERANCE_PIXELS / gridSize, MIN_HIT_TOLERANCE);
            for (HitCandidate candidate : candidates) {
                if (candidate.matches(sceneX, sceneY, tolerance)) {
                    return candidate.hit();
                }
            }
            return null;
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
    }

    private record HitCandidate(HitArea area, CanvasHit hit, HitBounds bounds) {

        private static HitCandidate from(HitArea area) {
            return new HitCandidate(
                    area,
                    new CanvasHit(
                            area.hitRef(),
                            area.primitive(),
                            area.selectionRef().isBlank() ? null : area.selectionRef()),
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

        private boolean contains(double sceneX, double sceneY) {
            return sceneX >= minX && sceneX <= maxX && sceneY >= minY && sceneY <= maxY;
        }

        private boolean contains(double sceneX, double sceneY, double tolerance) {
            return sceneX >= minX - tolerance
                    && sceneX <= maxX + tolerance
                    && sceneY >= minY - tolerance
                    && sceneY <= maxY + tolerance;
        }
    }

    public record OverlayPrimitive(
            String label,
            double centerX,
            double centerY,
            double width,
            double height,
            PaintStyle style,
            @Nullable SceneColor textColor
    ) {

        public OverlayPrimitive {
            label = label == null ? "" : label;
            width = Math.max(0.0, width);
            height = Math.max(0.0, height);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
            textColor = textColor == null ? SceneColor.color(255, 255, 255, 1.0) : textColor;
        }
    }

    private static <T> List<T> copyOf(@Nullable List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private enum Geometry {
        ;

        private static boolean pointInPolygon(double x, double y, List<MapCanvasPoint> polygon) {
            boolean inside = false;
            int previous = polygon.size() - 1;
            for (int index = 0; index < polygon.size(); index++) {
                MapCanvasPoint current = polygon.get(index);
                MapCanvasPoint before = polygon.get(previous);
                boolean intersects = (current.y() > y) != (before.y() > y)
                        && x < (before.x() - current.x()) * (y - current.y()) / (before.y() - current.y())
                        + current.x();
                if (intersects) {
                    inside = !inside;
                }
                previous = index;
            }
            return inside;
        }

        private static double distanceToPolyline(
                double x,
                double y,
                List<MapCanvasPoint> polyline
        ) {
            double best = Double.MAX_VALUE;
            for (int index = 1; index < polyline.size(); index++) {
                MapCanvasPoint start = polyline.get(index - 1);
                MapCanvasPoint end = polyline.get(index);
                best = Math.min(best, distanceToSegment(x, y, start.x(), start.y(), end.x(), end.y()));
            }
            return best;
        }

        private static double distanceToSegment(
                double pointX,
                double pointY,
                double startX,
                double startY,
                double endX,
                double endY
        ) {
            double deltaX = endX - startX;
            double deltaY = endY - startY;
            double lengthSquared = deltaX * deltaX + deltaY * deltaY;
            if (lengthSquared <= ZERO_LENGTH) {
                return Math.hypot(pointX - startX, pointY - startY);
            }
            double projection = ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / lengthSquared;
            double clamped = Math.max(0.0, Math.min(1.0, projection));
            double nearestX = startX + clamped * deltaX;
            double nearestY = startY + clamped * deltaY;
            return Math.hypot(pointX - nearestX, pointY - nearestY);
        }
    }
}
