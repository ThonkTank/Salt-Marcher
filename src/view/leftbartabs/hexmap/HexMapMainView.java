package src.view.leftbartabs.hexmap;

import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;
import javafx.scene.Node;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;

public final class HexMapMainView extends ScrollPane {

    private static final Color COLOR_SELECTED_STROKE = Color.web("#f8fafc");
    private static final Color COLOR_DEFAULT_STROKE = Color.web("#334155");
    private static final Color COLOR_TEXT = Color.web("#0f172a");
    private static final Color COLOR_MARKER = Color.web("#7c2d12");
    private static final Color COLOR_PARTY = Color.web("#2563eb");
    private static final Color COLOR_FOREST = Color.web("#8fbc8f");
    private static final Color COLOR_MOUNTAINS = Color.web("#c0b5a5");
    private static final Color COLOR_WATER = Color.web("#8ecae6");
    private static final Color COLOR_DESERT = Color.web("#f3d37b");
    private static final Color COLOR_SWAMP = Color.web("#9aa66a");
    private static final Color COLOR_GRASSLAND = Color.web("#b7d98f");
    private static final String KEY_MAP_ID = "hex.mapId";
    private static final String KEY_ACTIVE_TOOL = "hex.activeTool";
    private static final String KEY_ACTIVE_TERRAIN = "hex.activeTerrain";
    private static final String KEY_HITS = "hex.hits";
    static final String KEY_TILE_DRAW_COUNT = "hex.tileDrawCount";
    private static final int HIT_Q = 0;
    private static final int HIT_R = 1;
    private static final int HIT_CENTER_X = 2;
    private static final int HIT_CENTER_Y = 3;
    private static final double TEXT_OFFSET_Y = 4.0;
    private static final double HIT_WIDTH = 78.0;
    private static final double HIT_HEIGHT = 62.0;
    private final VBox content = new VBox(16);
    private final Label titleLabel = label("", "title-large");
    private final Label subtitleLabel = label("", "text-secondary");
    private final Label statusLabel = label("", "text-muted");
    private final Label emptyLabel = label("Noch keine Hex-Karte geladen.", "text-secondary", "hex-map-empty");
    private final Label toolLabel = label("", "text-muted");
    private final StackPane canvasLayer = new StackPane();
    private final Canvas tileCanvas = new Canvas();
    private final Canvas partyCanvas = new Canvas();
    private Consumer<HexMapMainViewInputEvent> eventConsumer = ignored -> { };

    public HexMapMainView() {
        getStyleClass().addAll("surface-root", "hex-map-scroll");
        content.getStyleClass().add("hex-map-main");
        tileCanvas.getStyleClass().add("hex-map-canvas");
        tileCanvas.addEventHandler(MouseEvent.MOUSE_CLICKED, this::publishTile);
        partyCanvas.setMouseTransparent(true);
        canvasLayer.getChildren().addAll(tileCanvas, partyCanvas);
        content.getChildren().addAll(header(), emptyLabel, canvasLayer);
        setContent(content);
        setFitToWidth(true);
        setHbarPolicy(ScrollBarPolicy.AS_NEEDED);
    }

    public void bind(HexMapMainContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        show(contentModel.projectionProperty().get());
        drawTileLayer(contentModel.tileLayerProperty().get());
        drawPartyLayer(contentModel.partyTokenProperty().get());
        contentModel.projectionProperty().addListener((ignored, before, after) -> show(after));
        contentModel.tileLayerProperty().addListener((ignored, before, after) -> drawTileLayer(after));
        contentModel.partyTokenProperty().addListener((ignored, before, after) -> drawPartyLayer(after));
    }

    public void onViewInputEvent(Consumer<HexMapMainViewInputEvent> consumer) {
        eventConsumer = consumer == null ? ignored -> { } : consumer;
    }

    private void show(HexMapMainContentModel.Projection projection) {
        if (projection == null) {
            return;
        }
        tileCanvas.getProperties().put(KEY_MAP_ID, projection.selectedMapId());
        tileCanvas.getProperties().put(KEY_ACTIVE_TOOL, projection.activeToolKey());
        tileCanvas.getProperties().put(KEY_ACTIVE_TERRAIN, projection.activeTerrainKey());
        titleLabel.setText(projection.title());
        subtitleLabel.setText(projection.subtitle());
        statusLabel.setText(projection.status());
        toolLabel.setText("Werkzeug: " + projection.activeToolLabel()
                + " | Terrain: " + projection.activeTerrainLabel());
        emptyLabel.setText(projection.emptyText());
        emptyLabel.setVisible(!projection.mapLoaded());
        emptyLabel.setManaged(!projection.mapLoaded());
        canvasLayer.setVisible(projection.mapLoaded());
        canvasLayer.setManaged(projection.mapLoaded());
    }

    private Node header() {
        VBox header = new VBox(4, titleLabel, subtitleLabel, statusLabel, toolLabel);
        header.getStyleClass().add("hex-map-header");
        return header;
    }

