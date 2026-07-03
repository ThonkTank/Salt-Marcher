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
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.Pane;
import javafx.scene.layout.StackPane;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.scene.text.TextAlignment;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.BoundaryPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.GlyphPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.InlineLabelEditState;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.InlineLabelEditorPresentation;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapCanvasPoint;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapCanvasPolygonPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PaintStyle;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.RelationPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.RenderScene;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.Viewport;

public class DungeonMapView extends BorderPane {

    private static final String MAP_LABEL_STYLE_CLASS = "dungeon-map-inline-label-editor";
    private static final String MAP_LABEL_FONT_FAMILY = "SansSerif";
    private static final double MAP_LABEL_FONT_SIZE_PIXELS = 13.0;
    private static final DungeonMapViewInputEvent.CanvasInput MOUSE_PRESSED_INPUT =
            rawMousePressedInput();
    private static final DungeonMapViewInputEvent.CanvasInput MOUSE_DRAGGED_INPUT =
            rawMouseDraggedInput();
    private static final DungeonMapViewInputEvent.CanvasInput MOUSE_MOVED_INPUT =
            rawMouseMovedInput();
    private static final DungeonMapViewInputEvent.CanvasInput MOUSE_RELEASED_INPUT =
            rawMouseReleasedInput();
    private static final DungeonMapViewInputEvent.CanvasInput SCROLLED_INPUT =
            rawScrolledInput();
    private static final DungeonMapViewInputEvent.CanvasInput ESCAPE_PRESSED_INPUT =
            rawEscapePressedInput();
    private static final DungeonMapViewInputEvent.CanvasInput LABEL_EDIT_COMMITTED_INPUT =
            rawLabelEditCommittedInput();
    private static final DungeonMapViewInputEvent.CanvasInput LABEL_EDIT_CANCELLED_INPUT =
            rawLabelEditCancelledInput();
    private static final DungeonMapViewInputEvent.CanvasInput LABEL_EDIT_TEXT_CHANGED_INPUT =
            rawLabelEditTextChangedInput();
    private static final Runnable NO_CANVAS_BINDING = () -> {};
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
    private final TextField inlineLabelEditor = ViewChrome.createInlineLabelEditor();
    private final Label overlayMessage = ViewChrome.createOverlayMessage();
    private final ChangeListener<String> inlineLabelEditorTextListener =
            (ignored, before, after) -> InputSnapshots.emitLabelEditEvent(this, LABEL_EDIT_TEXT_CHANGED_INPUT, after);
    private Consumer<DungeonMapViewInputEvent> viewInputEventHandler = ignored -> {};
    private Runnable removeCanvasBinding = NO_CANVAS_BINDING;
    private double[] polygonXBuffer = new double[0];
    private double[] polygonYBuffer = new double[0];

    public DungeonMapView() {
        getStyleClass().addAll("surface-root", "dungeon-map-surface");
        canvas.widthProperty().bind(canvasLayer.widthProperty());
        canvas.heightProperty().bind(canvasLayer.heightProperty());
        ViewChrome.installCanvas(canvasLayer, canvas);
        ViewChrome.installHost(host, canvasLayer, inlineLabelEditor, overlayMessage);
        InputEvents.installInlineLabelEditor(inlineLabelEditor, this);
        setCenter(host);
        InputEvents.install(canvasLayer, this);
    }

