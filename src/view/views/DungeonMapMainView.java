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
import javafx.geometry.VPos;
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
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.scene.text.TextAlignment;

public class DungeonMapMainView extends BorderPane {

    private static final double DEFAULT_WIDTH = 960.0;
    private static final double DEFAULT_HEIGHT = 640.0;
    private static final double BASE_TILE_PIXELS = 32.0;
    private static final double MIN_ZOOM = 0.1;
    private static final double MAX_ZOOM = 4.0;
    private static final double ZOOM_STEP_FACTOR = 1.1;
    private static final int[] GRID_STEPS = {1, 5, 10, 25};

    private static final Color BACKGROUND = Color.web("#12181c");
    private static final Color GRID_MINOR = Color.web("#667782", 0.18);
    private static final Color GRID_MEDIUM = Color.web("#738390", 0.16);
    private static final Color GRID_MAJOR = Color.web("#8d9ca8", 0.22);
    private static final Color GRID_MAX = Color.web("#b1bcc5", 0.28);
    private static final Color GRID_AXIS = Color.web("#c5d1d8", 0.32);
    private static final Color ROOM_FILL = Color.web("#2a3238");
    private static final Color ROOM_STROKE = Color.web("#8a6a35");
    private static final Color CORRIDOR_FILL = Color.web("#3b5053", 0.80);
    private static final Color CORRIDOR_STROKE = Color.web("#91b6b0");
    private static final Color CURRENT_FILL = Color.web("#5b4517");
    private static final Color CURRENT_STROKE = Color.web("#fff0c6");
    private static final Color OPEN_FILL = Color.web("#303940");
    private static final Color OPEN_STROKE = Color.web("#667782");
    private static final Color BLOCKED_FILL = Color.web("#2a2f33");
    private static final Color BLOCKED_STROKE = Color.web("#555d64");
    private static final Color WALL_STROKE = Color.web("#8a6a35");
    private static final Color DOOR_STROKE = Color.web("#e5c06f");
    private static final Color LABEL_FILL = Color.web("#181f24");
    private static final Color LABEL_BORDER = Color.web("#8a6a35");
    private static final Color LABEL_TEXT = Color.web("#ecedee");
    private static final Color HUD_TEXT = Color.web("#ecedee");
    private static final Color PLACEHOLDER = Color.web("#ecedee", 0.92);
    private static final Color LOADED_NOTE = Color.web("#ecedee", 0.70);
    private static final Font HUD_FONT = Font.font("SansSerif", FontWeight.BOLD, 14);
    private static final Font LABEL_FONT = Font.font("SansSerif", FontWeight.BOLD, 12);
    private static final Font MARKER_FONT = Font.font("SansSerif", FontWeight.BOLD, 10);