    private void drawTileLayer(HexMapMainContentModel.TileLayer tileLayer) {
        if (tileLayer == null) {
            return;
        }
        canvasLayer.setPrefSize(tileLayer.canvasWidth(), tileLayer.canvasHeight());
        tileCanvas.setWidth(tileLayer.canvasWidth());
        tileCanvas.setHeight(tileLayer.canvasHeight());
        partyCanvas.setWidth(tileLayer.canvasWidth());
        partyCanvas.setHeight(tileLayer.canvasHeight());
        tileCanvas.getProperties().put(KEY_HITS, tileLayer.hits());
        drawTiles(
                tileCanvas.getGraphicsContext2D(),
                tileLayer.canvasWidth(),
                tileLayer.canvasHeight(),
                tileLayer.tiles());
        long nextDrawCount = rawLongProperty(tileCanvas, KEY_TILE_DRAW_COUNT) + 1L;
        tileCanvas.getProperties().put(KEY_TILE_DRAW_COUNT, nextDrawCount);
    }

    private void drawPartyLayer(HexMapMainContentModel.PartyTokenItem partyToken) {
        drawPartyLayer(
                partyCanvas.getGraphicsContext2D(),
                partyCanvas.getWidth(),
                partyCanvas.getHeight(),
                partyToken);
    }

    private static void drawTiles(
            GraphicsContext graphics,
            double canvasWidth,
            double canvasHeight,
            List<HexMapMainContentModel.TileItem> tiles
    ) {
        graphics.clearRect(0, 0, canvasWidth, canvasHeight);
        for (HexMapMainContentModel.TileItem tile : tiles) {
            drawTile(graphics, tile);
        }
    }

    private static void drawPartyLayer(
            GraphicsContext graphics,
            double canvasWidth,
            double canvasHeight,
            HexMapMainContentModel.PartyTokenItem partyToken
    ) {
        graphics.clearRect(0, 0, canvasWidth, canvasHeight);
        drawPartyToken(graphics, partyToken);
    }

    private static void drawTile(GraphicsContext graphics, HexMapMainContentModel.TileItem tile) {
        graphics.setFill(terrainColor(tile.terrainKey()));
        double[] xPoints = tile.rawXPoints();
        double[] yPoints = tile.rawYPoints();
        graphics.fillPolygon(xPoints, yPoints, 6);
        graphics.setStroke(tile.selected() ? COLOR_SELECTED_STROKE : COLOR_DEFAULT_STROKE);
        graphics.setLineWidth(tile.selected() ? 3.0 : 1.0);
        graphics.strokePolygon(xPoints, yPoints, 6);
        graphics.setFill(COLOR_TEXT);
        graphics.fillText(tile.coordinateText(), tile.centerX() - 14.0, tile.centerY() + TEXT_OFFSET_Y);
        if (!tile.markerText().isBlank()) {
            graphics.setFill(COLOR_MARKER);
            graphics.fillText("*", tile.centerX() + 20.0, tile.centerY() - 12.0);
        }
    }

    private static void drawPartyToken(
            GraphicsContext graphics,
            HexMapMainContentModel.PartyTokenItem partyToken
    ) {
        if (partyToken != null && partyToken.active()) {
            graphics.setFill(COLOR_PARTY);
            graphics.fillOval(partyToken.centerX() - 10.0, partyToken.centerY() - 24.0, 20.0, 20.0);
            graphics.setFill(Color.WHITE);
            graphics.fillText("P", partyToken.centerX() - 4.0, partyToken.centerY() - 10.0);
        }
    }

    private void publishTile(MouseEvent event) {
        Optional<double[]> hit = rawHit(event.getX(), event.getY());
        if (hit.isEmpty()) {
            return;
        }
        double[] hitData = hit.get();
        eventConsumer.accept(new HexMapMainViewInputEvent(
                rawLongProperty(tileCanvas, KEY_MAP_ID),
                (int) hitData[HIT_Q],
                (int) hitData[HIT_R],
                rawStringProperty(tileCanvas, KEY_ACTIVE_TOOL),
                rawStringProperty(tileCanvas, KEY_ACTIVE_TERRAIN)));
    }

    private Optional<double[]> rawHit(double x, double y) {
        for (double[] hit : rawHits()) {
            if (rawContains(hit, x, y)) {
                return Optional.of(hit);
            }
        }
        return Optional.empty();
    }

    private static boolean rawContains(double[] hit, double x, double y) {
        double normalizedX = Math.abs(x - hit[HIT_CENTER_X]) / (HIT_WIDTH / 2.0);
        double normalizedY = Math.abs(y - hit[HIT_CENTER_Y]) / (HIT_HEIGHT / 2.0);
        return normalizedX + normalizedY * 0.75 <= 1.0;
    }

    @SuppressWarnings({"unchecked", "PMD.LawOfDemeter"})
    private List<double[]> rawHits() {
        Object value = tileCanvas.getProperties().get(KEY_HITS);
        return value instanceof List<?> hits ? (List<double[]>) hits : List.of();
    }

    private static Color terrainColor(String terrainKey) {
        return switch (terrainKey == null ? "" : terrainKey.trim()) {
            case "FOREST" -> COLOR_FOREST;
            case "MOUNTAINS" -> COLOR_MOUNTAINS;
            case "WATER" -> COLOR_WATER;
            case "DESERT" -> COLOR_DESERT;
            case "SWAMP" -> COLOR_SWAMP;
            default -> COLOR_GRASSLAND;
        };
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private static long rawLongProperty(Node node, String key) {
        Object value = node.getProperties().get(key);
        return value instanceof Number number ? number.longValue() : 0L;
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    private static String rawStringProperty(Node node, String key) {
        Object value = node.getProperties().get(key);
        return value instanceof String text ? text : "";
    }

    private static Label label(String text, String... styleClasses) {
        Label label = new Label(text);
        label.getStyleClass().addAll(styleClasses);
        return label;
    }
}