    public void bind(DungeonMapContentModel presentationModel) {
        removeCurrentCanvasListeners();
        if (presentationModel == null) {
            return;
        }
        ChangeListener<DungeonMapContentModel.CanvasState> canvasStateListener =
                (ignored, before, after) -> {
                    redraw(after, presentationModel);
                    showInlineLabelEditor(presentationModel.currentInlineLabelEditorPresentation(), true);
                };
        ChangeListener<InlineLabelEditState> inlineLabelEditListener =
                (ignored, before, after) -> {
                    showInlineLabelEditor(
                            presentationModel.currentInlineLabelEditorPresentation(),
                            preservesInlineLabelEditorSelection(before, after));
                    if (activatesInlineLabelEditor(before, after)) {
                        focusInlineLabelEditor();
                    }
                };
        InvalidationListener canvasSizeListener = ignored -> {
            redraw(presentationModel.currentCanvasState(), presentationModel);
            showInlineLabelEditor(presentationModel.currentInlineLabelEditorPresentation(), true);
        };
        presentationModel.canvasStateProperty().addListener(canvasStateListener);
        presentationModel.inlineLabelEditStateProperty().addListener(inlineLabelEditListener);
        canvas.widthProperty().addListener(canvasSizeListener);
        canvas.heightProperty().addListener(canvasSizeListener);
        removeCanvasBinding = () -> {
            presentationModel.canvasStateProperty().removeListener(canvasStateListener);
            presentationModel.inlineLabelEditStateProperty().removeListener(inlineLabelEditListener);
            canvas.widthProperty().removeListener(canvasSizeListener);
            canvas.heightProperty().removeListener(canvasSizeListener);
        };
        redraw(presentationModel.currentCanvasState(), presentationModel);
        showInlineLabelEditor(presentationModel.currentInlineLabelEditorPresentation(), false);
    }

