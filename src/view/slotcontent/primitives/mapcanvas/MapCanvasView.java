package src.view.slotcontent.primitives.mapcanvas;

import java.util.List;
import java.util.function.Consumer;
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
import static src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.*;

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

    private MapCanvasContentModel contentModel = new MapCanvasContentModel(DEFAULT_TITLE);
    private final SurfaceNodes surfaceNodes = new SurfaceNodes(this::redraw);
    private final Viewport viewport = new Viewport();
    private final MapSceneRenderer renderer = new MapSceneRenderer();
    private final CanvasInteractionController interactionController = new CanvasInteractionController();
    private Consumer<MapCanvasViewInputEvent> viewInputEventHandler = ignored -> {};

    public MapCanvasView() {
        getStyleClass().add(SURFACE_ROOT_STYLE);
        setPadding(new Insets(8));
        contentModel.canvasStateProperty().addListener((ignored, before, after) -> redraw());
        setCenter(surfaceNodes.host());
        interactionController.install();
        redraw();
    }

    public final void bind(MapCanvasContentModel contentModel) {
        this.contentModel = contentModel == null ? new MapCanvasContentModel(DEFAULT_TITLE) : contentModel;
        this.contentModel.canvasStateProperty().addListener((ignored, before, after) -> redraw());
        redraw();
    }

    public final void onViewInputEvent(Consumer<MapCanvasViewInputEvent> action) {
        viewInputEventHandler = action == null ? ignored -> {} : action;
    }

    private void redraw() {
        RenderScene renderScene = surfaceNodes.currentScene(contentModel.currentRenderScene());
        CanvasBounds bounds = surfaceNodes.renderBounds();
        GraphicsContext gc = surfaceNodes.graphicsContext();
        renderer.render(gc, renderScene, viewport, bounds);
        OverlayPresenter.show(surfaceNodes.overlayMessage(), renderScene);
    }

    private record CanvasBounds(double width, double height) {
    }

    private static final class SurfaceHost extends StackPane {

        private SurfaceHost() {
            getStyleClass().add(CONTENT_STYLE);
            setAlignment(Pos.CENTER);
        }

        private void installContent(Pane canvasLayer, OverlayMessage overlayMessage) {
            getChildren().setAll(canvasLayer, overlayMessage);
        }
    }

    private static final class CanvasLayer extends Pane {

        private CanvasLayer() {
            setMinSize(0.0, 0.0);
            setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
            setFocusTraversable(true);
        }

        private void installCanvas(Canvas canvas) {
            getChildren().setAll(canvas);
        }
    }

    private static final class StyledCanvas extends Canvas {

        private StyledCanvas() {
            super(DEFAULT_WIDTH, DEFAULT_HEIGHT);
            getStyleClass().add(CANVAS_STYLE);
        }
    }

    private final class SurfaceNodes {

        private final SurfaceHost host = new SurfaceHost();
        private final CanvasLayer canvasLayer = new CanvasLayer();
        private final StyledCanvas canvas = new StyledCanvas();
        private final OverlayMessage overlayMessage = new OverlayMessage();

        private SurfaceNodes(Runnable redrawAction) {
            canvas.widthProperty().bind(canvasLayer.widthProperty());
            canvas.heightProperty().bind(canvasLayer.heightProperty());
            canvas.widthProperty().addListener((ignored, before, after) -> redrawAction.run());
            canvas.heightProperty().addListener((ignored, before, after) -> redrawAction.run());
            canvasLayer.installCanvas(canvas);
            host.installContent(canvasLayer, overlayMessage);
            StackPane.setAlignment(canvasLayer, Pos.TOP_LEFT);
            StackPane.setAlignment(overlayMessage, Pos.CENTER);
        }

        private StackPane host() {
            return host;
        }

        private Pane canvasLayer() {
            return canvasLayer;
        }

        private GraphicsContext graphicsContext() {
            return canvas.getGraphicsContext2D();
        }

        private OverlayMessage overlayMessage() {
            return overlayMessage;
        }

        private void requestFocus() {
            canvasLayer.requestFocus();
        }

        private RenderScene currentScene(@Nullable RenderScene renderScene) {
            return renderScene == null ? RenderScene.empty(DEFAULT_TITLE) : renderScene;
        }

        private CanvasBounds renderBounds() {
            double currentWidth = canvas.getWidth();
            double currentHeight = canvas.getHeight();
            double renderWidth = currentWidth > MIN_CANVAS_SIZE ? currentWidth : DEFAULT_WIDTH;
            double renderHeight = currentHeight > MIN_CANVAS_SIZE ? currentHeight : DEFAULT_HEIGHT;
            return new CanvasBounds(renderWidth, renderHeight);
        }
    }

    private static final class OverlayMessage extends Label {

        private OverlayMessage() {
            getStyleClass().add(OVERLAY_PLACEHOLDER_STYLE);
            setWrapText(true);
            setMouseTransparent(true);
        }

        private void showState(boolean sceneLoaded) {
            getStyleClass().setAll(sceneLoaded ? OVERLAY_NOTE_STYLE : OVERLAY_PLACEHOLDER_STYLE);
        }
    }

    private final class CanvasInteractionController {

        private double lastDragSceneX;
        private double lastDragSceneY;
        private boolean middleDragActive;
        private boolean primaryInteractionActive;

        private void install() {
            surfaceNodes.canvasLayer().addEventFilter(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
            surfaceNodes.canvasLayer().addEventFilter(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
            surfaceNodes.canvasLayer().addEventFilter(MouseEvent.MOUSE_MOVED, this::handleMouseMoved);
            surfaceNodes.canvasLayer().addEventFilter(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
            surfaceNodes.canvasLayer().addEventFilter(ScrollEvent.SCROLL, this::handleScroll);
        }

        private void handleMousePressed(MouseEvent event) {
            surfaceNodes.requestFocus();
            MouseButton button = event.getButton();
            switch (button) {
                case MIDDLE -> {
                    middleDragActive = true;
                    lastDragSceneX = event.getSceneX();
                    lastDragSceneY = event.getSceneY();
                    emitViewInputEvent(event, MapCanvasViewInputEvent.Interaction.PRESS, 0.0, 0.0);
                    event.consume();
                }
                case PRIMARY -> {
                    primaryInteractionActive = true;
                    emitViewInputEvent(event, MapCanvasViewInputEvent.Interaction.PRESS, 0.0, 0.0);
                    event.consume();
                }
                case SECONDARY -> {
                    emitViewInputEvent(event, MapCanvasViewInputEvent.Interaction.PRESS, 0.0, 0.0);
                    event.consume();
                }
                default -> {
                }
            }
        }

        private void handleMouseDragged(MouseEvent event) {
            if (primaryInteractionActive) {
                emitViewInputEvent(event, MapCanvasViewInputEvent.Interaction.DRAG, 0.0, 0.0);
                event.consume();
                return;
            }
            if (!middleDragActive) {
                return;
            }
            emitViewInputEvent(
                    event,
                    MapCanvasViewInputEvent.Interaction.DRAG,
                    event.getSceneX() - lastDragSceneX,
                    event.getSceneY() - lastDragSceneY);
            lastDragSceneX = event.getSceneX();
            lastDragSceneY = event.getSceneY();
            event.consume();
        }

        private void handleMouseMoved(MouseEvent event) {
            if (!middleDragActive && !primaryInteractionActive) {
                emitViewInputEvent(event, MapCanvasViewInputEvent.Interaction.MOVE, 0.0, 0.0);
            }
        }

        private void handleMouseReleased(MouseEvent event) {
            MouseButton button = event.getButton();
            if (button == MouseButton.MIDDLE) {
                emitViewInputEvent(event, MapCanvasViewInputEvent.Interaction.RELEASE, 0.0, 0.0);
                middleDragActive = false;
                event.consume();
                return;
            }
            if (button == MouseButton.PRIMARY) {
                if (primaryInteractionActive) {
                    emitViewInputEvent(event, MapCanvasViewInputEvent.Interaction.RELEASE, 0.0, 0.0);
                }
                primaryInteractionActive = false;
                event.consume();
                return;
            }
            if (button == MouseButton.SECONDARY) {
                emitViewInputEvent(event, MapCanvasViewInputEvent.Interaction.RELEASE, 0.0, 0.0);
                event.consume();
            }
        }

        private void handleScroll(ScrollEvent event) {
            emitScrollInputEvent(event);
            event.consume();
        }

        private void emitViewInputEvent(
                MouseEvent event,
                MapCanvasViewInputEvent.Interaction interaction,
                double dragDeltaX,
                double dragDeltaY
        ) {
            double sceneX = viewport.screenToSceneX(event.getX());
            double sceneY = viewport.screenToSceneY(event.getY());
            RenderScene renderScene = surfaceNodes.currentScene(contentModel.currentRenderScene());
            viewInputEventHandler.accept(new MapCanvasViewInputEvent(
                    interaction,
                    new MapCanvasViewInputEvent.CanvasButtons(
                            event.isPrimaryButtonDown() || primaryInteractionActive,
                            middleDragActive,
                            event.isSecondaryButtonDown()),
                    new MapCanvasViewInputEvent.CanvasModifiers(
                            event.isControlDown(),
                            event.isShiftDown(),
                            event.isAltDown()),
                    new MapCanvasViewInputEvent.CanvasPosition(event.getX(), event.getY(), sceneX, sceneY),
                    SceneHitTester.hit(renderScene, sceneX, sceneY, viewport.gridSize()),
                    NO_DELTA,
                    dragDeltaX,
                    dragDeltaY));
        }

        private void emitScrollInputEvent(ScrollEvent event) {
            double sceneX = viewport.screenToSceneX(event.getX());
            double sceneY = viewport.screenToSceneY(event.getY());
            RenderScene renderScene = surfaceNodes.currentScene(contentModel.currentRenderScene());
            viewInputEventHandler.accept(new MapCanvasViewInputEvent(
                    MapCanvasViewInputEvent.Interaction.SCROLL,
                    new MapCanvasViewInputEvent.CanvasButtons(false, false, false),
                    new MapCanvasViewInputEvent.CanvasModifiers(
                            event.isControlDown(),
                            event.isShiftDown(),
                            event.isAltDown()),
                    new MapCanvasViewInputEvent.CanvasPosition(event.getX(), event.getY(), sceneX, sceneY),
                    SceneHitTester.hit(renderScene, sceneX, sceneY, viewport.gridSize()),
                    event.getDeltaY(),
                    0.0,
                    0.0));
        }
    }

    private final class Viewport {

        private double zoom() {
            return contentModel.currentViewport().zoom();
        }

        private void panByPixels(double deltaX, double deltaY) {
            contentModel.panByPixels(deltaX, deltaY);
        }

        private void zoomAround(double canvasX, double canvasY, double factor) {
            contentModel.zoomAround(canvasX, canvasY, factor);
        }

        private double gridSize() {
            return contentModel.currentViewport().gridSize();
        }

        private double sceneToScreenX(double sceneX) {
            return contentModel.currentViewport().sceneToScreenX(sceneX);
        }

        private double sceneToScreenY(double sceneY) {
            return contentModel.currentViewport().sceneToScreenY(sceneY);
        }

        private double screenToSceneX(double screenX) {
            return contentModel.currentViewport().screenToSceneX(screenX);
        }

        private double screenToSceneY(double screenY) {
            return contentModel.currentViewport().screenToSceneY(screenY);
        }

        private double normalizedOffset(double spacing, boolean horizontal) {
            return contentModel.currentViewport().normalizedOffset(spacing, horizontal);
        }
    }

    private static final class MapSceneRenderer {

        private final GridPainter gridPainter = new GridPainter();
        private final ShapePainter shapePainter = new ShapePainter();
        private final TextPainter textPainter = new TextPainter(shapePainter);

        private void render(
                GraphicsContext gc,
                RenderScene renderScene,
                Viewport viewport,
                CanvasBounds bounds
        ) {
            gc.clearRect(0.0, 0.0, bounds.width(), bounds.height());
            fillBackground(gc, bounds);
            if (renderScene.gridView()) {
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
                List<MapCanvasPolygonPrimitive> surfaces,
                Viewport viewport
        ) {
            for (MapCanvasPolygonPrimitive surface : surfaces) {
                drawPolygon(gc, surface.polygon(), surface.style(), viewport);
            }
        }

        private void drawBoundaries(
                GraphicsContext gc,
                List<BoundaryPrimitive> boundaries,
                Viewport viewport
        ) {
            for (BoundaryPrimitive boundary : boundaries) {
                drawPolyline(gc, boundary.polyline(), boundary.style(), viewport);
            }
        }

        private void drawActors(GraphicsContext gc, List<MapCanvasPolygonPrimitive> actors, Viewport viewport) {
            for (MapCanvasPolygonPrimitive actor : actors) {
                drawPolygon(gc, actor.polygon(), actor.style(), viewport);
            }
        }

        private void drawRelations(
                GraphicsContext gc,
                List<RelationPrimitive> relations,
                Viewport viewport
        ) {
            for (RelationPrimitive relation : relations) {
                drawPolyline(gc, relation.polyline(), relation.style(), viewport);
            }
        }

        private void drawPolygon(
                GraphicsContext gc,
                List<MapCanvasPoint> points,
                PaintStyle style,
                Viewport viewport
        ) {
            if (points.size() < MIN_POLYGON_POINTS) {
                return;
            }
            double[] xPoints = new double[points.size()];
            double[] yPoints = new double[points.size()];
            for (int index = 0; index < points.size(); index++) {
                MapCanvasPoint point = points.get(index);
                xPoints[index] = viewport.sceneToScreenX(point.x());
                yPoints[index] = viewport.sceneToScreenY(point.y());
            }
            applyStyle(gc, style, viewport);
            Color fill = fxColor(style.fill());
            if (fill != null) {
                gc.fillPolygon(xPoints, yPoints, xPoints.length);
            }
            Color stroke = fxColor(style.stroke());
            if (stroke != null && style.strokeWidth() > 0.0) {
                gc.strokePolygon(xPoints, yPoints, xPoints.length);
            }
            gc.restore();
        }

        private void drawPolyline(
                GraphicsContext gc,
                List<MapCanvasPoint> points,
                PaintStyle style,
                Viewport viewport
        ) {
            if (points.size() < MIN_POLYLINE_POINTS) {
                return;
            }
            applyStyle(gc, style, viewport);
            MapCanvasPoint first = points.get(0);
            gc.beginPath();
            gc.moveTo(viewport.sceneToScreenX(first.x()), viewport.sceneToScreenY(first.y()));
            for (int index = 1; index < points.size(); index++) {
                MapCanvasPoint point = points.get(index);
                gc.lineTo(viewport.sceneToScreenX(point.x()), viewport.sceneToScreenY(point.y()));
            }
            gc.stroke();
            gc.restore();
        }

        private void applyStyle(GraphicsContext gc, PaintStyle style, Viewport viewport) {
            gc.save();
            gc.setGlobalAlpha(style.alpha());
            Color fill = fxColor(style.fill());
            if (fill != null) {
                gc.setFill(fill);
            }
            Color stroke = fxColor(style.stroke());
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
                List<GlyphPrimitive> glyphs,
                Viewport viewport
        ) {
            gc.setTextAlign(TextAlignment.CENTER);
            for (GlyphPrimitive glyph : glyphs) {
                shapePainter.drawPolygon(gc, glyph.polygon(), glyph.style(), viewport);
                String label = glyph.label();
                if (!label.isBlank()) {
                    MapCanvasPoint center = Geometry.polygonCenter(glyph.polygon());
                    gc.setFill(defaultTextColor(glyph.labelColor()));
                    gc.fillText(
                            label,
                            viewport.sceneToScreenX(center.x()),
                            viewport.sceneToScreenY(center.y()) + 4.0);
                }
            }
            gc.setTextAlign(TextAlignment.LEFT);
        }

        private void drawTexts(GraphicsContext gc, List<TextPrimitive> texts, Viewport viewport) {
            gc.setTextAlign(TextAlignment.CENTER);
            for (TextPrimitive text : texts) {
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
                List<OverlayPrimitive> overlays,
                Viewport viewport
        ) {
            gc.setTextAlign(TextAlignment.CENTER);
            for (OverlayPrimitive overlay : overlays) {
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
                PaintStyle style,
                Color textColor,
                double x,
                double y,
                double width,
                double height,
                Viewport viewport
        ) {
            shapePainter.applyStyle(gc, style, viewport);
            Color fill = fxColor(style.fill());
            if (fill != null) {
                gc.fillRoundRect(x, y, width, height, ROUNDED_BOX_ARC, ROUNDED_BOX_ARC);
            }
            Color stroke = fxColor(style.stroke());
            if (stroke != null && style.strokeWidth() > 0.0) {
                gc.strokeRoundRect(x, y, width, height, ROUNDED_BOX_ARC, ROUNDED_BOX_ARC);
            }
            gc.setFill(textColor);
            gc.restore();
        }

        private Color defaultTextColor(@Nullable SceneColor textColor) {
            Color resolved = fxColor(textColor);
            return resolved == null ? Color.WHITE : resolved;
        }
    }

    private static final class SceneHitTester {

        private static MapCanvasViewInputEvent.CanvasHit hit(
                RenderScene renderScene,
                double sceneX,
                double sceneY,
                double gridSize
        ) {
            double tolerance = Math.max(HIT_TOLERANCE_PIXELS / gridSize, MIN_HIT_TOLERANCE);
            for (HitArea hitArea : renderScene.hitAreas()) {
                if (matches(hitArea, sceneX, sceneY, tolerance)) {
                    return new MapCanvasViewInputEvent.CanvasHit(
                            hitArea.hitRef(),
                            hitArea.primitive(),
                            hitArea.selectionRef().isBlank() ? null : hitArea.selectionRef());
                }
            }
            return null;
        }

        private static boolean matches(
                HitArea hitArea,
                double sceneX,
                double sceneY,
                double tolerance
        ) {
            if (hitArea.hitRef().isBlank()) {
                return false;
            }
            if (hitArea instanceof PolygonHitArea polygonHitArea) {
                return Geometry.pointInPolygon(sceneX, sceneY, polygonHitArea.polygon());
            }
            if (hitArea instanceof PolylineHitArea polylineHitArea) {
                return polylineHitArea.polyline().size() >= MIN_POLYLINE_POINTS
                        && Geometry.distanceToPolyline(sceneX, sceneY, polylineHitArea.polyline()) <= tolerance;
            }
            return false;
        }
    }

    private static final class Geometry {

        private static MapCanvasPoint polygonCenter(List<MapCanvasPoint> polygon) {
            if (polygon.isEmpty()) {
                return new MapCanvasPoint(0.0, 0.0);
            }
            double minX = Double.POSITIVE_INFINITY;
            double minY = Double.POSITIVE_INFINITY;
            double maxX = Double.NEGATIVE_INFINITY;
            double maxY = Double.NEGATIVE_INFINITY;
            for (MapCanvasPoint point : polygon) {
                minX = Math.min(minX, point.x());
                minY = Math.min(minY, point.y());
                maxX = Math.max(maxX, point.x());
                maxY = Math.max(maxY, point.y());
            }
            return new MapCanvasPoint((minX + maxX) / 2.0, (minY + maxY) / 2.0);
        }

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

        private static void show(OverlayMessage overlayMessage, RenderScene renderScene) {
            overlayMessage.showState(renderScene.sceneLoaded());
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

    private static @Nullable Color fxColor(@Nullable SceneColor color) {
        return color == null ? null : new Color(color.red(), color.green(), color.blue(), color.opacity());
    }
}
