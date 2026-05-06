package src.view.slotcontent.primitives.mapcanvas;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.collections.ObservableList;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
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

    private static final String DEFAULT_TITLE = "Map";
    private static final String SURFACE_ROOT_STYLE = "surface-root";
    private static final String CONTENT_STYLE = "map-workspace-content";
    private static final String CANVAS_STYLE = "dungeon-map-canvas";
    private static final String OVERLAY_PLACEHOLDER_STYLE = "dungeon-map-overlay-placeholder";
    private static final String OVERLAY_NOTE_STYLE = "dungeon-map-overlay-note";
    private static final double DEFAULT_WIDTH = 960.0;
    private static final double DEFAULT_HEIGHT = 640.0;
    private static final double BASE_GRID = 32.0;
    private static final double DEFAULT_ZOOM = 1.0;
    private static final double MIN_ZOOM = 0.1;
    private static final double MAX_ZOOM = 4.0;
    private static final double ZOOM_STEP_FACTOR = 1.1;
    private static final double NO_DELTA = 0.0;
    private static final double MIN_CANVAS_SIZE = 1.0;
    private static final double MIN_GRID_PIXEL_SPACING = 10.0;
    private static final double MIN_HIT_TOLERANCE = 0.22;
    private static final double HIT_TOLERANCE_PIXELS = 7.0;
    private static final double ROUNDED_BOX_ARC = 14.0;
    private static final double LABEL_BASELINE_RATIO = 0.69;
    private static final int MIN_POLYGON_POINTS = 3;
    private static final int MIN_POLYLINE_POINTS = 2;
    private static final int[] GRID_STEPS = {1, 5, 10, 25};

    private final ObjectProperty<MapRenderScene> scene =
            new SimpleObjectProperty<>(MapRenderScene.empty(DEFAULT_TITLE));
    private final StackPane contentHost = new StackPane();
    private final Pane canvasLayer = new Pane();
    private final Canvas canvas = new Canvas(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    private final Label overlayMessage = new Label();
    private final Viewport viewport = new Viewport();
    private final SceneHitTester hitTester = new SceneHitTester();
    private final MapSceneRenderer renderer = new MapSceneRenderer();
    private final OverlayPresenter overlayPresenter = new OverlayPresenter();
    private final CanvasInteractionController interactionController = new CanvasInteractionController();
    private Runnable viewportChangedHandler = () -> {};
    private Function<CanvasPointerEvent, Boolean> primaryPressedHandler = ignored -> false;
    private Consumer<CanvasPointerEvent> primaryDraggedHandler = ignored -> {};
    private Consumer<CanvasPointerEvent> primaryReleasedHandler = ignored -> {};
    private Consumer<CanvasPointerEvent> pointerMovedHandler = ignored -> {};
    private Consumer<Integer> levelScrolledHandler = ignored -> {};

    public MapCanvasView() {
        ObservableList<String> styles = getStyleClass();
        styles.add(SURFACE_ROOT_STYLE);
        setPadding(new Insets(8));
        configureSurface();
        scene.addListener((ignored, before, after) -> redraw());
        setCenter(contentHost);
        interactionController.install();
        redraw();
    }

    public final ObjectProperty<MapRenderScene> renderSceneProperty() {
        return scene;
    }

    public final double zoom() {
        return viewport.zoom();
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
        viewport.reset();
        cameraChanged();
        canvasLayer.requestFocus();
    }

    private void configureSurface() {
        ObservableList<String> overlayStyles = overlayMessage.getStyleClass();
        overlayStyles.add(OVERLAY_PLACEHOLDER_STYLE);
        overlayMessage.setWrapText(true);
        overlayMessage.setMouseTransparent(true);

        ObservableList<String> hostStyles = contentHost.getStyleClass();
        hostStyles.add(CONTENT_STYLE);
        contentHost.setAlignment(Pos.CENTER);

        canvasLayer.setMinSize(0.0, 0.0);
        canvasLayer.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
        canvasLayer.setFocusTraversable(true);

        ObservableList<String> canvasStyles = canvas.getStyleClass();
        canvasStyles.add(CANVAS_STYLE);
        canvas.widthProperty().bind(canvasLayer.widthProperty());
        canvas.heightProperty().bind(canvasLayer.heightProperty());
        canvas.widthProperty().addListener((ignored, before, after) -> redraw());
        canvas.heightProperty().addListener((ignored, before, after) -> redraw());

        ObservableList<Node> canvasChildren = canvasLayer.getChildren();
        canvasChildren.setAll(canvas);

        ObservableList<Node> contentChildren = contentHost.getChildren();
        contentChildren.setAll(canvasLayer, overlayMessage);
        StackPane.setAlignment(canvasLayer, Pos.TOP_LEFT);
        StackPane.setAlignment(overlayMessage, Pos.CENTER);
    }

    private void cameraChanged() {
        redraw();
        viewportChangedHandler.run();
    }

    private void redraw() {
        MapRenderScene renderScene = currentScene();
        CanvasBounds bounds = renderBounds();
        GraphicsContext gc = canvas.getGraphicsContext2D();
        renderer.render(gc, renderScene, viewport, bounds);
        overlayPresenter.show(overlayMessage, renderScene);
    }

    private MapRenderScene currentScene() {
        MapRenderScene renderScene = scene.get();
        return renderScene == null ? MapRenderScene.empty(DEFAULT_TITLE) : renderScene;
    }

    private CanvasBounds renderBounds() {
        double currentWidth = canvas.getWidth();
        double currentHeight = canvas.getHeight();
        double renderWidth = currentWidth > MIN_CANVAS_SIZE ? currentWidth : DEFAULT_WIDTH;
        double renderHeight = currentHeight > MIN_CANVAS_SIZE ? currentHeight : DEFAULT_HEIGHT;
        return new CanvasBounds(renderWidth, renderHeight);
    }

    private record CanvasBounds(double width, double height) {
    }

    private final class CanvasInteractionController {

        private double lastDragSceneX;
        private double lastDragSceneY;
        private boolean middleDragActive;
        private boolean primaryInteractionActive;

        private void install() {
            canvasLayer.addEventFilter(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
            canvasLayer.addEventFilter(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
            canvasLayer.addEventFilter(MouseEvent.MOUSE_MOVED, this::handleMouseMoved);
            canvasLayer.addEventFilter(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
            canvasLayer.addEventFilter(ScrollEvent.SCROLL, this::handleScroll);
        }

        private void handleMousePressed(MouseEvent event) {
            canvasLayer.requestFocus();
            MouseButton button = event.getButton();
            switch (button) {
                case MIDDLE -> {
                    middleDragActive = true;
                    lastDragSceneX = event.getSceneX();
                    lastDragSceneY = event.getSceneY();
                    event.consume();
                }
                case PRIMARY -> {
                    primaryInteractionActive = Boolean.TRUE.equals(primaryPressedHandler.apply(
                            pointerEvent(event, CanvasPointerEvent.PointerPhase.PRESS, true, false)));
                    event.consume();
                }
                case SECONDARY -> {
                    boolean secondaryHandled = Boolean.TRUE.equals(primaryPressedHandler.apply(
                            pointerEvent(event, CanvasPointerEvent.PointerPhase.PRESS, false, true)));
                    primaryInteractionActive = primaryInteractionActive && !secondaryHandled;
                    event.consume();
                }
                default -> {
                }
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
            viewport.panByPixels(event.getSceneX() - lastDragSceneX, event.getSceneY() - lastDragSceneY);
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
            MouseButton button = event.getButton();
            if (button == MouseButton.MIDDLE) {
                middleDragActive = false;
                event.consume();
                return;
            }
            if (button == MouseButton.PRIMARY) {
                if (primaryInteractionActive) {
                    primaryReleasedHandler.accept(pointerEvent(
                            event,
                            CanvasPointerEvent.PointerPhase.RELEASE,
                            true,
                            false));
                }
                primaryInteractionActive = false;
                event.consume();
            }
        }

        private void handleScroll(ScrollEvent event) {
            double deltaY = event.getDeltaY();
            if (event.isControlDown() && deltaY != NO_DELTA) {
                levelScrolledHandler.accept(deltaY > NO_DELTA ? 1 : -1);
                cameraChanged();
                event.consume();
                return;
            }
            if (deltaY > NO_DELTA) {
                viewport.zoomAround(event.getX(), event.getY(), ZOOM_STEP_FACTOR);
            } else if (deltaY < NO_DELTA) {
                viewport.zoomAround(event.getX(), event.getY(), 1.0 / ZOOM_STEP_FACTOR);
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
            double sceneX = viewport.screenToSceneX(event.getX());
            double sceneY = viewport.screenToSceneY(event.getY());
            MapRenderScene renderScene = currentScene();
            return new CanvasPointerEvent(
                    phase,
                    new CanvasPointerEvent.CanvasButtons(primaryButtonDown, secondaryButtonDown),
                    new CanvasPointerEvent.CanvasModifiers(
                            event.isControlDown(),
                            event.isShiftDown(),
                            event.isAltDown()),
                    new CanvasPointerEvent.CanvasPoint(sceneX, sceneY),
                    hitTester.hit(renderScene, sceneX, sceneY, viewport.gridSize()));
        }
    }

    private static final class Viewport {

        private double panX;
        private double panY;
        private double zoom = DEFAULT_ZOOM;

        private double zoom() {
            return zoom;
        }

        private void reset() {
            panX = 0.0;
            panY = 0.0;
            zoom = DEFAULT_ZOOM;
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

        private double normalizedOffset(double spacing, boolean horizontal) {
            double pan = horizontal ? panX : panY;
            double offset = pan % spacing;
            return offset < 0.0 ? offset + spacing : offset;
        }
    }

    private static final class MapSceneRenderer {

        private final GridPainter gridPainter = new GridPainter();
        private final ShapePainter shapePainter = new ShapePainter();
        private final TextPainter textPainter = new TextPainter(shapePainter);

        private void render(
                GraphicsContext gc,
                MapRenderScene renderScene,
                Viewport viewport,
                CanvasBounds bounds
        ) {
            gc.clearRect(0.0, 0.0, bounds.width(), bounds.height());
            fillBackground(gc, bounds);
            if (renderScene.viewMode() == MapRenderScene.ViewMode.GRID) {
                gridPainter.draw(gc, viewport, bounds);
            }
            shapePainter.drawRelations(gc, renderScene.relations(), viewport);
            shapePainter.drawSurfaces(gc, renderScene.surfaces(), viewport);
            shapePainter.drawBoundaries(gc, renderScene.boundaries(), viewport);
            shapePainter.drawActors(gc, renderScene.actors(), viewport);
            textPainter.drawGlyphs(gc, renderScene.glyphs(), viewport);
            textPainter.drawTexts(gc, renderScene.texts(), viewport);
            textPainter.drawOverlays(gc, renderScene.overlays(), viewport);
        }

        private void fillBackground(GraphicsContext gc, CanvasBounds bounds) {
            gc.setFill(color(0x12, 0x18, 0x1c, 1.0));
            gc.fillRect(0.0, 0.0, bounds.width(), bounds.height());
        }
    }

    private static final class GridPainter {

        private void draw(GraphicsContext gc, Viewport viewport, CanvasBounds bounds) {
            for (int index = 0; index < GRID_STEPS.length; index++) {
                int gridStep = GRID_STEPS[index];
                double pixelSpacing = viewport.gridSize() * gridStep;
                if (pixelSpacing >= MIN_GRID_PIXEL_SPACING) {
                    drawTier(gc, viewport, bounds, pixelSpacing, gridColor(index), gridWidth(index));
                }
            }
        }

        private void drawTier(
                GraphicsContext gc,
                Viewport viewport,
                CanvasBounds bounds,
                double spacing,
                Color stroke,
                double lineWidth
        ) {
            gc.setStroke(stroke);
            gc.setLineWidth(lineWidth);
            double offsetX = viewport.normalizedOffset(spacing, true);
            double offsetY = viewport.normalizedOffset(spacing, false);
            for (double x = offsetX; x <= bounds.width(); x += spacing) {
                gc.strokeLine(x, 0.0, x, bounds.height());
            }
            for (double y = offsetY; y <= bounds.height(); y += spacing) {
                gc.strokeLine(0.0, y, bounds.width(), y);
            }
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
    }

    private static final class ShapePainter {

        private void drawSurfaces(
                GraphicsContext gc,
                List<MapRenderScene.SurfacePrimitive> surfaces,
                Viewport viewport
        ) {
            for (MapRenderScene.SurfacePrimitive surface : surfaces) {
                drawPolygon(gc, surface.polygon(), surface.style(), viewport);
            }
        }

        private void drawBoundaries(
                GraphicsContext gc,
                List<MapRenderScene.BoundaryPrimitive> boundaries,
                Viewport viewport
        ) {
            for (MapRenderScene.BoundaryPrimitive boundary : boundaries) {
                drawPolyline(gc, boundary.polyline(), boundary.style(), viewport);
            }
        }

        private void drawActors(GraphicsContext gc, List<MapRenderScene.ActorPrimitive> actors, Viewport viewport) {
            for (MapRenderScene.ActorPrimitive actor : actors) {
                drawPolygon(gc, actor.polygon(), actor.style(), viewport);
            }
        }

        private void drawRelations(
                GraphicsContext gc,
                List<MapRenderScene.RelationPrimitive> relations,
                Viewport viewport
        ) {
            for (MapRenderScene.RelationPrimitive relation : relations) {
                drawPolyline(gc, relation.polyline(), relation.style(), viewport);
            }
        }

        private void drawPolygon(
                GraphicsContext gc,
                List<MapRenderScene.ScenePoint> points,
                MapRenderScene.PaintStyle style,
                Viewport viewport
        ) {
            if (points.size() < MIN_POLYGON_POINTS) {
                return;
            }
            double[] xPoints = new double[points.size()];
            double[] yPoints = new double[points.size()];
            for (int index = 0; index < points.size(); index++) {
                MapRenderScene.ScenePoint point = points.get(index);
                xPoints[index] = viewport.sceneToScreenX(point.x());
                yPoints[index] = viewport.sceneToScreenY(point.y());
            }
            applyStyle(gc, style, viewport);
            Color fill = style.fill();
            if (fill != null) {
                gc.fillPolygon(xPoints, yPoints, xPoints.length);
            }
            Color stroke = style.stroke();
            if (stroke != null && style.strokeWidth() > 0.0) {
                gc.strokePolygon(xPoints, yPoints, xPoints.length);
            }
            gc.restore();
        }

        private void drawPolyline(
                GraphicsContext gc,
                List<MapRenderScene.ScenePoint> points,
                MapRenderScene.PaintStyle style,
                Viewport viewport
        ) {
            if (points.size() < MIN_POLYLINE_POINTS) {
                return;
            }
            applyStyle(gc, style, viewport);
            MapRenderScene.ScenePoint first = points.get(0);
            gc.beginPath();
            gc.moveTo(viewport.sceneToScreenX(first.x()), viewport.sceneToScreenY(first.y()));
            for (int index = 1; index < points.size(); index++) {
                MapRenderScene.ScenePoint point = points.get(index);
                gc.lineTo(viewport.sceneToScreenX(point.x()), viewport.sceneToScreenY(point.y()));
            }
            gc.stroke();
            gc.restore();
        }

        private void applyStyle(GraphicsContext gc, MapRenderScene.PaintStyle style, Viewport viewport) {
            gc.save();
            gc.setGlobalAlpha(style.alpha());
            Color fill = style.fill();
            if (fill != null) {
                gc.setFill(fill);
            }
            Color stroke = style.stroke();
            if (stroke != null) {
                gc.setStroke(stroke);
                gc.setLineWidth(style.strokeWidth() * viewport.gridSize());
            }
            if (style.dashed()) {
                gc.setLineDashes(8.0, 5.0);
            } else {
                gc.setLineDashes();
            }
        }
    }

    private static final class TextPainter {

        private final ShapePainter shapePainter;

        private TextPainter(ShapePainter shapePainter) {
            this.shapePainter = shapePainter;
        }

        private void drawGlyphs(
                GraphicsContext gc,
                List<MapRenderScene.GlyphPrimitive> glyphs,
                Viewport viewport
        ) {
            gc.setTextAlign(TextAlignment.CENTER);
            for (MapRenderScene.GlyphPrimitive glyph : glyphs) {
                shapePainter.drawPolygon(gc, glyph.polygon(), glyph.style(), viewport);
                String label = glyph.label();
                if (!label.isBlank()) {
                    MapRenderScene.ScenePoint center = Geometry.polygonCenter(glyph.polygon());
                    gc.setFill(glyph.labelColor());
                    gc.fillText(
                            label,
                            viewport.sceneToScreenX(center.x()),
                            viewport.sceneToScreenY(center.y()) + 4.0);
                }
            }
            gc.setTextAlign(TextAlignment.LEFT);
        }

        private void drawTexts(GraphicsContext gc, List<MapRenderScene.TextPrimitive> texts, Viewport viewport) {
            gc.setTextAlign(TextAlignment.CENTER);
            for (MapRenderScene.TextPrimitive text : texts) {
                double width = text.width() * viewport.gridSize();
                double height = text.height() * viewport.gridSize();
                double x = viewport.sceneToScreenX(text.centerX()) - text.width() * viewport.gridSize() / 2.0;
                double y = viewport.sceneToScreenY(text.centerY()) - text.height() * viewport.gridSize() / 2.0;
                drawLabelBox(gc, text.style(), defaultTextColor(text.textColor()), x, y, width, height, viewport);
                gc.fillText(
                        text.text(),
                        viewport.sceneToScreenX(text.centerX()),
                        y + height * LABEL_BASELINE_RATIO);
            }
            gc.setTextAlign(TextAlignment.LEFT);
        }

        private void drawOverlays(
                GraphicsContext gc,
                List<MapRenderScene.OverlayPrimitive> overlays,
                Viewport viewport
        ) {
            gc.setTextAlign(TextAlignment.CENTER);
            for (MapRenderScene.OverlayPrimitive overlay : overlays) {
                double width = overlay.width() * viewport.gridSize();
                double height = overlay.height() * viewport.gridSize();
                double x = viewport.sceneToScreenX(overlay.centerX()) - overlay.width() * viewport.gridSize() / 2.0;
                double y = viewport.sceneToScreenY(overlay.centerY()) - overlay.height() * viewport.gridSize() / 2.0;
                drawLabelBox(
                        gc,
                        overlay.style(),
                        defaultTextColor(overlay.textColor()),
                        x,
                        y,
                        width,
                        height,
                        viewport);
                gc.fillText(
                        overlay.label(),
                        viewport.sceneToScreenX(overlay.centerX()),
                        y + height * LABEL_BASELINE_RATIO);
            }
            gc.setTextAlign(TextAlignment.LEFT);
        }

        private void drawLabelBox(
                GraphicsContext gc,
                MapRenderScene.PaintStyle style,
                Color textColor,
                double x,
                double y,
                double width,
                double height,
                Viewport viewport
        ) {
            shapePainter.applyStyle(gc, style, viewport);
            Color fill = style.fill();
            if (fill != null) {
                gc.fillRoundRect(x, y, width, height, ROUNDED_BOX_ARC, ROUNDED_BOX_ARC);
            }
            Color stroke = style.stroke();
            if (stroke != null && style.strokeWidth() > 0.0) {
                gc.strokeRoundRect(x, y, width, height, ROUNDED_BOX_ARC, ROUNDED_BOX_ARC);
            }
            gc.setFill(textColor);
            gc.restore();
        }

        private Color defaultTextColor(@Nullable Color textColor) {
            return textColor == null ? Color.WHITE : textColor;
        }
    }

    private static final class SceneHitTester {

        private CanvasPointerEvent.@Nullable CanvasHit hit(
                MapRenderScene renderScene,
                double sceneX,
                double sceneY,
                double gridSize
        ) {
            double tolerance = Math.max(HIT_TOLERANCE_PIXELS / gridSize, MIN_HIT_TOLERANCE);
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

        private CanvasPointerEvent.@Nullable CanvasHit actorHit(
                List<MapRenderScene.ActorPrimitive> polygons,
                double sceneX,
                double sceneY
        ) {
            for (int index = polygons.size() - 1; index >= 0; index--) {
                MapRenderScene.ActorPrimitive polygon = polygons.get(index);
                String hitRef = polygon.hitRef();
                List<MapRenderScene.ScenePoint> points = polygon.polygon();
                if (hitRef.isBlank() || points.isEmpty()) {
                    continue;
                }
                if (Geometry.pointInPolygon(sceneX, sceneY, points)) {
                    return new CanvasPointerEvent.CanvasHit(
                            hitRef,
                            CanvasPointerEvent.CanvasPrimitive.ACTOR,
                            polygon.selectionRef());
                }
            }
            return null;
        }

        private CanvasPointerEvent.@Nullable CanvasHit glyphHit(
                List<MapRenderScene.GlyphPrimitive> polygons,
                double sceneX,
                double sceneY
        ) {
            for (int index = polygons.size() - 1; index >= 0; index--) {
                MapRenderScene.GlyphPrimitive polygon = polygons.get(index);
                String hitRef = polygon.hitRef();
                List<MapRenderScene.ScenePoint> points = polygon.polygon();
                if (hitRef.isBlank() || points.isEmpty()) {
                    continue;
                }
                if (Geometry.pointInPolygon(sceneX, sceneY, points)) {
                    return new CanvasPointerEvent.CanvasHit(
                            hitRef,
                            CanvasPointerEvent.CanvasPrimitive.GLYPH,
                            polygon.selectionRef());
                }
            }
            return null;
        }

        private CanvasPointerEvent.@Nullable CanvasHit surfaceHit(
                List<MapRenderScene.SurfacePrimitive> polygons,
                double sceneX,
                double sceneY
        ) {
            for (int index = polygons.size() - 1; index >= 0; index--) {
                MapRenderScene.SurfacePrimitive polygon = polygons.get(index);
                String hitRef = polygon.hitRef();
                List<MapRenderScene.ScenePoint> points = polygon.polygon();
                if (hitRef.isBlank() || points.isEmpty()) {
                    continue;
                }
                if (Geometry.pointInPolygon(sceneX, sceneY, points)) {
                    return new CanvasPointerEvent.CanvasHit(
                            hitRef,
                            CanvasPointerEvent.CanvasPrimitive.SURFACE,
                            polygon.selectionRef());
                }
            }
            return null;
        }

        private CanvasPointerEvent.@Nullable CanvasHit boundaryHit(
                List<MapRenderScene.BoundaryPrimitive> lines,
                double sceneX,
                double sceneY,
                double tolerance
        ) {
            for (int index = lines.size() - 1; index >= 0; index--) {
                MapRenderScene.BoundaryPrimitive line = lines.get(index);
                String hitRef = line.hitRef();
                List<MapRenderScene.ScenePoint> polyline = line.polyline();
                if (hitRef.isBlank() || polyline.size() < MIN_POLYLINE_POINTS) {
                    continue;
                }
                if (Geometry.distanceToPolyline(sceneX, sceneY, polyline) <= tolerance) {
                    return new CanvasPointerEvent.CanvasHit(
                            hitRef,
                            CanvasPointerEvent.CanvasPrimitive.BOUNDARY,
                            line.selectionRef());
                }
            }
            return null;
        }

        private CanvasPointerEvent.@Nullable CanvasHit relationHit(
                List<MapRenderScene.RelationPrimitive> lines,
                double sceneX,
                double sceneY,
                double tolerance
        ) {
            for (int index = lines.size() - 1; index >= 0; index--) {
                MapRenderScene.RelationPrimitive line = lines.get(index);
                String hitRef = line.hitRef();
                List<MapRenderScene.ScenePoint> polyline = line.polyline();
                if (hitRef.isBlank() || polyline.size() < MIN_POLYLINE_POINTS) {
                    continue;
                }
                if (Geometry.distanceToPolyline(sceneX, sceneY, polyline) <= tolerance) {
                    return new CanvasPointerEvent.CanvasHit(
                            hitRef,
                            CanvasPointerEvent.CanvasPrimitive.RELATION,
                            null);
                }
            }
            return null;
        }

        private CanvasPointerEvent.@Nullable CanvasHit textHit(
                List<MapRenderScene.TextPrimitive> texts,
                double sceneX,
                double sceneY
        ) {
            for (int index = texts.size() - 1; index >= 0; index--) {
                MapRenderScene.TextPrimitive text = texts.get(index);
                String hitRef = text.hitRef();
                String label = text.text();
                if (hitRef.isBlank() || label.isBlank()) {
                    continue;
                }
                double halfWidth = text.width() / 2.0;
                double halfHeight = text.height() / 2.0;
                boolean insideBounds = sceneX >= text.centerX() - halfWidth
                        && sceneX <= text.centerX() + halfWidth
                        && sceneY >= text.centerY() - halfHeight
                        && sceneY <= text.centerY() + halfHeight;
                if (insideBounds) {
                    return new CanvasPointerEvent.CanvasHit(
                            hitRef,
                            CanvasPointerEvent.CanvasPrimitive.TEXT,
                            text.selectionRef());
                }
            }
            return null;
        }
    }

    private static final class Geometry {

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
            int previous = polygon.size() - 1;
            for (int index = 0; index < polygon.size(); index++) {
                MapRenderScene.ScenePoint current = polygon.get(index);
                MapRenderScene.ScenePoint before = polygon.get(previous);
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
                List<MapRenderScene.ScenePoint> polyline
        ) {
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
            if (lengthSquared <= NO_DELTA) {
                return Math.hypot(pointX - startX, pointY - startY);
            }
            double projection = ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / lengthSquared;
            double clamped = Math.max(0.0, Math.min(1.0, projection));
            double nearestX = startX + clamped * deltaX;
            double nearestY = startY + clamped * deltaY;
            return Math.hypot(pointX - nearestX, pointY - nearestY);
        }
    }

    private static final class OverlayPresenter {

        private void show(Label overlayMessage, MapRenderScene renderScene) {
            ObservableList<String> styles = overlayMessage.getStyleClass();
            styles.removeAll(OVERLAY_PLACEHOLDER_STYLE, OVERLAY_NOTE_STYLE);
            styles.add(renderScene.sceneLoaded() ? OVERLAY_NOTE_STYLE : OVERLAY_PLACEHOLDER_STYLE);
            String message = renderScene.overlayMessage();
            boolean visible = !message.isBlank();
            overlayMessage.setText(message);
            overlayMessage.setVisible(visible);
            overlayMessage.setManaged(visible);
        }
    }

    private static Color color(int red, int green, int blue, double opacity) {
        return new Color(red / 255.0, green / 255.0, blue / 255.0, opacity);
    }
}
