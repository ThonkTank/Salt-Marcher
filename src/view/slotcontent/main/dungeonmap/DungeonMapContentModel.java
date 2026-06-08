package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import javafx.beans.property.ReadOnlyDoubleProperty;
import javafx.beans.property.ReadOnlyDoubleWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.TravelDungeonSnapshot;

public final class DungeonMapContentModel {

    private static final SceneProjector SCENE_PROJECTOR = new SceneProjector();
    private static final String EMPTY_KIND = "EMPTY";
    private static final String EMPTY_LABEL_KIND = EMPTY_KIND;
    private static final String ROOM_LABEL_KIND = "ROOM_LABEL";
    private static final String CLUSTER_LABEL_KIND = "CLUSTER_LABEL";
    private static final String FEATURE_LABEL_KIND = "FEATURE_LABEL";

    private final String placeholderTitle;
    private final ReadOnlyObjectWrapper<CanvasState> canvasState;
    private final ReadOnlyDoubleWrapper zoom = new ReadOnlyDoubleWrapper(defaultZoom());
    private DungeonMapRenderState renderState;
    private Map<String, PointerTarget> pointerTargets = Map.of();

    // Public ContentModel API

    public DungeonMapContentModel(String placeholderTitle, boolean editorMode) {
        this.placeholderTitle = normalizePlaceholderTitle(placeholderTitle);
        canvasState = new ReadOnlyObjectWrapper<>(CanvasState.initial(RenderScene.empty(this.placeholderTitle)));
        renderState = DungeonMapRenderState.empty(this.placeholderTitle, editorMode);
        showRenderScene(SCENE_PROJECTOR.toScene(renderState));
    }

    public ReadOnlyObjectProperty<CanvasState> canvasStateProperty() {
        return canvasState.getReadOnlyProperty();
    }

    public ReadOnlyDoubleProperty zoomProperty() {
        return zoom.getReadOnlyProperty();
    }

    CanvasState currentCanvasState() {
        return canvasState.get();
    }

    public Viewport currentViewport() {
        return canvasState.get().viewport();
    }

    public double currentZoom() {
        return currentViewport().zoom();
    }

    private static double minimumHitTolerance() {
        return 0.22;
    }

    private static double baseGrid() {
        return 32.0;
    }

    private static double defaultZoom() {
        return 1.0;
    }

    private static double minimumZoom() {
        return 0.1;
    }

    private static double maximumZoom() {
        return 4.0;
    }

    private static double hitTolerancePixels() {
        return 7.0;
    }

    private static double hitBucketSizeScene() {
        return 4.0;
    }

    private static double maximumHitIndexTolerance() {
        return hitTolerancePixels() / (baseGrid() * minimumZoom());
    }

    private static int minimumPolylinePoints() {
        return 2;
    }

    private static String defaultTitle() {
        return "Dungeon Map";
    }

    public void resetCamera() {
        setCanvasState(canvasState.get().withViewport(Viewport.initial()));
    }

    public void panByPixels(double deltaX, double deltaY) {
        setCanvasState(canvasState.get().withViewport(canvasState.get().viewport().panByPixels(deltaX, deltaY)));
    }

    public void zoomAround(double canvasX, double canvasY, double factor) {
        setCanvasState(canvasState.get().withViewport(canvasState.get().viewport().zoomAround(canvasX, canvasY, factor)));
    }

    public PointerTarget resolvePointerTarget(double sceneX, double sceneY) {
        CanvasHit hit = hitAt(sceneX, sceneY);
        if (hit == null || hit.hitRef().isBlank()) {
            return PointerTarget.empty();
        }
        return pointerTargets.getOrDefault(hit.hitRef(), PointerTarget.empty());
    }

    public void applyEditorSurfaceSnapshot(DungeonEditorMapSurfaceSnapshot editorSnapshot) {
        showRenderState(DungeonMapSnapshotMapper.mapEditorSurface(placeholderTitle, editorSnapshot));
    }

    public void applyTravelSnapshot(TravelDungeonSnapshot travelSnapshot) {
        showRenderState(DungeonMapSnapshotMapper.mapTravel(placeholderTitle, travelSnapshot));
    }

    private void showRenderState(DungeonMapRenderState nextRenderState) {
        renderState = nextRenderState == null ? renderState : nextRenderState;
        pointerTargets = PointerTargetIndex.from(renderState);
        showRenderScene(SCENE_PROJECTOR.toScene(renderState));
    }

    private void showRenderScene(RenderScene renderScene) {
        setCanvasState(canvasState.get().withRenderScene(renderScene == null ? RenderScene.empty(placeholderTitle) : renderScene));
    }

    private @Nullable CanvasHit hitAt(double sceneX, double sceneY) {
        return canvasState.get().hitAt(sceneX, sceneY);
    }

    private void setCanvasState(CanvasState nextState) {
        canvasState.set(nextState);
        zoom.set(nextState.viewport().zoom());
    }

    private static String normalizePlaceholderTitle(String placeholderTitle) {
        return placeholderTitle == null || placeholderTitle.isBlank()
                ? defaultTitle()
                : placeholderTitle;
    }

    public record CanvasState(
            RenderScene renderScene,
            Viewport viewport,
            HitIndex hitIndex
    ) {

        private static CanvasState initial(RenderScene renderScene) {
            return new CanvasState(
                    renderScene,
                    Viewport.initial(),
                    HitIndex.from(indexableHitAreas(renderScene)));
        }

        private CanvasState withRenderScene(RenderScene nextRenderScene) {
            return new CanvasState(
                    nextRenderScene,
                    viewport,
                    HitIndex.from(indexableHitAreas(nextRenderScene)));
        }

        private CanvasState withViewport(Viewport nextViewport) {
            return new CanvasState(renderScene, nextViewport, hitIndex);
        }

        private @Nullable CanvasHit hitAt(double sceneX, double sceneY) {
            return hitIndex.hitAt(sceneX, sceneY, viewport.gridSize());
        }

        private static List<HitArea> indexableHitAreas(RenderScene renderScene) {
            return renderScene.containsRenderablePrimitives() && renderScene.containsHitAreas()
                    ? renderScene.hitAreas()
                    : List.of();
        }
    }

