package src.view.slotcontent.main.dungeonmap;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;
import javafx.scene.text.TextAlignment;

public class DungeonMapMainView extends BorderPane {

    private static final double DEFAULT_WIDTH = 960.0;
    private static final double DEFAULT_HEIGHT = 640.0;
    private static final double BASE_GRID = 32.0;
    private static final double MIN_ZOOM = 0.1;
    private static final double MAX_ZOOM = 4.0;
    private static final double ZOOM_STEP_FACTOR = 1.1;
    private static final int[] GRID_STEPS = {1, 5, 10, 25};
    private final ObjectProperty<DungeonMapDisplayModel> renderModel =
            new SimpleObjectProperty<>(DungeonMapDisplayModel.empty());
    private final Label titleLabel = new Label();
    private final Label subtitleLabel = new Label();
    private final Label modeBadge = new Label();
    private final Label statusLabel = new Label();
    private final Label summaryLabel = new Label();
    private final StackPane contentHost = new StackPane();
    private final Canvas canvas = new Canvas(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    private final Label overlayMessage = new Label();
    private final Label hudLabel = new Label();
    private double panX;
    private double panY;
    private double zoom = 1.0;
    private double lastDragX;
    private double lastDragY;
    private boolean middleDragActive;

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonMapMainView(String titleText) {
        getStyleClass().add("surface-root");
        setPadding(new Insets(8));
        configureLabels();
        configureContentHost();
        titleLabel.setText(titleText);
        renderModel.addListener((ignored, before, after) -> redraw());
        setTop(buildHeader());
        setCenter(contentHost);
        setBottom(summaryLabel);
        BorderPane.setMargin(summaryLabel, new Insets(8, 0, 0, 0));
        installInteractionHandlers();
        redraw();
    }

    public final ObjectProperty<DungeonMapDisplayModel> renderModelProperty() {
        return renderModel;
    }

    public final StringProperty statusTextProperty() {
        return statusLabel.textProperty();
    }

    public final double zoom() {
        return zoom;
    }

    public final void resetCamera() {
        panX = 0.0;
        panY = 0.0;
        zoom = 1.0;
        redraw();
        contentHost.requestFocus();
    }

    private void configureLabels() {
        titleLabel.getStyleClass().add("title-large");
        subtitleLabel.getStyleClass().add("text-muted");
        modeBadge.getStyleClass().add("map-mode-badge");
        statusLabel.getStyleClass().add("map-status-label");
        statusLabel.setWrapText(true);
        summaryLabel.getStyleClass().add("text-muted");
        summaryLabel.setWrapText(true);
        overlayMessage.getStyleClass().add("dungeon-map-overlay-placeholder");
        overlayMessage.setWrapText(true);
        overlayMessage.setMouseTransparent(true);
        hudLabel.getStyleClass().add("dungeon-map-hud");
        hudLabel.setMouseTransparent(true);
    }

    private void configureContentHost() {
        contentHost.getStyleClass().add("map-workspace-content");
        contentHost.setAlignment(Pos.CENTER);
        contentHost.setFocusTraversable(true);
        canvas.getStyleClass().add("dungeon-map-canvas");
        contentHost.getChildren().setAll(canvas, overlayMessage, hudLabel);
        StackPane.setAlignment(overlayMessage, Pos.CENTER);
        StackPane.setAlignment(hudLabel, Pos.BOTTOM_RIGHT);
        StackPane.setMargin(hudLabel, new Insets(0, 16, 14, 0));
        contentHost.widthProperty().addListener((ignored, before, after) -> resizeCanvas());
        contentHost.heightProperty().addListener((ignored, before, after) -> resizeCanvas());
    }

    private HBox buildHeader() {
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox badgeRow = new HBox(8, modeBadge, statusLabel);
        VBox titleBox = new VBox(4, titleLabel, subtitleLabel, badgeRow);
        HBox header = new HBox(8, titleBox, spacer, buildCameraControls());
        header.getStyleClass().add("map-workspace-header");
        header.setPadding(new Insets(0, 0, 8, 0));
        return header;
    }

    private HBox buildCameraControls() {
        HBox cameraControls = new HBox(
                4,
                cameraButton("W", "Pan up", () -> panByPixels(0.0, 48.0)),
                cameraButton("A", "Pan left", () -> panByPixels(48.0, 0.0)),
                cameraButton("S", "Pan down", () -> panByPixels(0.0, -48.0)),
                cameraButton("D", "Pan right", () -> panByPixels(-48.0, 0.0)),
                cameraButton("-", "Zoom out", () -> zoomAround(width() / 2.0, height() / 2.0, 1.0 / ZOOM_STEP_FACTOR)),
                cameraButton("+", "Zoom in", () -> zoomAround(width() / 2.0, height() / 2.0, ZOOM_STEP_FACTOR)),
                cameraButton("Reset", "Reset camera", this::resetCamera)
        );
        cameraControls.getStyleClass().add("map-camera-controls");
        return cameraControls;
    }

    private Button cameraButton(String label, String tooltip, Runnable action) {
        Button button = new Button(label);
        button.getStyleClass().addAll("compact", "flat");
        button.setTooltip(new Tooltip(tooltip));
        button.setOnAction(event -> {
            action.run();
            redraw();
            contentHost.requestFocus();
        });
        return button;
    }

    private void installInteractionHandlers() {
        contentHost.addEventFilter(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
        contentHost.addEventFilter(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
        contentHost.addEventFilter(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
        contentHost.addEventFilter(ScrollEvent.SCROLL, this::handleScroll);
        contentHost.addEventFilter(KeyEvent.KEY_PRESSED, this::handleKeyPressed);
    }

    private void handleMousePressed(MouseEvent event) {
        contentHost.requestFocus();
        if (event.getButton() == MouseButton.MIDDLE) {
            middleDragActive = true;
            lastDragX = event.getX();
            lastDragY = event.getY();
            event.consume();
        }
    }

    private void handleMouseDragged(MouseEvent event) {
        if (!middleDragActive) {
            return;
        }
        panByPixels(event.getX() - lastDragX, event.getY() - lastDragY);
        lastDragX = event.getX();
        lastDragY = event.getY();
        redraw();
        event.consume();
    }

    private void handleMouseReleased(MouseEvent event) {
        if (event.getButton() == MouseButton.MIDDLE) {
            middleDragActive = false;
            event.consume();
        }
    }

    private void handleScroll(ScrollEvent event) {
        if (event.getDeltaY() > 0.0) {
            zoomAround(event.getX(), event.getY(), ZOOM_STEP_FACTOR);
        } else if (event.getDeltaY() < 0.0) {
            zoomAround(event.getX(), event.getY(), 1.0 / ZOOM_STEP_FACTOR);
        }
        redraw();
        event.consume();
    }

    private void handleKeyPressed(KeyEvent event) {
        if (event.getCode() == KeyCode.A) {
            panByPixels(48.0, 0.0);
        } else if (event.getCode() == KeyCode.D) {
            panByPixels(-48.0, 0.0);
        } else if (event.getCode() == KeyCode.W) {
            panByPixels(0.0, 48.0);
        } else if (event.getCode() == KeyCode.S) {
            panByPixels(0.0, -48.0);
        } else {
            return;
        }
        redraw();
        event.consume();
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

    private void resizeCanvas() {
        canvas.setWidth(width());
        canvas.setHeight(height());
        redraw();
    }

    private void redraw() {
        DungeonMapDisplayModel model = renderModel.get() == null ? DungeonMapDisplayModel.empty() : renderModel.get();
        titleLabel.setText(model.title());
        subtitleLabel.setText(model.subtitle() + "  Zoom " + String.format(Locale.ROOT, "%.1f", zoom) + "x");
        modeBadge.setText(model.modeLabel());
        statusLabel.setText(model.statusLabel());
        summaryLabel.setText(model.summaryLabel());
        hudLabel.setText(String.format(Locale.ROOT, "x %.0f  y %.0f  z %d  %.0f%%",
                -panX / gridSize(),
                -panY / gridSize(),
                model.projectionLevel(),
                zoom * 100.0));
        renderScene(model);
    }

    private void renderScene(DungeonMapDisplayModel model) {
        GraphicsContext gc = canvas.getGraphicsContext2D();
        gc.clearRect(0.0, 0.0, width(), height());
        overlayMessage.setText("");
        if (model.topology() != DungeonMapDisplayModel.RenderTopology.SQUARE) {
            overlayMessage.setText("Hex topology rendering is not available yet.");
            overlayMessage.setVisible(true);
            return;
        }
        if (model.viewMode() == DungeonMapDisplayModel.ViewMode.GRAPH) {
            renderGraph(gc, model);
        } else {
            renderGridScene(gc, model);
        }
        renderOverlayMessage(model);
    }

    private void renderGridScene(GraphicsContext gc, DungeonMapDisplayModel model) {
        fillBackground(gc);
        drawGrid(gc);
        drawCells(gc, model, true);
        drawEdges(gc, model, true);
        drawMarkers(gc, model, true);
        drawPartyToken(gc, model);
        drawLabels(gc, model, true);
        drawAxes(gc);
        drawHudLabel(gc, gridReferenceText(), width() - hudLabelWidth(gridReferenceText()) - 12.0, height() - 36.0);
    }

    private void renderGraph(GraphicsContext gc, DungeonMapDisplayModel model) {
        fillBackground(gc);
        Map<Long, GraphPoint> points = graphPoints(model);
        gc.setStroke(graphLink());
        gc.setLineWidth(3.0);
        for (DungeonMapDisplayModel.GraphLink link : model.graphLinks()) {
            GraphPoint from = points.get(link.fromId());
            GraphPoint to = points.get(link.toId());
            if (from != null && to != null) {
                gc.setStroke(link.selected() ? highlightStroke() : graphLink());
                gc.strokeLine(from.x(), from.y(), to.x(), to.y());
            }
        }
        gc.setTextAlign(TextAlignment.CENTER);
        for (DungeonMapDisplayModel.GraphNode node : model.graphNodes()) {
            GraphPoint point = points.get(node.id());
            if (point == null) {
                continue;
            }
            gc.setFill(node.selected() ? partyFill() : graphNodeFill());
            gc.fillRoundRect(point.x() - 42.0, point.y() - 18.0, 84.0, 36.0, 18.0, 18.0);
            gc.setStroke(node.selected() ? partyStroke() : roomStroke());
            gc.setLineWidth(node.selected() ? 2.4 : 2.0);
            gc.strokeRoundRect(point.x() - 42.0, point.y() - 18.0, 84.0, 36.0, 18.0, 18.0);
            gc.setFill(node.selected() ? partyShadow() : labelText());
            gc.fillText(abbreviateLabel(node.label(), 14), point.x(), point.y() + 4.0);
        }
        gc.setTextAlign(TextAlignment.LEFT);
        drawHudLabel(gc, "Graph · " + model.graphNodes().size() + " rooms", 12.0, height() - 36.0);
    }

    private void fillBackground(GraphicsContext gc) {
        gc.setFill(background());
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
            if (worldLineIndex(x, panX, spacing) != 0) {
                gc.strokeLine(x, 0.0, x, height());
            }
        }
        for (double y = offsetY; y <= height(); y += spacing) {
            if (worldLineIndex(y, panY, spacing) != 0) {
                gc.strokeLine(0.0, y, width(), y);
            }
        }
    }

    private void drawCells(GraphicsContext gc, DungeonMapDisplayModel model, boolean includeOverlay) {
        for (DungeonMapDisplayModel.RenderCell cell : model.cells()) {
            boolean overlay = cell.z() != model.projectionLevel();
            if (overlay && (!includeOverlay || model.overlayMode() == DungeonMapDisplayModel.OverlayMode.OFF)) {
                continue;
            }
            if (model.overlayMode() == DungeonMapDisplayModel.OverlayMode.SELECTED && overlay && Math.abs(cell.z()) != 1) {
                continue;
            }
            double x = worldToScreenX(cell.q());
            double y = worldToScreenY(cell.r());
            double size = gridSize();
            if (x + size < -8.0 || y + size < -8.0 || x > width() + 8.0 || y > height() + 8.0) {
                continue;
            }
            gc.save();
            if (overlay) {
                gc.setGlobalAlpha(overlayAlpha(cell.z(), model.projectionLevel()));
            }
            gc.setFill(fillFor(cell, model.projectionLevel()));
            gc.fillRect(x, y, size, size);
            gc.setStroke(strokeFor(cell, model.projectionLevel()));
            gc.setLineWidth(cell.selected() ? 2.4 : 1.0);
            gc.strokeRect(x, y, size, size);
            gc.restore();
        }
    }

    private void drawEdges(GraphicsContext gc, DungeonMapDisplayModel model, boolean includeOverlay) {
        for (DungeonMapDisplayModel.RenderEdge edge : model.edges()) {
            boolean overlay = edge.z() != model.projectionLevel();
            if (overlay && (!includeOverlay || model.overlayMode() == DungeonMapDisplayModel.OverlayMode.OFF)) {
                continue;
            }
            gc.save();
            if (overlay) {
                gc.setGlobalAlpha(overlayAlpha(edge.z(), model.projectionLevel()));
            }
            gc.setStroke(edge.kind() == DungeonMapDisplayModel.EdgeKind.DOOR
                    ? doorStroke()
                    : edge.selected() ? highlightStroke() : wallStroke());
            gc.setLineWidth(edge.kind() == DungeonMapDisplayModel.EdgeKind.DOOR ? 3.6 : edge.selected() ? 2.8 : 2.0);
            gc.strokeLine(worldToScreenX(edge.startQ()), worldToScreenY(edge.startR()),
                    worldToScreenX(edge.endQ()), worldToScreenY(edge.endR()));
            gc.restore();
        }
    }

    private void drawMarkers(GraphicsContext gc, DungeonMapDisplayModel model, boolean includeOverlay) {
        gc.setTextAlign(TextAlignment.CENTER);
        for (DungeonMapDisplayModel.RenderMarker marker : model.markers()) {
            boolean overlay = marker.z() != model.projectionLevel();
            if (overlay && (!includeOverlay || model.overlayMode() == DungeonMapDisplayModel.OverlayMode.OFF)) {
                continue;
            }
            double cx = worldToScreenX(marker.q());
            double cy = worldToScreenY(marker.r());
            double radius = marker.kind() == DungeonMapDisplayModel.MarkerKind.DOOR ? 10.0 : 12.0;
            gc.save();
            if (overlay) {
                gc.setGlobalAlpha(overlayAlpha(marker.z(), model.projectionLevel()));
            }
            gc.setFill(markerFill(marker));
            gc.fillRoundRect(cx - radius, cy - radius, radius * 2.0, radius * 2.0, 10.0, 10.0);
            gc.setStroke(marker.selected() ? highlightStroke() : markerStroke(marker));
            gc.setLineWidth(marker.selected() ? 2.2 : 1.4);
            gc.strokeRoundRect(cx - radius, cy - radius, radius * 2.0, radius * 2.0, 10.0, 10.0);
            gc.setFill(labelText());
            gc.fillText(marker.label(), cx, cy + 4.0);
            gc.restore();
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private void drawLabels(GraphicsContext gc, DungeonMapDisplayModel model, boolean includeOverlay) {
        if (gridSize() < 18.0) {
            return;
        }
        gc.setTextAlign(TextAlignment.CENTER);
        for (DungeonMapDisplayModel.RenderLabel label : model.labels()) {
            boolean overlay = label.z() != model.projectionLevel();
            if (label.label().isBlank()
                    || (overlay && (!includeOverlay || model.overlayMode() == DungeonMapDisplayModel.OverlayMode.OFF))) {
                continue;
            }
            double width = Math.max(56.0, Math.min(180.0, label.label().length() * 7.2 + 16.0));
            double x = worldToScreenX(label.q()) - width / 2.0;
            double y = worldToScreenY(label.r()) - 12.0;
            if (x + width < 0.0 || x > width() || y + 24.0 < 0.0 || y > height()) {
                continue;
            }
            gc.save();
            if (overlay) {
                gc.setGlobalAlpha(overlayAlpha(label.z(), model.projectionLevel()));
            }
            gc.setFill(labelFill());
            gc.fillRoundRect(x, y, width, 24.0, 14.0, 14.0);
            gc.setStroke(label.selected() ? highlightStroke() : labelBorder());
            gc.setLineWidth(label.selected() ? 2.0 : 1.0);
            gc.strokeRoundRect(x, y, width, 24.0, 14.0, 14.0);
            gc.setFill(labelText());
            gc.fillText(label.label(), x + width / 2.0, y + 16.5);
            gc.restore();
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private void drawPartyToken(GraphicsContext gc, DungeonMapDisplayModel model) {
        DungeonMapDisplayModel.PartyToken token = model.partyToken();
        if (token == null || !token.visible() || token.z() != model.projectionLevel()) {
            return;
        }
        double cx = worldToScreenX(token.q());
        double cy = worldToScreenY(token.r());
        double outerRadius = Math.max(7.5, gridSize() * 0.26);
        double innerRadius = Math.max(3.2, outerRadius * 0.42);
        double forwardX = token.heading().dx();
        double forwardY = token.heading().dy();
        double sideX = -forwardY;
        double sideY = forwardX;
        double[] shapeX = {
                cx + forwardX * outerRadius * 1.18,
                cx + forwardX * outerRadius * 0.54 + sideX * outerRadius * 0.76,
                cx - forwardX * outerRadius * 0.92 + sideX * outerRadius * 0.92,
                cx - forwardX * outerRadius * 1.02,
                cx - forwardX * outerRadius * 0.92 - sideX * outerRadius * 0.92,
                cx + forwardX * outerRadius * 0.54 - sideX * outerRadius * 0.76
        };
        double[] shapeY = {
                cy + forwardY * outerRadius * 1.18,
                cy + forwardY * outerRadius * 0.54 + sideY * outerRadius * 0.76,
                cy - forwardY * outerRadius * 0.92 + sideY * outerRadius * 0.92,
                cy - forwardY * outerRadius * 1.02,
                cy - forwardY * outerRadius * 0.92 - sideY * outerRadius * 0.92,
                cy + forwardY * outerRadius * 0.54 - sideY * outerRadius * 0.76
        };
        double[] shadowX = new double[shapeX.length];
        double[] shadowY = new double[shapeY.length];
        for (int index = 0; index < shapeX.length; index++) {
            shadowX[index] = shapeX[index] - 1.5;
            shadowY[index] = shapeY[index] + 1.5;
        }
        gc.setFill(partyShadow());
        gc.fillPolygon(shadowX, shadowY, shadowX.length);
        gc.setFill(partyFill());
        gc.fillPolygon(shapeX, shapeY, shapeX.length);
        gc.setStroke(partyStroke());
        gc.setLineWidth(2.2);
        gc.strokePolygon(shapeX, shapeY, shapeX.length);
        gc.setFill(partyStroke());
        gc.fillOval(cx - innerRadius, cy - innerRadius, innerRadius * 2.0, innerRadius * 2.0);
    }

    private void drawAxes(GraphicsContext gc) {
        gc.setStroke(axis());
        gc.setLineWidth(2.6);
        if (panX >= -gridSize() && panX <= width() + gridSize()) {
            gc.strokeLine(panX, 0.0, panX, height());
        }
        if (panY >= -gridSize() && panY <= height() + gridSize()) {
            gc.strokeLine(0.0, panY, width(), panY);
        }
    }

    private void drawHudLabel(GraphicsContext gc, String text, double x, double y) {
        if (text == null || text.isBlank()) {
            return;
        }
        double labelWidth = hudLabelWidth(text);
        gc.setFill(labelFill());
        gc.fillRoundRect(x, y, labelWidth, 24.0, 14.0, 14.0);
        gc.setStroke(labelBorder());
        gc.setLineWidth(1.0);
        gc.strokeRoundRect(x, y, labelWidth, 24.0, 14.0, 14.0);
        gc.setFill(labelText());
        gc.setTextAlign(TextAlignment.LEFT);
        gc.fillText(text, x + 8.0, y + 16.5);
    }

    private Color fillFor(DungeonMapDisplayModel.RenderCell cell, int projectionLevel) {
        if (cell.z() != projectionLevel) {
            return blend(cell.z() > projectionLevel ? roomFill() : corridorFill(),
                    cell.z() > projectionLevel ? aboveTint() : belowTint(),
                    0.56);
        }
        if (cell.selected()) {
            return selectedFill();
        }
        return switch (cell.kind()) {
            case ROOM -> roomFill();
            case CORRIDOR -> corridorFill();
            case STAIR -> stairFill();
            case TRANSITION -> transitionFill();
        };
    }

    private Color strokeFor(DungeonMapDisplayModel.RenderCell cell, int projectionLevel) {
        if (cell.z() != projectionLevel) {
            return blend(roomStroke(), cell.z() > projectionLevel ? aboveTint() : belowTint(), 0.62);
        }
        if (cell.selected()) {
            return selectedStroke();
        }
        return switch (cell.kind()) {
            case ROOM -> roomStroke();
            case CORRIDOR, STAIR -> corridorStroke();
            case TRANSITION -> transitionStroke();
        };
    }

    private Color markerFill(DungeonMapDisplayModel.RenderMarker marker) {
        return switch (marker.kind()) {
            case DOOR -> labelFill();
            case STAIR -> stairFill();
            case TRANSITION -> transitionFill();
        };
    }

    private Color markerStroke(DungeonMapDisplayModel.RenderMarker marker) {
        return switch (marker.kind()) {
            case DOOR -> doorStroke();
            case STAIR -> corridorStroke();
            case TRANSITION -> transitionStroke();
        };
    }

    private Map<Long, GraphPoint> graphPoints(DungeonMapDisplayModel model) {
        Map<Long, GraphPoint> points = new LinkedHashMap<>();
        int count = Math.max(model.graphNodes().size(), 1);
        double radius = 130.0 * zoom;
        double centerX = width() / 2.0 + panX;
        double centerY = height() / 2.0 + panY;
        for (int index = 0; index < model.graphNodes().size(); index++) {
            DungeonMapDisplayModel.GraphNode node = model.graphNodes().get(index);
            double angle = (-Math.PI / 2.0) + (Math.PI * 2.0 * index / count);
            points.put(node.id(), new GraphPoint(
                    centerX + Math.cos(angle) * radius,
                    centerY + Math.sin(angle) * radius));
        }
        return points;
    }

    private void renderOverlayMessage(DungeonMapDisplayModel model) {
        overlayMessage.getStyleClass().removeAll("dungeon-map-overlay-placeholder", "dungeon-map-overlay-note");
        overlayMessage.getStyleClass().add(model.mapLoaded() ? "dungeon-map-overlay-note" : "dungeon-map-overlay-placeholder");
        overlayMessage.setText(model.overlayMessage());
        overlayMessage.setVisible(!model.overlayMessage().isBlank());
        overlayMessage.setManaged(!model.overlayMessage().isBlank());
    }

    private String gridReferenceText() {
        int squares = gridSize() < 10.0 ? 5 : 1;
        return squares == 1 ? "Raster: 1 Feld (5 Fuss)" : "Raster: " + squares + " Felder";
    }

    private double width() {
        return contentHost.getWidth() > 1.0 ? contentHost.getWidth() : DEFAULT_WIDTH;
    }

    private double height() {
        return contentHost.getHeight() > 1.0 ? contentHost.getHeight() : DEFAULT_HEIGHT;
    }

    private double gridSize() {
        return BASE_GRID * zoom;
    }

    private double worldToScreenX(double worldX) {
        return panX + worldX * gridSize();
    }

    private double worldToScreenY(double worldY) {
        return panY + worldY * gridSize();
    }

    private double normalizedOffset(double pan, double spacing) {
        double offset = pan % spacing;
        return offset < 0.0 ? offset + spacing : offset;
    }

    private int worldLineIndex(double canvasCoordinate, double pan, double spacing) {
        return (int) Math.round((canvasCoordinate - pan) / spacing);
    }

    private Color gridColor(int tier) {
        return switch (tier) {
            case 0 -> gridMinor();
            case 1 -> gridMedium();
            case 2 -> gridMajor();
            default -> gridMax();
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

    private double overlayAlpha(int z, int projectionLevel) {
        int distance = Math.max(1, Math.abs(z - projectionLevel));
        return Math.max(0.16, Math.min(0.56, 0.35 / Math.sqrt(distance)));
    }

    private double hudLabelWidth(String text) {
        return (text == null ? 0 : text.length()) * 7.2 + 16.0;
    }

    private String abbreviateLabel(String label, int maxLength) {
        if (label == null || label.length() <= maxLength) {
            return label == null ? "" : label;
        }
        return label.substring(0, Math.max(1, maxLength - 1)) + ".";
    }

    private Color background() {
        return color(0x12, 0x18, 0x1c, 1.0);
    }

    private Color gridMinor() {
        return color(0x66, 0x77, 0x82, 0.18);
    }

    private Color gridMedium() {
        return color(0x73, 0x83, 0x90, 0.16);
    }

    private Color gridMajor() {
        return color(0x8d, 0x9c, 0xa8, 0.22);
    }

    private Color gridMax() {
        return color(0xb1, 0xbc, 0xc5, 0.28);
    }

    private Color axis() {
        return color(0xc5, 0xd1, 0xd8, 0.32);
    }

    private Color roomFill() {
        return color(0x2a, 0x32, 0x38, 1.0);
    }

    private Color roomStroke() {
        return color(0x8a, 0x6a, 0x35, 1.0);
    }

    private Color wallStroke() {
        return color(0x8a, 0x6a, 0x35, 1.0);
    }

    private Color highlightStroke() {
        return color(0xf1, 0xd3, 0x8a, 1.0);
    }

    private Color corridorFill() {
        return color(0x3b, 0x50, 0x53, 0.8);
    }

    private Color corridorStroke() {
        return color(0x91, 0xb6, 0xb0, 1.0);
    }

    private Color selectedFill() {
        return color(0x58, 0x70, 0x6e, 0.95);
    }

    private Color selectedStroke() {
        return color(0xd7, 0xec, 0xe7, 1.0);
    }

    private Color partyFill() {
        return color(0xff, 0xb6, 0x2a, 1.0);
    }

    private Color partyStroke() {
        return color(0xff, 0xf0, 0xc6, 1.0);
    }

    private Color partyShadow() {
        return color(0x12, 0x0f, 0x08, 0.8);
    }

    private Color labelFill() {
        return color(0x18, 0x1f, 0x24, 1.0);
    }

    private Color labelBorder() {
        return color(0x8a, 0x6a, 0x35, 1.0);
    }

    private Color labelText() {
        return color(0xec, 0xed, 0xee, 1.0);
    }

    private Color aboveTint() {
        return color(0x7c, 0xc8, 0xf4, 1.0);
    }

    private Color belowTint() {
        return color(0xd6, 0xa5, 0x65, 1.0);
    }

    private Color doorStroke() {
        return color(0xe5, 0xc0, 0x6f, 1.0);
    }

    private Color graphLink() {
        return color(0x56, 0x63, 0x6c, 1.0);
    }

    private Color graphNodeFill() {
        return color(0x2f, 0x3a, 0x41, 1.0);
    }

    private Color stairFill() {
        return color(0x3b, 0x50, 0x53, 0.95);
    }

    private Color transitionFill() {
        return color(0x58, 0x7f, 0x9a, 0.95);
    }

    private Color transitionStroke() {
        return color(0xac, 0xc7, 0xd8, 1.0);
    }

    private Color blend(Color base, Color tint, double tintRatio) {
        double ratio = Math.max(0.0, Math.min(1.0, tintRatio));
        double baseRatio = 1.0 - ratio;
        return new Color(
                base.getRed() * baseRatio + tint.getRed() * ratio,
                base.getGreen() * baseRatio + tint.getGreen() * ratio,
                base.getBlue() * baseRatio + tint.getBlue() * ratio,
                base.getOpacity());
    }

    private Color color(int red, int green, int blue, double opacity) {
        return new Color(red / 255.0, green / 255.0, blue / 255.0, opacity);
    }

    private record GraphPoint(double x, double y) {
    }
}