    public void onViewInputEvent(Consumer<DungeonMapViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    private void redraw(
            DungeonMapContentModel.CanvasState canvasState,
            DungeonMapContentModel measurementSink
    ) {
        if (canvasState == null) {
            return;
        }
        long startedNanos = System.nanoTime();
        try {
            CanvasRenderer.render(
                    this,
                    CanvasSurface.graphicsContext(canvas),
                    canvasState,
                    CanvasSurface.renderWidth(canvas),
                CanvasSurface.renderHeight(canvas));
        } finally {
            if (measurementSink != null) {
                measurementSink.recordCanvasRedraw(System.nanoTime() - startedNanos);
            }
        }
        ViewChrome.showOverlay(overlayMessage, canvasState);
    }

    private void removeCurrentCanvasListeners() {
        removeCanvasBinding.run();
        removeCanvasBinding = NO_CANVAS_BINDING;
    }

    private void requestCanvasFocus() {
        canvasLayer.requestFocus();
    }

    private void emitInput(DungeonMapViewInputEvent inputEvent) {
        viewInputEventHandler.accept(inputEvent);
    }

    private void showInlineLabelEditor(
            InlineLabelEditorPresentation presentation,
            boolean preserveSelection
    ) {
        inlineLabelEditor.resizeRelocate(
                presentation.screenX(),
                presentation.screenY(),
                presentation.width(),
                presentation.height());
        setInlineLabelEditorText(presentation.text(), preserveSelection);
        inlineLabelEditor.setRotate(presentation.rotationDegrees());
        inlineLabelEditor.setVisible(presentation.visible());
        inlineLabelEditor.setManaged(false);
    }

    private void setInlineLabelEditorText(String text, boolean preserveSelection) {
        String safeText = text == null ? "" : text;
        if (safeText.equals(inlineLabelEditor.getText())) {
            return;
        }
        int anchor = inlineLabelEditor.getAnchor();
        int caret = inlineLabelEditor.getCaretPosition();
        inlineLabelEditor.textProperty().removeListener(inlineLabelEditorTextListener);
        try {
            inlineLabelEditor.setText(safeText);
        } finally {
            inlineLabelEditor.textProperty().addListener(inlineLabelEditorTextListener);
        }
        if (preserveSelection) {
            selectClampedInlineLabelEditorRange(anchor, caret);
        }
    }

    private void selectClampedInlineLabelEditorRange(int anchor, int caret) {
        int textLength = inlineLabelEditor.getLength();
        inlineLabelEditor.selectRange(
                clampSelectionIndex(anchor, textLength),
                clampSelectionIndex(caret, textLength));
    }

    private static int clampSelectionIndex(int index, int textLength) {
        return Math.max(0, Math.min(index, textLength));
    }

    private static DungeonMapViewInputEvent.CanvasInput rawMousePressedInput() {
        return new DungeonMapViewInputEvent.CanvasInput(
                true, false, false, false, false, false, false, false, false, false);
    }

    private static DungeonMapViewInputEvent.CanvasInput rawMouseDraggedInput() {
        return new DungeonMapViewInputEvent.CanvasInput(
                false, true, false, false, false, false, false, false, false, false);
    }

    private static DungeonMapViewInputEvent.CanvasInput rawMouseMovedInput() {
        return new DungeonMapViewInputEvent.CanvasInput(
                false, false, true, false, false, false, false, false, false, false);
    }

    private static DungeonMapViewInputEvent.CanvasInput rawMouseReleasedInput() {
        return new DungeonMapViewInputEvent.CanvasInput(
                false, false, false, false, true, false, false, false, false, false);
    }

    private static DungeonMapViewInputEvent.CanvasInput rawScrolledInput() {
        return new DungeonMapViewInputEvent.CanvasInput(
                false, false, false, false, false, true, false, false, false, false);
    }

    private static DungeonMapViewInputEvent.CanvasInput rawEscapePressedInput() {
        return new DungeonMapViewInputEvent.CanvasInput(
                false, false, false, false, false, false, true, false, false, false);
    }

    private static DungeonMapViewInputEvent.CanvasInput rawLabelEditCommittedInput() {
        return new DungeonMapViewInputEvent.CanvasInput(
                false, false, false, false, false, false, false, true, false, false);
    }

    private static DungeonMapViewInputEvent.CanvasInput rawLabelEditCancelledInput() {
        return new DungeonMapViewInputEvent.CanvasInput(
                false, false, false, false, false, false, false, false, true, false);
    }

    private static DungeonMapViewInputEvent.CanvasInput rawLabelEditTextChangedInput() {
        return new DungeonMapViewInputEvent.CanvasInput(
                false, false, false, false, false, false, false, false, false, true);
    }

    private void focusInlineLabelEditor() {
        inlineLabelEditor.requestFocus();
        inlineLabelEditor.selectAll();
    }

    private static boolean activatesInlineLabelEditor(
            InlineLabelEditState before,
            InlineLabelEditState after
    ) {
        return after != null
                && after.active()
                && (before == null || !before.active() || !after.target().equals(before.target()));
    }

    private static boolean preservesInlineLabelEditorSelection(
            InlineLabelEditState before,
            InlineLabelEditState after
    ) {
        return !activatesInlineLabelEditor(before, after);
    }

    private void preparePolygonBuffers(List<MapCanvasPoint> points, Viewport viewport) {
        if (polygonXBuffer.length < points.size()) {
            polygonXBuffer = new double[points.size()];
            polygonYBuffer = new double[points.size()];
        }
        for (int index = 0; index < points.size(); index++) {
            MapCanvasPoint point = points.get(index);
            polygonXBuffer[index] = viewport.sceneToScreenX(point.x());
            polygonYBuffer[index] = viewport.sceneToScreenY(point.y());
        }
    }

    private double[] polygonXBuffer() {
        return polygonXBuffer;
    }

    private double[] polygonYBuffer() {
        return polygonYBuffer;
    }

    private void handleKeyPressed(KeyEvent event) {
        KeyCode code = event.getCode();
        if (code == KeyCode.ENTER || code == KeyCode.SPACE) {
            InputSnapshots.emitKeyboardEvent(
                    this,
                    MOUSE_PRESSED_INPUT,
                    event,
                    true,
                    canvas.getWidth(),
                    canvas.getHeight(),
                    0.0);
            InputSnapshots.emitKeyboardEvent(
                    this,
                    MOUSE_RELEASED_INPUT,
                    event,
                    false,
                    canvas.getWidth(),
                    canvas.getHeight(),
                    0.0);
            event.consume();
            return;
        }
        if (code == KeyCode.PAGE_UP || code == KeyCode.PAGE_DOWN || code == KeyCode.E || code == KeyCode.Q) {
            InputSnapshots.emitKeyboardEvent(
                    this,
                    SCROLLED_INPUT,
                    event,
                    false,
                    canvas.getWidth(),
                    canvas.getHeight(),
                    projectionLevelDelta(code),
                    projectionLevelShortcut(code));
            event.consume();
            return;
        }
        if (code == KeyCode.ESCAPE) {
            InputSnapshots.emitKeyboardEvent(
                    this,
                    ESCAPE_PRESSED_INPUT,
                    event,
                    false,
                    canvas.getWidth(),
                    canvas.getHeight(),
                    0.0);
            event.consume();
        }
    }

    private static double projectionLevelDelta(KeyCode code) {
        return code == KeyCode.PAGE_UP || code == KeyCode.E ? 1.0 : -1.0;
    }

    private static boolean projectionLevelShortcut(KeyCode code) {
        return code == KeyCode.E || code == KeyCode.Q;
    }

    private interface InputEvents {

        static void install(Pane canvasLayer, DungeonMapView view) {
            canvasLayer.setOnMousePressed(event -> handleMousePressed(view, event));
            canvasLayer.setOnMouseDragged(event -> handleMouseDragged(view, event));
            canvasLayer.setOnMouseMoved(event -> handleMouseMoved(view, event));
            canvasLayer.setOnMouseExited(event -> handleMouseExited(view, event));
            canvasLayer.setOnMouseReleased(event -> handleMouseReleased(view, event));
            canvasLayer.setOnScroll(event -> handleScroll(view, event));
            canvasLayer.setOnKeyPressed(view::handleKeyPressed);
        }

        static void installInlineLabelEditor(TextField editor, DungeonMapView view) {
            editor.textProperty().addListener(view.inlineLabelEditorTextListener);
            editor.setOnKeyPressed(event -> {
                if (event.getCode() == KeyCode.ENTER) {
                    InputSnapshots.emitLabelEditEvent(view, LABEL_EDIT_COMMITTED_INPUT, editor.getText());
                    view.requestCanvasFocus();
                    event.consume();
                    return;
                }
                if (event.getCode() == KeyCode.ESCAPE) {
                    InputSnapshots.emitLabelEditEvent(view, LABEL_EDIT_CANCELLED_INPUT, "");
                    view.requestCanvasFocus();
                    event.consume();
                }
            });
        }

        static void handleMousePressed(DungeonMapView view, MouseEvent event) {
            view.requestCanvasFocus();
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
                InputSnapshots.emitMouseEvent(view, MOUSE_PRESSED_INPUT, event);
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
                return;
            }
            if (event.isSecondaryButtonDown()) {
                InputSnapshots.emitMouseEvent(view, MOUSE_DRAGGED_INPUT, event);
                event.consume();
            }
        }

        static void handleMouseReleased(DungeonMapView view, MouseEvent event) {
            if (event.getButton() == MouseButton.MIDDLE
                    || event.getButton() == MouseButton.PRIMARY
                    || event.getButton() == MouseButton.SECONDARY) {
                InputSnapshots.emitMouseEvent(view, MOUSE_RELEASED_INPUT, event);
                event.consume();
            }
        }

        static void handleScroll(DungeonMapView view, ScrollEvent event) {
            InputSnapshots.emitScrollEvent(view, SCROLLED_INPUT, event);
            event.consume();
        }

        static void handleMouseMoved(DungeonMapView view, MouseEvent event) {
            InputSnapshots.emitMouseEvent(view, MOUSE_MOVED_INPUT, event);
        }

        static void handleMouseExited(DungeonMapView view, MouseEvent event) {
            InputSnapshots.emitMouseEvent(
                    view,
                    new DungeonMapViewInputEvent.CanvasInput(
                            false, false, false, true, false, false, false, false, false, false),
                    event);
        }

    }

