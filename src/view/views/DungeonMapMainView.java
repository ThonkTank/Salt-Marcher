package src.view.views;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
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
import javafx.scene.layout.Pane;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.scene.shape.Line;

public class DungeonMapMainView extends BorderPane {

    private static final double DEFAULT_WIDTH = 960.0;
    private static final double DEFAULT_HEIGHT = 640.0;
    private static final double BASE_TILE_PIXELS = 32.0;
    private static final double MIN_ZOOM = 0.1;
    private static final double MAX_ZOOM = 4.0;
    private static final double ZOOM_STEP_FACTOR = 1.1;
    private static final int[] GRID_STEPS = {1, 5, 10, 25};

    private final ObjectProperty<RenderModel> renderModel = new SimpleObjectProperty<>(RenderModel.empty());
    private final Label titleLabel = new Label();
    private final Label subtitleLabel = new Label();
    private final Label modeBadge = new Label();
    private final Label statusLabel = new Label();
    private final Label summaryLabel = new Label();
    private final StackPane contentHost = new StackPane();
    private final Pane sceneLayer = new Pane();
    private final Label overlayMessage = new Label();
    private final Label hudLabel = new Label();
    private double centerX;
    private double centerY;
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

    public final ObjectProperty<RenderModel> renderModelProperty() {
        return renderModel;
    }