    private final ObjectProperty<RenderModel> renderModel = new SimpleObjectProperty<>(RenderModel.empty());
    private final Label titleLabel = new Label();
    private final Label subtitleLabel = new Label();
    private final Label modeBadge = new Label();
    private final Label statusLabel = new Label();
    private final Label summaryLabel = new Label();
    private final StackPane contentHost = new StackPane();
    private final Canvas renderSurface = new Canvas(DEFAULT_WIDTH, DEFAULT_HEIGHT);
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
    }

    private void configureContentHost() {
        contentHost.getStyleClass().add("map-workspace-content");
        contentHost.setAlignment(Pos.CENTER);
        contentHost.setFocusTraversable(true);
        renderSurface.getStyleClass().add("dungeon-map-scene");
        contentHost.getChildren().setAll(renderSurface);
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
        renderSurface.setWidth(width());
        renderSurface.setHeight(height());
        paint(renderSurface.getGraphicsContext2D(), model);
    }

    private void paint(GraphicsContext graphics, RenderModel model) {
        graphics.setFill(BACKGROUND);
        graphics.fillRect(0.0, 0.0, width(), height());
        if (model.topology() != RenderTopology.SQUARE) {
            paintOverlayMessage(graphics, "Hex topology rendering is not available yet.", false);
            return;
        }
        paintGrid(graphics);
        paintCells(graphics, model);
        paintEdges(graphics, model);
        paintLabels(graphics, model);
        paintHud(graphics);
        paintOverlayMessage(graphics, model.overlayMessage(), model.mapLoaded());
    }

    private void paintGrid(GraphicsContext graphics) {
        double scale = pixelsPerTile();
        for (int index = 0; index < GRID_STEPS.length; index++) {
            int gridStep = GRID_STEPS[index];
            double pixelSpacing = scale * gridStep;
            if (pixelSpacing >= 10.0) {
                paintGridTier(graphics, scale, gridStep, index);
            }
        }
        paintAxis(graphics, scale);
    }

    private void paintGridTier(GraphicsContext graphics, double scale, int spacingSquares, int tier) {
        int minColumn = (int) Math.floor(centerX - width() / (2.0 * scale)) - spacingSquares;
        int maxColumn = (int) Math.ceil(centerX + width() / (2.0 * scale)) + spacingSquares;
        int minRow = (int) Math.floor(centerY - height() / (2.0 * scale)) - spacingSquares;
        int maxRow = (int) Math.ceil(centerY + height() / (2.0 * scale)) + spacingSquares;
        graphics.setStroke(gridTierColor(tier));
        graphics.setLineWidth(gridTierWidth(tier));
        for (int column = align(minColumn, spacingSquares); column <= maxColumn; column += spacingSquares) {
            if (column != 0) {
                double x = worldToScreenX(column, scale);
                graphics.strokeLine(x, 0.0, x, height());
            }
        }
        for (int row = align(minRow, spacingSquares); row <= maxRow; row += spacingSquares) {
            if (row != 0) {
                double y = worldToScreenY(row, scale);
                graphics.strokeLine(0.0, y, width(), y);
            }
        }
    }

    private void paintAxis(GraphicsContext graphics, double scale) {
        graphics.setStroke(GRID_AXIS);
        graphics.setLineWidth(2.6);
        double axisX = worldToScreenX(0.0, scale);
        double axisY = worldToScreenY(0.0, scale);
        if (axisX >= 0.0 && axisX <= width()) {
            graphics.strokeLine(axisX, 0.0, axisX, height());
        }
        if (axisY >= 0.0 && axisY <= height()) {
            graphics.strokeLine(0.0, axisY, width(), axisY);
        }
    }

    private void paintCells(GraphicsContext graphics, RenderModel model) {
        double scale = pixelsPerTile();
        double inset = Math.max(1.5, Math.min(5.0, scale * 0.08));
        double size = Math.max(6.0, scale - inset * 2.0);
        double arc = Math.max(4.0, size * 0.18);
        for (RenderCell cell : model.cells()) {
            double x = worldToScreenX(cell.q(), scale) + inset;
            double y = worldToScreenY(cell.r(), scale) + inset;
            if (x + size < -8.0 || y + size < -8.0 || x > width() + 8.0 || y > height() + 8.0) {
                continue;
            }
            graphics.setFill(fillFor(cell));
            graphics.fillRoundRect(x, y, size, size, arc, arc);
            graphics.setStroke(strokeFor(cell));
            graphics.setLineWidth(cell.current() ? 2.2 : 1.35);
            graphics.strokeRoundRect(x, y, size, size, arc, arc);
            if (cell.current()) {
                graphics.setStroke(CURRENT_STROKE);
                graphics.setLineWidth(1.1);
                graphics.strokeRoundRect(x + 2.0, y + 2.0, Math.max(0.0, size - 4.0), Math.max(0.0, size - 4.0), arc, arc);
            }
        }
    }

    private void paintEdges(GraphicsContext graphics, RenderModel model) {
        double scale = pixelsPerTile();
        for (RenderEdge edge : model.edges()) {
            double fromX = worldToScreenX(edge.fromQ(), scale) + scale / 2.0;
            double fromY = worldToScreenY(edge.fromR(), scale) + scale / 2.0;
            double toX = worldToScreenX(edge.toQ(), scale) + scale / 2.0;
            double toY = worldToScreenY(edge.toR(), scale) + scale / 2.0;
            if ("door".equalsIgnoreCase(edge.kind())) {
                graphics.setStroke(DOOR_STROKE);
                graphics.setLineWidth(3.6);
                graphics.strokeLine(fromX, fromY, toX, toY);
                paintDoorMarker(graphics, edge, (fromX + toX) / 2.0, (fromY + toY) / 2.0);
            } else {
                graphics.setStroke(WALL_STROKE);
                graphics.setLineWidth(edge.interactive() ? 3.0 : 2.4);
                graphics.strokeLine(fromX, fromY, toX, toY);
            }
        }
    }

    private void paintDoorMarker(GraphicsContext graphics, RenderEdge edge, double centerScreenX, double centerScreenY) {
        double radius = 10.0;
        graphics.setFill(LABEL_FILL);
        graphics.fillOval(centerScreenX - radius, centerScreenY - radius, radius * 2.0, radius * 2.0);
        graphics.setStroke(DOOR_STROKE);
        graphics.setLineWidth(1.4);
        graphics.strokeOval(centerScreenX - radius, centerScreenY - radius, radius * 2.0, radius * 2.0);
        graphics.setFill(DOOR_STROKE);
        graphics.setFont(MARKER_FONT);
        graphics.setTextAlign(TextAlignment.CENTER);
        graphics.setTextBaseline(VPos.CENTER);
        String marker = edge.label().isBlank() ? "D" : abbreviate(edge.label(), 2);
        graphics.fillText(marker, centerScreenX, centerScreenY + 0.5);
    }

    private void paintLabels(GraphicsContext graphics, RenderModel model) {
        double scale = pixelsPerTile();
        if (scale < 18.0) {
            return;
        }
        Map<String, LabelGroup> groups = collectLabelGroups(model);
        graphics.setFont(LABEL_FONT);
        graphics.setTextAlign(TextAlignment.CENTER);
        graphics.setTextBaseline(VPos.CENTER);
        for (LabelGroup group : groups.values()) {
            paintLabelGroup(graphics, scale, group);
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

    private void paintLabelGroup(GraphicsContext graphics, double scale, LabelGroup group) {
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
        graphics.setFill(LABEL_FILL);
        graphics.fillRoundRect(screenX - labelWidth / 2.0, screenY - labelHeight / 2.0, labelWidth, labelHeight, 14.0, 14.0);
        graphics.setStroke(group.current() ? CURRENT_STROKE : LABEL_BORDER);
        graphics.setLineWidth(group.current() ? 1.6 : 1.0);
        graphics.strokeRoundRect(screenX - labelWidth / 2.0, screenY - labelHeight / 2.0, labelWidth, labelHeight, 14.0, 14.0);
        graphics.setFill(LABEL_TEXT);
        graphics.fillText(group.label(), screenX, screenY + 0.5);
    }

    private void paintHud(GraphicsContext graphics) {
        graphics.setFill(HUD_TEXT);
        graphics.setFont(HUD_FONT);
        graphics.setTextAlign(TextAlignment.RIGHT);
        graphics.setTextBaseline(VPos.BOTTOM);
        String reference = String.format(Locale.ROOT, "x %.1f  y %.1f  z %.0f%%", centerX, centerY, zoom * 100.0);
        graphics.fillText(reference, width() - 18.0, height() - 16.0);
    }

    private void paintOverlayMessage(GraphicsContext graphics, String message, boolean mapLoaded) {
        if (message.isBlank()) {
            return;
        }
        graphics.setTextAlign(TextAlignment.CENTER);
        graphics.setTextBaseline(VPos.CENTER);
        graphics.setFont(Font.font("SansSerif", FontWeight.BOLD, mapLoaded ? 19.0 : 22.0));
        graphics.setFill(mapLoaded ? LOADED_NOTE : PLACEHOLDER);
        graphics.fillText(message, width() / 2.0, height() / 2.0);
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

    private Color gridTierColor(int tier) {
        return switch (tier) {
            case 0 -> GRID_MINOR;
            case 1 -> GRID_MEDIUM;
            case 2 -> GRID_MAJOR;
            default -> GRID_MAX;
        };
    }

    private double gridTierWidth(int tier) {
        return switch (tier) {
            case 0 -> 0.9;
            case 1 -> 1.05;
            case 2 -> 1.4;
            default -> 1.8;
        };
    }

    private Color fillFor(RenderCell cell) {
        if (cell.current()) {
            return CURRENT_FILL;
        }
        if (cell.room()) {
            return ROOM_FILL;
        }
        if (cell.corridor()) {
            return CORRIDOR_FILL;
        }
        if (cell.blocked()) {
            return BLOCKED_FILL;
        }
        return OPEN_FILL;
    }

    private Color strokeFor(RenderCell cell) {
        if (cell.current()) {
            return CURRENT_STROKE;
        }
        if (cell.room()) {
            return ROOM_STROKE;
        }
        if (cell.corridor()) {
            return CORRIDOR_STROKE;
        }
        if (cell.blocked()) {
            return BLOCKED_STROKE;
        }
        return OPEN_STROKE;
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
