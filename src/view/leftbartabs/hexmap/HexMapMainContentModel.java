package src.view.leftbartabs.hexmap;

import java.util.Comparator;
import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.hex.published.HexEditorSnapshot;
import src.domain.hex.published.HexTravelSnapshot;

public final class HexMapMainContentModel {

    private static final String NO_MAP_TEXT = "Keine Hex-Karte geladen.";
    private static final String LARGE_MAP_TEXT = "Hex-Karte ist fuer die Canvas-Ansicht zu gross.";
    static final int MAX_RENDERED_RADIUS = 20;
    private static final double TILE_WIDTH = 78.0;
    private static final double TILE_HEIGHT = 62.0;
    private static final double HORIZONTAL_STEP = 58.0;
    private static final double VERTICAL_STEP = 48.0;
    private static final double CANVAS_MARGIN = 48.0;
    private static final double HALF_TILE_WIDTH = TILE_WIDTH / 2.0;
    private static final double QUARTER_TILE_WIDTH = TILE_WIDTH / 4.0;
    private static final double HALF_TILE_HEIGHT = TILE_HEIGHT / 2.0;

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.initial());
    private final ReadOnlyObjectWrapper<TileLayer> tileLayer =
            new ReadOnlyObjectWrapper<>(TileLayer.empty());
    private final ReadOnlyObjectWrapper<PartyTokenItem> partyToken =
            new ReadOnlyObjectWrapper<>(PartyTokenItem.none());
    private HexEditorSnapshot editorSnapshot = HexEditorSnapshot.empty(NO_MAP_TEXT);
    private HexTravelSnapshot travelSnapshot = HexTravelSnapshot.empty("Keine Hex-Reiseposition ausgewaehlt.");

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<TileLayer> tileLayerProperty() {
        return tileLayer.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<PartyTokenItem> partyTokenProperty() {
        return partyToken.getReadOnlyProperty();
    }

    void applySnapshot(HexEditorSnapshot snapshot) {
        editorSnapshot = snapshot == null ? HexEditorSnapshot.empty(NO_MAP_TEXT) : snapshot;
        refreshProjection();
    }

    void applyTravelSnapshot(HexTravelSnapshot snapshot) {
        travelSnapshot = snapshot == null
                ? HexTravelSnapshot.empty("Keine Hex-Reiseposition ausgewaehlt.")
                : snapshot;
        Projection nextProjection = projection.get().withTravel(travelSnapshot);
        projection.set(nextProjection);
        partyToken.set(nextProjection.partyToken());
    }

    private void refreshProjection() {
        Projection nextProjection = Projection.from(editorSnapshot, travelSnapshot);
        projection.set(nextProjection);
        tileLayer.set(TileLayer.from(editorSnapshot));
        partyToken.set(nextProjection.partyToken());
    }

    record Projection(
            String title,
            String subtitle,
            String status,
            String emptyText,
            boolean mapLoaded,
            long selectedMapId,
            int radius,
            String activeToolKey,
            String activeToolLabel,
            String activeTerrainKey,
            String activeTerrainLabel,
            PartyTokenItem partyToken
    ) {

        Projection {
            title = safeText(title);
            subtitle = safeText(subtitle);
            status = safeText(status);
            emptyText = safeText(emptyText);
            activeToolKey = safeText(activeToolKey);
            activeToolLabel = safeText(activeToolLabel);
            activeTerrainKey = safeText(activeTerrainKey);
            activeTerrainLabel = safeText(activeTerrainLabel);
            partyToken = partyToken == null ? PartyTokenItem.none() : partyToken;
        }

        static Projection initial() {
            return new Projection(
                    "Hex-Karte",
                    "Ueberlandkarte",
                    NO_MAP_TEXT,
                    NO_MAP_TEXT,
                    false,
                    0L,
                    0,
                    HexMapToolContentPartModel.SELECT,
                    HexMapToolContentPartModel.label(HexMapToolContentPartModel.SELECT),
                    HexMapVocabularyContentPartModel.DEFAULT_TERRAIN,
                    HexMapVocabularyContentPartModel.terrainLabel(HexMapVocabularyContentPartModel.DEFAULT_TERRAIN),
                    PartyTokenItem.none());
        }

        static Projection from(HexEditorSnapshot snapshot, HexTravelSnapshot travelSnapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty(NO_MAP_TEXT)
                    : snapshot;
            HexTravelSnapshot safeTravel = travelSnapshot == null
                    ? HexTravelSnapshot.empty("Keine Hex-Reiseposition ausgewaehlt.")
                    : travelSnapshot;
            return safeSnapshot.selectedMap()
                    .map(map -> loaded(safeSnapshot, safeTravel, map))
                    .orElseGet(() -> new Projection(
                            "Hex-Karte",
                            "Keine Karte ausgewaehlt",
                            safeSnapshot.statusText(),
                            NO_MAP_TEXT,
                            false,
                            0L,
                            0,
                            safeSnapshot.activeTool(),
                            toolLabel(safeSnapshot.activeTool()),
                            safeSnapshot.activeTerrain(),
                    HexMapVocabularyContentPartModel.terrainLabel(safeSnapshot.activeTerrain()),
                            PartyTokenItem.none()));
        }

        private static Projection loaded(
                HexEditorSnapshot snapshot,
                HexTravelSnapshot travelSnapshot,
                HexEditorSnapshot.MapSnapshot map
        ) {
            int radius = map.radius();
            boolean renderable = radius <= MAX_RENDERED_RADIUS;
            return new Projection(
                    map.displayName(),
                    "Radius " + radius + " | " + map.tileCount() + " Hexfelder",
                    renderable ? snapshot.statusText() : LARGE_MAP_TEXT,
                    renderable ? "" : LARGE_MAP_TEXT + " Maximaler Canvas-Radius: " + MAX_RENDERED_RADIUS + ".",
                    renderable,
                    map.mapId().value(),
                    radius,
                    snapshot.activeTool(),
                    toolLabel(snapshot.activeTool()),
                    snapshot.activeTerrain(),
                    HexMapVocabularyContentPartModel.terrainLabel(snapshot.activeTerrain()),
                    renderable ? PartyTokenItem.from(travelSnapshot, map.mapId().value(), radius) : PartyTokenItem.none());
        }

        Projection withTravel(HexTravelSnapshot travelSnapshot) {
            return new Projection(
                    title,
                    subtitle,
                    status,
                    emptyText,
                    mapLoaded,
                    selectedMapId,
                    radius,
                    activeToolKey,
                    activeToolLabel,
                    activeTerrainKey,
                    activeTerrainLabel,
                    mapLoaded ? PartyTokenItem.from(travelSnapshot, selectedMapId, radius) : PartyTokenItem.none());
        }
    }

    record TileLayer(
            boolean mapLoaded,
            double canvasWidth,
            double canvasHeight,
            List<double[]> hits,
            List<TileItem> tiles
    ) {

        TileLayer {
            hits = hits == null ? List.of() : List.copyOf(hits);
            tiles = tiles == null ? List.of() : List.copyOf(tiles);
        }

        static TileLayer empty() {
            return new TileLayer(false, CANVAS_MARGIN * 2.0, CANVAS_MARGIN * 2.0, List.of(), List.of());
        }

        static TileLayer from(HexEditorSnapshot snapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty(NO_MAP_TEXT)
                    : snapshot;
            return safeSnapshot.selectedMap()
                    .map(map -> loaded(safeSnapshot, map))
                    .orElseGet(TileLayer::empty);
        }

        private static TileLayer loaded(HexEditorSnapshot snapshot, HexEditorSnapshot.MapSnapshot map) {
            int radius = map.radius();
            if (radius > MAX_RENDERED_RADIUS) {
                return empty();
            }
            List<TileItem> tileItems = snapshot.tiles().stream()
                    .sorted(Comparator.comparingInt(HexEditorSnapshot.TileSnapshot::r)
                            .thenComparingInt(HexEditorSnapshot.TileSnapshot::q))
                    .map(tile -> TileItem.from(tile, radius))
                    .toList();
            double canvasWidth = tileItems.stream()
                    .mapToDouble(TileItem::centerX)
                    .max()
                    .orElse(CANVAS_MARGIN)
                    + CANVAS_MARGIN;
            double canvasHeight = tileItems.stream()
                    .mapToDouble(TileItem::centerY)
                    .max()
                    .orElse(CANVAS_MARGIN)
                    + CANVAS_MARGIN;
            return new TileLayer(
                    true,
                    canvasWidth,
                    canvasHeight,
                    tileItems.stream().map(TileItem::hitData).toList(),
                    tileItems);
        }
    }

    record TileItem(
            int q,
            int r,
            double centerX,
            double centerY,
            String terrainKey,
            String terrainLabel,
            boolean selected,
            String markerText,
            double[] xPoints,
            double[] yPoints
    ) {

        TileItem {
            terrainKey = safeText(terrainKey);
            terrainLabel = safeText(terrainLabel);
            markerText = safeText(markerText);
            xPoints = xPoints == null ? new double[0] : xPoints.clone();
            yPoints = yPoints == null ? new double[0] : yPoints.clone();
        }

        static TileItem from(HexEditorSnapshot.TileSnapshot tile, int radius) {
            Point center = center(tile.q(), tile.r(), radius);
            String markers = markerText(tile.markers());
            return new TileItem(
                    tile.q(),
                    tile.r(),
                    center.x(),
                    center.y(),
                    safeTerrainKey(tile.terrain()),
                    HexMapVocabularyContentPartModel.terrainLabel(tile.terrain()),
                    tile.selected(),
                    markers,
                    xPoints(center.x()),
                    yPoints(center.y()));
        }

        String coordinateText() {
            return q + "," + r;
        }

        @Override
        public double[] xPoints() {
            return xPoints.clone();
        }

        @Override
        public double[] yPoints() {
            return yPoints.clone();
        }

        double[] rawXPoints() {
            return xPoints;
        }

        double[] rawYPoints() {
            return yPoints;
        }

        double[] hitData() {
            return new double[] {q, r, centerX, centerY};
        }

        private static double[] xPoints(double centerX) {
            return new double[] {
                    centerX - QUARTER_TILE_WIDTH,
                    centerX + QUARTER_TILE_WIDTH,
                    centerX + HALF_TILE_WIDTH,
                    centerX + QUARTER_TILE_WIDTH,
                    centerX - QUARTER_TILE_WIDTH,
                    centerX - HALF_TILE_WIDTH
            };
        }

        private static double[] yPoints(double centerY) {
            return new double[] {
                    centerY - HALF_TILE_HEIGHT,
                    centerY - HALF_TILE_HEIGHT,
                    centerY,
                    centerY + HALF_TILE_HEIGHT,
                    centerY + HALF_TILE_HEIGHT,
                    centerY
            };
        }

        private static String markerText(List<HexEditorSnapshot.MarkerSnapshot> markers) {
            if (markers == null || markers.isEmpty()) {
                return "";
            }
            return markers.size() == 1
                    ? HexMapVocabularyContentPartModel.markerLabel(markers.getFirst().type())
                    : markers.size() + " Marker";
        }

    }

    record PartyTokenItem(boolean active, double centerX, double centerY) {

        static PartyTokenItem none() {
            return new PartyTokenItem(false, 0.0, 0.0);
        }

        static PartyTokenItem from(HexTravelSnapshot travelSnapshot, long selectedMapId, int radius) {
            if (travelSnapshot == null || !travelSnapshot.active() || travelSnapshot.mapId() != selectedMapId) {
                return none();
            }
            Point center = center(travelSnapshot.q(), travelSnapshot.r(), radius);
            return new PartyTokenItem(
                    true,
                    center.x(),
                    center.y());
        }
    }

    private record Point(double x, double y) {
    }

    static String toolLabel(String tool) {
        return HexMapToolContentPartModel.label(tool);
    }

    private static String safeText(String text) {
        return text == null ? "" : text.trim();
    }

    private static String safeTerrainKey(String text) {
        String safeText = safeText(text);
        return safeText.isBlank() ? HexMapVocabularyContentPartModel.DEFAULT_TERRAIN : safeText;
    }

    private static Point center(int q, int r, int radius) {
        int row = r + radius;
        int column = q + radius + Math.floorDiv(r + radius, 2);
        return new Point(
                CANVAS_MARGIN + Math.max(0, column) * HORIZONTAL_STEP,
                CANVAS_MARGIN + Math.max(0, row) * VERTICAL_STEP);
    }
}