    public final StringProperty statusTextProperty() {
        return statusLabel.textProperty();
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
        sceneLayer.getStyleClass().add("dungeon-map-scene");
        sceneLayer.setMinSize(0.0, 0.0);
        sceneLayer.setPrefSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
        contentHost.getChildren().setAll(sceneLayer, overlayMessage, hudLabel);
        StackPane.setAlignment(overlayMessage, Pos.CENTER);
        StackPane.setAlignment(hudLabel, Pos.BOTTOM_RIGHT);
        StackPane.setMargin(hudLabel, new Insets(0, 16, 14, 0));
        contentHost.widthProperty().addListener((ignored, before, after) -> redraw());
        contentHost.heightProperty().addListener((ignored, before, after) -> redraw());
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
                cameraButton("W", "Pan up", () -> panByTiles(0.0, -1.5)),
                cameraButton("A", "Pan left", () -> panByTiles(-1.5, 0.0)),
                cameraButton("S", "Pan down", () -> panByTiles(0.0, 1.5)),
                cameraButton("D", "Pan right", () -> panByTiles(1.5, 0.0)),
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
        contentHost.addEventFilter(MouseEvent.MOUSE_CLICKED, this::handleMouseClicked);
        contentHost.addEventFilter(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
        contentHost.addEventFilter(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
        contentHost.addEventFilter(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
        contentHost.addEventFilter(ScrollEvent.SCROLL, this::handleScroll);
        contentHost.addEventFilter(KeyEvent.KEY_PRESSED, this::handleKeyPressed);
    }

    private void handleMouseClicked(MouseEvent event) {
        if (event.getButton() != MouseButton.PRIMARY || middleDragActive) {
            return;
        }
        contentHost.requestFocus();
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
        double dx = event.getX() - lastDragX;
        double dy = event.getY() - lastDragY;
        centerX -= dx / pixelsPerTile();
        centerY -= dy / pixelsPerTile();
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
            panByTiles(-1.5, 0.0);
        } else if (event.getCode() == KeyCode.D) {
            panByTiles(1.5, 0.0);
        } else if (event.getCode() == KeyCode.W) {
            panByTiles(0.0, -1.5);
        } else if (event.getCode() == KeyCode.S) {
            panByTiles(0.0, 1.5);
        } else {
            return;
        }
        redraw();
        event.consume();
    }

    private void panByTiles(double deltaX, double deltaY) {
        centerX += deltaX;
        centerY += deltaY;
    }

    private void zoomAround(double canvasX, double canvasY, double factor) {
        double oldScale = pixelsPerTile();
        double worldX = centerX + (canvasX - width() / 2.0) / oldScale;
        double worldY = centerY + (canvasY - height() / 2.0) / oldScale;
        zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
        double newScale = pixelsPerTile();
        centerX = worldX - (canvasX - width() / 2.0) / newScale;
        centerY = worldY - (canvasY - height() / 2.0) / newScale;
    }

    private void resetCamera() {
        centerX = 0.0;
        centerY = 0.0;
        zoom = 1.0;
    }

    private void redraw() {
        RenderModel model = renderModel.get() == null ? RenderModel.empty() : renderModel.get();
        titleLabel.setText(model.title());
        subtitleLabel.setText(model.subtitle() + "  Zoom " + String.format(Locale.ROOT, "%.1f", zoom) + "x");
        modeBadge.setText(model.modeLabel());
        statusLabel.setText(model.statusLabel());
        summaryLabel.setText(model.summaryLabel());
        hudLabel.setText(String.format(Locale.ROOT, "x %.1f  y %.1f  z %.0f%%", centerX, centerY, zoom * 100.0));
        sceneLayer.setPrefSize(width(), height());
        sceneLayer.resize(width(), height());
        renderScene(model);
    }

    private void renderScene(RenderModel model) {
        sceneLayer.getChildren().clear();
        overlayMessage.setText("");
        if (model.topology() != RenderTopology.SQUARE) {
            overlayMessage.setText("Hex topology rendering is not available yet.");
            return;
        }
        renderGrid();
        renderCells(model);
        renderEdges(model);
        renderLabels(model);
        renderOverlayMessage(model);
    }

    private void renderGrid() {
        double scale = pixelsPerTile();
        for (int index = 0; index < GRID_STEPS.length; index++) {
            int gridStep = GRID_STEPS[index];
            double pixelSpacing = scale * gridStep;
            if (pixelSpacing >= 10.0) {
                renderGridTier(scale, gridStep, gridTierStyle(index));
            }
        }
        renderAxis(scale);
    }

    private void renderGridTier(double scale, int spacingSquares, String styleClass) {
        int minColumn = (int) Math.floor(centerX - width() / (2.0 * scale)) - spacingSquares;
        int maxColumn = (int) Math.ceil(centerX + width() / (2.0 * scale)) + spacingSquares;
        int minRow = (int) Math.floor(centerY - height() / (2.0 * scale)) - spacingSquares;
        int maxRow = (int) Math.ceil(centerY + height() / (2.0 * scale)) + spacingSquares;
        for (int column = align(minColumn, spacingSquares); column <= maxColumn; column += spacingSquares) {
            if (column != 0) {
                addGridLine(worldToScreenX(column, scale), 0.0, worldToScreenX(column, scale), height(), styleClass);
            }
        }
        for (int row = align(minRow, spacingSquares); row <= maxRow; row += spacingSquares) {
            if (row != 0) {
                addGridLine(0.0, worldToScreenY(row, scale), width(), worldToScreenY(row, scale), styleClass);
            }
        }
    }

    private void renderAxis(double scale) {
        double axisX = worldToScreenX(0.0, scale);
        double axisY = worldToScreenY(0.0, scale);
        if (axisX >= 0.0 && axisX <= width()) {
            addGridLine(axisX, 0.0, axisX, height(), "dungeon-map-grid-axis");
        }
        if (axisY >= 0.0 && axisY <= height()) {
            addGridLine(0.0, axisY, width(), axisY, "dungeon-map-grid-axis");
        }
    }

    private void addGridLine(double startX, double startY, double endX, double endY, String styleClass) {
        Line line = new Line(startX, startY, endX, endY);
        line.getStyleClass().add(styleClass);
        line.setMouseTransparent(true);
        sceneLayer.getChildren().add(line);
    }

    private void renderCells(RenderModel model) {
        double scale = pixelsPerTile();
        double inset = Math.max(1.5, Math.min(5.0, scale * 0.08));
        double size = Math.max(6.0, scale - inset * 2.0);
        for (RenderCell cell : model.cells()) {
            double x = worldToScreenX(cell.q(), scale) + inset;
            double y = worldToScreenY(cell.r(), scale) + inset;
            if (x + size < -8.0 || y + size < -8.0 || x > width() + 8.0 || y > height() + 8.0) {
                continue;
            }
            StackPane cellNode = new StackPane();
            cellNode.getStyleClass().add("dungeon-map-cell");
            addCellStyle(cellNode, cell);
            cellNode.setDisable(!cell.interactive());
            cellNode.resizeRelocate(x, y, size, size);
            if (cell.current()) {
                Region inner = new Region();
                inner.getStyleClass().add("dungeon-map-cell-current-inner");
                inner.setMouseTransparent(true);
                StackPane.setMargin(inner, new Insets(2));
                cellNode.getChildren().add(inner);
            }
            addCellContent(cellNode, cell, size);
            sceneLayer.getChildren().add(cellNode);
        }
    }

    private void addCellStyle(StackPane cellNode, RenderCell cell) {
        if (cell.current()) {
            cellNode.getStyleClass().add("dungeon-map-cell-current");
        } else if (cell.room()) {
            cellNode.getStyleClass().add("dungeon-map-cell-room");
        } else if (cell.corridor()) {
            cellNode.getStyleClass().add("dungeon-map-cell-corridor");
        } else if (cell.blocked()) {
            cellNode.getStyleClass().add("dungeon-map-cell-blocked");
        } else {
            cellNode.getStyleClass().add("dungeon-map-cell-open");
        }
    }

    private void addCellContent(StackPane cellNode, RenderCell cell, double size) {
        VBox content = new VBox(1);
        content.setAlignment(Pos.CENTER);
        content.setMouseTransparent(true);
        if (size >= 20.0) {
            Label glyph = new Label(glyphFor(cell));
            glyph.getStyleClass().add("dungeon-map-cell-glyph");
            content.getChildren().add(glyph);
        }
        if (size >= 30.0 && !cell.label().isBlank()) {
            Label caption = new Label(cell.label());
            caption.getStyleClass().add("dungeon-map-cell-caption");
            caption.setMouseTransparent(true);
            content.getChildren().add(caption);
        }
        cellNode.getChildren().add(content);
    }

    private String glyphFor(RenderCell cell) {
        if (cell.current()) {
            return "*";
        }
        if (cell.room()) {
            return "R";
        }
        if (cell.corridor()) {
            return "C";
        }
        if (cell.blocked()) {
            return "X";
        }
        return "";
    }

    private void renderEdges(RenderModel model) {
        double scale = pixelsPerTile();
        for (RenderEdge edge : model.edges()) {
            double fromX = worldToScreenX(edge.fromQ(), scale) + scale / 2.0;
            double fromY = worldToScreenY(edge.fromR(), scale) + scale / 2.0;
            double toX = worldToScreenX(edge.toQ(), scale) + scale / 2.0;
            double toY = worldToScreenY(edge.toR(), scale) + scale / 2.0;
            Line edgeLine = new Line(fromX, fromY, toX, toY);
            addEdgeStyle(edgeLine, edge);
            edgeLine.setMouseTransparent(true);
            sceneLayer.getChildren().add(edgeLine);
            if ("door".equalsIgnoreCase(edge.kind())) {
                addDoorMarker(edge, (fromX + toX) / 2.0, (fromY + toY) / 2.0);
            }
        }
    }

    private void addEdgeStyle(Line line, RenderEdge edge) {
        if ("door".equalsIgnoreCase(edge.kind())) {
            line.getStyleClass().add("dungeon-map-door");
        } else {
            line.getStyleClass().add("dungeon-map-wall");
            if (!edge.interactive()) {
                line.getStyleClass().add("dungeon-map-wall-noninteractive");
            }
        }
    }

    private void addDoorMarker(RenderEdge edge, double centerScreenX, double centerScreenY) {
        Label marker = new Label(edge.label().isBlank() ? "D" : abbreviate(edge.label(), 2));
        marker.getStyleClass().add("dungeon-map-door-marker");
        marker.setMouseTransparent(true);
        marker.resizeRelocate(centerScreenX - 10.0, centerScreenY - 10.0, 20.0, 20.0);
        sceneLayer.getChildren().add(marker);
    }

    private void renderLabels(RenderModel model) {
        double scale = pixelsPerTile();
        if (scale < 18.0) {
            return;
        }
        Map<String, LabelGroup> groups = collectLabelGroups(model);
        for (LabelGroup group : groups.values()) {
            addLabelGroup(scale, group);
        }
    }

    private Map<String, LabelGroup> collectLabelGroups(RenderModel model) {
        Map<String, LabelGroup> groups = new LinkedHashMap<>();
        for (RenderCell cell : model.cells()) {
            if (cell.label().isBlank() || cell.ownerKind().isBlank()) {
                continue;
            }
            String key = cell.ownerKind() + "|" + cell.ownerId() + "|" + cell.label();
            groups.computeIfAbsent(key, ignored -> new LabelGroup(cell.label()))
                    .include(cell.q() + 0.5, cell.r() + 0.5, cell.current());
        }
        return groups;
    }

    private void addLabelGroup(double scale, LabelGroup group) {
        double screenX = worldToScreenX(group.centerX(), scale);
        double screenY = worldToScreenY(group.centerY(), scale);
        double labelWidth = Math.max(56.0, Math.min(160.0, group.label().length() * 7.1 + 18.0));
        double labelHeight = 24.0;
        if (screenX + labelWidth / 2.0 < 0.0
                || screenY + labelHeight / 2.0 < 0.0
                || screenX - labelWidth / 2.0 > width()
                || screenY - labelHeight / 2.0 > height()) {
            return;
        }
        Label label = new Label(group.label());
        label.getStyleClass().add("dungeon-map-label");
        if (group.current()) {
            label.getStyleClass().add("dungeon-map-label-current");
        }
        label.setMouseTransparent(true);
        label.resizeRelocate(screenX - labelWidth / 2.0, screenY - labelHeight / 2.0, labelWidth, labelHeight);
        sceneLayer.getChildren().add(label);
    }

    private void renderOverlayMessage(RenderModel model) {
        overlayMessage.getStyleClass().removeAll("dungeon-map-overlay-placeholder", "dungeon-map-overlay-note");
        overlayMessage.getStyleClass().add(model.mapLoaded() ? "dungeon-map-overlay-note" : "dungeon-map-overlay-placeholder");
        overlayMessage.setText(model.overlayMessage());
        overlayMessage.setVisible(!model.overlayMessage().isBlank());
        overlayMessage.setManaged(!model.overlayMessage().isBlank());
    }

    private double width() {
        return contentHost.getWidth() > 1.0 ? contentHost.getWidth() : DEFAULT_WIDTH;
    }

    private double height() {
        return contentHost.getHeight() > 1.0 ? contentHost.getHeight() : DEFAULT_HEIGHT;
    }

    private double pixelsPerTile() {
        return BASE_TILE_PIXELS * zoom;
    }

    private double worldToScreenX(double worldX, double scale) {
        return (worldX - centerX) * scale + width() / 2.0;
    }

    private double worldToScreenY(double worldY, double scale) {
        return (worldY - centerY) * scale + height() / 2.0;
    }

    private int align(int value, int spacing) {
        int remainder = Math.floorMod(value, spacing);
        return remainder == 0 ? value : value + spacing - remainder;
    }

    private String gridTierStyle(int tier) {
        return switch (tier) {
            case 0 -> "dungeon-map-grid-minor";
            case 1 -> "dungeon-map-grid-medium";
            case 2 -> "dungeon-map-grid-major";
            default -> "dungeon-map-grid-max";
        };
    }

    private String abbreviate(String text, int maxLength) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String compact = text.trim().replaceAll("\\s+", "");
        return compact.length() <= maxLength
                ? compact.toUpperCase(Locale.ROOT)
                : compact.substring(0, maxLength).toUpperCase(Locale.ROOT);
    }

    public enum RenderTopology {
        SQUARE,
        HEX
    }

    public record RenderModel(
            String title,
            String subtitle,
            String modeLabel,
            String statusLabel,
            String summaryLabel,
            boolean mapLoaded,
            String overlayMessage,
            RenderTopology topology,
            List<RenderCell> cells,
            List<RenderEdge> edges
    ) {

        public RenderModel {
            title = title == null || title.isBlank() ? "Dungeon Map" : title;
            subtitle = subtitle == null ? "" : subtitle;
            modeLabel = modeLabel == null ? "" : modeLabel;
            statusLabel = statusLabel == null ? "" : statusLabel;
            summaryLabel = summaryLabel == null ? "" : summaryLabel;
            overlayMessage = overlayMessage == null ? "" : overlayMessage;
            topology = topology == null ? RenderTopology.SQUARE : topology;
            cells = cells == null ? List.of() : List.copyOf(cells);
            edges = edges == null ? List.of() : List.copyOf(edges);
        }

        public static RenderModel empty() {
            return new RenderModel(
                    "Dungeon Map",
                    "",
                    "",
                    "",
                    "",
                    false,
                    "No dungeon map loaded.",
                    RenderTopology.SQUARE,
                    List.of(),
                    List.of());
        }
    }

    public record RenderCell(
            int q,
            int r,
            String label,
            boolean room,
            boolean corridor,
            boolean blocked,
            boolean interactive,
            boolean current,
            String ownerKind,
            long ownerId,
            String partKind
    ) {

        public RenderCell {
            label = label == null ? "" : label;
            ownerKind = ownerKind == null ? "" : ownerKind;
            partKind = partKind == null ? "" : partKind;
        }
    }

    public record RenderEdge(
            int fromQ,
            int fromR,
            int toQ,
            int toR,
            String kind,
            String label,
            boolean interactive,
            String ownerKind,
            long ownerId,
            String partKind
    ) {

        public RenderEdge {
            kind = kind == null || kind.isBlank() ? "edge" : kind;
            label = label == null ? "" : label;
            ownerKind = ownerKind == null ? "" : ownerKind;
            partKind = partKind == null ? "" : partKind;
        }
    }

    private static final class LabelGroup {

        private final String label;
        private double sumX;
        private double sumY;
        private int count;
        private boolean current;

        private LabelGroup(String label) {
            this.label = Objects.requireNonNull(label, "label");
        }

        private void include(double x, double y, boolean includedCurrent) {
            sumX += x;
            sumY += y;
            count++;
            current = current || includedCurrent;
        }

        private String label() {
            return label;
        }

        private double centerX() {
            return count == 0 ? 0.0 : sumX / count;
        }

        private double centerY() {
            return count == 0 ? 0.0 : sumY / count;
        }

        private boolean current() {
            return current;
        }

    }
}