    public record Viewport(
            double panX,
            double panY,
            double zoom
    ) {

        private static Viewport initial() {
            return new Viewport(0.0, 0.0, defaultZoom());
        }

        public Viewport {
            zoom = Math.max(minimumZoom(), Math.min(maximumZoom(), zoom));
        }

        private Viewport panByPixels(double deltaX, double deltaY) {
            return new Viewport(panX + deltaX, panY + deltaY, zoom);
        }

        private Viewport zoomAround(double canvasX, double canvasY, double factor) {
            double nextZoom = Math.max(minimumZoom(), Math.min(maximumZoom(), zoom * factor));
            double scale = nextZoom / zoom;
            return new Viewport(
                    canvasX - (canvasX - panX) * scale,
                    canvasY - (canvasY - panY) * scale,
                    nextZoom);
        }

        public double gridSize() {
            return baseGrid() * zoom;
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

    private static String normalizeTitle(String title) {
        return title == null || title.isBlank() ? defaultTitle() : title.trim();
    }

    private static <T> List<T> copyOf(@Nullable List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    public record RenderColor(
            int red,
            int green,
            int blue,
            int alpha
    ) {

        public RenderColor {
            red = clampChannel(red);
            green = clampChannel(green);
            blue = clampChannel(blue);
            alpha = clampChannel(alpha);
        }

        public static RenderColor color(int red, int green, int blue, double opacity) {
            return new RenderColor(red, green, blue, toChannel(opacity));
        }

        public static RenderColor blend(RenderColor base, RenderColor tint, double weight) {
            double clampedWeight = Math.max(0.0, Math.min(1.0, weight));
            double inverseWeight = 1.0 - clampedWeight;
            return new RenderColor(
                    blendChannel(base.red(), tint.red(), inverseWeight, clampedWeight),
                    blendChannel(base.green(), tint.green(), inverseWeight, clampedWeight),
                    blendChannel(base.blue(), tint.blue(), inverseWeight, clampedWeight),
                    blendChannel(base.alpha(), tint.alpha(), inverseWeight, clampedWeight));
        }

        public double redUnit() {
            return red / (double) maximumChannel();
        }

        public double greenUnit() {
            return green / (double) maximumChannel();
        }

        public double blueUnit() {
            return blue / (double) maximumChannel();
        }

        public double alphaUnit() {
            return alpha / (double) maximumChannel();
        }

        private static int blendChannel(int base, int tint, double inverseWeight, double weight) {
            return clampChannel((int) Math.round(base * inverseWeight + tint * weight));
        }

        private static int toChannel(double value) {
            return clampChannel((int) Math.round(clampUnit(value) * maximumChannel()));
        }

        private static int clampChannel(int value) {
            return Math.max(0, Math.min(maximumChannel(), value));
        }

        private static double clampUnit(double value) {
            return Math.max(0.0, Math.min(1.0, value));
        }

        private static int maximumChannel() {
            return 255;
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
            boolean gridView,
            List<MapCanvasPolygonPrimitive> surfaces,
            List<BoundaryPrimitive> boundaries,
            List<GlyphPrimitive> glyphs,
            List<TextPrimitive> texts,
            List<RelationPrimitive> relations,
            List<MapCanvasPolygonPrimitive> actors,
            List<HitArea> hitAreas
    ) {

        public RenderScene {
            title = normalizeTitle(title);
            subtitle = subtitle == null ? "" : subtitle;
            modeLabel = modeLabel == null ? "" : modeLabel;
            statusLabel = statusLabel == null ? "" : statusLabel;
            summaryLabel = summaryLabel == null ? "" : summaryLabel;
            overlayMessage = overlayMessage == null ? "" : overlayMessage;
            surfaces = copyOf(surfaces);
            boundaries = copyOf(boundaries);
            glyphs = copyOf(glyphs);
            texts = copyOf(texts);
            relations = copyOf(relations);
            actors = copyOf(actors);
            hitAreas = copyOf(hitAreas);
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
                    true,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of());
        }

        public boolean gridView() {
            return gridView;
        }

        public boolean containsHitAreas() {
            return !hitAreas.isEmpty();
        }

        public boolean containsRenderablePrimitives() {
            return containsSurfacePrimitives()
                    || containsAnnotationPrimitives();
        }

        public boolean containsSurfacePrimitives() {
            return !surfaces.isEmpty()
                    || !boundaries.isEmpty()
                    || !glyphs.isEmpty()
                    || !actors.isEmpty();
        }

        public boolean containsAnnotationPrimitives() {
            return !texts.isEmpty() || !relations.isEmpty();
        }

        @Override
        public List<MapCanvasPolygonPrimitive> surfaces() {
            return copyOf(surfaces);
        }

        @Override
        public List<BoundaryPrimitive> boundaries() {
            return copyOf(boundaries);
        }

        @Override
        public List<GlyphPrimitive> glyphs() {
            return copyOf(glyphs);
        }

        @Override
        public List<TextPrimitive> texts() {
            return copyOf(texts);
        }

        @Override
        public List<RelationPrimitive> relations() {
            return copyOf(relations);
        }

        @Override
        public List<MapCanvasPolygonPrimitive> actors() {
            return copyOf(actors);
        }

        @Override
        public List<HitArea> hitAreas() {
            return copyOf(hitAreas);
        }

    }

    public record PaintStyle(
            @Nullable RenderColor fill,
            @Nullable RenderColor stroke,
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

        @Override
        public List<MapCanvasPoint> polygon() {
            return copyOf(polygon);
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

        @Override
        public List<MapCanvasPoint> polyline() {
            return copyOf(polyline);
        }
    }

    public record GlyphPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            List<MapCanvasPoint> polygon,
            PaintStyle style,
            String label,
            @Nullable RenderColor labelColor
    ) {

        public GlyphPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            polygon = copyOf(polygon);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
            label = label == null ? "" : label;
            labelColor = labelColor == null ? RenderColor.color(255, 255, 255, 1.0) : labelColor;
        }

        @Override
        public List<MapCanvasPoint> polygon() {
            return copyOf(polygon);
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
            @Nullable RenderColor textColor
    ) {

        public TextPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            text = text == null ? "" : text;
            width = Math.max(0.0, width);
            height = Math.max(0.0, height);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
            textColor = textColor == null ? RenderColor.color(255, 255, 255, 1.0) : textColor;
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

        @Override
        public List<MapCanvasPoint> polyline() {
            return copyOf(polyline);
        }
    }

    public enum CanvasPrimitive {
        EMPTY,
        SURFACE,
        BOUNDARY,
        GLYPH,
        TEXT,
        RELATION,
        ACTOR,
        OVERLAY
    }

    public record CanvasHit(
            String hitRef,
            CanvasPrimitive primitive,
            @Nullable String selectionRef
    ) {

        public CanvasHit {
            hitRef = hitRef == null ? "" : hitRef;
            primitive = primitive == null ? CanvasPrimitive.EMPTY : primitive;
        }
    }

    public sealed interface HitArea permits PolygonHitArea, PolylineHitArea {

        String hitRef();

        CanvasPrimitive primitive();

        String selectionRef();

        HitBounds bounds();

        boolean matches(double sceneX, double sceneY, double tolerance);
    }

    public static final class PolygonHitArea implements HitArea {
        private final String hitRef;
        private final CanvasPrimitive primitive;
        private final String selectionRef;
        private final List<MapCanvasPoint> polygon;

        public PolygonHitArea(
                String hitRef,
                CanvasPrimitive primitive,
                String selectionRef,
                List<MapCanvasPoint> polygon
        ) {
            this.hitRef = hitRef == null ? "" : hitRef;
            this.primitive = primitive == null ? CanvasPrimitive.EMPTY : primitive;
            this.selectionRef = selectionRef == null ? "" : selectionRef;
            this.polygon = copyOf(polygon);
        }

        @Override
        public String hitRef() {
            return hitRef;
        }

        @Override
        public CanvasPrimitive primitive() {
            return primitive;
        }

        @Override
        public String selectionRef() {
            return selectionRef;
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

    public static final class PolylineHitArea implements HitArea {
        private final String hitRef;
        private final CanvasPrimitive primitive;
        private final String selectionRef;
        private final List<MapCanvasPoint> polyline;

        public PolylineHitArea(
                String hitRef,
                CanvasPrimitive primitive,
                String selectionRef,
                List<MapCanvasPoint> polyline
        ) {
            this.hitRef = hitRef == null ? "" : hitRef;
            this.primitive = primitive == null ? CanvasPrimitive.EMPTY : primitive;
            this.selectionRef = selectionRef == null ? "" : selectionRef;
            this.polyline = copyOf(polyline);
        }

        @Override
        public String hitRef() {
            return hitRef;
        }

        @Override
        public CanvasPrimitive primitive() {
            return primitive;
        }

        @Override
        public String selectionRef() {
            return selectionRef;
        }

        @Override
        public HitBounds bounds() {
            return HitBounds.from(polyline);
        }

        @Override
        public boolean matches(double sceneX, double sceneY, double tolerance) {
            return !hitRef.isBlank()
                    && polyline.size() >= minimumPolylinePoints()
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

        private @Nullable CanvasHit hitAt(double sceneX, double sceneY, double gridSize) {
            List<HitCandidate> candidates = buckets.get(key(bucket(sceneX), bucket(sceneY)));
            if (candidates == null) {
                return null;
            }
            double tolerance = Math.max(hitTolerancePixels() / gridSize, minimumHitTolerance());
            for (HitCandidate candidate : candidates) {
                if (candidate.matches(sceneX, sceneY, tolerance)) {
                    return candidate.hit();
                }
            }
            return null;
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

    public record HitBounds(double minX, double minY, double maxX, double maxY) {

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

    private static final class Geometry {

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

    // Scene assembly

    private record SceneBuckets(
            List<MapCanvasPolygonPrimitive> surfaces,
            List<BoundaryPrimitive> boundaries,
            List<GlyphPrimitive> glyphs,
            List<TextPrimitive> texts,
            List<RelationPrimitive> relations,
            List<MapCanvasPolygonPrimitive> actors,
            List<HitArea> hitAreas
    ) {
    }

    private static final class SceneProjector {

        private final GridSceneAssembler gridSceneAssembler = new GridSceneAssembler();
        private final GraphSceneAssembler graphSceneAssembler = new GraphSceneAssembler();

        private RenderScene toScene(DungeonMapRenderState displayModel) {
            if (displayModel == null) {
                return RenderScene.empty(defaultTitle());
            }
            SceneBuckets buckets = displayModel.isGraphView()
                    ? graphSceneAssembler.assemble(displayModel)
                    : gridSceneAssembler.assemble(displayModel);
            return new RenderScene(
                    displayModel.title(),
                    displayModel.subtitle(),
                    displayModel.modeLabel(),
                    displayModel.statusLabel(),
                    displayModel.summaryLabel(),
                    displayModel.mapLoaded(),
                    displayModel.overlayMessage(),
                    !displayModel.isGraphView(),
                    buckets.surfaces(),
                    buckets.boundaries(),
                    buckets.glyphs(),
                    buckets.texts(),
                    buckets.relations(),
                    buckets.actors(),
                    buckets.hitAreas());
        }
    }

    private static final class GridSceneAssembler {

        private SceneBuckets assemble(DungeonMapRenderState displayModel) {
            List<MapCanvasPolygonPrimitive> surfaces = new ArrayList<>();
            List<BoundaryPrimitive> boundaries = new ArrayList<>();
            List<GlyphPrimitive> glyphs = new ArrayList<>();
            List<TextPrimitive> texts = new ArrayList<>();
            List<MapCanvasPolygonPrimitive> actors = new ArrayList<>();
            addCells(displayModel, surfaces);
            addEdges(displayModel, boundaries);
            addMarkers(displayModel, glyphs);
            addLabels(displayModel, texts);
            addPartyToken(displayModel, actors);
            return new SceneBuckets(
                    surfaces,
                    boundaries,
                    glyphs,
                    texts,
                    List.of(),
                    actors,
                    HitAreaProjector.gridHitAreas(actors, glyphs, texts, boundaries, surfaces));
        }

        private void addCells(
                DungeonMapRenderState displayModel,
                List<MapCanvasPolygonPrimitive> surfaces
        ) {
            for (DungeonMapRenderState.Cell cell : displayModel.cells()) {
                if (!LevelFilter.includeLevel(displayModel, cell.z())) {
                    continue;
                }
                surfaces.add(new MapCanvasPolygonPrimitive(
                        SceneIdentity.cellHitRef(cell),
                        SceneIdentity.selectionRef(cell.topologyRef()),
                        cell.z(),
                        SceneGeometry.square(cell.q(), cell.r(), 1.0),
                        SurfaceStyler.style(cell, displayModel)));
            }
        }

        private void addEdges(
                DungeonMapRenderState displayModel,
                List<BoundaryPrimitive> boundaries
        ) {
            for (DungeonMapRenderState.Edge edge : displayModel.edges()) {
                if (!LevelFilter.includeLevel(displayModel, edge.z())) {
                    continue;
                }
                boundaries.add(new BoundaryPrimitive(
                        SceneIdentity.edgeHitRef(edge),
                        SceneIdentity.selectionRef(edge.topologyRef()),
                        edge.z(),
                        List.of(
                                new MapCanvasPoint(edge.startQ(), edge.startR()),
                                new MapCanvasPoint(edge.endQ(), edge.endR())),
                        EdgeStyler.style(edge, displayModel)));
            }
        }

        private void addMarkers(
                DungeonMapRenderState displayModel,
                List<GlyphPrimitive> glyphs
        ) {
            for (DungeonMapRenderState.Marker marker : displayModel.markers()) {
                if (!LevelFilter.includeLevel(displayModel, marker.z())) {
                    continue;
                }
                String hitRef = SceneIdentity.markerHitRef(marker);
                glyphs.add(new GlyphPrimitive(
                        hitRef,
                        SceneIdentity.selectionRef(marker.handle().topologyRef()),
                        marker.z(),
                        SceneGeometry.Marker.markerShape(marker),
                        MarkerStyler.style(marker, displayModel),
                        SceneGeometry.Label.abbreviateLabel(marker.label(), marker.isDoorMarker() ? 1 : 3),
                        ScenePalette.LABEL_TEXT));
            }
        }

        private void addLabels(
                DungeonMapRenderState displayModel,
                List<TextPrimitive> texts
        ) {
            for (DungeonMapRenderState.Label label : displayModel.labels()) {
                if (!LevelFilter.includeLevel(displayModel, label.z())) {
                    continue;
                }
                texts.add(new TextPrimitive(
                        SceneIdentity.labelHitRef(label),
                        SceneIdentity.selectionRef(label.topologyRef()),
                        label.z(),
                        label.label(),
                        label.q(),
                        label.r(),
                        SceneGeometry.Label.labelWidthScene(label.label()),
                        SceneGeometry.Label.labelHeightScene(),
                        LabelStyler.style(label, displayModel),
                        ScenePalette.LABEL_TEXT));
            }
        }

        private void addPartyToken(
                DungeonMapRenderState displayModel,
                List<MapCanvasPolygonPrimitive> actors
        ) {
            DungeonMapRenderState.PartyToken token = displayModel.partyToken();
            if (token == null || !token.visible() || !LevelFilter.includeLevel(displayModel, token.z())) {
                return;
            }
            actors.add(new MapCanvasPolygonPrimitive(
                    "",
                    null,
                    token.z(),
                    SceneGeometry.Marker.partyTokenShape(token),
                    new PaintStyle(
                            ScenePalette.PARTY_FILL,
                            ScenePalette.PARTY_STROKE,
                            1.8 / 32.0,
                            1.0,
                            false)));
        }
    }

    private static final class GraphSceneAssembler {

        private SceneBuckets assemble(DungeonMapRenderState displayModel) {
            List<MapCanvasPolygonPrimitive> surfaces = new ArrayList<>();
            List<TextPrimitive> texts = new ArrayList<>();
            List<RelationPrimitive> relations = new ArrayList<>();
            Map<Long, DungeonMapRenderState.GraphNode> nodesById = indexNodes(displayModel.graphNodes());
            addLinks(displayModel, relations, nodesById);
            addNodes(displayModel, surfaces, texts);
            return new SceneBuckets(
                    surfaces,
                    List.of(),
                    List.of(),
                    texts,
                    relations,
                    List.of(),
                    HitAreaProjector.graphHitAreas(texts, relations, surfaces));
        }

        private Map<Long, DungeonMapRenderState.GraphNode> indexNodes(List<DungeonMapRenderState.GraphNode> graphNodes) {
            Map<Long, DungeonMapRenderState.GraphNode> nodesById = new LinkedHashMap<>();
            for (DungeonMapRenderState.GraphNode node : graphNodes) {
                nodesById.put(node.id(), node);
            }
            return nodesById;
        }

        private void addLinks(
                DungeonMapRenderState displayModel,
                List<RelationPrimitive> relations,
                Map<Long, DungeonMapRenderState.GraphNode> nodesById
        ) {
            for (DungeonMapRenderState.GraphLink link : displayModel.graphLinks()) {
                DungeonMapRenderState.GraphNode from = nodesById.get(link.fromId());
                DungeonMapRenderState.GraphNode to = nodesById.get(link.toId());
                if (from == null || to == null) {
                    continue;
                }
                relations.add(new RelationPrimitive(
                        "",
                        displayModel.projectionLevel(),
                        List.of(
                                new MapCanvasPoint(from.q(), from.r()),
                                new MapCanvasPoint(to.q(), to.r())),
                        new PaintStyle(
                                null,
                                link.selected() ? ScenePalette.HIGHLIGHT_STROKE : ScenePalette.GRAPH_LINK,
                                link.selected() ? 2.4 / 32.0 : 1.7 / 32.0,
                                1.0,
                                false)));
            }
        }

        private void addNodes(
                DungeonMapRenderState displayModel,
                List<MapCanvasPolygonPrimitive> surfaces,
                List<TextPrimitive> texts
        ) {
            for (DungeonMapRenderState.GraphNode node : displayModel.graphNodes()) {
                surfaces.add(new MapCanvasPolygonPrimitive(
                        SceneIdentity.graphNodeHitRef(node),
                        "ROOM:" + node.id(),
                        displayModel.projectionLevel(),
                        SceneGeometry.roundedRect(node.q(), node.r(), 1.8, 1.1),
                        new PaintStyle(
                                ScenePalette.GRAPH_NODE_FILL,
                                node.selected() ? ScenePalette.HIGHLIGHT_STROKE : ScenePalette.ROOM_CELL_STROKE,
                                node.selected() ? 2.4 / 32.0 : 1.2 / 32.0,
                                1.0,
                                false)));
                texts.add(new TextPrimitive(
                        SceneIdentity.graphNodeHitRef(node),
                        "ROOM:" + node.id(),
                        displayModel.projectionLevel(),
                        node.label(),
                        node.q(),
                        node.r(),
                        Math.max(1.8, SceneGeometry.Label.labelWidthScene(node.label())),
                        SceneGeometry.Label.labelHeightScene(),
                        new PaintStyle(null, null, 0.0, 1.0, false),
                        ScenePalette.LABEL_TEXT));
            }
        }
    }

    // Hit, geometry, and style helpers

    private static final class HitAreaProjector {

        private static List<HitArea> gridHitAreas(
                List<MapCanvasPolygonPrimitive> actors,
                List<GlyphPrimitive> glyphs,
                List<TextPrimitive> texts,
                List<BoundaryPrimitive> boundaries,
                List<MapCanvasPolygonPrimitive> surfaces
        ) {
            List<HitArea> hitAreas = new ArrayList<>();
            addPolygonHits(hitAreas, actors, MapCanvasPolygonPrimitive::hitRef, MapCanvasPolygonPrimitive::selectionRef,
                    MapCanvasPolygonPrimitive::polygon, CanvasPrimitive.ACTOR);
            addPolygonHits(hitAreas, glyphs, GlyphPrimitive::hitRef, GlyphPrimitive::selectionRef,
                    GlyphPrimitive::polygon, CanvasPrimitive.GLYPH);
            addTextHits(hitAreas, texts);
            addPolylineHits(hitAreas, boundaries, BoundaryPrimitive::hitRef,
                    BoundaryPrimitive::selectionRef, BoundaryPrimitive::polyline,
                    CanvasPrimitive.BOUNDARY);
            addPolygonHits(hitAreas, surfaces, MapCanvasPolygonPrimitive::hitRef, MapCanvasPolygonPrimitive::selectionRef,
                    MapCanvasPolygonPrimitive::polygon, CanvasPrimitive.SURFACE);
            return List.copyOf(hitAreas);
        }

        private static List<HitArea> graphHitAreas(
                List<TextPrimitive> texts,
                List<RelationPrimitive> relations,
                List<MapCanvasPolygonPrimitive> surfaces
        ) {
            List<HitArea> hitAreas = new ArrayList<>();
            addTextHits(hitAreas, texts);
            addPolylineHits(hitAreas, relations, RelationPrimitive::hitRef, ignored -> "",
                    RelationPrimitive::polyline, CanvasPrimitive.RELATION);
            addPolygonHits(hitAreas, surfaces, MapCanvasPolygonPrimitive::hitRef, MapCanvasPolygonPrimitive::selectionRef,
                    MapCanvasPolygonPrimitive::polygon, CanvasPrimitive.SURFACE);
            return List.copyOf(hitAreas);
        }

        private static <T> void addPolygonHits(
                List<HitArea> target,
                List<T> source,
                Function<T, String> hitRefReader,
                Function<T, String> selectionRefReader,
                Function<T, List<MapCanvasPoint>> polygonReader,
                CanvasPrimitive primitive
        ) {
            for (T item : source) {
                String hitRef = hitRefReader.apply(item);
                List<MapCanvasPoint> polygon = polygonReader.apply(item);
                if (hitRef.isBlank() || polygon.isEmpty()) {
                    continue;
                }
                target.add(new PolygonHitArea(
                        hitRef,
                        primitive,
                        selectionRefReader.apply(item),
                        polygon));
            }
        }

        private static <T> void addPolylineHits(
                List<HitArea> target,
                List<T> source,
                Function<T, String> hitRefReader,
                Function<T, String> selectionRefReader,
                Function<T, List<MapCanvasPoint>> polylineReader,
                CanvasPrimitive primitive
        ) {
            for (T item : source) {
                String hitRef = hitRefReader.apply(item);
                List<MapCanvasPoint> polyline = polylineReader.apply(item);
                if (hitRef.isBlank() || polyline.isEmpty()) {
                    continue;
                }
                target.add(new PolylineHitArea(
                        hitRef,
                        primitive,
                        selectionRefReader.apply(item),
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
                    CanvasPrimitive.TEXT,
                    text.selectionRef(),
                    SceneGeometry.centeredRect(text.centerX(), text.centerY(), text.width(), text.height())));
        }

        private static boolean clusterLabelText(TextPrimitive text) {
            return text != null && text.hitRef().endsWith(":" + CLUSTER_LABEL_KIND);
        }
    }

    private static final class LevelFilter {

        private static boolean includeLevel(DungeonMapRenderState displayModel, int level) {
            if (level == displayModel.projectionLevel()) {
                return true;
            }
            DungeonMapRenderState.LevelOverlaySettings settings = displayModel.overlaySettings();
            return switch (settings.mode()) {
                case OFF -> false;
                case NEARBY -> Math.abs(level - displayModel.projectionLevel()) <= settings.levelRange();
                case SELECTED -> settings.selectsLevel(level);
            };
        }
    }

    private static final class SceneIdentity {

        private static @Nullable String selectionRef(DungeonMapRenderState.TopologyRef topologyRef) {
            if (topologyRef == null || topologyRef.isEmpty()) {
                return null;
            }
            return topologyRef.kind() + ":" + topologyRef.id();
        }

        private static String cellHitRef(DungeonMapRenderState.Cell cell) {
            return "cell:" + cell.kind().name()
                    + ":" + cell.ownerId()
                    + ":" + cell.clusterId()
                    + ":" + cell.topologyRef().kind()
                    + ":" + cell.topologyRef().id();
        }

        private static String edgeHitRef(DungeonMapRenderState.Edge edge) {
            return "edge:" + edge.kind().name()
                    + ":" + edge.ownerId()
                    + ":" + edge.topologyRef().kind()
                    + ":" + edge.topologyRef().id()
                    + ":" + edge.z()
                    + ":" + sceneCoordinate(edge.startQ())
                    + ":" + sceneCoordinate(edge.startR())
                    + ":" + sceneCoordinate(edge.endQ())
                    + ":" + sceneCoordinate(edge.endR());
        }

        private static String labelHitRef(DungeonMapRenderState.Label label) {
            return "label:" + label.ownerId()
                    + ":" + label.clusterId()
                    + ":" + label.topologyRef().kind()
                    + ":" + label.topologyRef().id()
                    + ":" + label.labelKind();
        }

        private static String markerHitRef(DungeonMapRenderState.Marker marker) {
            DungeonMapRenderState.MarkerHandle handle = marker.handle();
            if (!HandleMarkerPresentation.hitIndexed(handle.kind())) {
                return "";
            }
            return "marker:" + handle.kindName()
                    + ":" + handle.topologyRef().kind()
                    + ":" + handle.topologyRef().id()
                    + ":" + handle.ownerId()
                    + ":" + handle.clusterId()
                    + ":" + handle.corridorId()
                    + ":" + handle.roomId()
                    + ":" + handle.index()
                    + ":" + handle.q()
                    + ":" + handle.r()
                    + ":" + handle.level()
                    + ":" + handle.direction();
        }

        private static String graphNodeHitRef(DungeonMapRenderState.GraphNode node) {
            return "graph-node:ROOM:" + node.id() + ":" + node.clusterId();
        }

        private static int sceneCoordinate(double coordinate) {
            return (int) Math.round(coordinate);
        }
    }

    private static final class PointerTargetIndex {

        private static Map<String, PointerTarget> from(DungeonMapRenderState displayModel) {
            if (displayModel == null) {
                return Map.of();
            }
            Map<String, PointerTarget> targets = new LinkedHashMap<>();
            if (displayModel.isGraphView()) {
                addGraphTargets(displayModel, targets);
            } else {
                addGridTargets(displayModel, targets);
            }
            return Map.copyOf(targets);
        }

        private static void addGridTargets(DungeonMapRenderState displayModel, Map<String, PointerTarget> targets) {
            addCellTargets(displayModel, targets);
            addBoundaryTargets(displayModel, targets);
            addMarkerTargets(displayModel, targets);
            addLabelTargets(displayModel, targets);
        }

        private static void addCellTargets(DungeonMapRenderState displayModel, Map<String, PointerTarget> targets) {
            for (DungeonMapRenderState.Cell cell : displayModel.cells()) {
                if (LevelFilter.includeLevel(displayModel, cell.z())) {
                    targets.put(SceneIdentity.cellHitRef(cell), PointerTarget.cell(
                            cell.kind().name(),
                            cell.ownerId(),
                            cell.clusterId(),
                            cell.topologyRef()));
                }
            }
        }

        private static void addBoundaryTargets(DungeonMapRenderState displayModel, Map<String, PointerTarget> targets) {
            for (DungeonMapRenderState.Edge edge : displayModel.edges()) {
                if (LevelFilter.includeLevel(displayModel, edge.z())) {
                    targets.put(SceneIdentity.edgeHitRef(edge), PointerTarget.boundary(edgeBoundaryTarget(edge)));
                }
            }
        }

        private static BoundaryTarget edgeBoundaryTarget(DungeonMapRenderState.Edge edge) {
            DungeonMapRenderState.TopologyRef topologyRef = edge.topologyRef();
            String kind = edge.isDoor() ? "DOOR" : "WALL";
            return new BoundaryTarget(
                    kind,
                    boundaryKey(
                            kind,
                            edge.ownerId(),
                            topologyRef,
                            edge.startQ(),
                            edge.startR(),
                            edge.z(),
                            edge.endQ(),
                            edge.endR(),
                            edge.z()),
                    edge.ownerId(),
                    topologyRef,
                    edge.startQ(),
                    edge.startR(),
                    edge.z(),
                    edge.endQ(),
                    edge.endR(),
                    edge.z());
        }

        private static void addMarkerTargets(DungeonMapRenderState displayModel, Map<String, PointerTarget> targets) {
            for (DungeonMapRenderState.Marker marker : displayModel.markers()) {
                if (LevelFilter.includeLevel(displayModel, marker.z())) {
                    String hitRef = SceneIdentity.markerHitRef(marker);
                    if (!hitRef.isBlank()) {
                        targets.put(hitRef, PointerTarget.handle(toHandleTarget(marker.handle())));
                    }
                }
            }
        }

        private static void addLabelTargets(DungeonMapRenderState displayModel, Map<String, PointerTarget> targets) {
            for (DungeonMapRenderState.Label label : displayModel.labels()) {
                if (LevelFilter.includeLevel(displayModel, label.z())) {
                    targets.put(SceneIdentity.labelHitRef(label), PointerTarget.label(
                            label.labelKind(),
                            label.ownerId(),
                            label.clusterId(),
                            label.topologyRef()));
                }
            }
        }

        private static void addGraphTargets(DungeonMapRenderState displayModel, Map<String, PointerTarget> targets) {
            for (DungeonMapRenderState.GraphNode node : displayModel.graphNodes()) {
                DungeonMapRenderState.TopologyRef topologyRef = new DungeonMapRenderState.TopologyRef("ROOM", node.id());
                targets.put(SceneIdentity.graphNodeHitRef(node), PointerTarget.graphNode(
                        node.id(),
                        node.clusterId(),
                        topologyRef));
            }
        }

        private static HandleTarget toHandleTarget(DungeonMapRenderState.MarkerHandle handle) {
            return new HandleTarget(
                    handle.kind(),
                    handle.topologyRef(),
                    handle.ownerId(),
                    handle.clusterId(),
                    handle.corridorId(),
                    handle.roomId(),
                    handle.index(),
                    handle.q(),
                    handle.r(),
                    handle.level(),
                    handle.direction());
        }

        private static String boundaryKey(
                String kind,
                long ownerId,
                DungeonMapRenderState.TopologyRef topologyRef,
                double startQ,
                double startR,
                int startLevel,
                double endQ,
                double endR,
                int endLevel
        ) {
            return kind + ":"
                    + ownerId + ":"
                    + topologyRef.kind() + ":"
                    + topologyRef.id() + ":"
                    + startQ + ":"
                    + startR + ":"
                    + startLevel + ":"
                    + endQ + ":"
                    + endR + ":"
                    + endLevel;
        }
    }

    public enum PointerTargetKind {
        EMPTY,
        CELL,
        LABEL,
        GRAPH_NODE,
        HANDLE,
        BOUNDARY
    }

    public record PointerTarget(
            PointerTargetKind targetKind,
            String labelKind,
            String elementKind,
            long ownerId,
            long clusterId,
            DungeonMapRenderState.TopologyRef topologyRef,
            HandleTarget handleRef,
            BoundaryTarget boundaryRef
    ) {
        public PointerTarget {
            targetKind = targetKind == null ? PointerTargetKind.EMPTY : targetKind;
            labelKind = normalizeKind(labelKind, EMPTY_LABEL_KIND);
            elementKind = normalizeKind(elementKind, EMPTY_KIND);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRef = topologyRef == null ? DungeonMapRenderState.TopologyRef.empty() : topologyRef;
            handleRef = handleRef == null ? HandleTarget.empty() : handleRef;
            boundaryRef = boundaryRef == null ? BoundaryTarget.empty() : boundaryRef;
        }

        public static PointerTarget empty() {
            return new PointerTarget(
                    PointerTargetKind.EMPTY,
                    EMPTY_LABEL_KIND,
                    EMPTY_KIND,
                    0L,
                    0L,
                    DungeonMapRenderState.TopologyRef.empty(),
                    HandleTarget.empty(),
                    BoundaryTarget.empty());
        }

        public static PointerTarget cell(
                String elementKind,
                long ownerId,
                long clusterId,
                DungeonMapRenderState.TopologyRef topologyRef
        ) {
            return new PointerTarget(
                    PointerTargetKind.CELL,
                    EMPTY_LABEL_KIND,
                    elementKind,
                    ownerId,
                    clusterId,
                    topologyRef,
                    HandleTarget.empty(),
                    BoundaryTarget.empty());
        }

        public static PointerTarget label(
                String labelKind,
                long ownerId,
                long clusterId,
                DungeonMapRenderState.TopologyRef topologyRef
        ) {
            DungeonMapRenderState.TopologyRef safeTopologyRef = topologyRef == null
                    ? DungeonMapRenderState.TopologyRef.empty()
                    : topologyRef;
            return new PointerTarget(
                    PointerTargetKind.LABEL,
                    labelKind,
                    safeTopologyRef.kind(),
                    ownerId,
                    clusterId,
                    safeTopologyRef,
                    HandleTarget.empty(),
                    BoundaryTarget.empty());
        }

        public static PointerTarget graphNode(
                long ownerId,
                long clusterId,
                DungeonMapRenderState.TopologyRef topologyRef
        ) {
            DungeonMapRenderState.TopologyRef safeTopologyRef = topologyRef == null
                    ? DungeonMapRenderState.TopologyRef.empty()
                    : topologyRef;
            return new PointerTarget(
                    PointerTargetKind.GRAPH_NODE,
                    EMPTY_LABEL_KIND,
                    safeTopologyRef.kind(),
                    ownerId,
                    clusterId,
                    safeTopologyRef,
                    HandleTarget.empty(),
                    BoundaryTarget.empty());
        }

        public static PointerTarget handle(HandleTarget handleRef) {
            HandleTarget safeHandle = handleRef == null ? HandleTarget.empty() : handleRef;
            return new PointerTarget(
                    PointerTargetKind.HANDLE,
                    EMPTY_LABEL_KIND,
                    safeHandle.topologyRef().kind(),
                    safeHandle.ownerId(),
                    safeHandle.clusterId(),
                    safeHandle.topologyRef(),
                    safeHandle,
                    BoundaryTarget.empty());
        }

        public static PointerTarget boundary(BoundaryTarget boundaryRef) {
            BoundaryTarget safeBoundary = boundaryRef == null ? BoundaryTarget.empty() : boundaryRef;
            return new PointerTarget(
                    PointerTargetKind.BOUNDARY,
                    EMPTY_LABEL_KIND,
                    safeBoundary.topologyRef().kind(),
                    safeBoundary.ownerId(),
                    0L,
                    safeBoundary.topologyRef(),
                    HandleTarget.empty(),
                    safeBoundary);
        }

        public String topologyKind() {
            return topologyRef.kind();
        }

        public long topologyId() {
            return topologyRef.id();
        }
    }

    public record HandleTarget(
            DungeonEditorHandleKind kind,
            DungeonMapRenderState.TopologyRef topologyRef,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int orderIndex,
            int q,
            int r,
            int level,
            String direction
    ) {
        public HandleTarget {
            kind = kind == null ? DungeonEditorHandleKind.CLUSTER_LABEL : kind;
            topologyRef = topologyRef == null ? DungeonMapRenderState.TopologyRef.empty() : topologyRef;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            orderIndex = Math.max(0, orderIndex);
            direction = direction == null ? "" : direction.trim();
        }

        public static HandleTarget empty() {
            return new HandleTarget(
                    DungeonEditorHandleKind.CLUSTER_LABEL,
                    DungeonMapRenderState.TopologyRef.empty(),
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    0,
                    0,
                    0,
                    "");
        }

        public String topologyKind() {
            return topologyRef.kind();
        }

        public long topologyId() {
            return topologyRef.id();
        }
    }

    public record BoundaryTarget(
            String kind,
            String key,
            long ownerId,
            DungeonMapRenderState.TopologyRef topologyRef,
            double startQ,
            double startR,
            int startLevel,
            double endQ,
            double endR,
            int endLevel
    ) {
        public BoundaryTarget {
            kind = normalizeKind(kind, "WALL");
            key = key == null ? "" : key.strip();
            ownerId = Math.max(0L, ownerId);
            topologyRef = topologyRef == null ? DungeonMapRenderState.TopologyRef.empty() : topologyRef;
        }

        public static BoundaryTarget empty() {
            return new BoundaryTarget(
                    "WALL",
                    "",
                    0L,
                    DungeonMapRenderState.TopologyRef.empty(),
                    0.0,
                    0.0,
                    0,
                    0.0,
                    0.0,
                    0);
        }

        public String topologyKind() {
            return topologyRef.kind();
        }

        public long topologyId() {
            return topologyRef.id();
        }
    }

    private static String normalizeKind(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static final class SceneGeometry {

        private static List<MapCanvasPoint> square(double q, double r, double size) {
            return List.of(
                    new MapCanvasPoint(q, r),
                    new MapCanvasPoint(q + size, r),
                    new MapCanvasPoint(q + size, r + size),
                    new MapCanvasPoint(q, r + size));
        }

        private static List<MapCanvasPoint> roundedRect(
                double centerQ,
                double centerR,
                double width,
                double height
        ) {
            double halfWidth = width / 2.0;
            double halfHeight = height / 2.0;
            return List.of(
                    new MapCanvasPoint(centerQ - halfWidth, centerR - halfHeight),
                    new MapCanvasPoint(centerQ + halfWidth, centerR - halfHeight),
                    new MapCanvasPoint(centerQ + halfWidth, centerR + halfHeight),
                    new MapCanvasPoint(centerQ - halfWidth, centerR + halfHeight));
        }

        private static List<MapCanvasPoint> centeredRect(
                double centerQ,
                double centerR,
                double width,
                double height
        ) {
            return roundedRect(centerQ, centerR, width, height);
        }

        private static final class Label {

            private static double labelHeightScene() {
                return 24.0 / 32.0;
            }

            private static double labelWidthScene(String label) {
                return Math.max(
                        56.0 / 32.0,
                        Math.min(180.0 / 32.0, label.length() * labelCharWidthScene() + labelPaddingScene()));
            }

            private static String abbreviateLabel(String label, int maxLength) {
                if (label == null || label.length() <= maxLength) {
                    return label == null ? "" : label;
                }
                return label.substring(0, Math.max(1, maxLength - 1)) + ".";
            }

            private static double labelPaddingScene() {
                return 16.0 / 32.0;
            }

            private static double labelCharWidthScene() {
                return 7.2 / 32.0;
            }
        }

        private static final class Marker {

            private static List<MapCanvasPoint> markerShape(DungeonMapRenderState.Marker marker) {
                double half = markerHalfSizeScene(marker);
                return square(marker.q() - half, marker.r() - half, half * 2.0);
            }

            private static List<MapCanvasPoint> partyTokenShape(DungeonMapRenderState.PartyToken token) {
                double forwardX = token.heading().dx();
                double forwardY = token.heading().dy();
                double sideX = -forwardY;
                double sideY = forwardX;
                double outerRadius = partyOuterRadiusScene();
                return List.of(
                        new MapCanvasPoint(
                                token.q() + forwardX * outerRadius * 1.18,
                                token.r() + forwardY * outerRadius * 1.18),
                        new MapCanvasPoint(
                                token.q() + forwardX * outerRadius * 0.54
                                        + sideX * outerRadius * 0.76,
                                token.r() + forwardY * outerRadius * 0.54
                                        + sideY * outerRadius * 0.76),
                        new MapCanvasPoint(
                                token.q() - forwardX * outerRadius * 0.92
                                        + sideX * outerRadius * 0.92,
                                token.r() - forwardY * outerRadius * 0.92
                                        + sideY * outerRadius * 0.92),
                        new MapCanvasPoint(
                                token.q() - forwardX * outerRadius * 1.02,
                                token.r() - forwardY * outerRadius * 1.02),
                        new MapCanvasPoint(
                                token.q() - forwardX * outerRadius * 0.92
                                        - sideX * outerRadius * 0.92,
                                token.r() - forwardY * outerRadius * 0.92
                                        - sideY * outerRadius * 0.92),
                        new MapCanvasPoint(
                                token.q() + forwardX * outerRadius * 0.54
                                        - sideX * outerRadius * 0.76,
                                token.r() + forwardY * outerRadius * 0.54
                                        - sideY * outerRadius * 0.76));
            }

            private static double markerHalfSizeScene() {
                return 0.34;
            }

            private static double markerHalfSizeScene(DungeonMapRenderState.Marker marker) {
                if (marker.isWallRunMarker()) {
                    return 0.16;
                }
                return marker.isDoorMarker() ? 0.28 : markerHalfSizeScene();
            }

            private static double partyOuterRadiusScene() {
                return 0.26;
            }
        }

        private static final class Overlay {

            private static double overlayAlpha(int z, int projectionLevel, double configuredOpacity) {
                int distance = Math.max(1, Math.abs(z - projectionLevel));
                return Math.max(0.05, Math.min(0.95, configuredOpacity / Math.sqrt(distance)));
            }
        }
    }

    private static final class SurfaceStyler {

        private static PaintStyle style(
                DungeonMapRenderState.Cell cell,
                DungeonMapRenderState displayModel
        ) {
            if (cell.preview()) {
                return previewStyle(cell);
            }
            if (cell.z() != displayModel.projectionLevel()) {
                return overlayStyle(cell, displayModel);
            }
            return new PaintStyle(
                    cell.selected() ? ScenePalette.SELECTED_FILL : baseFill(cell),
                    cell.selected() ? ScenePalette.SELECTED_STROKE : baseStroke(cell),
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    1.0,
                    false);
        }

        private static PaintStyle previewStyle(DungeonMapRenderState.Cell cell) {
            return new PaintStyle(
                    cell.destructivePreview() ? ScenePalette.DESTRUCTIVE_PREVIEW_FILL : ScenePalette.PREVIEW_FILL,
                    cell.destructivePreview() ? ScenePalette.DESTRUCTIVE_PREVIEW_STROKE : ScenePalette.PREVIEW_STROKE,
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    0.58,
                    false);
        }

        private static PaintStyle overlayStyle(
                DungeonMapRenderState.Cell cell,
                DungeonMapRenderState displayModel
        ) {
            boolean above = cell.z() > displayModel.projectionLevel();
            RenderColor tint = above ? ScenePalette.ABOVE_TINT : ScenePalette.BELOW_TINT;
            RenderColor baseFill = above ? ScenePalette.ROOM_FILL : ScenePalette.CORRIDOR_FILL;
            return new PaintStyle(
                    ScenePalette.blend(baseFill, tint, 0.56),
                    ScenePalette.blend(ScenePalette.ROOM_CELL_STROKE, tint, 0.62),
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    SceneGeometry.Overlay.overlayAlpha(cell.z(), displayModel.projectionLevel(), displayModel.overlaySettings().opacity()),
                    false);
        }

        private static RenderColor baseFill(DungeonMapRenderState.Cell cell) {
            return switch (cell.kind()) {
                case ROOM -> ScenePalette.ROOM_FILL;
                case CORRIDOR -> ScenePalette.CORRIDOR_FILL;
                case STAIR -> ScenePalette.STAIR_FILL;
                case TRANSITION -> ScenePalette.TRANSITION_FILL;
            };
        }

        private static RenderColor baseStroke(DungeonMapRenderState.Cell cell) {
            return switch (cell.kind()) {
                case ROOM -> ScenePalette.ROOM_CELL_STROKE;
                case CORRIDOR, STAIR -> ScenePalette.CORRIDOR_STROKE;
                case TRANSITION -> ScenePalette.TRANSITION_STROKE;
            };
        }
    }

    private static final class EdgeStyler {

        private static PaintStyle style(
                DungeonMapRenderState.Edge edge,
                DungeonMapRenderState displayModel
        ) {
            if (edge.preview()) {
                return new PaintStyle(null, ScenePalette.PREVIEW_STROKE, 2.6 / 32.0, 0.72, true);
            }
            if (edge.z() != displayModel.projectionLevel()) {
                return overlayStyle(edge, displayModel);
            }
            return visibleStyle(edge);
        }

        private static PaintStyle overlayStyle(
                DungeonMapRenderState.Edge edge,
                DungeonMapRenderState displayModel
        ) {
            return new PaintStyle(
                    null,
                    edge.isDoor() ? ScenePalette.DOOR_STROKE : ScenePalette.WALL_STROKE,
                    edge.isDoor() ? 3.6 / 32.0 : 2.0 / 32.0,
                    SceneGeometry.Overlay.overlayAlpha(edge.z(), displayModel.projectionLevel(), displayModel.overlaySettings().opacity()),
                    false);
        }

        private static PaintStyle visibleStyle(DungeonMapRenderState.Edge edge) {
            RenderColor stroke = edge.selected()
                    ? ScenePalette.HIGHLIGHT_STROKE
                    : edge.isDoor() ? ScenePalette.DOOR_STROKE : ScenePalette.WALL_STROKE;
            double strokeWidth = edge.selected() ? selectedStrokeWidth(edge) : unselectedStrokeWidth(edge);
            return new PaintStyle(null, stroke, strokeWidth, 1.0, false);
        }

        private static double selectedStrokeWidth(DungeonMapRenderState.Edge edge) {
            return edge.isDoor() ? 4.2 / 32.0 : 2.8 / 32.0;
        }

        private static double unselectedStrokeWidth(DungeonMapRenderState.Edge edge) {
            return edge.isDoor() ? 3.6 / 32.0 : 2.0 / 32.0;
        }
    }

    private static final class MarkerStyler {

        private static PaintStyle style(
                DungeonMapRenderState.Marker marker,
                DungeonMapRenderState displayModel
        ) {
            if (marker.preview()) {
                return new PaintStyle(
                        ScenePalette.PREVIEW_FILL,
                        ScenePalette.PREVIEW_STROKE,
                        marker.selected() ? 2.2 / 32.0 : 1.4 / 32.0,
                        0.72,
                        false);
            }
            if (marker.isWallRunMarker()) {
                return new PaintStyle(
                        fill(marker),
                        stroke(marker),
                        marker.selected() ? 1.4 / 32.0 : 0.9 / 32.0,
                        marker.z() == displayModel.projectionLevel()
                                ? 0.58
                                : SceneGeometry.Overlay.overlayAlpha(
                                        marker.z(),
                                        displayModel.projectionLevel(),
                                        displayModel.overlaySettings().opacity()) * 0.58,
                        false);
            }
            return new PaintStyle(
                    fill(marker),
                    stroke(marker),
                    marker.selected() ? 2.2 / 32.0 : 1.4 / 32.0,
                    marker.z() == displayModel.projectionLevel()
                            ? 1.0
                            : SceneGeometry.Overlay.overlayAlpha(
                                    marker.z(),
                                    displayModel.projectionLevel(),
                                    displayModel.overlaySettings().opacity()),
                    false);
        }

        private static RenderColor fill(DungeonMapRenderState.Marker marker) {
            return switch (marker.kind()) {
                case DOOR, CLUSTER -> ScenePalette.LABEL_FILL;
                case STAIR -> ScenePalette.STAIR_FILL;
                case TRANSITION -> ScenePalette.TRANSITION_FILL;
                case WAYPOINT -> ScenePalette.PREVIEW_FILL;
            };
        }

        private static RenderColor stroke(DungeonMapRenderState.Marker marker) {
            if (marker.selected()) {
                return ScenePalette.HIGHLIGHT_STROKE;
            }
            return switch (marker.kind()) {
                case DOOR -> ScenePalette.DOOR_STROKE;
                case STAIR -> ScenePalette.CORRIDOR_STROKE;
                case TRANSITION -> ScenePalette.TRANSITION_STROKE;
                case WAYPOINT -> ScenePalette.PREVIEW_STROKE;
                case CLUSTER -> ScenePalette.LABEL_BORDER;
            };
        }
    }

    private static final class LabelStyler {

        private static PaintStyle style(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel
        ) {
            return new PaintStyle(
                    label.preview() ? ScenePalette.PREVIEW_FILL : ScenePalette.LABEL_FILL,
                    label.preview()
                            ? ScenePalette.PREVIEW_STROKE
                            : label.selected() ? ScenePalette.HIGHLIGHT_STROKE : ScenePalette.LABEL_BORDER,
                    (label.selected() ? 2.0 : 1.0) / 32.0,
                    alpha(label, displayModel),
                    false);
        }

        private static double alpha(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel
        ) {
            if (label.z() != displayModel.projectionLevel()) {
                return SceneGeometry.Overlay.overlayAlpha(
                        label.z(),
                        displayModel.projectionLevel(),
                        displayModel.overlaySettings().opacity());
            }
            return label.preview() ? 0.76 : 1.0;
        }
    }

    private static final class ScenePalette {

        private static final RenderColor ROOM_FILL = color(0x2a, 0x32, 0x38, 1.0);
        private static final RenderColor ROOM_CELL_STROKE = color(0x6d, 0x78, 0x81, 0.72);
        private static final RenderColor WALL_STROKE = color(0x8a, 0x6a, 0x35, 1.0);
        private static final RenderColor HIGHLIGHT_STROKE = color(0xf1, 0xd3, 0x8a, 1.0);
        private static final RenderColor CORRIDOR_FILL = color(0x3b, 0x50, 0x53, 0.8);
        private static final RenderColor CORRIDOR_STROKE = color(0x91, 0xb6, 0xb0, 1.0);
        private static final RenderColor SELECTED_FILL = color(0x58, 0x70, 0x6e, 0.95);
        private static final RenderColor SELECTED_STROKE = color(0xd7, 0xec, 0xe7, 1.0);
        private static final RenderColor PREVIEW_FILL = color(0xd7, 0xec, 0xe7, 0.72);
        private static final RenderColor PREVIEW_STROKE = color(0xf1, 0xd3, 0x8a, 1.0);
        private static final RenderColor PARTY_FILL = color(0xff, 0xb6, 0x2a, 1.0);
        private static final RenderColor PARTY_STROKE = color(0xff, 0xf0, 0xc6, 1.0);
        private static final RenderColor LABEL_FILL = color(0x18, 0x1f, 0x24, 1.0);
        private static final RenderColor LABEL_BORDER = color(0x76, 0x84, 0x8d, 1.0);
        private static final RenderColor LABEL_TEXT = color(0xf2, 0xf4, 0xf5, 1.0);
        private static final RenderColor STAIR_FILL = color(0x4b, 0x3a, 0x6e, 0.95);
        private static final RenderColor TRANSITION_FILL = color(0x6f, 0x3f, 0x28, 0.95);
        private static final RenderColor TRANSITION_STROKE = color(0xe0, 0xa3, 0x6a, 1.0);
        private static final RenderColor DOOR_STROKE = color(0xc6, 0xe2, 0xff, 1.0);
        private static final RenderColor GRAPH_LINK = color(0x88, 0x96, 0xa1, 0.9);
        private static final RenderColor GRAPH_NODE_FILL = color(0x21, 0x29, 0x2f, 1.0);
        private static final RenderColor ABOVE_TINT = color(0x86, 0x90, 0xd8, 0.75);
        private static final RenderColor BELOW_TINT = color(0x55, 0x8a, 0x9c, 0.75);
        private static final RenderColor DESTRUCTIVE_PREVIEW_FILL = color(0x99, 0x43, 0x3d, 1.0);
        private static final RenderColor DESTRUCTIVE_PREVIEW_STROKE = color(0xff, 0xc1, 0x87, 1.0);

        private static RenderColor blend(RenderColor base, RenderColor tint, double weight) {
            return RenderColor.blend(base, tint, weight);
        }

        private static RenderColor color(int red, int green, int blue, double opacity) {
            return RenderColor.color(red, green, blue, opacity);
        }
    }


// Snapshot-to-render-state mapping
    private static final class DungeonMapSnapshotMapper {

    private static final Map<DungeonEditorTool, String> TOOL_LABELS = createToolLabels();

    static DungeonMapRenderState mapEditorSurface(String placeholderTitle, DungeonEditorMapSurfaceSnapshot snapshot) {
        DungeonEditorMapSurfaceSnapshot safeSnapshot = snapshot == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : snapshot;
        DungeonMapRenderState baseState = DungeonMapEditorSurfaceProjector.mapEditorSurface(
                placeholderTitle,
                safeSnapshot.surface(),
                safeSnapshot.selection(),
                safeSnapshot.preview(),
                true);
        return baseState.withViewMode(DungeonMapRenderState.ViewMode.fromEditor(safeSnapshot.viewMode()))
                .withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(toolLabel(safeSnapshot.selectedTool()));
    }

    static DungeonMapRenderState mapTravel(String placeholderTitle, TravelDungeonSnapshot snapshot) {
        TravelDungeonSnapshot safeSnapshot = snapshot == null
                ? TravelDungeonSnapshot.empty()
                : snapshot;
        DungeonMapRenderState baseState = DungeonMapTravelFactsProjector.mapTravelSurface(
                placeholderTitle,
                safeSnapshot.travelSurface());
        return baseState.withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(DungeonMapRenderState.selectToolLabel());
    }

    private static DungeonMapRenderState.LevelOverlaySettings toOverlaySettings(
            DungeonOverlaySettings overlaySettings
    ) {
        DungeonOverlaySettings safeOverlay = overlaySettings == null
                ? DungeonOverlaySettings.defaults()
                : overlaySettings;
        return new DungeonMapRenderState.LevelOverlaySettings(
                DungeonMapRenderState.OverlayMode.fromKey(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static String toolLabel(DungeonEditorTool selectedTool) {
        return TOOL_LABELS.getOrDefault(selectedTool, DungeonMapRenderState.selectToolLabel());
    }

    private static Map<DungeonEditorTool, String> createToolLabels() {
        Map<DungeonEditorTool, String> labels = new EnumMap<>(DungeonEditorTool.class);
        labels.put(DungeonEditorTool.SELECT, DungeonMapRenderState.selectToolLabel());
        labels.put(DungeonEditorTool.ROOM_PAINT, "Raum malen");
        labels.put(DungeonEditorTool.ROOM_DELETE, "Raum löschen");
        labels.put(DungeonEditorTool.WALL_CREATE, "Wand setzen");
        labels.put(DungeonEditorTool.WALL_DELETE, "Wand löschen");
        labels.put(DungeonEditorTool.DOOR_CREATE, "Tür setzen");
        labels.put(DungeonEditorTool.DOOR_DELETE, "Tür löschen");
        labels.put(DungeonEditorTool.CORRIDOR_CREATE, "Korridor erstellen");
        labels.put(DungeonEditorTool.CORRIDOR_DELETE, "Korridor löschen");
        labels.put(DungeonEditorTool.STAIR_CREATE, "Treppe erstellen");
        labels.put(DungeonEditorTool.STAIR_CREATE_SQUARE, "Treppe erstellen");
        labels.put(DungeonEditorTool.STAIR_CREATE_CIRCULAR, "Treppe erstellen");
        labels.put(DungeonEditorTool.STAIR_DELETE, "Treppe löschen");
        labels.put(DungeonEditorTool.TRANSITION_CREATE, "Übergang erstellen");
        labels.put(DungeonEditorTool.TRANSITION_DELETE, "Übergang löschen");
        return labels;
    }
}

    private static final class DungeonMapTravelFactsProjector {

    static DungeonMapRenderState mapTravelSurface(
            String placeholderTitle,
            @Nullable DungeonTravelSurfaceSnapshot surface
    ) {
        if (surface == null) {
            return DungeonMapRenderState.empty(placeholderTitle, false);
        }
        DungeonMapSnapshot map = surface.map();
        List<DungeonMapRenderState.GraphNode> graphNodes = TravelGraph.graphNodes(map.areas());
        return new DungeonMapRenderState(
                surface.mapName(),
                true,
                map.width(),
                map.height(),
                DungeonMapRenderState.Topology.fromPublished(map.topology()),
                DungeonMapRenderState.ViewMode.grid(),
                DungeonMapRenderState.LevelOverlaySettings.off(),
                0,
                false,
                DungeonMapRenderState.selectToolLabel(),
                "No dungeon map geometry available.",
                TravelGeometry.cells(map),
                TravelGeometry.edges(map.boundaries()),
                TravelFeatureAnnotations.labels(map.features()),
                TravelFeatureAnnotations.markers(map.features()),
                graphNodes,
                TravelGraph.fallbackGraphLinks(graphNodes),
                TravelParty.partyToken(surface));
    }

    private static final class TravelGeometry {

    private static List<DungeonMapRenderState.Cell> cells(DungeonMapSnapshot map) {
        List<DungeonMapRenderState.Cell> cells = new ArrayList<>();
        for (DungeonAreaSnapshot area : map.areas()) {
            for (DungeonCellRef cell : area.cells()) {
                cells.add(new DungeonMapRenderState.Cell(
                        cell.q(),
                        cell.r(),
                        cell.level(),
                        area.label(),
                        area.kind() == DungeonAreaKind.CORRIDOR
                                ? DungeonMapRenderState.CellKind.CORRIDOR
                                : DungeonMapRenderState.CellKind.ROOM,
                        area.id(),
                        area.clusterId(),
                        topologyRef(area.topologyRef()),
                        false,
                        false,
                        false,
                        false));
            }
        }
        for (DungeonFeatureSnapshot feature : map.features()) {
            for (DungeonCellRef cell : feature.cells()) {
                cells.add(new DungeonMapRenderState.Cell(
                        cell.q(),
                        cell.r(),
                        cell.level(),
                        feature.label(),
                        feature.kind() == DungeonFeatureKind.TRANSITION
                                ? DungeonMapRenderState.CellKind.TRANSITION
                                : DungeonMapRenderState.CellKind.STAIR,
                        feature.id(),
                        0L,
                        topologyRef(feature.topologyRef()),
                        false,
                        false,
                        false,
                        false));
            }
        }
        return List.copyOf(cells);
    }

    private static List<DungeonMapRenderState.Edge> edges(List<DungeonBoundarySnapshot> boundaries) {
        List<DungeonMapRenderState.Edge> edges = new ArrayList<>();
        for (DungeonBoundarySnapshot boundary : boundaries) {
            edges.add(new DungeonMapRenderState.Edge(
                    boundary.edge().from().q(),
                    boundary.edge().from().r(),
                    boundary.edge().to().q(),
                    boundary.edge().to().r(),
                    boundary.edge().from().level(),
                    "door".equalsIgnoreCase(boundary.kind())
                            ? DungeonMapRenderState.EdgeKind.DOOR
                            : DungeonMapRenderState.EdgeKind.WALL,
                    boundary.label(),
                    boundary.id(),
                    topologyRef(boundary.topologyRef()),
                    false,
                    false));
        }
        return List.copyOf(edges);
    }
}

    private static final class TravelFeatureAnnotations {

    private static List<DungeonMapRenderState.Label> labels(List<DungeonFeatureSnapshot> features) {
        List<DungeonMapRenderState.Label> labels = new ArrayList<>();
        for (DungeonFeatureSnapshot feature : features) {
            CellCenter center = centerOf(feature.cells());
            labels.add(new DungeonMapRenderState.Label(
                    feature.label(),
                    center.q(),
                    center.r(),
                    center.level(),
                    feature.id(),
                    0L,
                    topologyRef(feature.topologyRef()),
                    FEATURE_LABEL_KIND,
                    false,
                    false));
        }
        return List.copyOf(labels);
    }

    private static List<DungeonMapRenderState.Marker> markers(List<DungeonFeatureSnapshot> features) {
        List<DungeonMapRenderState.Marker> markers = new ArrayList<>();
        for (DungeonFeatureSnapshot feature : features) {
            CellCenter center = centerOf(feature.cells());
            boolean transition = feature.kind() == DungeonFeatureKind.TRANSITION;
            markers.add(new DungeonMapRenderState.Marker(
                    transition ? "->" : "z",
                    center.q(),
                    center.r(),
                    center.level(),
                    transition ? DungeonMapRenderState.MarkerKind.WAYPOINT : DungeonMapRenderState.MarkerKind.STAIR,
                    false,
                    new DungeonMapRenderState.MarkerHandle(
                            transition
                                    ? DungeonEditorHandleKind.CORRIDOR_WAYPOINT
                                    : DungeonEditorHandleKind.STAIR_ANCHOR,
                            topologyRef(feature.topologyRef()),
                            feature.id(),
                            0L,
                            0L,
                            0L,
                            0,
                            (int) Math.floor(center.q()),
                            (int) Math.floor(center.r()),
                            center.level(),
                            ""),
                    false));
        }
        return List.copyOf(markers);
    }
}

    private static final class TravelGraph {

    private static List<DungeonMapRenderState.GraphNode> graphNodes(List<DungeonAreaSnapshot> areas) {
        List<DungeonMapRenderState.GraphNode> nodes = new ArrayList<>();
        for (DungeonAreaSnapshot area : areas) {
            if (area.cells().isEmpty()) {
                continue;
            }
            CellCenter center = centerOf(area.cells());
            nodes.add(new DungeonMapRenderState.GraphNode(
                    area.id(),
                    area.clusterId(),
                    area.label(),
                    center.q(),
                    center.r(),
                    false));
        }
        return List.copyOf(nodes);
    }

    private static List<DungeonMapRenderState.GraphLink> fallbackGraphLinks(
            List<DungeonMapRenderState.GraphNode> nodes
    ) {
        int maximumLinklessGraphNodeCount = 1;
        if (nodes.size() <= maximumLinklessGraphNodeCount) {
            return List.of();
        }
        List<DungeonMapRenderState.GraphLink> links = new ArrayList<>();
        for (int index = 1; index < nodes.size(); index++) {
            links.add(new DungeonMapRenderState.GraphLink(nodes.get(index - 1).id(), nodes.get(index).id(), false));
        }
        return List.copyOf(links);
    }
}

    private static final class TravelParty {

    private static DungeonMapRenderState.PartyToken partyToken(DungeonTravelSurfaceSnapshot surface) {
        if (surface.position() == null) {
            return null;
        }
        DungeonCellRef tile = surface.position().tile();
        return new DungeonMapRenderState.PartyToken(
                tile.q() + 0.5,
                tile.r() + 0.5,
                tile.level(),
                DungeonMapRenderState.Heading.fromEditor(surface.position().heading()),
                true);
    }
}

    private static DungeonMapRenderState.TopologyRef topologyRef(DungeonTopologyElementRef ref) {
        return ref == null
                ? DungeonMapRenderState.TopologyRef.empty()
                : new DungeonMapRenderState.TopologyRef(ref.kind().name(), ref.id());
    }

    private static CellCenter centerOf(List<DungeonCellRef> cells) {
        if (cells == null || cells.isEmpty()) {
            return new CellCenter(0.5, 0.5, 0);
        }
        double q = 0.0;
        double r = 0.0;
        int level = cells.getFirst().level();
        for (DungeonCellRef cell : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        return new CellCenter(q / cells.size(), r / cells.size(), level);
    }

    private record CellCenter(double q, double r, int level) {
    }
}

    private static final class DungeonMapEditorSurfaceProjector {

    static DungeonMapRenderState mapEditorSurface(
            String placeholderTitle,
            @Nullable DungeonEditorSurface surface,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview preview,
            boolean editorMode
    ) {
        if (surface == null) {
            return DungeonMapRenderState.empty(placeholderTitle, editorMode);
        }
        DungeonEditorMapSnapshot map = surface.map();
        ProjectionAccumulator projection = assemble(
                map,
                surface.previewMap(),
                selection == null ? DungeonEditorStateSnapshot.Selection.empty() : selection,
                preview == null ? DungeonEditorPreview.none() : preview);
        return projection.renderState(surface, map, editorMode);
    }

    private static ProjectionAccumulator assemble(
            DungeonEditorMapSnapshot map,
            @Nullable DungeonEditorMapSnapshot previewMap,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview preview
    ) {
        ProjectionAccumulator projection = new ProjectionAccumulator();
        projection.addAreas(map, selection);
        projection.addClusterLabels(map, selection);
        projection.addPreviewAndBoundaries(map, selection, preview, previewMap);
        projection.addFeatures(map, selection);
        projection.addHandles(map, selection, preview);
        projection.addPreviewMapDiff(map, selection, preview, previewMap);
        projection.addFallbackGraphLinks();
        return projection;
    }

}

    private interface EditorPreviewProjection {

    static void addEditorPreview(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Edge> edges,
            List<DungeonMapRenderState.Label> labels,
            DungeonEditorMapSnapshot map,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview preview,
            @Nullable DungeonEditorMapSnapshot previewMap
    ) {
        switch (preview) {
            case DungeonEditorPreview.MoveHandlePreview movePreview ->
                    addClusterMovePreview(cells, edges, labels, map, selection, movePreview);
            case DungeonEditorPreview.RoomRectanglePreview roomRectangle ->
                    addRoomRectanglePreview(cells, roomRectangle);
            case DungeonEditorPreview.ClusterBoundariesPreview boundaryEdges ->
                    addBoundaryEdgesPreview(edges, boundaryEdges);
            case DungeonEditorPreview.MoveBoundaryStretchPreview boundaryStretchMove ->
                    EditorBoundaryStretchPreview.addBoundaryStretchPreview(cells, edges, labels, selection, previewMap, boundaryStretchMove);
            case DungeonEditorPreview.NonePreview ignored -> {
            }
        }
    }

    static void addHandleMovePreview(
            List<DungeonMapRenderState.Marker> markers,
            DungeonEditorPreview preview
    ) {
        if (!(preview instanceof DungeonEditorPreview.MoveHandlePreview movePreview)
                || movePreview.handleRef().kind().isClusterLabel()) {
            return;
        }
        DungeonEditorHandleRef ref = movePreview.handleRef();
        DungeonCellRef cell = ref.cell();
        int movedQ = cell.q() + movePreview.deltaQ();
        int movedR = cell.r() + movePreview.deltaR();
        int movedLevel = cell.level() + movePreview.deltaLevel();
        HandleMarkerPresentation presentation = HandleMarkerPresentation.marker(
                ref.kind(),
                movedQ,
                movedR);
        markers.add(new DungeonMapRenderState.Marker(
                presentation.label(),
                presentation.q(),
                presentation.r(),
                movedLevel,
                EditorElementKinds.handleMarkerKind(ref.kind()),
                true,
                new DungeonMapRenderState.MarkerHandle(
                        ref.kind(),
                        EditorProjectionFacts.topologyRef(ref.topologyRef()),
                        ref.ownerId(),
                        ref.clusterId(),
                        ref.corridorId(),
                        ref.roomId(),
                        ref.index(),
                        movedQ,
                        movedR,
                        movedLevel,
                        ref.direction()),
                true));
    }

    static void addBoundaryEdgesPreview(
            List<DungeonMapRenderState.Edge> edges,
            DungeonEditorPreview.ClusterBoundariesPreview boundaryEdges
    ) {
        DungeonMapRenderState.EdgeKind kind = EditorElementKinds.boundaryKind(boundaryEdges.boundaryKind());
        for (DungeonEdgeRef edge : boundaryEdges.edges()) {
            if (EditorProjectionFacts.invalidEdge(edge)) {
                continue;
            }
            edges.add(new DungeonMapRenderState.Edge(
                    edge.from().q(),
                    edge.from().r(),
                    edge.to().q(),
                    edge.to().r(),
                    edge.from().level(),
                    kind,
                    boundaryEdges.deleteMode() ? "Delete preview" : "Boundary preview",
                    boundaryEdges.clusterId(),
                    DungeonMapRenderState.TopologyRef.empty(),
                    false,
                    true));
        }
    }

    static void addRoomRectanglePreview(
            List<DungeonMapRenderState.Cell> cells,
            DungeonEditorPreview.RoomRectanglePreview roomRectangle
    ) {
        int minQ = Math.min(roomRectangle.start().q(), roomRectangle.end().q());
        int maxQ = Math.max(roomRectangle.start().q(), roomRectangle.end().q());
        int minR = Math.min(roomRectangle.start().r(), roomRectangle.end().r());
        int maxR = Math.max(roomRectangle.start().r(), roomRectangle.end().r());
        for (int q = minQ; q <= maxQ; q++) {
            for (int r = minR; r <= maxR; r++) {
                cells.add(new DungeonMapRenderState.Cell(
                        q,
                        r,
                        roomRectangle.start().level(),
                        roomRectangle.deleteMode() ? "Delete preview" : "Paint preview",
                        DungeonMapRenderState.CellKind.ROOM,
                        0L,
                        0L,
                        DungeonMapRenderState.TopologyRef.empty(),
                        false,
                        false,
                        true,
                        roomRectangle.deleteMode()));
            }
        }
    }

    static void addClusterMovePreview(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Edge> edges,
            List<DungeonMapRenderState.Label> labels,
            DungeonEditorMapSnapshot map,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview.MoveHandlePreview movePreview
    ) {
        if (!movePreview.handleRef().kind().isClusterLabel()) {
            return;
        }
        Set<DungeonCellRef> draggedCells = new LinkedHashSet<>();
        for (DungeonEditorMapSnapshot.Area area : map.areas()) {
            if (!EditorSelectionFacts.draggedClusterArea(area, selection, movePreview)) {
                continue;
            }
            for (DungeonCellRef cell : area.cells()) {
                cells.add(EditorRenderElements.cell(area, cell, true, true, false, movePreview.deltaQ(), movePreview.deltaR(), movePreview.deltaLevel()));
                draggedCells.add(cell);
            }
        }
        DungeonEditorHandleSnapshot clusterLabelHandle = EditorProjectionFacts.clusterLabelHandle(map.editorHandles(), movePreview.handleRef().clusterId());
        if (clusterLabelHandle != null) {
            labels.add(EditorRenderElements.clusterLabel(
                    clusterLabelHandle,
                    true,
                    true,
                    movePreview.deltaQ(),
                    movePreview.deltaR(),
                    movePreview.deltaLevel()));
        }
        previewClusterBoundaries(edges, map.boundaries(), draggedCells, movePreview);
    }

    static void previewClusterBoundaries(
            List<DungeonMapRenderState.Edge> edges,
            List<DungeonEditorMapSnapshot.Boundary> boundaries,
            Set<DungeonCellRef> draggedCells,
            DungeonEditorPreview.MoveHandlePreview movePreview
    ) {
        if (draggedCells.isEmpty()) {
            return;
        }
        for (DungeonEditorMapSnapshot.Boundary boundary : boundaries) {
            if (EditorProjectionFacts.invalidEdge(boundary.edge()) || !EditorSelectionFacts.edgeTouchesAnyCell(boundary.edge(), draggedCells)) {
                continue;
            }
            edges.add(EditorRenderElements.edge(boundary, movePreview.deltaQ(), movePreview.deltaR(), movePreview.deltaLevel(), true, false));
        }
    }


}

    private interface EditorBoundaryStretchPreview {

    static void addBoundaryStretchPreview(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Edge> edges,
            List<DungeonMapRenderState.Label> labels,
            DungeonEditorStateSnapshot.Selection selection,
            @Nullable DungeonEditorMapSnapshot previewMap,
            DungeonEditorPreview.MoveBoundaryStretchPreview movePreview
    ) {
        if (previewMap == null) {
            return;
        }
        List<DungeonEditorMapSnapshot.Area> previewAreas = previewAreas(previewMap, movePreview.clusterId());
        if (previewAreas.isEmpty()) {
            return;
        }
        previewAreas(cells, previewAreas, selection);
        DungeonEditorHandleSnapshot previewHandle = EditorProjectionFacts.clusterLabelHandle(previewMap.editorHandles(), movePreview.clusterId());
        if (previewHandle != null) {
            labels.add(EditorRenderElements.clusterLabel(previewHandle, true, true, 0, 0, 0));
        }
        previewBoundaries(edges, previewMap.boundaries(), previewClusterCells(previewAreas));
    }

    static List<DungeonEditorMapSnapshot.Area> previewAreas(
            DungeonEditorMapSnapshot previewMap,
            long clusterId
    ) {
        List<DungeonEditorMapSnapshot.Area> result = new ArrayList<>();
        for (DungeonEditorMapSnapshot.Area area : previewMap.areas()) {
            if (EditorElementKinds.areaKind(area) == DungeonMapRenderState.CellKind.ROOM && EditorProjectionFacts.clusterId(area) == clusterId) {
                result.add(area);
            }
        }
        return List.copyOf(result);
    }

    static void previewAreas(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonEditorMapSnapshot.Area> previewAreas,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        for (DungeonEditorMapSnapshot.Area area : previewAreas) {
            for (DungeonCellRef cell : area.cells()) {
                cells.add(EditorRenderElements.cell(area, cell, EditorSelectionFacts.selectedArea(area, selection), true, false, 0, 0, 0));
            }
        }
    }

    static Set<DungeonCellRef> previewClusterCells(List<DungeonEditorMapSnapshot.Area> previewAreas) {
        Set<DungeonCellRef> result = new LinkedHashSet<>();
        for (DungeonEditorMapSnapshot.Area area : previewAreas) {
            result.addAll(area.cells());
        }
        return Set.copyOf(result);
    }

    static void previewBoundaries(
            List<DungeonMapRenderState.Edge> edges,
            List<DungeonEditorMapSnapshot.Boundary> boundaries,
            Set<DungeonCellRef> previewClusterCells
    ) {
        for (DungeonEditorMapSnapshot.Boundary boundary : boundaries) {
            if (EditorProjectionFacts.invalidEdge(boundary.edge()) || !EditorSelectionFacts.edgeTouchesAnyCell(boundary.edge(), previewClusterCells)) {
                continue;
            }
            edges.add(EditorRenderElements.edge(boundary, 0, 0, 0, true, false));
        }
    }


}

    private interface EditorPreviewDiff {

    static void addPreviewAreaDiff(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Label> labels,
            List<DungeonEditorMapSnapshot.Area> committedAreas,
            List<DungeonEditorMapSnapshot.Area> previewAreas,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        Map<String, DungeonEditorMapSnapshot.Area> committedByKey = indexAreas(committedAreas);
        for (DungeonEditorMapSnapshot.Area previewArea : previewAreas) {
            DungeonEditorMapSnapshot.Area committedArea = committedByKey.remove(areaKey(previewArea));
            if (previewArea.equals(committedArea)) {
                continue;
            }
            addPreviewArea(cells, labels, previewArea, selection, false);
        }
        for (DungeonEditorMapSnapshot.Area removedArea : committedByKey.values()) {
            addPreviewArea(cells, labels, removedArea, selection, true);
        }
    }

    static void addPreviewBoundaryDiff(
            List<DungeonMapRenderState.Edge> edges,
            List<DungeonEditorMapSnapshot.Boundary> committedBoundaries,
            List<DungeonEditorMapSnapshot.Boundary> previewBoundaries,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        Map<String, DungeonEditorMapSnapshot.Boundary> committedByKey = indexBoundaries(committedBoundaries);
        for (DungeonEditorMapSnapshot.Boundary previewBoundary : previewBoundaries) {
            DungeonEditorMapSnapshot.Boundary committedBoundary = committedByKey.remove(boundaryKey(previewBoundary));
            if (previewBoundary.equals(committedBoundary)) {
                continue;
            }
            edges.add(EditorRenderElements.edge(
                    previewBoundary,
                    0,
                    0,
                    0,
                    true,
                    EditorSelectionFacts.selectedBoundary(previewBoundary, selection)));
        }
        for (DungeonEditorMapSnapshot.Boundary removedBoundary : committedByKey.values()) {
            edges.add(EditorRenderElements.edge(
                    removedBoundary,
                    0,
                    0,
                    0,
                    true,
                    EditorSelectionFacts.selectedBoundary(removedBoundary, selection)));
        }
    }

    static void addPreviewHandleDiff(
            List<DungeonMapRenderState.Marker> markers,
            List<DungeonEditorHandleSnapshot> committedHandles,
            List<DungeonEditorHandleSnapshot> previewHandles,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        Map<String, DungeonEditorHandleSnapshot> committedByKey = indexHandles(committedHandles);
        for (DungeonEditorHandleSnapshot previewHandle : previewHandles) {
            if (previewHandle.ref().kind().isClusterLabel()) {
                continue;
            }
            DungeonEditorHandleSnapshot committedHandle = committedByKey.remove(handleKey(previewHandle.ref()));
            if (previewHandle.equals(committedHandle)) {
                continue;
            }
            markers.add(EditorRenderElements.handleMarker(previewHandle, selection, true));
        }
        for (DungeonEditorHandleSnapshot removedHandle : committedByKey.values()) {
            if (removedHandle.ref().kind().isClusterLabel()) {
                continue;
            }
            markers.add(EditorRenderElements.handleMarker(removedHandle, selection, true));
        }
    }

    static void addPreviewArea(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Label> labels,
            DungeonEditorMapSnapshot.Area area,
            DungeonEditorStateSnapshot.Selection selection,
            boolean destructive
    ) {
        boolean selected = EditorSelectionFacts.selectedArea(area, selection);
        List<DungeonMapRenderState.Cell> previewCells = new ArrayList<>();
        for (DungeonCellRef cell : area.cells()) {
            previewCells.add(EditorRenderElements.cell(area, cell, selected, true, destructive, 0, 0, 0));
        }
        cells.addAll(previewCells);
        if (previewCells.isEmpty()) {
            return;
        }
        EditorProjectionFacts.CellCenter center = EditorProjectionFacts.centerOfCells(previewCells);
        labels.add(new DungeonMapRenderState.Label(
                area.label(),
                center.q(),
                center.r(),
                previewCells.getFirst().z(),
                area.id(),
                EditorProjectionFacts.clusterId(area),
                EditorProjectionFacts.areaTopologyRef(area),
                ROOM_LABEL_KIND,
                selected,
                true));
    }



    static Map<String, DungeonEditorMapSnapshot.Area> indexAreas(List<DungeonEditorMapSnapshot.Area> areas) {
        Map<String, DungeonEditorMapSnapshot.Area> result = new LinkedHashMap<>();
        for (DungeonEditorMapSnapshot.Area area : areas) {
            result.put(areaKey(area), area);
        }
        return result;
    }

    static Map<String, DungeonEditorMapSnapshot.Boundary> indexBoundaries(
            List<DungeonEditorMapSnapshot.Boundary> boundaries
    ) {
        Map<String, DungeonEditorMapSnapshot.Boundary> result = new LinkedHashMap<>();
        for (DungeonEditorMapSnapshot.Boundary boundary : boundaries) {
            result.put(boundaryKey(boundary), boundary);
        }
        return result;
    }

    static Map<String, DungeonEditorHandleSnapshot> indexHandles(List<DungeonEditorHandleSnapshot> handles) {
        Map<String, DungeonEditorHandleSnapshot> result = new LinkedHashMap<>();
        for (DungeonEditorHandleSnapshot handle : handles) {
            result.put(handleKey(handle.ref()), handle);
        }
        return result;
    }

    static String areaKey(DungeonEditorMapSnapshot.Area area) {
        return area.kind() + ":" + area.id();
    }

    static String boundaryKey(DungeonEditorMapSnapshot.Boundary boundary) {
        DungeonMapRenderState.TopologyRef ref = EditorProjectionFacts.topologyRef(boundary.topologyRef());
        return ref.kind() + ":" + ref.id() + ":" + boundary.id();
    }

    static String handleKey(DungeonEditorHandleRef handle) {
        DungeonMapRenderState.TopologyRef ref = EditorProjectionFacts.topologyRef(handle.topologyRef());
        return handle.kind().name()
                + ":" + ref.kind()
                + ":" + ref.id()
                + ":" + handle.ownerId()
                + ":" + handle.clusterId()
                + ":" + handle.corridorId()
                + ":" + handle.roomId()
                + ":" + handle.index();
    }


}

    private interface EditorRenderElements {

    static DungeonMapRenderState.Cell cell(
            DungeonEditorMapSnapshot.Area area,
            DungeonCellRef cell,
            boolean selected,
            boolean preview,
            boolean destructive,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return new DungeonMapRenderState.Cell(
                cell.q() + deltaQ,
                cell.r() + deltaR,
                cell.level() + deltaLevel,
                area.label(),
                EditorElementKinds.areaKind(area),
                area.id(),
                EditorProjectionFacts.clusterId(area),
                EditorProjectionFacts.areaTopologyRef(area),
                selected,
                false,
                preview,
                destructive);
    }

    static DungeonMapRenderState.Cell featureCell(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonCellRef cell,
            boolean selected
    ) {
        return new DungeonMapRenderState.Cell(
                cell.q(),
                cell.r(),
                cell.level(),
                feature.label(),
                EditorElementKinds.featureKind(feature),
                feature.id(),
                0L,
                EditorProjectionFacts.featureTopologyRef(feature),
                selected,
                false,
                false,
                false);
    }

    static DungeonMapRenderState.Edge edge(
            DungeonEditorMapSnapshot.Boundary boundary,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            boolean preview,
            boolean selected
    ) {
        DungeonEdgeRef edge = boundary.edge();
        return new DungeonMapRenderState.Edge(
                edge.from().q() + deltaQ,
                edge.from().r() + deltaR,
                edge.to().q() + deltaQ,
                edge.to().r() + deltaR,
                edge.from().level() + deltaLevel,
                EditorElementKinds.boundaryKind(boundary.kind()),
                boundary.label(),
                boundary.id(),
                EditorProjectionFacts.topologyRef(boundary.topologyRef()),
                selected,
                preview);
    }

    static DungeonMapRenderState.Marker featureMarker(
            DungeonEditorMapSnapshot.Feature feature,
            EditorProjectionFacts.CellCenter center,
            int level,
            boolean selected
    ) {
        boolean transition = EditorElementKinds.transitionFeature(feature);
        return new DungeonMapRenderState.Marker(
                transition ? "->" : "z",
                center.q(),
                center.r(),
                level,
                transition ? DungeonMapRenderState.MarkerKind.WAYPOINT : DungeonMapRenderState.MarkerKind.STAIR,
                selected,
                new DungeonMapRenderState.MarkerHandle(
                        transition
                                ? DungeonEditorHandleKind.CORRIDOR_WAYPOINT
                                : DungeonEditorHandleKind.STAIR_ANCHOR,
                        EditorProjectionFacts.featureTopologyRef(feature),
                        feature.id(),
                        0L,
                        0L,
                        0L,
                        0,
                        (int) Math.floor(center.q()),
                        (int) Math.floor(center.r()),
                        level,
                        ""),
                false);
    }

    static DungeonMapRenderState.Marker handleMarker(
            DungeonEditorHandleSnapshot handle,
            DungeonEditorStateSnapshot.Selection selection,
            boolean preview
    ) {
        DungeonEditorHandleRef ref = handle.ref();
        HandleMarkerPresentation presentation = HandleMarkerPresentation.marker(
                ref.kind(),
                handle.cell().q(),
                handle.cell().r(),
                handle.markerQ(),
                handle.markerR());
        return new DungeonMapRenderState.Marker(
                presentation.label(),
                presentation.q(),
                presentation.r(),
                handle.cell().level(),
                EditorElementKinds.handleMarkerKind(ref.kind()),
                EditorSelectionFacts.selectedHandle(ref, selection),
                markerHandle(ref),
                preview);
    }

    static DungeonMapRenderState.Label clusterLabel(
            DungeonEditorHandleSnapshot handle,
            boolean selected,
            boolean preview,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        DungeonCellRef cell = handle.cell();
        DungeonEditorHandleRef ref = handle.ref();
        return new DungeonMapRenderState.Label(
                handle.label(),
                cell.q() + deltaQ + 0.5,
                cell.r() + deltaR + 0.5,
                cell.level() + deltaLevel,
                ref.ownerId(),
                ref.clusterId(),
                EditorProjectionFacts.topologyRef(ref.topologyRef()),
                CLUSTER_LABEL_KIND,
                selected,
                preview);
    }

    static DungeonMapRenderState.MarkerHandle markerHandle(DungeonEditorHandleRef handle) {
        return new DungeonMapRenderState.MarkerHandle(
                handle.kind(),
                EditorProjectionFacts.topologyRef(handle.topologyRef()),
                handle.ownerId(),
                handle.clusterId(),
                handle.corridorId(),
                handle.roomId(),
                handle.index(),
                handle.cell().q(),
                handle.cell().r(),
                handle.cell().level(),
                handle.direction());
    }

}

    private interface EditorSelectionFacts {

    static boolean selectedArea(
            DungeonEditorMapSnapshot.Area area,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        if (selection.clusterSelection()) {
            return EditorElementKinds.areaKind(area) == DungeonMapRenderState.CellKind.ROOM && EditorProjectionFacts.clusterId(area) == selection.clusterId();
        }
        return EditorProjectionFacts.areaTopologyRef(area).equals(EditorProjectionFacts.topologyRef(selection.topologyRef()));
    }

    static boolean selectedFeature(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return EditorProjectionFacts.featureTopologyRef(feature).equals(EditorProjectionFacts.topologyRef(selection.topologyRef()));
    }

    static boolean selectedBoundary(
            DungeonEditorMapSnapshot.Boundary boundary,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return EditorProjectionFacts.topologyRef(boundary.topologyRef()).equals(
                EditorProjectionFacts.topologyRef(selection.topologyRef()));
    }

    static boolean selectedHandle(
            DungeonEditorHandleRef ref,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        DungeonEditorHandleRef selected = selection.handleRef();
        return selected != null
                && ref.kind() == selected.kind()
                && EditorProjectionFacts.topologyRef(ref.topologyRef()).equals(
                        EditorProjectionFacts.topologyRef(selected.topologyRef()))
                && ref.ownerId() == selected.ownerId()
                && ref.clusterId() == selected.clusterId()
                && ref.corridorId() == selected.corridorId()
                && ref.roomId() == selected.roomId()
                && ref.index() == selected.index();
    }

    static boolean selectedClusterLabel(
            DungeonEditorHandleSnapshot handle,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        if (selection.clusterSelection()) {
            return handle.ref().clusterId() > 0L && handle.ref().clusterId() == selection.clusterId();
        }
        return selectedHandle(handle.ref(), selection);
    }

    static boolean draggedClusterArea(
            DungeonEditorMapSnapshot.Area area,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview.MoveHandlePreview movePreview
    ) {
        long selectedClusterId = selection.clusterId() <= 0L
                ? movePreview.handleRef().clusterId()
                : selection.clusterId();
        return selectedClusterId > 0L
                && EditorElementKinds.areaKind(area) == DungeonMapRenderState.CellKind.ROOM
                && EditorProjectionFacts.clusterId(area) == selectedClusterId;
    }

    static boolean edgeTouchesAnyCell(DungeonEdgeRef edge, Set<DungeonCellRef> cells) {
        return edge != null && (cells.contains(edge.from()) || cells.contains(edge.to()));
    }

}

    private interface EditorElementKinds {

    static DungeonMapRenderState.CellKind areaKind(DungeonEditorMapSnapshot.Area area) {
        return "CORRIDOR".equalsIgnoreCase(area.kind())
                ? DungeonMapRenderState.CellKind.CORRIDOR
                : DungeonMapRenderState.CellKind.ROOM;
    }

    static DungeonMapRenderState.CellKind featureKind(DungeonEditorMapSnapshot.Feature feature) {
        return transitionFeature(feature)
                ? DungeonMapRenderState.CellKind.TRANSITION
                : DungeonMapRenderState.CellKind.STAIR;
    }

    static boolean transitionFeature(DungeonEditorMapSnapshot.Feature feature) {
        return "TRANSITION".equalsIgnoreCase(feature.kind());
    }

    static DungeonMapRenderState.EdgeKind boundaryKind(String kind) {
        return "DOOR".equalsIgnoreCase(kind) ? DungeonMapRenderState.EdgeKind.DOOR : DungeonMapRenderState.EdgeKind.WALL;
    }

    static DungeonMapRenderState.MarkerKind handleMarkerKind(DungeonEditorHandleKind kind) {
        if (kind == DungeonEditorHandleKind.DOOR) {
            return DungeonMapRenderState.MarkerKind.DOOR;
        }
        if (kind == DungeonEditorHandleKind.STAIR_ANCHOR) {
            return DungeonMapRenderState.MarkerKind.STAIR;
        }
        if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN) {
            return DungeonMapRenderState.MarkerKind.CLUSTER;
        }
        return DungeonMapRenderState.MarkerKind.WAYPOINT;
    }

}

    private record HandleMarkerPresentation(String label, double q, double r) {

        static HandleMarkerPresentation marker(DungeonEditorHandleKind kind, int q, int r) {
            return marker(kind, q, r, q, r);
        }

        static HandleMarkerPresentation marker(
                DungeonEditorHandleKind kind,
                int q,
                int r,
                double markerQ,
                double markerR
        ) {
            return new HandleMarkerPresentation(
                    label(kind),
                    markerQ(kind, q, markerQ),
                    markerR(kind, r, markerR));
        }

        static boolean hitIndexed(@Nullable DungeonEditorHandleKind kind) {
            return kind != null;
        }

        private static double markerQ(DungeonEditorHandleKind kind, int coordinate, double markerQ) {
            if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN) {
                return markerQ;
            }
            return kind == DungeonEditorHandleKind.CLUSTER_CORNER ? coordinate : coordinate + 0.5;
        }

        private static double markerR(DungeonEditorHandleKind kind, int coordinate, double markerR) {
            if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN) {
                return markerR;
            }
            return kind == DungeonEditorHandleKind.CLUSTER_CORNER ? coordinate : coordinate + 0.5;
        }

        private static String label(DungeonEditorHandleKind kind) {
            if (kind == DungeonEditorHandleKind.CLUSTER_CORNER) {
                return "+";
            }
            if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN) {
                return "-";
            }
            if (kind == DungeonEditorHandleKind.DOOR) {
                return "D";
            }
            if (kind == DungeonEditorHandleKind.STAIR_ANCHOR) {
                return "z";
            }
            if (kind == DungeonEditorHandleKind.CORRIDOR_ANCHOR) {
                return "o";
            }
            if (kind == DungeonEditorHandleKind.CORRIDOR_WAYPOINT) {
                return "•";
            }
            return "";
        }

    }

    private interface EditorProjectionFacts {

    static DungeonMapRenderState.TopologyRef areaTopologyRef(DungeonEditorMapSnapshot.Area area) {
        return topologyRef(area.topologyRef());
    }

    static DungeonMapRenderState.TopologyRef featureTopologyRef(DungeonEditorMapSnapshot.Feature feature) {
        return topologyRef(feature.topologyRef());
    }

    static long clusterId(DungeonEditorMapSnapshot.Area area) {
        return area.clusterId();
    }

    static boolean invalidEdge(@Nullable DungeonEdgeRef edge) {
        return edge == null || edge.from() == null || edge.to() == null;
    }

    static CellCenter centerOfCells(List<DungeonMapRenderState.Cell> cells) {
        double q = 0.0;
        double r = 0.0;
        for (DungeonMapRenderState.Cell cell : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        int count = Math.max(1, cells.size());
        return new CellCenter(q / count, r / count);
    }

    static DungeonEditorHandleSnapshot clusterLabelHandle(
            @Nullable List<DungeonEditorHandleSnapshot> handles,
            long clusterId
    ) {
        if (handles == null || clusterId <= 0L) {
            return null;
        }
        for (DungeonEditorHandleSnapshot handle : handles) {
            if (handle != null && handle.ref().kind().isClusterLabel() && handle.ref().clusterId() == clusterId) {
                return handle;
            }
        }
        return null;
    }

    static DungeonMapRenderState.TopologyRef topologyRef(
            src.domain.dungeon.published.DungeonEditorTopologyElementRef ref
    ) {
        return ref == null
                ? DungeonMapRenderState.TopologyRef.empty()
                : new DungeonMapRenderState.TopologyRef(ref.kind(), ref.id());
    }

    static DungeonMapRenderState.TopologyRef topologyRef(DungeonTopologyElementRef ref) {
        return ref == null
                ? DungeonMapRenderState.TopologyRef.empty()
                : new DungeonMapRenderState.TopologyRef(ref.kind().name(), ref.id());
    }

    record CellCenter(double q, double r) {
    }
}

    private static final class ProjectionAccumulator {
        private final List<DungeonMapRenderState.Cell> cells = new ArrayList<>();
        private final List<DungeonMapRenderState.Edge> edges = new ArrayList<>();
        private final List<DungeonMapRenderState.Label> labels = new ArrayList<>();
        private final List<DungeonMapRenderState.Marker> markers = new ArrayList<>();
        private final List<DungeonMapRenderState.GraphNode> graphNodes = new ArrayList<>();
        private final List<DungeonMapRenderState.GraphLink> graphLinks = new ArrayList<>();

        private void addAreas(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection
        ) {
            for (DungeonEditorMapSnapshot.Area area : map.areas()) {
                addArea(area, EditorSelectionFacts.selectedArea(area, selection));
            }
        }

        private void addArea(
                DungeonEditorMapSnapshot.Area area,
                boolean selected
        ) {
            List<DungeonMapRenderState.Cell> areaCells = new ArrayList<>();
            for (DungeonCellRef cell : area.cells()) {
                areaCells.add(EditorRenderElements.cell(area, cell, selected, false, false, 0, 0, 0));
            }
            cells.addAll(areaCells);
            if (areaCells.isEmpty()) {
                return;
            }
            EditorProjectionFacts.CellCenter center =
                    EditorProjectionFacts.centerOfCells(areaCells);
            graphNodes.add(new DungeonMapRenderState.GraphNode(
                    area.id(),
                    EditorProjectionFacts.clusterId(area),
                    area.label(),
                    center.q(),
                    center.r(),
                    selected));
            if (EditorElementKinds.areaKind(area) == DungeonMapRenderState.CellKind.ROOM) {
                labels.add(new DungeonMapRenderState.Label(
                        area.label(),
                        center.q(),
                        center.r(),
                        areaCells.getFirst().z(),
                        area.id(),
                        EditorProjectionFacts.clusterId(area),
                        EditorProjectionFacts.areaTopologyRef(area),
                        ROOM_LABEL_KIND,
                        selected,
                        false));
            }
        }

        private void addClusterLabels(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection
        ) {
            List<Long> renderedClusterIds = new ArrayList<>();
            for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
                if (!handle.ref().kind().isClusterLabel()) {
                    continue;
                }
                long clusterId = handle.ref().clusterId();
                if (clusterId <= 0L || renderedClusterIds.contains(clusterId)) {
                    continue;
                }
                renderedClusterIds.add(clusterId);
                labels.add(EditorRenderElements.clusterLabel(
                        handle,
                        EditorSelectionFacts.selectedClusterLabel(handle, selection),
                        false,
                        0,
                        0,
                        0));
            }
        }

        private void addPreviewAndBoundaries(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonEditorPreview preview,
                @Nullable DungeonEditorMapSnapshot previewMap
        ) {
            EditorPreviewProjection.addEditorPreview(cells, edges, labels, map, selection, preview, previewMap);
            for (DungeonEditorMapSnapshot.Boundary boundary : map.boundaries()) {
                if (EditorProjectionFacts.invalidEdge(boundary.edge())) {
                    continue;
                }
                edges.add(EditorRenderElements.edge(
                        boundary,
                        0,
                        0,
                        0,
                        false,
                        EditorSelectionFacts.selectedBoundary(boundary, selection)));
            }
        }

        private void addFeatures(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection
        ) {
            for (DungeonEditorMapSnapshot.Feature feature : map.features()) {
                addFeature(feature, EditorSelectionFacts.selectedFeature(feature, selection));
            }
        }

        private void addFeature(
                DungeonEditorMapSnapshot.Feature feature,
                boolean selected
        ) {
            List<DungeonMapRenderState.Cell> featureCells = new ArrayList<>();
            for (DungeonCellRef cell : feature.cells()) {
                featureCells.add(EditorRenderElements.featureCell(feature, cell, selected));
            }
            cells.addAll(featureCells);
            if (featureCells.isEmpty()) {
                return;
            }
            EditorProjectionFacts.CellCenter center =
                    EditorProjectionFacts.centerOfCells(featureCells);
            labels.add(new DungeonMapRenderState.Label(
                    feature.label(),
                    center.q(),
                    center.r(),
                    featureCells.getFirst().z(),
                    feature.id(),
                    0L,
                    EditorProjectionFacts.featureTopologyRef(feature),
                    FEATURE_LABEL_KIND,
                    selected,
                    false));
            markers.add(EditorRenderElements.featureMarker(
                    feature,
                    center,
                    featureCells.getFirst().z(),
                    selected));
        }

        private void addHandles(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonEditorPreview preview
        ) {
            for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
                if (handle.ref().kind().isClusterLabel()) {
                    continue;
                }
                markers.add(EditorRenderElements.handleMarker(handle, selection, false));
            }
            EditorPreviewProjection.addHandleMovePreview(markers, preview);
        }

        private void addPreviewMapDiff(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonEditorPreview preview,
                @Nullable DungeonEditorMapSnapshot previewMap
        ) {
            if (preview != DungeonEditorPreview.none() || previewMap == null) {
                return;
            }
            EditorPreviewDiff.addPreviewAreaDiff(cells, labels, map.areas(), previewMap.areas(), selection);
            EditorPreviewDiff.addPreviewBoundaryDiff(
                    edges,
                    map.boundaries(),
                    previewMap.boundaries(),
                    selection);
            EditorPreviewDiff.addPreviewHandleDiff(
                    markers,
                    map.editorHandles(),
                    previewMap.editorHandles(),
                    selection);
        }

        private void addFallbackGraphLinks() {
            if (!graphLinks.isEmpty() || graphNodes.size() <= 1) {
                return;
            }
            for (int index = 1; index < graphNodes.size(); index++) {
                graphLinks.add(new DungeonMapRenderState.GraphLink(
                        graphNodes.get(index - 1).id(),
                        graphNodes.get(index).id(),
                        false));
            }
        }

        private DungeonMapRenderState renderState(
                DungeonEditorSurface surface,
                DungeonEditorMapSnapshot map,
                boolean editorMode
        ) {
            return new DungeonMapRenderState(
                    surface.mapName(),
                    true,
                    map.width(),
                    map.height(),
                    DungeonMapRenderState.Topology.fromName(map.topology()),
                    DungeonMapRenderState.ViewMode.grid(),
                    DungeonMapRenderState.LevelOverlaySettings.off(),
                    0,
                    editorMode,
                    DungeonMapRenderState.selectToolLabel(),
                    "No dungeon map geometry available.",
                    List.copyOf(cells),
                    List.copyOf(edges),
                    List.copyOf(labels),
                    List.copyOf(markers),
                    List.copyOf(graphNodes),
                    List.copyOf(graphLinks),
                    null);
        }
    }

// Render-state values
    private record DungeonMapRenderState(
        String title,
        boolean projectionAvailable,
        int width,
        int height,
        DungeonMapRenderState.Topology topology,
        DungeonMapRenderState.ViewMode viewMode,
        DungeonMapRenderState.LevelOverlaySettings overlaySettings,
        int projectionLevel,
        boolean editorMode,
        String selectedTool,
        String emptyMessage,
        List<DungeonMapRenderState.Cell> cells,
        List<DungeonMapRenderState.Edge> edges,
        List<DungeonMapRenderState.Label> labels,
        List<DungeonMapRenderState.Marker> markers,
        List<DungeonMapRenderState.GraphNode> graphNodes,
        List<DungeonMapRenderState.GraphLink> graphLinks,
        DungeonMapRenderState.PartyToken partyToken
) {

    DungeonMapRenderState {
        title = normalizeTitle(title);
        width = Math.max(0, width);
        height = Math.max(0, height);
        topology = topology == null ? Topology.SQUARE : topology;
        viewMode = viewMode == null ? ViewMode.GRID : viewMode;
        overlaySettings = overlaySettings == null ? LevelOverlaySettings.defaults() : overlaySettings;
        selectedTool = normalizeTool(selectedTool);
        emptyMessage = normalizeEmptyMessage(emptyMessage, projectionAvailable);
        cells = immutableList(cells);
        edges = immutableList(edges);
        labels = immutableList(labels);
        markers = immutableList(markers);
        graphNodes = immutableList(graphNodes);
        graphLinks = immutableList(graphLinks);
    }

    String subtitle() {
        if (!projectionAvailable) {
            return "";
        }
        return width + " x " + height + " grid · z=" + projectionLevel;
    }

    String modeLabel() {
        return viewMode.label();
    }

    boolean isGraphView() {
        return viewMode == ViewMode.GRAPH;
    }

    String statusLabel() {
        return editorMode ? selectedTool : "Token auf der Karte ziehen";
    }

    String summaryLabel() {
        if (!projectionAvailable) {
            return "";
        }
        return cells.size() + " cells, " + edges.size() + " edges · " + overlaySettings.mode().label();
    }

    boolean mapLoaded() {
        return !(cells.isEmpty()
                && edges.isEmpty()
                && labels.isEmpty()
                && markers.isEmpty()
                && graphNodes.isEmpty());
    }

    String overlayMessage() {
        return mapLoaded() ? "" : emptyMessage;
    }

    DungeonMapRenderState withViewMode(ViewMode nextViewMode) {
        return new DungeonMapRenderState(
                title,
                projectionAvailable,
                width,
                height,
                topology,
                nextViewMode == null ? ViewMode.GRID : nextViewMode,
                overlaySettings,
                projectionLevel,
                editorMode,
                selectedTool,
                emptyMessage,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    DungeonMapRenderState withOverlaySettings(LevelOverlaySettings nextOverlaySettings) {
        return new DungeonMapRenderState(
                title,
                projectionAvailable,
                width,
                height,
                topology,
                viewMode,
                nextOverlaySettings == null ? LevelOverlaySettings.off() : nextOverlaySettings,
                projectionLevel,
                editorMode,
                selectedTool,
                emptyMessage,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    DungeonMapRenderState withProjectionLevel(int nextProjectionLevel) {
        return new DungeonMapRenderState(
                title,
                projectionAvailable,
                width,
                height,
                topology,
                viewMode,
                overlaySettings,
                nextProjectionLevel,
                editorMode,
                selectedTool,
                emptyMessage,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    DungeonMapRenderState withSelectedTool(String nextSelectedTool) {
        return new DungeonMapRenderState(
                title,
                projectionAvailable,
                width,
                height,
                topology,
                viewMode,
                overlaySettings,
                projectionLevel,
                editorMode,
                normalizeTool(nextSelectedTool),
                emptyMessage,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    static DungeonMapRenderState empty(String title, boolean editorMode) {
        return new DungeonMapRenderState(
                title,
                false,
                0,
                0,
                Topology.SQUARE,
                ViewMode.GRID,
                LevelOverlaySettings.off(),
                0,
                editorMode,
                selectToolLabel(),
                "No dungeon map loaded.",
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null);
    }

    enum Topology {
        SQUARE,
        HEX;

        static Topology fromPublished(DungeonTopologyKind topologyKind) {
            return topologyKind == DungeonTopologyKind.HEX ? HEX : SQUARE;
        }

        static Topology fromName(String topologyName) {
            return "HEX".equalsIgnoreCase(topologyName) ? HEX : SQUARE;
        }
    }

    enum ViewMode {
        GRID("Grid"),
        GRAPH("Graph");

        private final String label;

        ViewMode(String label) {
            this.label = label;
        }

        String label() {
            return label;
        }

        static ViewMode grid() {
            return GRID;
        }

        static ViewMode fromEditor(DungeonEditorViewMode viewMode) {
            return viewMode == DungeonEditorViewMode.GRAPH ? GRAPH : GRID;
        }
    }

    enum OverlayMode {
        OFF("Overlay: Aus"),
        NEARBY("Overlay: Nachbarn"),
        SELECTED("Overlay: Auswahl");

        private final String label;

        OverlayMode(String label) {
            this.label = label;
        }

        String label() {
            return label;
        }

        static OverlayMode fromKey(String modeKey) {
            return switch (upper(modeKey)) {
                case "NEARBY" -> NEARBY;
                case "SELECTED" -> SELECTED;
                default -> OFF;
            };
        }
    }

    enum CellKind {
        ROOM,
        CORRIDOR,
        STAIR,
        TRANSITION;
    }

    enum EdgeKind {
        WALL,
        DOOR;
    }

    enum MarkerKind {
        DOOR,
        STAIR,
        TRANSITION,
        WAYPOINT,
        CLUSTER;
    }

    enum Heading {
        NORTH(0.0, -1.0),
        EAST(1.0, 0.0),
        SOUTH(0.0, 1.0),
        WEST(-1.0, 0.0);

        private final double dx;
        private final double dy;

        Heading(double dx, double dy) {
            this.dx = dx;
            this.dy = dy;
        }

        double dx() {
            return dx;
        }

        double dy() {
            return dy;
        }

        static Heading fromEditor(DungeonTravelHeading heading) {
            if (heading == null) {
                return SOUTH;
            }
            return switch (heading) {
                case NORTH -> NORTH;
                case EAST -> EAST;
                case WEST -> WEST;
                default -> SOUTH;
            };
        }
    }

    record LevelOverlaySettings(
            DungeonMapRenderState.OverlayMode mode,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {

        LevelOverlaySettings {
            mode = mode == null ? OverlayMode.OFF : mode;
            levelRange = Math.max(1, Math.min(maximumLevelRange(), levelRange));
            opacity = Math.max(0.05, Math.min(0.95, opacity));
            selectedLevels = selectedLevels == null
                    ? List.of()
                    : selectedLevels.stream()
                            .filter(Objects::nonNull)
                            .distinct()
                            .sorted()
                            .toList();
        }

        @Override
        public List<Integer> selectedLevels() {
            return immutableList(selectedLevels);
        }

        boolean selectsLevel(int level) {
            return selectedLevels().contains(level);
        }

        static LevelOverlaySettings defaults() {
            return new LevelOverlaySettings(OverlayMode.NEARBY, defaultLevelRange(), defaultOpacity(), List.of());
        }

        static LevelOverlaySettings off() {
            return new LevelOverlaySettings(OverlayMode.OFF, defaultLevelRange(), defaultOpacity(), List.of());
        }

        private static int defaultLevelRange() {
            return 2;
        }

        private static int maximumLevelRange() {
            return 6;
        }

        private static double defaultOpacity() {
            return 0.35;
        }
    }

    record TopologyRef(String kind, long id) {

        TopologyRef {
            kind = kind == null || kind.isBlank() ? emptyKind() : kind.trim();
            id = Math.max(0L, id);
        }

        boolean isEmpty() {
            return id <= 0L || emptyKind().equals(kind);
        }

        static TopologyRef empty() {
            return new TopologyRef(emptyKind(), 0L);
        }
    }

    record MarkerHandle(
            @Nullable DungeonEditorHandleKind kind,
            DungeonMapRenderState.TopologyRef topologyRef,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index,
            int q,
            int r,
            int level,
            String direction
    ) {

        MarkerHandle {
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            index = Math.max(0, index);
            direction = direction == null ? "" : direction.trim();
        }

        String kindName() {
            return kind == null ? emptyKind() : kind.name();
        }
    }

    record Cell(
            int q,
            int r,
            int z,
            String label,
            DungeonMapRenderState.CellKind kind,
            long ownerId,
            long clusterId,
            DungeonMapRenderState.TopologyRef topologyRef,
            boolean selected,
            boolean overlay,
            boolean preview,
            boolean destructivePreview
    ) {

        Cell {
            label = label == null ? "" : label;
            kind = kind == null ? CellKind.ROOM : kind;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    record Edge(
            double startQ,
            double startR,
            double endQ,
            double endR,
            int z,
            DungeonMapRenderState.EdgeKind kind,
            String label,
            long ownerId,
            DungeonMapRenderState.TopologyRef topologyRef,
            boolean selected,
            boolean preview
    ) {

        Edge {
            kind = kind == null ? EdgeKind.WALL : kind;
            label = label == null ? "" : label;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }

        boolean isDoor() {
            return kind == EdgeKind.DOOR;
        }
    }

    record Label(
            String label,
            double q,
            double r,
            int z,
            long ownerId,
            long clusterId,
            DungeonMapRenderState.TopologyRef topologyRef,
            String labelKind,
            boolean selected,
            boolean preview
    ) {

        Label {
            label = label == null ? "" : label;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            labelKind = normalizeKind(labelKind, EMPTY_LABEL_KIND);
        }
    }

    record Marker(
            String label,
            double q,
            double r,
            int z,
            DungeonMapRenderState.MarkerKind kind,
            boolean selected,
            DungeonMapRenderState.MarkerHandle handle,
            boolean preview
    ) {

        Marker {
            label = label == null ? "" : label;
            kind = kind == null ? MarkerKind.DOOR : kind;
            handle = handle == null
                    ? new MarkerHandle(null, TopologyRef.empty(), 0L, 0L, 0L, 0L, 0, 0, 0, 0, "")
                    : handle;
        }

        boolean isDoorMarker() {
            return kind == MarkerKind.DOOR;
        }

        boolean isWallRunMarker() {
            return handle.kind() == DungeonEditorHandleKind.CLUSTER_WALL_RUN;
        }
    }

    record GraphNode(long id, long clusterId, String label, double q, double r, boolean selected) {

        GraphNode {
            label = label == null || label.isBlank() ? "Room" : label;
        }
    }

    record GraphLink(long fromId, long toId, boolean selected) {
    }

    record PartyToken(double q, double r, int z, DungeonMapRenderState.Heading heading, boolean visible) {

        PartyToken {
            heading = heading == null ? Heading.SOUTH : heading;
        }
    }

    private static String normalizeTitle(String title) {
        return title == null || title.isBlank() ? defaultTitle() : title.trim();
    }

    private static String normalizeTool(String selectedTool) {
        return selectedTool == null || selectedTool.isBlank() ? selectToolLabel() : selectedTool;
    }

    private static String selectToolLabel() {
        return "Auswahl";
    }

    private static String emptyKind() {
        return "EMPTY";
    }

    private static String normalizeEmptyMessage(String emptyMessage, boolean projectionAvailable) {
        if (emptyMessage != null && !emptyMessage.isBlank()) {
            return emptyMessage;
        }
        return projectionAvailable ? "No dungeon map geometry available." : "No dungeon map loaded.";
    }

    private static <T> List<T> immutableList(@Nullable List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static String upper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
}
