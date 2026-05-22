package src.view.slotcontent.main.dungeonmap;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import javafx.beans.InvalidationListener;
import javafx.beans.value.ChangeListener;
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
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.BoundaryPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.GlyphPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapCanvasPoint;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapCanvasPolygonPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.OverlayPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PaintStyle;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.RelationPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.RenderScene;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.Viewport;

@SuppressWarnings("PMD.CouplingBetweenObjects")
public class DungeonMapView extends BorderPane {

    private static final Object BOUND_MODEL_KEY = new Object();
    private static final Object CANVAS_STATE_LISTENER_KEY = new Object();
    private static final Object CANVAS_SIZE_LISTENER_KEY = new Object();
    private static final int[] GRID_STEPS = {1, 5, 10, 25};
    private static final Map<DungeonMapContentModel.RenderColor, Color> FX_COLOR_CACHE = new HashMap<>();
    private static final Color BACKGROUND_COLOR = color(0x12, 0x18, 0x1c, 1.0);
    private static final Color[] GRID_COLORS = {
            color(0x66, 0x77, 0x82, 0.18),
            color(0x73, 0x83, 0x90, 0.16),
            color(0x8d, 0x9c, 0xa8, 0.22),
            color(0xb1, 0xbc, 0xc5, 0.28)
    };
    private final StackPane host = new StackPane();
    private final Pane canvasLayer = new Pane();
    private final Canvas canvas = new Canvas(defaultCanvasWidth(), defaultCanvasHeight());
    private final Label overlayMessage = new Label();
    private Consumer<DungeonMapViewInputEvent> viewInputEventHandler = ignored -> {};
    private double[] polygonXBuffer = new double[0];
    private double[] polygonYBuffer = new double[0];

