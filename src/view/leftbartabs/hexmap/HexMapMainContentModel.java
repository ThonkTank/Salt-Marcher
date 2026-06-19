package src.view.leftbartabs.hexmap;

import java.util.Comparator;
import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.hex.published.HexEditorSnapshot;

public final class HexMapMainContentModel {

    private static final String NO_MAP_TEXT = "Keine Hex-Karte geladen.";
    private static final String DEFAULT_TOOL = "SELECT";
    private static final String DEFAULT_TERRAIN = "GRASSLAND";
    private static final String DEFAULT_MARKER_TYPE = "LANDMARK";
    private static final double TILE_WIDTH = 78.0;
    private static final double TILE_HEIGHT = 62.0;
    private static final double HORIZONTAL_STEP = 58.0;
    private static final double VERTICAL_STEP = 48.0;
    private static final double CANVAS_MARGIN = 48.0;

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.initial());

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applySnapshot(HexEditorSnapshot snapshot) {
        projection.set(Projection.from(snapshot));
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
            String activeTerrainKey,
            String activeTerrainLabel,
            double canvasWidth,
            double canvasHeight,
            List<double[]> hits,
            List<TileItem> tiles
    ) {

        Projection {
            title = safeText(title);
            subtitle = safeText(subtitle);
            status = safeText(status);
            emptyText = safeText(emptyText);
            activeToolKey = safeText(activeToolKey);
            activeTerrainKey = safeText(activeTerrainKey);
            activeTerrainLabel = safeText(activeTerrainLabel);
            hits = hits == null ? List.of() : List.copyOf(hits);
            tiles = tiles == null ? List.of() : List.copyOf(tiles);
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
                    DEFAULT_TOOL,
                    DEFAULT_TERRAIN,
                    terrainLabel(DEFAULT_TERRAIN),
                    CANVAS_MARGIN * 2.0,
                    CANVAS_MARGIN * 2.0,
                    List.of(),
                    List.of());
        }

        static Projection from(HexEditorSnapshot snapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty(NO_MAP_TEXT)
                    : snapshot;
            return safeSnapshot.selectedMap()
                    .map(map -> loaded(safeSnapshot, map))
                    .orElseGet(() -> new Projection(
                            "Hex-Karte",
                            "Keine Karte ausgewaehlt",
                            safeSnapshot.statusText(),
                            NO_MAP_TEXT,
                            false,
                            0L,
                            0,
                            safeSnapshot.activeTool(),
                            safeSnapshot.activeTerrain(),
                            terrainLabel(safeSnapshot.activeTerrain()),
                            CANVAS_MARGIN * 2.0,
                            CANVAS_MARGIN * 2.0,
                            List.of(),
                            List.of()));
        }

        private static Projection loaded(
                HexEditorSnapshot snapshot,
                HexEditorSnapshot.MapSnapshot map
        ) {
            int radius = map.radius();
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
            List<double[]> hitItems = tileItems.stream()
                    .map(TileItem::hitData)
                    .toList();
            return new Projection(
                    map.displayName(),
                    "Radius " + radius + " | " + map.tileCount() + " Hexfelder",
                    snapshot.statusText(),
                    "",
                    true,
                    map.mapId().value(),
                    radius,
                    snapshot.activeTool(),
                    snapshot.activeTerrain(),
                    terrainLabel(snapshot.activeTerrain()),
                    canvasWidth,
                    canvasHeight,
                    hitItems,
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
            String markerText
    ) {

        TileItem {
            terrainKey = safeText(terrainKey);
            terrainLabel = safeText(terrainLabel);
            markerText = safeText(markerText);
        }

        static TileItem from(HexEditorSnapshot.TileSnapshot tile, int radius) {
            int row = tile.r() + radius;
            int column = tile.q() + radius + Math.floorDiv(tile.r() + radius, 2);
            String markers = markerText(tile.markers());
            return new TileItem(
                    tile.q(),
                    tile.r(),
                    CANVAS_MARGIN + Math.max(0, column) * HORIZONTAL_STEP,
                    CANVAS_MARGIN + Math.max(0, row) * VERTICAL_STEP,
                    safeKey(tile.terrain(), DEFAULT_TERRAIN),
                    HexMapMainContentModel.terrainLabel(tile.terrain()),
                    tile.selected(),
                    markers);
        }

        String coordinateText() {
            return q + "," + r;
        }

        double[] xPoints() {
            double halfWidth = TILE_WIDTH / 2.0;
            double quarterWidth = TILE_WIDTH / 4.0;
            return new double[] {
                    centerX - quarterWidth,
                    centerX + quarterWidth,
                    centerX + halfWidth,
                    centerX + quarterWidth,
                    centerX - quarterWidth,
                    centerX - halfWidth
            };
        }

        double[] yPoints() {
            double halfHeight = TILE_HEIGHT / 2.0;
            return new double[] {
                    centerY - halfHeight,
                    centerY - halfHeight,
                    centerY,
                    centerY + halfHeight,
                    centerY + halfHeight,
                    centerY
            };
        }

        double[] hitData() {
            return new double[] {q, r, centerX, centerY};
        }

        private static String markerText(List<HexEditorSnapshot.MarkerSnapshot> markers) {
            if (markers == null || markers.isEmpty()) {
                return "";
            }
            return markers.size() == 1
                    ? markerLabel(markers.getFirst().type())
                    : markers.size() + " Marker";
        }
    }

    static String terrainLabel(String terrain) {
        return switch (safeKey(terrain, DEFAULT_TERRAIN)) {
            case "FOREST" -> "Wald";
            case "MOUNTAINS" -> "Gebirge";
            case "WATER" -> "Wasser";
            case "DESERT" -> "Wueste";
            case "SWAMP" -> "Sumpf";
            default -> "Grasland";
        };
    }

    static String markerLabel(String markerType) {
        return switch (safeKey(markerType, DEFAULT_MARKER_TYPE)) {
            case "SETTLEMENT" -> "Siedlung";
            case "DANGER" -> "Gefahr";
            case "RESOURCE" -> "Ressource";
            default -> "Landmarke";
        };
    }

    private static String safeKey(String text, String fallback) {
        String safeText = safeText(text);
        return safeText.isBlank() ? fallback : safeText;
    }

    private static String safeText(String text) {
        return text == null ? "" : text.trim();
    }
}
