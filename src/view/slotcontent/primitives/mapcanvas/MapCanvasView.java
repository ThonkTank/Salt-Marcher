package src.view.slotcontent.primitives.mapcanvas;

import java.util.function.Consumer;
import java.util.function.Function;
import java.util.List;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.control.Label;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.Pane;
import javafx.scene.layout.StackPane;
import javafx.scene.paint.Color;
import javafx.scene.text.TextAlignment;
import org.jspecify.annotations.Nullable;

public class MapCanvasView extends BorderPane {

    private static final double DEFAULT_WIDTH = 960.0;
    private static final double DEFAULT_HEIGHT = 640.0;
    private static final double BASE_GRID = 32.0;
    private static final double MIN_ZOOM = 0.1;
    private static final double MAX_ZOOM = 4.0;
    private static final double ZOOM_STEP_FACTOR = 1.1;
    private static final int[] GRID_STEPS = {1, 5, 10, 25};

    private final ObjectProperty<MapRenderScene> scene =
            new SimpleObjectProperty<>(MapRenderScene.empty("Map"));
    private final StackPane contentHost = new StackPane();
    private final Pane canvasLayer = new Pane();
    private final Canvas canvas = new Canvas(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    private final Label overlayMessage = new Label();
    private double panX;
    private double panY;
    private double zoom = 1.0;
    private double lastDragSceneX;
    private double lastDragSceneY;
    private boolean middleDragActive;
    private boolean primaryInteractionActive;
    private Runnable viewportChangedHandler = () -> {};
    private Function<CanvasPointerEvent, Boolean> primaryPressedHandler = ignored -> false;
    private Consumer<CanvasPointerEvent> primaryDraggedHandler = ignored -> {};
    private Consumer<CanvasPointerEvent> primaryReleasedHandler = ignored -> {};
    private Consumer<CanvasPointerEvent> pointerMovedHandler = ignored -> {};
    private Consumer<Integer> levelScrolledHandler = ignored -> {};

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public MapCanvasView() {
        getStyleClass().add("surface-root");
        setPadding(new Insets(8));
        configureLabels();
        configureContentHost();
        scene.addListener((ignored, before, after) -> redraw());
        setCenter(contentHost);
        installInteractionHandlers();
        redraw();
    }

    public final ObjectProperty<MapRenderScene> renderSceneProperty() {
        return scene;
    }

    public final double zoom() {
        return zoom;
    }

    public final void onViewportChanged(Runnable action) {
        viewportChangedHandler = action == null ? () -> {} : action;
    }

    public final void onPrimaryPressed(Function<CanvasPointerEvent, Boolean> action) {
        primaryPressedHandler = action == null ? ignored -> false : action;
    }

    public final void onPrimaryDragged(Consumer<CanvasPointerEvent> action) {
        primaryDraggedHandler = action == null ? ignored -> {} : action;
    }

    public final void onPrimaryReleased(Consumer<CanvasPointerEvent> action) {
        primaryReleasedHandler = action == null ? ignored -> {} : action;
    }

    public final void onPointerMoved(Consumer<CanvasPointerEvent> action) {
        pointerMovedHandler = action == null ? ignored -> {} : action;
    }

    public final void onLevelScrolled(Consumer<Integer> action) {
        levelScrolledHandler = action == null ? ignored -> {} : action;
    }

    public final void resetCamera() {
        panX = 0.0;
        panY = 0.0;
        zoom = 1.0;
        cameraChanged();
        canvasLayer.requestFocus();
    }

    private void configureLabels() {
        overlayMessage.getStyleClass().add("dungeon-map-overlay-placeholder");
        overlayMessage.setWrapText(true);
        overlayMessage.setMouseTransparent(true);
    }

    private void configureContentHost() {
        contentHost.getStyleClass().add("map-workspace-content");
        contentHost.setAlignment(Pos.CENTER);
        canvasLayer.setMinSize(0.0, 0.0);
        canvasLayer.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
        canvasLayer.setFocusTraversable(true);
        canvas.getStyleClass().add("dungeon-map-canvas");
        canvas.widthProperty().bind(canvasLayer.widthProperty());
        canvas.heightProperty().bind(canvasLayer.heightProperty());
        canvas.widthProperty().addListener((ignored, before, after) -> redraw());
        canvas.heightProperty().addListener((ignored, before, after) -> redraw());
        canvasLayer.getChildren().setAll(canvas);
        contentHost.getChildren().setAll(canvasLayer, overlayMessage);
        StackPane.setAlignment(canvasLayer, Pos.TOP_LEFT);
        StackPane.setAlignment(overlayMessage, Pos.CENTER);
    }

    private void installInteractionHandlers() {
        canvasLayer.addEventFilter(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
        canvasLayer.addEventFilter(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
        canvasLayer.addEventFilter(MouseEvent.MOUSE_MOVED, this::handleMouseMoved);
        canvasLayer.addEventFilter(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
        canvasLayer.addEventFilter(ScrollEvent.SCROLL, this::handleScroll);
    }

    private void handleMousePressed(MouseEvent event) {
        canvasLayer.requestFocus();
        if (event.getButton() == MouseButton.MIDDLE) {
            middleDragActive = true;
            lastDragSceneX = event.getSceneX();
            lastDragSceneY = event.getSceneY();
            event.consume();
        } else if (event.getButton() == MouseButton.PRIMARY) {
            primaryInteractionActive =
                    Boolean.TRUE.equals(primaryPressedHandler.apply(
                            pointerEvent(event, CanvasPointerEvent.PointerPhase.PRESS, true, false)));
            event.consume();
        } else if (event.getButton() == MouseButton.SECONDARY) {
            boolean secondaryHandled =
                    Boolean.TRUE.equals(primaryPressedHandler.apply(
                            pointerEvent(event, CanvasPointerEvent.PointerPhase.PRESS, false, true)));
            primaryInteractionActive = primaryInteractionActive && !secondaryHandled;
            event.consume();
        }
    }

    private void handleMouseDragged(MouseEvent event) {
        if (primaryInteractionActive) {
            primaryDraggedHandler.accept(pointerEvent(event, CanvasPointerEvent.PointerPhase.DRAG, true, false));
            event.consume();
            return;
        }
        if (!middleDragActive) {
            return;
        }
        panByPixels(event.getSceneX() - lastDragSceneX, event.getSceneY() - lastDragSceneY);
        lastDragSceneX = event.getSceneX();
        lastDragSceneY = event.getSceneY();
        cameraChanged();
        event.consume();
    }

    private void handleMouseMoved(MouseEvent event) {
        if (!middleDragActive && !primaryInteractionActive) {
            pointerMovedHandler.accept(pointerEvent(event, CanvasPointerEvent.PointerPhase.MOVE, false, false));
        }
    }

    private void handleMouseReleased(MouseEvent event) {
        if (event.getButton() == MouseButton.MIDDLE) {
            middleDragActive = false;
            event.consume();
        } else if (event.getButton() == MouseButton.PRIMARY) {
            if (primaryInteractionActive) {
                primaryReleasedHandler.accept(pointerEvent(event, CanvasPointerEvent.PointerPhase.RELEASE, true, false));
            }
            primaryInteractionActive = false;
            event.consume();
        }
    }

    private void handleScroll(ScrollEvent event) {
        if (event.isControlDown() && event.getDeltaY() != 0.0) {
            levelScrolledHandler.accept(event.getDeltaY() > 0.0 ? 1 : -1);
            cameraChanged();
            event.consume();
            return;
        }
        if (event.getDeltaY() > 0.0) {
            zoomAround(event.getX(), event.getY(), ZOOM_STEP_FACTOR);
        } else if (event.getDeltaY() < 0.0) {
            zoomAround(event.getX(), event.getY(), 1.0 / ZOOM_STEP_FACTOR);
        }
        cameraChanged();
        event.consume();
    }

    private CanvasPointerEvent pointerEvent(
            MouseEvent event,
            CanvasPointerEvent.PointerPhase phase,
            boolean primaryButtonDown,
            boolean secondaryButtonDown
    ) {
        double sceneX = screenToSceneX(event.getX());
        double sceneY = screenToSceneY(event.getY());
        MapRenderScene renderScene = scene.get() == null ? MapRenderScene.empty("Map") : scene.get();
        return new CanvasPointerEvent(
                phase,
                new CanvasPointerEvent.CanvasButtons(primaryButtonDown, secondaryButtonDown),
                new CanvasPointerEvent.CanvasModifiers(event.isControlDown(), event.isShiftDown(), event.isAltDown()),
                new CanvasPointerEvent.CanvasPoint(sceneX, sceneY),
                hit(renderScene, sceneX, sceneY));
    }

    private CanvasPointerEvent.@Nullable CanvasHit hit(MapRenderScene renderScene, double sceneX, double sceneY) {
        double tolerance = Math.max(7.0 / gridSize(), 0.22);
        CanvasPointerEvent.CanvasHit actorHit = actorHit(renderScene.actors(), sceneX, sceneY);
        if (actorHit != null) {
            return actorHit;
        }
        CanvasPointerEvent.CanvasHit glyphHit = glyphHit(renderScene.glyphs(), sceneX, sceneY);
        if (glyphHit != null) {
            return glyphHit;
        }
        CanvasPointerEvent.CanvasHit textHit = textHit(renderScene.texts(), sceneX, sceneY);
        if (textHit != null) {
            return textHit;
        }
        CanvasPointerEvent.CanvasHit boundaryHit = boundaryHit(renderScene.boundaries(), sceneX, sceneY, tolerance);
        if (boundaryHit != null) {
            return boundaryHit;
        }
        CanvasPointerEvent.CanvasHit relationHit = relationHit(renderScene.relations(), sceneX, sceneY, tolerance);
        if (relationHit != null) {
            return relationHit;
        }
        return surfaceHit(renderScene.surfaces(), sceneX, sceneY);
    }

    private static CanvasPointerEvent.@Nullable CanvasHit actorHit(
            List<MapRenderScene.ActorPrimitive> polygons,
            double sceneX,
            double sceneY
    ) {
        for (int index = polygons.size() - 1; index >= 0; index--) {
            MapRenderScene.ActorPrimitive polygon = polygons.get(index);
            if (polygon.hitRef().isBlank() || polygon.polygon().isEmpty()) {
                continue;
            }
            if (pointInPolygon(sceneX, sceneY, polygon.polygon())) {
                return new CanvasPointerEvent.CanvasHit(
                        polygon.hitRef(),
                        CanvasPointerEvent.CanvasPrimitive.ACTOR,
                        polygon.selectionRef());
            }
        }
        return null;
    }

    private static CanvasPointerEvent.@Nullable CanvasHit glyphHit(
            List<MapRenderScene.GlyphPrimitive> polygons,
            double sceneX,
            double sceneY
    ) {
        for (int index = polygons.size() - 1; index >= 0; index--) {
            MapRenderScene.GlyphPrimitive polygon = polygons.get(index);
            if (polygon.hitRef().isBlank() || polygon.polygon().isEmpty()) {
                continue;
            }
            if (pointInPolygon(sceneX, sceneY, polygon.polygon())) {
                return new CanvasPointerEvent.CanvasHit(
                        polygon.hitRef(),
                        CanvasPointerEvent.CanvasPrimitive.GLYPH,
                        polygon.selectionRef());
            }
        }
        return null;
    }

    private static CanvasPointerEvent.@Nullable CanvasHit surfaceHit(
            List<MapRenderScene.SurfacePrimitive> polygons,
            double sceneX,
            double sceneY
    ) {
        for (int index = polygons.size() - 1; index >= 0; index--) {
            MapRenderScene.SurfacePrimitive polygon = polygons.get(index);
            if (polygon.hitRef().isBlank() || polygon.polygon().isEmpty()) {
                continue;
            }
            if (pointInPolygon(sceneX, sceneY, polygon.polygon())) {
                return new CanvasPointerEvent.CanvasHit(
                        polygon.hitRef(),
                        CanvasPointerEvent.CanvasPrimitive.SURFACE,
                        polygon.selectionRef());
            }
        }
        return null;
    }

    private static CanvasPointerEvent.@Nullable CanvasHit boundaryHit(
            List<MapRenderScene.BoundaryPrimitive> lines,
            double sceneX,
            double sceneY,
            double tolerance
    ) {
        for (int index = lines.size() - 1; index >= 0; index--) {
            MapRenderScene.BoundaryPrimitive line = lines.get(index);
            if (line.hitRef().isBlank() || line.polyline().size() < 2) {
                continue;
            }
            if (distanceToPolyline(sceneX, sceneY, line.polyline()) <= tolerance) {
                return new CanvasPointerEvent.CanvasHit(
                        line.hitRef(),
                        CanvasPointerEvent.CanvasPrimitive.BOUNDARY,
                        line.selectionRef());
            }
        }
        return null;
    }

    private static CanvasPointerEvent.@Nullable CanvasHit relationHit(
            List<MapRenderScene.RelationPrimitive> lines,
            double sceneX,
            double sceneY,
            double tolerance
    ) {
        for (int index = lines.size() - 1; index >= 0; index--) {
            MapRenderScene.RelationPrimitive line = lines.get(index);
            if (line.hitRef().isBlank() || line.polyline().size() < 2) {
                continue;
            }
            if (distanceToPolyline(sceneX, sceneY, line.polyline()) <= tolerance) {
                return new CanvasPointerEvent.CanvasHit(
                        line.hitRef(),
                        CanvasPointerEvent.CanvasPrimitive.RELATION,
                        null);
            }
        }
        return null;
    }

    private static CanvasPointerEvent.@Nullable CanvasHit textHit(
            List<MapRenderScene.TextPrimitive> texts,
            double sceneX,
            double sceneY
    ) {
        for (int index = texts.size() - 1; index >= 0; index--) {
            MapRenderScene.TextPrimitive text = texts.get(index);
            if (text.hitRef().isBlank() || text.text().isBlank()) {
                continue;
            }
            double halfWidth = text.width() / 2.0;
            double halfHeight = text.height() / 2.0;
            if (sceneX >= text.centerX() - halfWidth
                    && sceneX <= text.centerX() + halfWidth
                    && sceneY >= text.centerY() - halfHeight
                    && sceneY <= text.centerY() + halfHeight) {
                return new CanvasPointerEvent.CanvasHit(
                        text.hitRef(),
                        CanvasPointerEvent.CanvasPrimitive.TEXT,
                        text.selectionRef());
            }
        }
        return null;
    }

    private void panByPixels(double deltaX, double deltaY) {
        panX += deltaX;
        panY += deltaY;
    }

    private void zoomAround(double canvasX, double canvasY, double factor) {
        double nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
        double scale = nextZoom / zoom;
        panX = canvasX - (canvasX - panX) * scale;
        panY = canvasY - (canvasY - panY) * scale;
        zoom = nextZoom;
    }

    private void cameraChanged() {
        redraw();
        viewportChangedHandler.run();
    }

    private void redraw() {
        MapRenderScene renderScene = scene.get() == null ? MapRenderScene.empty("Map") : scene.get();
        GraphicsContext gc = canvas.getGraphicsContext2D();
        gc.clearRect(0.0, 0.0, width(), height());
        fillBackground(gc);
        if (renderScene.viewMode() == MapRenderScene.ViewMode.GRID) {
            drawGrid(gc);
        }
        drawRelations(gc, renderScene.relations());
        drawSurfaces(gc, renderScene.surfaces());
        drawBoundaries(gc, renderScene.boundaries());
        drawActors(gc, renderScene.actors());
        drawGlyphs(gc, renderScene.glyphs());
        drawTexts(gc, renderScene.texts());
        drawOverlays(gc, renderScene.overlays());
        renderOverlayMessage(renderScene);
    }

    private void fillBackground(GraphicsContext gc) {
        gc.setFill(color(0x12, 0x18, 0x1c, 1.0));
        gc.fillRect(0.0, 0.0, width(), height());
    }

    private void drawGrid(GraphicsContext gc) {
        for (int index = 0; index < GRID_STEPS.length; index++) {
            int gridStep = GRID_STEPS[index];
            double pixelSpacing = gridSize() * gridStep;
            if (pixelSpacing >= 10.0) {
                drawGridTier(gc, pixelSpacing, gridColor(index), gridWidth(index));
            }
        }
    }

    private void drawGridTier(GraphicsContext gc, double spacing, Color stroke, double lineWidth) {
        gc.setStroke(stroke);
        gc.setLineWidth(lineWidth);
        double offsetX = normalizedOffset(panX, spacing);
        double offsetY = normalizedOffset(panY, spacing);
        for (double x = offsetX; x <= width(); x += spacing) {
            gc.strokeLine(x, 0.0, x, height());
        }
        for (double y = offsetY; y <= height(); y += spacing) {
            gc.strokeLine(0.0, y, width(), y);
        }
    }

    private void drawSurfaces(GraphicsContext gc, List<MapRenderScene.SurfacePrimitive> surfaces) {
        for (MapRenderScene.SurfacePrimitive surface : surfaces) {
            drawPolygon(gc, surface.polygon(), surface.style());
        }
    }

    private void drawBoundaries(GraphicsContext gc, List<MapRenderScene.BoundaryPrimitive> boundaries) {
        for (MapRenderScene.BoundaryPrimitive boundary : boundaries) {
            drawPolyline(gc, boundary.polyline(), boundary.style());
        }
    }

    private void drawGlyphs(GraphicsContext gc, List<MapRenderScene.GlyphPrimitive> glyphs) {
        gc.setTextAlign(TextAlignment.CENTER);
        for (MapRenderScene.GlyphPrimitive glyph : glyphs) {
            drawPolygon(gc, glyph.polygon(), glyph.style());
            if (!glyph.label().isBlank()) {
                MapRenderScene.ScenePoint center = polygonCenter(glyph.polygon());
                gc.setFill(glyph.labelColor());
                gc.fillText(glyph.label(), sceneToScreenX(center.x()), sceneToScreenY(center.y()) + 4.0);
            }
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private void drawActors(GraphicsContext gc, List<MapRenderScene.ActorPrimitive> actors) {
        for (MapRenderScene.ActorPrimitive actor : actors) {
            drawPolygon(gc, actor.polygon(), actor.style());
        }
    }

    private void drawTexts(GraphicsContext gc, List<MapRenderScene.TextPrimitive> texts) {
        gc.setTextAlign(TextAlignment.CENTER);
        for (MapRenderScene.TextPrimitive text : texts) {
            double x = sceneToScreenX(text.centerX()) - (text.width() * gridSize()) / 2.0;
            double y = sceneToScreenY(text.centerY()) - (text.height() * gridSize()) / 2.0;
            double width = text.width() * gridSize();
            double height = text.height() * gridSize();
            applyStyle(gc, text.style());
            if (text.style().fill() != null) {
                gc.fillRoundRect(x, y, width, height, 14.0, 14.0);
            }
            if (text.style().stroke() != null && text.style().strokeWidth() > 0.0) {
                gc.strokeRoundRect(x, y, width, height, 14.0, 14.0);
            }
            gc.setFill(text.textColor());
            gc.fillText(text.text(), sceneToScreenX(text.centerX()), y + height * 0.69);
            gc.restore();
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private void drawOverlays(GraphicsContext gc, List<MapRenderScene.OverlayPrimitive> overlays) {
        gc.setTextAlign(TextAlignment.CENTER);
        for (MapRenderScene.OverlayPrimitive overlay : overlays) {
            double x = sceneToScreenX(overlay.centerX()) - (overlay.width() * gridSize()) / 2.0;
            double y = sceneToScreenY(overlay.centerY()) - (overlay.height() * gridSize()) / 2.0;
            double width = overlay.width() * gridSize();
            double height = overlay.height() * gridSize();
            applyStyle(gc, overlay.style());
            if (overlay.style().fill() != null) {
                gc.fillRoundRect(x, y, width, height, 14.0, 14.0);
            }
            if (overlay.style().stroke() != null && overlay.style().strokeWidth() > 0.0) {
                gc.strokeRoundRect(x, y, width, height, 14.0, 14.0);
            }
            gc.setFill(overlay.textColor());
            gc.fillText(overlay.label(), sceneToScreenX(overlay.centerX()), y + height * 0.69);
            gc.restore();
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private void drawRelations(GraphicsContext gc, List<MapRenderScene.RelationPrimitive> relations) {
        for (MapRenderScene.RelationPrimitive relation : relations) {
            drawPolyline(gc, relation.polyline(), relation.style());
        }
    }

    private void drawPolygon(
            GraphicsContext gc,
            List<MapRenderScene.ScenePoint> points,
            MapRenderScene.PaintStyle style
    ) {
        if (points.size() < 3) {
            return;
        }
        double[] xPoints = new double[points.size()];
        double[] yPoints = new double[points.size()];
        for (int index = 0; index < points.size(); index++) {
            xPoints[index] = sceneToScreenX(points.get(index).x());
            yPoints[index] = sceneToScreenY(points.get(index).y());
        }
        applyStyle(gc, style);
        if (style.fill() != null) {
            gc.fillPolygon(xPoints, yPoints, xPoints.length);
        }
        if (style.stroke() != null && style.strokeWidth() > 0.0) {
            gc.strokePolygon(xPoints, yPoints, xPoints.length);
        }
        gc.restore();
    }

    private void drawPolyline(
            GraphicsContext gc,
            List<MapRenderScene.ScenePoint> points,
            MapRenderScene.PaintStyle style
    ) {
        if (points.size() < 2) {
            return;
        }
        applyStyle(gc, style);
        gc.beginPath();
        gc.moveTo(sceneToScreenX(points.get(0).x()), sceneToScreenY(points.get(0).y()));
        for (int index = 1; index < points.size(); index++) {
            gc.lineTo(sceneToScreenX(points.get(index).x()), sceneToScreenY(points.get(index).y()));
        }
        gc.stroke();
        gc.restore();
    }

    private void applyStyle(GraphicsContext gc, MapRenderScene.PaintStyle style) {
        gc.save();
        gc.setGlobalAlpha(style.alpha());
        if (style.fill() != null) {
            gc.setFill(style.fill());
        }
        if (style.stroke() != null) {
            gc.setStroke(style.stroke());
            gc.setLineWidth(style.strokeWidth() * gridSize());
        }
        if (style.dashed()) {
            gc.setLineDashes(8.0, 5.0);
        } else {
            gc.setLineDashes((double[]) null);
        }
    }

    private void renderOverlayMessage(MapRenderScene renderScene) {
        overlayMessage.getStyleClass().removeAll("dungeon-map-overlay-placeholder", "dungeon-map-overlay-note");
        overlayMessage.getStyleClass().add(
                renderScene.sceneLoaded() ? "dungeon-map-overlay-note" : "dungeon-map-overlay-placeholder");
        overlayMessage.setText(renderScene.overlayMessage());
        overlayMessage.setVisible(!renderScene.overlayMessage().isBlank());
        overlayMessage.setManaged(!renderScene.overlayMessage().isBlank());
    }

    private double width() {
        return canvas.getWidth() > 1.0 ? canvas.getWidth() : DEFAULT_WIDTH;
    }

    private double height() {
        return canvas.getHeight() > 1.0 ? canvas.getHeight() : DEFAULT_HEIGHT;
    }

    private double gridSize() {
        return BASE_GRID * zoom;
    }

    private double sceneToScreenX(double sceneX) {
        return panX + sceneX * gridSize();
    }

    private double sceneToScreenY(double sceneY) {
        return panY + sceneY * gridSize();
    }

    private double screenToSceneX(double screenX) {
        return (screenX - panX) / gridSize();
    }

    private double screenToSceneY(double screenY) {
        return (screenY - panY) / gridSize();
    }

    private double normalizedOffset(double pan, double spacing) {
        double offset = pan % spacing;
        return offset < 0.0 ? offset + spacing : offset;
    }

    private static MapRenderScene.ScenePoint polygonCenter(List<MapRenderScene.ScenePoint> polygon) {
        if (polygon.isEmpty()) {
            return new MapRenderScene.ScenePoint(0.0, 0.0);
        }
        double minX = Double.POSITIVE_INFINITY;
        double minY = Double.POSITIVE_INFINITY;
        double maxX = Double.NEGATIVE_INFINITY;
        double maxY = Double.NEGATIVE_INFINITY;
        for (MapRenderScene.ScenePoint point : polygon) {
            minX = Math.min(minX, point.x());
            minY = Math.min(minY, point.y());
            maxX = Math.max(maxX, point.x());
            maxY = Math.max(maxY, point.y());
        }
        return new MapRenderScene.ScenePoint((minX + maxX) / 2.0, (minY + maxY) / 2.0);
    }

    private static boolean pointInPolygon(double x, double y, List<MapRenderScene.ScenePoint> polygon) {
        boolean inside = false;
        for (int index = 0, previous = polygon.size() - 1; index < polygon.size(); previous = index++) {
            MapRenderScene.ScenePoint current = polygon.get(index);
            MapRenderScene.ScenePoint before = polygon.get(previous);
            boolean intersects = ((current.y() > y) != (before.y() > y))
                    && (x < (before.x() - current.x()) * (y - current.y()) / (before.y() - current.y()) + current.x());
            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static double distanceToPolyline(double x, double y, List<MapRenderScene.ScenePoint> polyline) {
        double best = Double.MAX_VALUE;
        for (int index = 1; index < polyline.size(); index++) {
            MapRenderScene.ScenePoint start = polyline.get(index - 1);
            MapRenderScene.ScenePoint end = polyline.get(index);
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
        if (lengthSquared <= 0.0) {
            return Math.hypot(pointX - startX, pointY - startY);
        }
        double projection = ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / lengthSquared;
        double clamped = Math.max(0.0, Math.min(1.0, projection));
        double nearestX = startX + clamped * deltaX;
        double nearestY = startY + clamped * deltaY;
        return Math.hypot(pointX - nearestX, pointY - nearestY);
    }

    private Color gridColor(int tier) {
        return switch (tier) {
            case 0 -> color(0x66, 0x77, 0x82, 0.18);
            case 1 -> color(0x73, 0x83, 0x90, 0.16);
            case 2 -> color(0x8d, 0x9c, 0xa8, 0.22);
            default -> color(0xb1, 0xbc, 0xc5, 0.28);
        };
    }

    private double gridWidth(int tier) {
        return switch (tier) {
            case 0 -> 0.9;
            case 1 -> 1.05;
            case 2 -> 1.4;
            default -> 1.8;
        };
    }

    private static Color color(int red, int green, int blue, double opacity) {
        return new Color(red / 255.0, green / 255.0, blue / 255.0, opacity);
    }

}