    private interface InputSnapshots {

        static void emitScrollEvent(
                DungeonMapView view,
                DungeonMapViewInputEvent.CanvasInput input,
                ScrollEvent event
        ) {
            view.emitInput(new DungeonMapViewInputEvent(
                    input,
                    new DungeonMapViewInputEvent.CanvasButtons(false, false, false),
                    new DungeonMapViewInputEvent.CanvasModifiers(
                            event.isControlDown(),
                            event.isShiftDown(),
                            event.isAltDown()),
                    new DungeonMapViewInputEvent.CanvasPosition(event.getX(), event.getY()),
                    event.getDeltaY(),
                    "",
                    0));
        }

        static void emitMouseEvent(
                DungeonMapView view,
                DungeonMapViewInputEvent.CanvasInput input,
                MouseEvent event
        ) {
            view.emitInput(new DungeonMapViewInputEvent(
                    input,
                    new DungeonMapViewInputEvent.CanvasButtons(
                            event.isPrimaryButtonDown() || event.getButton() == MouseButton.PRIMARY,
                            event.isMiddleButtonDown() || event.getButton() == MouseButton.MIDDLE,
                            event.isSecondaryButtonDown() || event.getButton() == MouseButton.SECONDARY),
                    new DungeonMapViewInputEvent.CanvasModifiers(
                            event.isControlDown(),
                            event.isShiftDown(),
                            event.isAltDown()),
                    new DungeonMapViewInputEvent.CanvasPosition(event.getX(), event.getY()),
                    0.0,
                    "",
                    event.getClickCount()));
        }

