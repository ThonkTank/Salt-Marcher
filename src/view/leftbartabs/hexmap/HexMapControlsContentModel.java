package src.view.leftbartabs.hexmap;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.hex.published.HexEditorSnapshot;

public final class HexMapControlsContentModel {

    static final String VALUE_DELIMITER = "\u001f";
    private static final List<ToolOption> TOOL_OPTIONS = List.of(
            new ToolOption("SELECT", "Auswahl"),
            new ToolOption("PAINT_TERRAIN", "Terrain"),
            new ToolOption("PLACE_MARKER", "Marker"));
    private static final List<TerrainOption> TERRAIN_OPTIONS = List.of(
            new TerrainOption("GRASSLAND", "Grasland"),
            new TerrainOption("FOREST", "Wald"),
            new TerrainOption("MOUNTAINS", "Gebirge"),
            new TerrainOption("WATER", "Wasser"),
            new TerrainOption("DESERT", "Wueste"),
            new TerrainOption("SWAMP", "Sumpf"));
    private static final List<MarkerTypeOption> MARKER_TYPE_OPTIONS = List.of(
            new MarkerTypeOption("SETTLEMENT", "Siedlung"),
            new MarkerTypeOption("LANDMARK", "Landmarke"),
            new MarkerTypeOption("DANGER", "Gefahr"),
            new MarkerTypeOption("RESOURCE", "Ressource"));

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.initial());

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    Projection currentProjection() {
        return projection.get();
    }

    void applySnapshot(HexEditorSnapshot snapshot) {
        projection.set(Projection.from(snapshot));
    }

    record Projection(
            List<MapOption> maps,
            long selectedMapId,
            String selectedMapName,
            int selectedMapRadius,
            boolean mapLoaded,
            List<ToolOption> tools,
            String activeToolKey,
            List<TerrainOption> terrains,
            String activeTerrainKey,
            List<MarkerTypeOption> markerTypes,
            List<MarkerOption> selectedTileMarkers,
            boolean tileSelected,
            int selectedQ,
            int selectedR,
            String selectedTileText,
            String statusText,
            String failureText,
            String warningText
    ) {

        Projection {
            maps = maps == null ? List.of() : List.copyOf(maps);
            selectedMapName = safeText(selectedMapName);
            tools = tools == null ? List.of() : List.copyOf(tools);
            activeToolKey = safeText(activeToolKey);
            terrains = terrains == null ? List.of() : List.copyOf(terrains);
            activeTerrainKey = safeText(activeTerrainKey);
            markerTypes = markerTypes == null ? List.of() : List.copyOf(markerTypes);
            selectedTileMarkers = selectedTileMarkers == null ? List.of() : List.copyOf(selectedTileMarkers);
            selectedTileText = safeText(selectedTileText);
            statusText = safeText(statusText);
            failureText = safeText(failureText);
            warningText = safeText(warningText);
        }

        static Projection initial() {
            return new Projection(
                    List.of(),
                    0L,
                    "",
                    2,
                    false,
                    TOOL_OPTIONS,
                    "SELECT",
                    TERRAIN_OPTIONS,
                    "GRASSLAND",
                    MARKER_TYPE_OPTIONS,
                    List.of(),
                    false,
                    0,
                    0,
                    "Kein Hex ausgewaehlt",
                    "Keine Hex-Karte geladen.",
                    "",
                    "");
        }

        static Projection from(HexEditorSnapshot snapshot) {
            HexEditorSnapshot safeSnapshot = snapshot == null
                    ? HexEditorSnapshot.empty("Keine Hex-Karte geladen.")
                    : snapshot;
            long selectedMapId = safeSnapshot.selectedMap()
                    .map(map -> map.mapId().value())
                    .orElse(0L);
            String selectedMapName = safeSnapshot.selectedMap()
                    .map(HexEditorSnapshot.MapSnapshot::displayName)
                    .orElse("");
            int selectedMapRadius = safeSnapshot.selectedMap()
                    .map(HexEditorSnapshot.MapSnapshot::radius)
                    .orElse(2);
            boolean tileSelected = safeSnapshot.selectedTile().isPresent();
            int selectedQ = safeSnapshot.selectedTile()
                    .map(HexEditorSnapshot.TileDetails::q)
                    .orElse(0);
            int selectedR = safeSnapshot.selectedTile()
                    .map(HexEditorSnapshot.TileDetails::r)
                    .orElse(0);
            List<MarkerOption> markers = safeSnapshot.selectedTile().stream()
                    .flatMap(tile -> tile.markers().stream())
                    .map(MarkerOption::from)
                    .toList();
            return new Projection(
                    safeSnapshot.catalog().stream().map(MapOption::from).toList(),
                    selectedMapId,
                    selectedMapName,
                    selectedMapRadius,
                    safeSnapshot.selectedMap().isPresent(),
                    TOOL_OPTIONS,
                    safeSnapshot.activeTool(),
                    TERRAIN_OPTIONS,
                    safeSnapshot.activeTerrain(),
                    MARKER_TYPE_OPTIONS,
                    markers,
                    tileSelected,
                    selectedQ,
                    selectedR,
                    tileSelected ? "Hex " + selectedQ + "," + selectedR : "Kein Hex ausgewaehlt",
                    safeSnapshot.statusText(),
                    safeSnapshot.failureText(),
                    safeSnapshot.warningText());
        }

        List<String> mapValues() {
            return maps.stream()
                    .map(option -> option.mapId() + VALUE_DELIMITER + option.toString())
                    .toList();
        }

        List<String> terrainValues() {
            return terrains.stream()
                    .map(option -> option.key() + VALUE_DELIMITER + option.label())
                    .toList();
        }

        List<String> markerTypeValues() {
            return markerTypes.stream()
                    .map(option -> option.key() + VALUE_DELIMITER + option.label())
                    .toList();
        }

        List<String> markerValues() {
            return java.util.stream.Stream.concat(
                            java.util.stream.Stream.of(markerValue(0L, "Neuer Marker", "LANDMARK", "")),
                            selectedTileMarkers.stream().map(Projection::markerValue))
                    .toList();
        }

        private static String markerValue(MarkerOption option) {
            return markerValue(option.markerId(), option.name(), option.typeKey(), option.note());
        }

        private static String markerValue(long markerId, String name, String type, String note) {
            return markerId + VALUE_DELIMITER + safeText(name) + VALUE_DELIMITER
                    + safeText(type) + VALUE_DELIMITER + safeText(note);
        }
    }

    record MapOption(long mapId, String label, int radius) {

        MapOption {
            label = safeText(label);
        }

        static MapOption from(HexEditorSnapshot.MapSummary summary) {
            return new MapOption(
                    summary.mapId().value(),
                    summary.displayName(),
                    summary.radius());
        }

        @Override
        public String toString() {
            return label.isBlank() ? "Karte " + mapId : label;
        }
    }

    record ToolOption(String key, String label) {

        ToolOption {
            key = safeText(key);
            label = safeText(label);
        }

        @Override
        public String toString() {
            return label;
        }
    }

    record TerrainOption(String key, String label) {

        TerrainOption {
            key = safeText(key);
            label = safeText(label);
        }

        @Override
        public String toString() {
            return label;
        }
    }

    record MarkerTypeOption(String key, String label) {

        MarkerTypeOption {
            key = safeText(key);
            label = safeText(label);
        }

        @Override
        public String toString() {
            return label;
        }
    }

    record MarkerOption(long markerId, String label, String name, String typeKey, String note) {

        MarkerOption {
            label = safeText(label);
            name = safeText(name);
            typeKey = safeText(typeKey);
            note = safeText(note);
        }

        static MarkerOption from(HexEditorSnapshot.MarkerSnapshot marker) {
            return new MarkerOption(
                    marker.markerId().value(),
                    marker.name(),
                    marker.name(),
                    marker.type(),
                    marker.note());
        }

        @Override
        public String toString() {
            return label;
        }
    }

    private static String safeText(String text) {
        return text == null ? "" : text.trim();
    }
}
