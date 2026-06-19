package src.domain.hex.published;

import java.util.List;
import java.util.Optional;

public record HexEditorSnapshot(
        List<MapSummary> catalog,
        Optional<MapSnapshot> selectedMap,
        List<TileSnapshot> tiles,
        Optional<TileDetails> selectedTile,
        String activeTool,
        String activeTerrain,
        String statusText,
        String failureText,
        String warningText
) {

    private static final String DEFAULT_TOOL = "SELECT";
    private static final String DEFAULT_TERRAIN = "GRASSLAND";
    private static final String DEFAULT_MARKER_TYPE = "LANDMARK";

    public HexEditorSnapshot {
        catalog = catalog == null ? List.of() : List.copyOf(catalog);
        selectedMap = selectedMap == null ? Optional.empty() : selectedMap;
        tiles = tiles == null ? List.of() : List.copyOf(tiles);
        selectedTile = selectedTile == null ? Optional.empty() : selectedTile;
        activeTool = defaultText(activeTool, DEFAULT_TOOL);
        activeTerrain = defaultText(activeTerrain, DEFAULT_TERRAIN);
        statusText = statusText == null ? "" : statusText.trim();
        failureText = failureText == null ? "" : failureText.trim();
        warningText = warningText == null ? "" : warningText.trim();
    }

    @Override
    public List<MapSummary> catalog() {
        return List.copyOf(catalog);
    }

    @Override
    public Optional<MapSnapshot> selectedMap() {
        return selectedMap;
    }

    @Override
    public List<TileSnapshot> tiles() {
        return List.copyOf(tiles);
    }

    @Override
    public Optional<TileDetails> selectedTile() {
        return selectedTile;
    }

    public static HexEditorSnapshot empty(String statusText) {
        return new HexEditorSnapshot(
                List.of(),
                Optional.empty(),
                List.of(),
                Optional.empty(),
                DEFAULT_TOOL,
                DEFAULT_TERRAIN,
                statusText,
                "",
                "");
    }

    public record MapSummary(HexMapId mapId, String displayName, int radius) {

        public MapSummary {
            mapId = mapId == null ? new HexMapId(0L) : mapId;
            displayName = displayName == null ? "" : displayName.trim();
            radius = Math.max(0, radius);
        }
    }

    public record MapSnapshot(
            HexMapId mapId,
            String displayName,
            int radius,
            int tileCount
    ) {

        public MapSnapshot {
            mapId = mapId == null ? new HexMapId(0L) : mapId;
            displayName = displayName == null ? "" : displayName.trim();
            radius = Math.max(0, radius);
            tileCount = Math.max(0, tileCount);
        }
    }

    public record TileSnapshot(
            int q,
            int r,
            String terrain,
            boolean selected,
            List<MarkerSnapshot> markers
    ) {

        public TileSnapshot {
            terrain = defaultText(terrain, DEFAULT_TERRAIN);
            markers = markers == null ? List.of() : List.copyOf(markers);
        }

        @Override
        public List<MarkerSnapshot> markers() {
            return List.copyOf(markers);
        }
    }

    public record TileDetails(
            int q,
            int r,
            String terrain,
            String elevation,
            String biome,
            String explorationState,
            String notes,
            List<MarkerSnapshot> markers
    ) {

        public TileDetails {
            terrain = defaultText(terrain, DEFAULT_TERRAIN);
            elevation = elevation == null ? "" : elevation.trim();
            biome = biome == null ? "" : biome.trim();
            explorationState = explorationState == null ? "" : explorationState.trim();
            notes = notes == null ? "" : notes.trim();
            markers = markers == null ? List.of() : List.copyOf(markers);
        }

        @Override
        public List<MarkerSnapshot> markers() {
            return List.copyOf(markers);
        }
    }

    public record MarkerSnapshot(
            HexMarkerId markerId,
            int q,
            int r,
            String name,
            String type,
            String note
    ) {

        public MarkerSnapshot {
            markerId = markerId == null ? new HexMarkerId(0L) : markerId;
            name = name == null ? "" : name.trim();
            type = defaultText(type, DEFAULT_MARKER_TYPE);
            note = note == null ? "" : note.trim();
        }
    }

    private static String defaultText(String text, String fallback) {
        String safeText = text == null ? "" : text.trim();
        return safeText.isBlank() ? fallback : safeText;
    }
}