        static void emitKeyboardEvent(
                DungeonMapView view,
                DungeonMapViewInputEvent.CanvasInput input,
                KeyEvent event,
                boolean primaryButtonDown,
                double canvasWidth,
                double canvasHeight,
                double scrollDeltaY
        ) {
            emitKeyboardEvent(view, input, event, primaryButtonDown, canvasWidth, canvasHeight, scrollDeltaY, false);
        }

        static void emitKeyboardEvent(
                DungeonMapView view,
                DungeonMapViewInputEvent.CanvasInput input,
                KeyEvent event,
                boolean primaryButtonDown,
                double canvasWidth,
                double canvasHeight,
                double scrollDeltaY,
                boolean forceControlModifier
        ) {
            view.emitInput(new DungeonMapViewInputEvent(
                    input,
                    new DungeonMapViewInputEvent.CanvasButtons(primaryButtonDown, false, false),
                    new DungeonMapViewInputEvent.CanvasModifiers(
                            forceControlModifier || event.isControlDown(),
                            event.isShiftDown(),
                            event.isAltDown()),
                    new DungeonMapViewInputEvent.CanvasPosition(canvasWidth / 2.0, canvasHeight / 2.0),
                    scrollDeltaY,
                    "",
                    0));
        }

        static void emitLabelEditEvent(
                DungeonMapView view,
                DungeonMapViewInputEvent.CanvasInput input,
                String text
        ) {
            view.emitInput(new DungeonMapViewInputEvent(
                    input,
                    new DungeonMapViewInputEvent.CanvasButtons(false, false, false),
                    new DungeonMapViewInputEvent.CanvasModifiers(false, false, false),
                    new DungeonMapViewInputEvent.CanvasPosition(0.0, 0.0),
                    0.0,
                    text,
                    0));
        }
    }

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

        static TextField createInlineLabelEditor() {
            TextField editor = new TextField();
            editor.setManaged(false);
            editor.setVisible(false);
            editor.setAccessibleText("Dungeon map label editor");
            editor.getStyleClass().add(MAP_LABEL_STYLE_CLASS);
            return editor;
        }

        static void installCanvas(Pane canvasLayer, Canvas canvas) {
            canvasLayer.getChildren().setAll(canvas);
        }

        static void installHost(
                StackPane host,
                Pane canvasLayer,
                TextField inlineLabelEditor,
                Label overlayMessage
        ) {
            host.getChildren().setAll(canvasLayer, inlineLabelEditor, overlayMessage);
            StackPane.setAlignment(canvasLayer, Pos.TOP_LEFT);
            StackPane.setAlignment(inlineLabelEditor, Pos.TOP_LEFT);
            StackPane.setAlignment(overlayMessage, Pos.CENTER);
        }

