package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.control.Label;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.Pane;
import javafx.scene.layout.StackPane;
import javafx.scene.paint.Color;
import javafx.scene.text.TextAlignment;
import static src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.*;

@SuppressWarnings("PMD.CouplingBetweenObjects")
public class DungeonMapView extends BorderPane {

    private static final String SURFACE_ROOT_STYLE = "surface-root";
    private static final String CONTENT_STYLE = "map-workspace-content";
    private static final String CANVAS_STYLE = "dungeon-map-canvas";
    private static final String OVERLAY_PLACEHOLDER_STYLE = "dungeon-map-overlay-placeholder";
    private static final String OVERLAY_NOTE_STYLE = "dungeon-map-overlay-note";
    private static final double DEFAULT_WIDTH = 960.0;
    private static final double DEFAULT_HEIGHT = 640.0;
    private static final double ZOOM_STEP_FACTOR = 1.1;
    private static final double NO_DELTA = 0.0;
    private static final double MIN_CANVAS_SIZE = 1.0;
    private static final double MIN_GRID_PIXEL_SPACING = 10.0;
    private static final double KEYBOARD_SCROLL_DELTA = 1.0;
    private static final double ROUNDED_BOX_ARC = 14.0;
    private static final double LABEL_BASELINE_RATIO = 0.69;
    private static final int MIN_POLYGON_POINTS = 3;
    private static final int MIN_POLYLINE_POINTS = 2;
    private static final int[] GRID_STEPS = {1, 5, 10, 25};
    private static final Color BACKGROUND_COLOR = color(0x12, 0x18, 0x1c, 1.0);
    private static final Color[] GRID_COLORS = {
            color(0x66, 0x77, 0x82, 0.18),
            color(0x73, 0x83, 0x90, 0.16),
            color(0x8d, 0x9c, 0xa8, 0.22),
            color(0xb1, 0xbc, 0xc5, 0.28)
    };
    private final StackPane host = new StackPane();
    private final Pane canvasLayer = new Pane();
    private final Canvas canvas = new Canvas(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    private final Label overlayMessage = new Label();
    private Consumer<DungeonMapViewInputEvent> viewInputEventHandler = ignored -> {};
    private double[] polygonXBuffer = new double[0];
    private double[] polygonYBuffer = new double[0];

    public DungeonMapView() {
        getStyleClass().add(SURFACE_ROOT_STYLE);
        setPadding(new Insets(8));
        host.getStyleClass().add(CONTENT_STYLE);
        host.setAlignment(Pos.CENTER);
        canvas.getStyleClass().add(CANVAS_STYLE);
        canvasLayer.setMinSize(0.0, 0.0);
        canvasLayer.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
        canvasLayer.setFocusTraversable(true);
        canvasLayer.setAccessibleText("Dungeon map");
        canvasLayer.setAccessibleHelp("Arrow keys move the map focus. Enter or Space activates the current target.");
        canvas.widthProperty().bind(canvasLayer.widthProperty());
        canvas.heightProperty().bind(canvasLayer.heightProperty());
        overlayMessage.setWrapText(true);
        overlayMessage.setMouseTransparent(true);
        canvasLayer.getChildren().setAll(canvas);
        host.getChildren().setAll(canvasLayer, overlayMessage);
        StackPane.setAlignment(canvasLayer, Pos.TOP_LEFT);
        StackPane.setAlignment(overlayMessage, Pos.CENTER);
        setCenter(host);
        installInputHandlers();
    }

    public void bind(DungeonMapContentModel presentationModel) {
        if (presentationModel == null) {
            return;
        }
        presentationModel.canvasStateProperty().addListener((ignored, before, after) -> redraw(after));
        redraw(presentationModel.currentCanvasState());
    }

    public void onViewInputEvent(Consumer<DungeonMapViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    private void installInputHandlers() {
        canvasLayer.setOnMousePressed(this::handleMousePressed);
        canvasLayer.setOnMouseDragged(this::handleMouseDragged);
        canvasLayer.setOnMouseMoved(this::handleMouseMoved);
        canvasLayer.setOnMouseReleased(this::handleMouseReleased);
        canvasLayer.setOnScroll(this::handleScroll);
        canvasLayer.setOnKeyPressed(this::handleKeyPressed);
    }

    private void handleMousePressed(MouseEvent event) {
        canvasLayer.requestFocus();
        MouseButton button = event.getButton();
        if (button == MouseButton.MIDDLE) {
            emitMouseEvent(event, true, false, false, false, false);
            event.consume();
            return;
        }
        if (button == MouseButton.PRIMARY) {
            emitMouseEvent(event, true, false, false, false, false);
            event.consume();
            return;
        }
        if (button == MouseButton.SECONDARY) {
            event.consume();
        }
    }

    private void handleMouseDragged(MouseEvent event) {
        if (event.isPrimaryButtonDown()) {
            emitMouseEvent(event, false, true, false, false, false);
            event.consume();
            return;
        }
        if (event.isMiddleButtonDown()) {
            emitMouseEvent(event, false, true, false, false, false);
            event.consume();
        }
    }

    private void handleMouseMoved(MouseEvent event) {
        emitMouseEvent(event, false, false, true, false, false);
    }

    private void handleMouseReleased(MouseEvent event) {
        if (event.getButton() == MouseButton.MIDDLE || event.getButton() == MouseButton.PRIMARY) {
            emitMouseEvent(event, false, false, false, true, false);
            event.consume();
        }
    }

    private void handleScroll(ScrollEvent event) {
        viewInputEventHandler.accept(new DungeonMapViewInputEvent(
                false,
                false,
                false,
                false,
                true,
                new DungeonMapViewInputEvent.CanvasButtons(false, false, false),
                new DungeonMapViewInputEvent.CanvasModifiers(
                        event.isControlDown(),
                        event.isShiftDown(),
                        event.isAltDown()),
                new DungeonMapViewInputEvent.CanvasPosition(event.getX(), event.getY()),
                event.getDeltaY()));
        event.consume();
    }

    private void handleKeyPressed(KeyEvent event) {
        KeyCode code = event.getCode();
        if (code == KeyCode.ENTER || code == KeyCode.SPACE) {
            emitKeyboardEvent(true, false, false, false, false, event, true, NO_DELTA);
            emitKeyboardEvent(false, false, false, true, false, event, false, NO_DELTA);
            event.consume();
            return;
        }
        if (code == KeyCode.PAGE_UP || code == KeyCode.PAGE_DOWN) {
            emitKeyboardEvent(
                    false,
                    false,
                    false,
                    false,
                    true,
                    event,
                    false,
                    code == KeyCode.PAGE_UP ? KEYBOARD_SCROLL_DELTA : -KEYBOARD_SCROLL_DELTA);
            event.consume();
        }
    }

    private void emitMouseEvent(
            MouseEvent event,
            boolean press,
            boolean drag,
            boolean move,
            boolean release,
            boolean scroll
    ) {
        viewInputEventHandler.accept(new DungeonMapViewInputEvent(
                press,
                drag,
                move,
                release,
                scroll,
                new DungeonMapViewInputEvent.CanvasButtons(
                        event.isPrimaryButtonDown() || event.getButton() == MouseButton.PRIMARY,
                        event.isMiddleButtonDown() || event.getButton() == MouseButton.MIDDLE,
                        event.isSecondaryButtonDown()),
                new DungeonMapViewInputEvent.CanvasModifiers(
                        event.isControlDown(),
                        event.isShiftDown(),
                        event.isAltDown()),
                new DungeonMapViewInputEvent.CanvasPosition(event.getX(), event.getY()),
                0.0));
    }

    private void emitKeyboardEvent(
            boolean press,
            boolean drag,
            boolean move,
            boolean release,
            boolean scroll,
            KeyEvent event,
            boolean primaryButtonDown,
            double scrollDeltaY
    ) {
        viewInputEventHandler.accept(new DungeonMapViewInputEvent(
                press,
                drag,
                move,
                release,
                scroll,
                new DungeonMapViewInputEvent.CanvasButtons(primaryButtonDown, false, false),
                new DungeonMapViewInputEvent.CanvasModifiers(
                        event.isControlDown(),
                        event.isShiftDown(),
                        event.isAltDown()),
                new DungeonMapViewInputEvent.CanvasPosition(canvas.getWidth() / 2.0, canvas.getHeight() / 2.0),
                scrollDeltaY));
    }

    private void redraw(DungeonMapContentModel.CanvasState canvasState) {
        if (canvasState == null) {
            return;
        }
        RenderScene renderScene = canvasState.renderScene();
        Viewport viewport = canvasState.viewport();
        double width = canvas.getWidth() > MIN_CANVAS_SIZE ? canvas.getWidth() : DEFAULT_WIDTH;
        double height = canvas.getHeight() > MIN_CANVAS_SIZE ? canvas.getHeight() : DEFAULT_HEIGHT;
        GraphicsContext gc = canvas.getGraphicsContext2D();
        gc.clearRect(0.0, 0.0, width, height);
        gc.setFill(BACKGROUND_COLOR);
        gc.fillRect(0.0, 0.0, width, height);
        drawGrid(gc, renderScene, viewport, width, height);
        drawRelations(gc, renderScene.relations(), viewport);
        drawSurfaces(gc, renderScene.surfaces(), viewport);
        drawBoundaries(gc, renderScene.boundaries(), viewport);
        drawSurfaces(gc, renderScene.actors(), viewport);
        drawGlyphs(gc, renderScene.glyphs(), viewport);
        drawTexts(gc, renderScene.texts(), viewport);
        drawOverlays(gc, renderScene.overlays(), viewport);
        overlayMessage.setText(renderScene.overlayMessage());
        overlayMessage.setVisible(!renderScene.sceneLoaded());
        overlayMessage.getStyleClass().setAll(renderScene.sceneLoaded() ? OVERLAY_NOTE_STYLE : OVERLAY_PLACEHOLDER_STYLE);
    }

    private static void drawGrid(GraphicsContext gc, RenderScene renderScene, Viewport viewport, double width, double height) {
        if (!renderScene.gridView()) {
            return;
        }
        for (int index = 0; index < GRID_STEPS.length; index++) {
            int gridStep = GRID_STEPS[index];
            double spacing = viewport.gridSize() * gridStep;
            if (spacing >= MIN_GRID_PIXEL_SPACING) {
                gc.setStroke(gridColor(index));
                gc.setLineWidth(gridWidth(index));
                double offsetX = viewport.normalizedOffset(spacing, true);
                double offsetY = viewport.normalizedOffset(spacing, false);
                for (double x = offsetX; x <= width; x += spacing) {
                    gc.strokeLine(x, 0.0, x, height);
                }
                for (double y = offsetY; y <= height; y += spacing) {
                    gc.strokeLine(0.0, y, width, y);
                }
            }
        }
    }

    private void drawSurfaces(GraphicsContext gc, List<MapCanvasPolygonPrimitive> surfaces, Viewport viewport) {
        for (MapCanvasPolygonPrimitive surface : surfaces) {
            drawPolygon(gc, surface.polygon(), surface.style(), viewport);
        }
    }

    private void drawBoundaries(GraphicsContext gc, List<BoundaryPrimitive> boundaries, Viewport viewport) {
        for (BoundaryPrimitive boundary : boundaries) {
            drawPolyline(gc, boundary.polyline(), boundary.style(), viewport);
        }
    }

    private void drawRelations(GraphicsContext gc, List<RelationPrimitive> relations, Viewport viewport) {
        for (RelationPrimitive relation : relations) {
            drawPolyline(gc, relation.polyline(), relation.style(), viewport);
        }
    }

    private void drawGlyphs(GraphicsContext gc, List<GlyphPrimitive> glyphs, Viewport viewport) {
        gc.setTextAlign(TextAlignment.CENTER);
        for (GlyphPrimitive glyph : glyphs) {
            drawPolygon(gc, glyph.polygon(), glyph.style(), viewport);
            String label = glyph.label();
            if (!label.isBlank()) {
                gc.setFill(defaultTextColor(glyph.labelColor()));
                gc.fillText(
                        label,
                        viewport.sceneToScreenX(polygonCenterX(glyph.polygon())),
                        viewport.sceneToScreenY(polygonCenterY(glyph.polygon())) + 4.0);
            }
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private void drawTexts(GraphicsContext gc, List<TextPrimitive> texts, Viewport viewport) {
        gc.setTextAlign(TextAlignment.CENTER);
        for (TextPrimitive text : texts) {
            double width = text.width() * viewport.gridSize();
            double height = text.height() * viewport.gridSize();
            double x = viewport.sceneToScreenX(text.centerX()) - width / 2.0;
            double y = viewport.sceneToScreenY(text.centerY()) - height / 2.0;
            drawLabelBox(gc, text.style(), defaultTextColor(text.textColor()), x, y, width, height, viewport);
            gc.fillText(text.text(), viewport.sceneToScreenX(text.centerX()), y + height * LABEL_BASELINE_RATIO);
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private void drawOverlays(GraphicsContext gc, List<OverlayPrimitive> overlays, Viewport viewport) {
        gc.setTextAlign(TextAlignment.CENTER);
        for (OverlayPrimitive overlay : overlays) {
            double width = overlay.width() * viewport.gridSize();
            double height = overlay.height() * viewport.gridSize();
            double x = viewport.sceneToScreenX(overlay.centerX()) - width / 2.0;
            double y = viewport.sceneToScreenY(overlay.centerY()) - height / 2.0;
            drawLabelBox(gc, overlay.style(), defaultTextColor(overlay.textColor()), x, y, width, height, viewport);
            gc.fillText(overlay.text(), viewport.sceneToScreenX(overlay.centerX()), y + height * LABEL_BASELINE_RATIO);
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private void drawPolygon(GraphicsContext gc, List<MapCanvasPoint> points, PaintStyle style, Viewport viewport) {
        if (points.size() < MIN_POLYGON_POINTS) {
            return;
        }
        ensurePolygonBufferCapacity(points.size());
        for (int index = 0; index < points.size(); index++) {
            MapCanvasPoint point = points.get(index);
            polygonXBuffer[index] = viewport.sceneToScreenX(point.x());
            polygonYBuffer[index] = viewport.sceneToScreenY(point.y());
        }
        applyStyle(gc, style, viewport);
        Color fill = fxColor(style.fill());
        if (fill != null) {
            gc.fillPolygon(polygonXBuffer, polygonYBuffer, points.size());
        }
        Color stroke = fxColor(style.stroke());
        if (stroke != null && style.strokeWidth() > 0.0) {
            gc.strokePolygon(polygonXBuffer, polygonYBuffer, points.size());
        }
        gc.restore();
    }

    private void drawPolyline(GraphicsContext gc, List<MapCanvasPoint> points, PaintStyle style, Viewport viewport) {
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
        applyStyle(gc, style, viewport);
        Color fill = fxColor(style.fill());
        if (fill != null) {
            gc.setFill(fill);
            gc.fillRoundRect(x, y, width, height, ROUNDED_BOX_ARC, ROUNDED_BOX_ARC);
        }
        Color stroke = fxColor(style.stroke());
        if (stroke != null && style.strokeWidth() > 0.0) {
            gc.setStroke(stroke);
            gc.strokeRoundRect(x, y, width, height, ROUNDED_BOX_ARC, ROUNDED_BOX_ARC);
        }
        gc.setFill(textColor);
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

    private void ensurePolygonBufferCapacity(int pointCount) {
        if (polygonXBuffer.length >= pointCount) {
            return;
        }
        polygonXBuffer = new double[pointCount];
        polygonYBuffer = new double[pointCount];
    }

    private static double polygonCenterX(List<MapCanvasPoint> points) {
        if (points.isEmpty()) {
            return 0.0;
        }
        double sumX = 0.0;
        for (MapCanvasPoint point : points) {
            sumX += point.x();
        }
        return sumX / points.size();
    }

    private static double polygonCenterY(List<MapCanvasPoint> points) {
        if (points.isEmpty()) {
            return 0.0;
        }
        double sumY = 0.0;
        for (MapCanvasPoint point : points) {
            sumY += point.y();
        }
        return sumY / points.size();
    }

    private static Color gridColor(int tier) {
        return tier >= 0 && tier < GRID_COLORS.length
                ? GRID_COLORS[tier]
                : GRID_COLORS[GRID_COLORS.length - 1];
    }

    private static double gridWidth(int tier) {
        return switch (tier) {
            case 0 -> 0.9;
            case 1 -> 1.05;
            case 2 -> 1.4;
            default -> 1.8;
        };
    }

    private Color defaultTextColor(SceneColor sceneColor) {
        if (sceneColor == null) {
            return Color.WHITE;
        }
        return fxColor(sceneColor);
    }

    private Color fxColor(SceneColor sceneColor) {
        return sceneColor == null ? null : toFxColor(sceneColor);
    }

    private static Color toFxColor(SceneColor sceneColor) {
        return new Color(
                sceneColor.red(),
                sceneColor.green(),
                sceneColor.blue(),
                sceneColor.opacity());
    }

    private static Color color(int red, int green, int blue, double opacity) {
        return new Color(red / 255.0, green / 255.0, blue / 255.0, opacity);
    }
}
