package src.view.slotcontent.primitives.mapcanvas;

import java.util.List;
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
            Viewport viewport
    ) {

        private static CanvasState initial(RenderScene renderScene) {
            return new CanvasState(renderScene, Viewport.initial());
        }

        private CanvasState withRenderScene(RenderScene nextRenderScene) {
            return new CanvasState(nextRenderScene, viewport);
        }

        private CanvasState withViewport(Viewport nextViewport) {
            return new CanvasState(renderScene, nextViewport);
        }

        private @Nullable CanvasHit hitAt(double sceneX, double sceneY) {
            return renderScene.hitAt(sceneX, sceneY, viewport.gridSize());
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

        private @Nullable CanvasHit hitAt(double sceneX, double sceneY, double gridSize) {
            double tolerance = Math.max(HIT_TOLERANCE_PIXELS / gridSize, MIN_HIT_TOLERANCE);
            for (HitArea hitArea : hitAreas) {
                if (hitArea.matches(sceneX, sceneY, tolerance)) {
                    return new CanvasHit(
                            hitArea.hitRef(),
                            hitArea.primitive(),
                            hitArea.selectionRef().isBlank() ? null : hitArea.selectionRef());
                }
            }
            return null;
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
        public boolean matches(double sceneX, double sceneY, double tolerance) {
            return !hitRef.isBlank()
                    && polyline.size() >= MIN_POLYLINE_POINTS
                    && Geometry.distanceToPolyline(sceneX, sceneY, polyline) <= tolerance;
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
