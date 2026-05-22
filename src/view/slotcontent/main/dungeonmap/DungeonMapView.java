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
    private static final DungeonMapViewInputEvent.CanvasInput MOUSE_PRESSED_INPUT =
            new DungeonMapViewInputEvent.CanvasInput(true, false, false, false, false);
    private static final DungeonMapViewInputEvent.CanvasInput MOUSE_DRAGGED_INPUT =
            new DungeonMapViewInputEvent.CanvasInput(false, true, false, false, false);
    private static final DungeonMapViewInputEvent.CanvasInput MOUSE_MOVED_INPUT =
            new DungeonMapViewInputEvent.CanvasInput(false, false, true, false, false);
    private static final DungeonMapViewInputEvent.CanvasInput MOUSE_RELEASED_INPUT =
            new DungeonMapViewInputEvent.CanvasInput(false, false, false, true, false);
    private static final DungeonMapViewInputEvent.CanvasInput SCROLLED_INPUT =
            new DungeonMapViewInputEvent.CanvasInput(false, false, false, false, true);
    private static final int[] GRID_STEPS = {1, 5, 10, 25};
    private static final Map<DungeonMapContentModel.RenderColor, Color> FX_COLOR_CACHE = new HashMap<>();
    private static final Color BACKGROUND_COLOR = PaintPalette.color(0x12, 0x18, 0x1c, 1.0);
    private static final Color[] GRID_COLORS = {
            PaintPalette.color(0x66, 0x77, 0x82, 0.18),
            PaintPalette.color(0x73, 0x83, 0x90, 0.16),
            PaintPalette.color(0x8d, 0x9c, 0xa8, 0.22),
            PaintPalette.color(0xb1, 0xbc, 0xc5, 0.28)
    };
    private final StackPane host = ViewChrome.createHost();
    private final Pane canvasLayer = ViewChrome.createCanvasLayer();
    private final Canvas canvas = ViewChrome.createCanvas();
    private final Label overlayMessage = ViewChrome.createOverlayMessage();
    private Consumer<DungeonMapViewInputEvent> viewInputEventHandler = ignored -> {};
    private double[] polygonXBuffer = new double[0];
    private double[] polygonYBuffer = new double[0];

    public DungeonMapView() {
        getStyleClass().addAll("surface-root", "dungeon-map-surface");
        canvas.widthProperty().bind(canvasLayer.widthProperty());
        canvas.heightProperty().bind(canvasLayer.heightProperty());
        ViewChrome.installCanvas(canvasLayer, canvas);
        ViewChrome.installHost(host, canvasLayer, overlayMessage);
        setCenter(host);
        InputEvents.install(canvasLayer, this);
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

    private void redraw(DungeonMapContentModel.CanvasState canvasState) {
        if (canvasState == null) {
            return;
        }
        RenderScene renderScene = canvasState.renderScene();
        CanvasRenderer.render(
                this,
                CanvasSurface.graphicsContext(canvas),
                renderScene,
                canvasState.viewport(),
                CanvasSurface.renderWidth(canvas),
                CanvasSurface.renderHeight(canvas));
        ViewChrome.showOverlay(overlayMessage, renderScene);
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

    @SuppressWarnings("PMD.LawOfDemeter")
    private interface InputEvents {

        static void install(Pane canvasLayer, DungeonMapView view) {
            canvasLayer.setOnMousePressed(event -> handleMousePressed(view, event));
            canvasLayer.setOnMouseDragged(event -> handleMouseDragged(view, event));
            canvasLayer.setOnMouseMoved(event -> InputSnapshots.emitMouseEvent(view, MOUSE_MOVED_INPUT, event));
            canvasLayer.setOnMouseReleased(event -> handleMouseReleased(view, event));
            canvasLayer.setOnScroll(event -> handleScroll(view, event));
            canvasLayer.setOnKeyPressed(event -> handleKeyPressed(view, event));
        }

        static void handleMousePressed(DungeonMapView view, MouseEvent event) {
            view.canvasLayer.requestFocus();
            MouseButton button = event.getButton();
            if (button == MouseButton.MIDDLE) {
                InputSnapshots.emitMouseEvent(view, MOUSE_PRESSED_INPUT, event);
                event.consume();
                return;
            }
            if (button == MouseButton.PRIMARY) {
                InputSnapshots.emitMouseEvent(view, MOUSE_PRESSED_INPUT, event);
                event.consume();
                return;
            }
            if (button == MouseButton.SECONDARY) {
                event.consume();
            }
        }

        static void handleMouseDragged(DungeonMapView view, MouseEvent event) {
            if (event.isPrimaryButtonDown()) {
                InputSnapshots.emitMouseEvent(view, MOUSE_DRAGGED_INPUT, event);
                event.consume();
                return;
            }
            if (event.isMiddleButtonDown()) {
                InputSnapshots.emitMouseEvent(view, MOUSE_DRAGGED_INPUT, event);
                event.consume();
            }
        }

        static void handleMouseReleased(DungeonMapView view, MouseEvent event) {
            if (event.getButton() == MouseButton.MIDDLE || event.getButton() == MouseButton.PRIMARY) {
                InputSnapshots.emitMouseEvent(view, MOUSE_RELEASED_INPUT, event);
                event.consume();
            }
        }

        static void handleScroll(DungeonMapView view, ScrollEvent event) {
            InputSnapshots.emitScrollEvent(view, SCROLLED_INPUT, event);
            event.consume();
        }

        static void handleKeyPressed(DungeonMapView view, KeyEvent event) {
            KeyCode code = event.getCode();
            if (code == KeyCode.ENTER || code == KeyCode.SPACE) {
                InputSnapshots.emitKeyboardEvent(view, MOUSE_PRESSED_INPUT, event, true, 0.0);
                InputSnapshots.emitKeyboardEvent(view, MOUSE_RELEASED_INPUT, event, false, 0.0);
                event.consume();
                return;
            }
            if (code == KeyCode.PAGE_UP || code == KeyCode.PAGE_DOWN) {
                InputSnapshots.emitKeyboardEvent(
                        view,
                        SCROLLED_INPUT,
                        event,
                        false,
                        code == KeyCode.PAGE_UP ? 1.0 : -1.0);
                event.consume();
            }
        }
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private interface InputSnapshots {

        static void emitScrollEvent(
                DungeonMapView view,
                DungeonMapViewInputEvent.CanvasInput input,
                ScrollEvent event
        ) {
            view.viewInputEventHandler.accept(new DungeonMapViewInputEvent(
                    input,
                    new DungeonMapViewInputEvent.CanvasButtons(false, false, false),
                    new DungeonMapViewInputEvent.CanvasModifiers(
                            event.isControlDown(),
                            event.isShiftDown(),
                            event.isAltDown()),
                    new DungeonMapViewInputEvent.CanvasPosition(event.getX(), event.getY()),
                    event.getDeltaY()));
        }

        static void emitMouseEvent(
                DungeonMapView view,
                DungeonMapViewInputEvent.CanvasInput input,
                MouseEvent event
        ) {
            view.viewInputEventHandler.accept(new DungeonMapViewInputEvent(
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

        static void emitKeyboardEvent(
                DungeonMapView view,
                DungeonMapViewInputEvent.CanvasInput input,
                KeyEvent event,
                boolean primaryButtonDown,
                double scrollDeltaY
        ) {
            view.viewInputEventHandler.accept(new DungeonMapViewInputEvent(
                    input,
                    new DungeonMapViewInputEvent.CanvasButtons(primaryButtonDown, false, false),
                    new DungeonMapViewInputEvent.CanvasModifiers(
                            event.isControlDown(),
                            event.isShiftDown(),
                            event.isAltDown()),
                    new DungeonMapViewInputEvent.CanvasPosition(
                            view.canvas.getWidth() / 2.0,
                            view.canvas.getHeight() / 2.0),
                    scrollDeltaY));
        }
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private interface ViewChrome {

        static StackPane createHost() {
            StackPane newHost = new StackPane();
            newHost.getStyleClass().add("map-workspace-content");
            newHost.setAlignment(Pos.CENTER);
            return newHost;
        }

        static Pane createCanvasLayer() {
            Pane newCanvasLayer = new Pane();
            newCanvasLayer.setMinSize(0.0, 0.0);
            newCanvasLayer.setMaxSize(Double.MAX_VALUE, Double.MAX_VALUE);
            newCanvasLayer.setFocusTraversable(true);
            newCanvasLayer.setAccessibleText("Dungeon map");
            newCanvasLayer.setAccessibleHelp(
                    "Arrow keys move the map focus. Enter or Space activates the current target.");
            return newCanvasLayer;
        }

        static Canvas createCanvas() {
            Canvas newCanvas = new Canvas(960.0, 640.0);
            newCanvas.getStyleClass().add("dungeon-map-canvas");
            return newCanvas;
        }

        static Label createOverlayMessage() {
            Label newOverlayMessage = new Label();
            newOverlayMessage.setWrapText(true);
            newOverlayMessage.setMouseTransparent(true);
            return newOverlayMessage;
        }

        static void installCanvas(Pane canvasLayer, Canvas canvas) {
            canvasLayer.getChildren().setAll(canvas);
        }

        static void installHost(StackPane host, Pane canvasLayer, Label overlayMessage) {
            host.getChildren().setAll(canvasLayer, overlayMessage);
            StackPane.setAlignment(canvasLayer, Pos.TOP_LEFT);
            StackPane.setAlignment(overlayMessage, Pos.CENTER);
        }

        static void showOverlay(Label overlayMessage, RenderScene renderScene) {
            overlayMessage.setText(renderScene.overlayMessage());
            overlayMessage.setVisible(!renderScene.sceneLoaded());
            overlayMessage.getStyleClass().setAll(renderScene.sceneLoaded()
                    ? "dungeon-map-overlay-note"
                    : "dungeon-map-overlay-placeholder");
        }
    }

    private interface CanvasSurface {

        static GraphicsContext graphicsContext(Canvas canvas) {
            return canvas.getGraphicsContext2D();
        }

        static double renderWidth(Canvas canvas) {
            double width = canvas.getWidth();
            return width > 1.0 ? width : 960.0;
        }

        static double renderHeight(Canvas canvas) {
            double height = canvas.getHeight();
            return height > 1.0 ? height : 640.0;
        }
    }

    private interface CanvasRenderer {

        static void render(
                DungeonMapView view,
                GraphicsContext gc,
                RenderScene renderScene,
                Viewport viewport,
                double width,
                double height
        ) {
            clear(gc, width, height);
            drawGrid(gc, renderScene, viewport, width, height);
            drawRelations(gc, renderScene.relations(), viewport);
            drawSurfaces(view, gc, renderScene.surfaces(), viewport);
            drawBoundaries(gc, renderScene.boundaries(), viewport);
            drawSurfaces(view, gc, renderScene.actors(), viewport);
            drawGlyphs(view, gc, renderScene.glyphs(), viewport);
            drawTexts(gc, renderScene.texts(), viewport);
            drawOverlays(gc, renderScene.overlays(), viewport);
        }

        static void clear(GraphicsContext gc, double width, double height) {
            gc.clearRect(0.0, 0.0, width, height);
            gc.setFill(BACKGROUND_COLOR);
            gc.fillRect(0.0, 0.0, width, height);
        }

        static void drawGrid(
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
                if (spacing >= 10.0) {
                    gc.setStroke(PaintPalette.gridColor(index));
                    gc.setLineWidth(PaintPalette.gridWidth(index));
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

        static void drawSurfaces(
                DungeonMapView view,
                GraphicsContext gc,
                List<MapCanvasPolygonPrimitive> surfaces,
                Viewport viewport
        ) {
            for (MapCanvasPolygonPrimitive surface : surfaces) {
                PrimitivePainter.drawPolygon(view, gc, surface.polygon(), surface.style(), viewport);
            }
        }

        static void drawBoundaries(
                GraphicsContext gc,
                List<BoundaryPrimitive> boundaries,
                Viewport viewport
        ) {
            for (BoundaryPrimitive boundary : boundaries) {
                PrimitivePainter.drawPolyline(gc, boundary.polyline(), boundary.style(), viewport);
            }
        }

        static void drawRelations(
                GraphicsContext gc,
                List<RelationPrimitive> relations,
                Viewport viewport
        ) {
            for (RelationPrimitive relation : relations) {
                PrimitivePainter.drawPolyline(gc, relation.polyline(), relation.style(), viewport);
            }
        }

        static void drawGlyphs(
                DungeonMapView view,
                GraphicsContext gc,
                List<GlyphPrimitive> glyphs,
                Viewport viewport
        ) {
            gc.setTextAlign(TextAlignment.CENTER);
            for (GlyphPrimitive glyph : glyphs) {
                PrimitivePainter.drawPolygon(view, gc, glyph.polygon(), glyph.style(), viewport);
                String label = glyph.label();
                if (!label.isBlank()) {
                    gc.setFill(PaintPalette.defaultTextColor(glyph.labelColor()));
                    gc.fillText(
                            label,
                            viewport.sceneToScreenX(PrimitivePainter.polygonCenterX(glyph.polygon())),
                            viewport.sceneToScreenY(PrimitivePainter.polygonCenterY(glyph.polygon())) + 4.0);
                }
            }
            gc.setTextAlign(TextAlignment.LEFT);
        }

        static void drawTexts(
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
                PrimitivePainter.drawLabelBox(
                        gc,
                        text.style(),
                        PaintPalette.defaultTextColor(text.textColor()),
                        x,
                        y,
                        width,
                        height,
                        viewport);
                gc.fillText(text.text(), viewport.sceneToScreenX(text.centerX()), y + height * 0.69);
            }
            gc.setTextAlign(TextAlignment.LEFT);
        }

        static void drawOverlays(
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
                PrimitivePainter.drawLabelBox(
                        gc,
                        overlay.style(),
                        PaintPalette.defaultTextColor(overlay.textColor()),
                        x,
                        y,
                        width,
                        height,
                        viewport);
                gc.fillText(overlay.text(), viewport.sceneToScreenX(overlay.centerX()), y + height * 0.69);
            }
            gc.setTextAlign(TextAlignment.LEFT);
        }
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private interface PrimitivePainter {

        static void drawPolygon(
                DungeonMapView view,
                GraphicsContext gc,
                List<MapCanvasPoint> points,
                PaintStyle style,
                Viewport viewport
        ) {
            if (points.size() < 3) {
                return;
            }
            ensurePolygonBufferCapacity(view, points.size());
            for (int index = 0; index < points.size(); index++) {
                MapCanvasPoint point = points.get(index);
                view.polygonXBuffer[index] = viewport.sceneToScreenX(point.x());
                view.polygonYBuffer[index] = viewport.sceneToScreenY(point.y());
            }
            applyStyle(gc, style, viewport);
            Color fill = PaintPalette.fxColor(style.fill());
            if (fill != null) {
                gc.fillPolygon(view.polygonXBuffer, view.polygonYBuffer, points.size());
            }
            Color stroke = PaintPalette.fxColor(style.stroke());
            if (stroke != null && style.strokeWidth() > 0.0) {
                gc.strokePolygon(view.polygonXBuffer, view.polygonYBuffer, points.size());
            }
            gc.restore();
        }

        static void drawPolyline(
                GraphicsContext gc,
                List<MapCanvasPoint> points,
                PaintStyle style,
                Viewport viewport
        ) {
            if (points.size() < 2) {
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

        static void drawLabelBox(
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
            Color fill = PaintPalette.fxColor(style.fill());
            if (fill != null) {
                gc.setFill(fill);
                gc.fillRoundRect(x, y, width, height, 14.0, 14.0);
            }
            Color stroke = PaintPalette.fxColor(style.stroke());
            if (stroke != null && style.strokeWidth() > 0.0) {
                gc.setStroke(stroke);
                gc.strokeRoundRect(x, y, width, height, 14.0, 14.0);
            }
            gc.setFill(textColor);
            gc.restore();
        }

        static void applyStyle(
                GraphicsContext gc,
                PaintStyle style,
                Viewport viewport
        ) {
            gc.save();
            gc.setGlobalAlpha(style.alpha());
            Color fill = PaintPalette.fxColor(style.fill());
            if (fill != null) {
                gc.setFill(fill);
            }
            Color stroke = PaintPalette.fxColor(style.stroke());
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

        static void ensurePolygonBufferCapacity(DungeonMapView view, int pointCount) {
            if (view.polygonXBuffer.length >= pointCount) {
                return;
            }
            view.polygonXBuffer = new double[pointCount];
            view.polygonYBuffer = new double[pointCount];
        }

        static double polygonCenterX(List<MapCanvasPoint> points) {
            if (points.isEmpty()) {
                return 0.0;
            }
            double sumX = 0.0;
            for (MapCanvasPoint point : points) {
                sumX += point.x();
            }
            return sumX / points.size();
        }

        static double polygonCenterY(List<MapCanvasPoint> points) {
            if (points.isEmpty()) {
                return 0.0;
            }
            double sumY = 0.0;
            for (MapCanvasPoint point : points) {
                sumY += point.y();
            }
            return sumY / points.size();
        }
    }

    private interface PaintPalette {

        static Color defaultTextColor(DungeonMapContentModel.RenderColor sceneColor) {
            if (sceneColor == null) {
                return Color.WHITE;
            }
            return fxColor(sceneColor);
        }

        static Color fxColor(DungeonMapContentModel.RenderColor sceneColor) {
            return sceneColor == null ? null : FX_COLOR_CACHE.computeIfAbsent(sceneColor, PaintPalette::toFxColor);
        }

        private static Color toFxColor(DungeonMapContentModel.RenderColor sceneColor) {
            return new Color(
                    sceneColor.redUnit(),
                    sceneColor.greenUnit(),
                    sceneColor.blueUnit(),
                    sceneColor.alphaUnit());
        }

        static Color gridColor(int tier) {
            return tier >= 0 && tier < GRID_COLORS.length
                    ? GRID_COLORS[tier]
                    : GRID_COLORS[GRID_COLORS.length - 1];
        }

        static double gridWidth(int tier) {
            return switch (tier) {
                case 0 -> 0.9;
                case 1 -> 1.05;
                case 2 -> 1.4;
                default -> 1.8;
            };
        }

        static Color color(int red, int green, int blue, double opacity) {
            return new Color(red / 255.0, green / 255.0, blue / 255.0, opacity);
        }
    }
}