    public DungeonMapView() {
        getStyleClass().addAll(surfaceRootStyleClass(), dungeonMapSurfaceStyleClass());
        host.getStyleClass().add(mapWorkspaceContentStyleClass());
        host.setAlignment(Pos.CENTER);
        canvas.getStyleClass().add(dungeonMapCanvasStyleClass());
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
        removeCurrentCanvasListeners();
        if (presentationModel == null) {
            return;
        }
        ChangeListener<DungeonMapContentModel.CanvasState> canvasStateListener =
                (ignored, before, after) -> redraw(after);
        InvalidationListener canvasSizeListener = ignored -> redraw(presentationModel.currentCanvasState());
        presentationModel.canvasStateProperty().addListener(canvasStateListener);
        canvas.widthProperty().addListener(canvasSizeListener);
        canvas.heightProperty().addListener(canvasSizeListener);
        getProperties().put(BOUND_MODEL_KEY, presentationModel);
        getProperties().put(CANVAS_STATE_LISTENER_KEY, canvasStateListener);
        getProperties().put(CANVAS_SIZE_LISTENER_KEY, canvasSizeListener);
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
            emitMouseEvent(mousePressedInput(), event);
            event.consume();
            return;
        }
        if (button == MouseButton.PRIMARY) {
            emitMouseEvent(mousePressedInput(), event);
            event.consume();
            return;
        }
        if (button == MouseButton.SECONDARY) {
            event.consume();
        }
    }

    private void handleMouseDragged(MouseEvent event) {
        if (event.isPrimaryButtonDown()) {
            emitMouseEvent(mouseDraggedInput(), event);
            event.consume();
            return;
        }
        if (event.isMiddleButtonDown()) {
            emitMouseEvent(mouseDraggedInput(), event);
            event.consume();
        }
    }

    private void handleMouseMoved(MouseEvent event) {
        emitMouseEvent(mouseMovedInput(), event);
    }

    private void handleMouseReleased(MouseEvent event) {
        if (event.getButton() == MouseButton.MIDDLE || event.getButton() == MouseButton.PRIMARY) {
            emitMouseEvent(mouseReleasedInput(), event);
            event.consume();
        }
    }

    private void handleScroll(ScrollEvent event) {
        emitScrollEvent(scrolledInput(), event);
        event.consume();
    }

    private void emitScrollEvent(DungeonMapViewInputEvent.CanvasInput input, ScrollEvent event) {
        viewInputEventHandler.accept(new DungeonMapViewInputEvent(
                input,
                new DungeonMapViewInputEvent.CanvasButtons(false, false, false),
                new DungeonMapViewInputEvent.CanvasModifiers(
                        event.isControlDown(),
                        event.isShiftDown(),
                        event.isAltDown()),
                new DungeonMapViewInputEvent.CanvasPosition(event.getX(), event.getY()),
                event.getDeltaY()));
    }

    private void handleKeyPressed(KeyEvent event) {
        KeyCode code = event.getCode();
        if (code == KeyCode.ENTER || code == KeyCode.SPACE) {
            emitKeyboardEvent(mousePressedInput(), event, true, 0.0);
            emitKeyboardEvent(mouseReleasedInput(), event, false, 0.0);
            event.consume();
            return;
        }
        if (code == KeyCode.PAGE_UP || code == KeyCode.PAGE_DOWN) {
            emitKeyboardEvent(
                    scrolledInput(),
                    event,
                    false,
                    code == KeyCode.PAGE_UP ? keyboardScrollDelta() : -keyboardScrollDelta());
            event.consume();
        }
    }

    private void emitMouseEvent(DungeonMapViewInputEvent.CanvasInput input, MouseEvent event) {
        viewInputEventHandler.accept(new DungeonMapViewInputEvent(
                input,
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
            DungeonMapViewInputEvent.CanvasInput input,
            KeyEvent event,
            boolean primaryButtonDown,
            double scrollDeltaY
    ) {
        viewInputEventHandler.accept(new DungeonMapViewInputEvent(
                input,
                new DungeonMapViewInputEvent.CanvasButtons(primaryButtonDown, false, false),
                new DungeonMapViewInputEvent.CanvasModifiers(
                        event.isControlDown(),
                        event.isShiftDown(),
                        event.isAltDown()),
                new DungeonMapViewInputEvent.CanvasPosition(canvas.getWidth() / 2.0, canvas.getHeight() / 2.0),
                scrollDeltaY));
    }

    private static DungeonMapViewInputEvent.CanvasInput mousePressedInput() {
        return new DungeonMapViewInputEvent.CanvasInput(true, false, false, false, false);
    }

    private static DungeonMapViewInputEvent.CanvasInput mouseDraggedInput() {
        return new DungeonMapViewInputEvent.CanvasInput(false, true, false, false, false);
    }

    private static DungeonMapViewInputEvent.CanvasInput mouseMovedInput() {
        return new DungeonMapViewInputEvent.CanvasInput(false, false, true, false, false);
    }

    private static DungeonMapViewInputEvent.CanvasInput mouseReleasedInput() {
        return new DungeonMapViewInputEvent.CanvasInput(false, false, false, true, false);
    }

    private static DungeonMapViewInputEvent.CanvasInput scrolledInput() {
        return new DungeonMapViewInputEvent.CanvasInput(false, false, false, false, true);
    }

    private void redraw(DungeonMapContentModel.CanvasState canvasState) {
        if (canvasState == null) {
            return;
        }
        RenderScene renderScene = canvasState.renderScene();
        Viewport viewport = canvasState.viewport();
        double width = canvas.getWidth() > minimumCanvasSize() ? canvas.getWidth() : defaultCanvasWidth();
        double height = canvas.getHeight() > minimumCanvasSize() ? canvas.getHeight() : defaultCanvasHeight();
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
        overlayMessage.getStyleClass().setAll(
                renderScene.sceneLoaded() ? dungeonMapOverlayNoteStyleClass() : dungeonMapOverlayPlaceholderStyleClass());
    }

    private static double defaultCanvasWidth() {
        return 960.0;
    }

    private static double defaultCanvasHeight() {
        return 640.0;
    }

    private static double minimumCanvasSize() {
        return 1.0;
    }

    private static String surfaceRootStyleClass() {
        return "surface-root";
    }

    private static String dungeonMapSurfaceStyleClass() {
        return "dungeon-map-surface";
    }

    private static String mapWorkspaceContentStyleClass() {
        return "map-workspace-content";
    }

    private static String dungeonMapCanvasStyleClass() {
        return "dungeon-map-canvas";
    }

    private static String dungeonMapOverlayNoteStyleClass() {
        return "dungeon-map-overlay-note";
    }

    private static String dungeonMapOverlayPlaceholderStyleClass() {
        return "dungeon-map-overlay-placeholder";
    }

    private static double minimumGridPixelSpacing() {
        return 10.0;
    }

    private static double keyboardScrollDelta() {
        return 1.0;
    }

    private static double labelBaselineRatio() {
        return 0.69;
    }

    private static int minimumPolygonPoints() {
        return 3;
    }

    private static int minimumPolylinePoints() {
        return 2;
    }

    private static double roundedBoxArc() {
        return 14.0;
    }

    private static void drawGrid(
            GraphicsContext gc,
            RenderScene renderScene,
            Viewport viewport,
            double width,
            double height
    ) {
        if (!renderScene.gridView()) {
            return;
        }
        for (int index = 0; index < GRID_STEPS.length; index++) {
            int gridStep = GRID_STEPS[index];
            double spacing = viewport.gridSize() * gridStep;
            if (spacing >= minimumGridPixelSpacing()) {
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

    private void drawRelations(
            GraphicsContext gc,
            List<RelationPrimitive> relations,
            Viewport viewport
    ) {
        for (RelationPrimitive relation : relations) {
            drawPolyline(gc, relation.polyline(), relation.style(), viewport);
        }
    }

    private void drawGlyphs(
            GraphicsContext gc,
            List<GlyphPrimitive> glyphs,
            Viewport viewport
    ) {
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

    private void drawTexts(
            GraphicsContext gc,
            List<DungeonMapContentModel.TextPrimitive> texts,
            Viewport viewport
    ) {
        gc.setTextAlign(TextAlignment.CENTER);
        for (DungeonMapContentModel.TextPrimitive text : texts) {
            double width = text.width() * viewport.gridSize();
            double height = text.height() * viewport.gridSize();
            double x = viewport.sceneToScreenX(text.centerX()) - width / 2.0;
            double y = viewport.sceneToScreenY(text.centerY()) - height / 2.0;
            drawLabelBox(gc, text.style(), defaultTextColor(text.textColor()), x, y, width, height, viewport);
            gc.fillText(text.text(), viewport.sceneToScreenX(text.centerX()), y + height * labelBaselineRatio());
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
            double x = viewport.sceneToScreenX(overlay.centerX()) - width / 2.0;
            double y = viewport.sceneToScreenY(overlay.centerY()) - height / 2.0;
            drawLabelBox(gc, overlay.style(), defaultTextColor(overlay.textColor()), x, y, width, height, viewport);
            gc.fillText(overlay.text(), viewport.sceneToScreenX(overlay.centerX()), y + height * labelBaselineRatio());
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private void drawPolygon(
            GraphicsContext gc,
            List<MapCanvasPoint> points,
            PaintStyle style,
            Viewport viewport
    ) {
        if (points.size() < minimumPolygonPoints()) {
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

    private void drawPolyline(
            GraphicsContext gc,
            List<MapCanvasPoint> points,
            PaintStyle style,
            Viewport viewport
    ) {
        if (points.size() < minimumPolylinePoints()) {
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
            gc.fillRoundRect(x, y, width, height, roundedBoxArc(), roundedBoxArc());
        }
        Color stroke = fxColor(style.stroke());
        if (stroke != null && style.strokeWidth() > 0.0) {
            gc.setStroke(stroke);
            gc.strokeRoundRect(x, y, width, height, roundedBoxArc(), roundedBoxArc());
        }
        gc.setFill(textColor);
        gc.restore();
    }

    private void applyStyle(
            GraphicsContext gc,
            PaintStyle style,
            Viewport viewport
    ) {
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

    @SuppressWarnings("unchecked")
    private void removeCurrentCanvasListeners() {
        Object boundModel = getProperties().remove(BOUND_MODEL_KEY);
        Object stateListener = getProperties().remove(CANVAS_STATE_LISTENER_KEY);
        Object sizeListener = getProperties().remove(CANVAS_SIZE_LISTENER_KEY);
        if (boundModel instanceof DungeonMapContentModel model
                && stateListener instanceof ChangeListener<?> changeListener) {
            model.canvasStateProperty()
                    .removeListener((ChangeListener<? super DungeonMapContentModel.CanvasState>) changeListener);
        }
        if (sizeListener instanceof InvalidationListener listener) {
            canvas.widthProperty().removeListener(listener);
            canvas.heightProperty().removeListener(listener);
        }
    }

    private Color defaultTextColor(DungeonMapContentModel.RenderColor sceneColor) {
        if (sceneColor == null) {
            return Color.WHITE;
        }
        return fxColor(sceneColor);
    }

    private Color fxColor(DungeonMapContentModel.RenderColor sceneColor) {
        return sceneColor == null ? null : FX_COLOR_CACHE.computeIfAbsent(sceneColor, DungeonMapView::toFxColor);
    }

    private static Color toFxColor(DungeonMapContentModel.RenderColor sceneColor) {
        return new Color(
                sceneColor.redUnit(),
                sceneColor.greenUnit(),
                sceneColor.blueUnit(),
                sceneColor.alphaUnit());
    }

    private static Color color(int red, int green, int blue, double opacity) {
        return new Color(red / 255.0, green / 255.0, blue / 255.0, opacity);
    }
}