        static void showOverlay(Label overlayMessage, DungeonMapContentModel.CanvasState canvasState) {
            RenderScene renderScene = canvasState.baseRenderScene();
            if (!renderScene.sceneLoaded()) {
                renderScene = canvasState.renderScene();
            }
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
                DungeonMapContentModel.CanvasState canvasState,
                double width,
                double height
        ) {
            RenderScene renderScene = canvasState.baseRenderScene();
            Viewport viewport = canvasState.viewport();
            clear(gc, width, height);
            drawGrid(gc, renderScene, viewport, width, height);
            drawRelations(gc, renderScene.relations(), viewport);
            drawSurfaces(view, gc, renderScene.baseSurfaces(), viewport);
            drawBoundaries(gc, renderScene.baseBoundaries(), viewport);
            drawGlyphs(view, gc, renderScene.baseGlyphs(), viewport);
            drawTexts(gc, renderScene.baseTexts(), viewport);
            drawSurfaces(view, gc, canvasState.hoverSurfaces(), viewport);
            drawBoundaries(gc, canvasState.hoverBoundaries(), viewport);
            drawGlyphs(view, gc, canvasState.hoverGlyphs(), viewport);
            drawTexts(gc, canvasState.hoverTexts(), viewport);
            drawSurfaces(view, gc, renderScene.actors(), viewport);
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
                if (gridSpacingVisible(spacing)) {
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

        static boolean gridSpacingVisible(double spacing) {
            return spacing >= 10.0;
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
                double centerX = viewport.sceneToScreenX(text.centerX());
                double centerY = viewport.sceneToScreenY(text.centerY());
                double x = centerX - width / 2.0;
                double y = centerY - height / 2.0;
                gc.save();
                gc.translate(centerX, centerY);
                gc.rotate(text.rotationDegrees());
                gc.translate(-centerX, -centerY);
                PrimitivePainter.drawLabelBox(
                        gc,
                        text.style(),
                        x,
                        y,
                        width,
                        height,
                        viewport);
                gc.setGlobalAlpha(text.style().alpha());
                gc.setFill(PaintPalette.defaultTextColor(text.textColor()));
                gc.setFont(PaintPalette.fxFont(text.typography()));
                gc.fillText(text.text(), centerX, y + height * 0.69, Math.max(1.0, width * 0.92));
                gc.restore();
            }
            gc.setTextAlign(TextAlignment.LEFT);
        }

    }

    private interface PrimitivePainter {

        static void drawPolygon(
                DungeonMapView view,
                GraphicsContext gc,
                List<MapCanvasPoint> points,
                PaintStyle style,
                Viewport viewport
        ) {
            if (!polygonDrawable(points)) {
                return;
            }
            view.preparePolygonBuffers(points, viewport);
            applyStyle(gc, style, viewport);
            Color fill = PaintPalette.fxColor(style.fill());
            if (fill != null) {
                gc.fillPolygon(view.polygonXBuffer(), view.polygonYBuffer(), points.size());
            }
            Color stroke = PaintPalette.fxColor(style.stroke());
            if (stroke != null && style.strokeWidth() > 0.0) {
                gc.strokePolygon(view.polygonXBuffer(), view.polygonYBuffer(), points.size());
            }
            gc.restore();
        }

        static void drawPolyline(
                GraphicsContext gc,
                List<MapCanvasPoint> points,
                PaintStyle style,
                Viewport viewport
        ) {
            if (!polylineDrawable(points)) {
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

        static boolean polygonDrawable(List<MapCanvasPoint> points) {
            return points.size() >= 3;
        }

        static boolean polylineDrawable(List<MapCanvasPoint> points) {
            return points.size() >= 2;
        }

        static void drawLabelBox(
                GraphicsContext gc,
                PaintStyle style,
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

        static Font fxFont(DungeonMapContentModel.LabelTypography typography) {
            if (typography == null) {
                return Font.font(MAP_LABEL_FONT_FAMILY, FontWeight.BOLD, MAP_LABEL_FONT_SIZE_PIXELS);
            }
            return Font.font(
                    typography.fontFamily(),
                    fxFontWeight(typography),
                    typography.fontSizePixels());
        }

        private static FontWeight fxFontWeight(DungeonMapContentModel.LabelTypography typography) {
            return typography.bold() ? FontWeight.BOLD : FontWeight.NORMAL;
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
