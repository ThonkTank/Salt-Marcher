package features.hex.api;

import java.util.List;
import java.util.Optional;

public record HexEditorSnapshot(
        List<MapSummary> catalog,
        Optional<MapSnapshot> selectedMap,
        List<TileSnapshot> tiles,
        Optional<TileDetails> selectedTile,
        HexEditorMode activeTool,
        HexTerrain activeTerrain,
        String statusText,
        String failureText,
        String warningText
) {

    public HexEditorSnapshot {
        catalog = catalog == null ? List.of() : List.copyOf(catalog);
        selectedMap = selectedMap == null ? Optional.empty() : selectedMap;
        tiles = tiles == null ? List.of() : List.copyOf(tiles);
        selectedTile = selectedTile == null ? Optional.empty() : selectedTile;
        activeTool = activeTool == null ? HexEditorMode.defaultMode() : activeTool;
        activeTerrain = activeTerrain == null ? HexTerrain.defaultTerrain() : activeTerrain;
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
                HexEditorMode.defaultMode(),
                HexTerrain.defaultTerrain(),
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
            HexTerrain terrain,
            boolean selected,
            List<MarkerSnapshot> markers
    ) {

        public TileSnapshot {
            terrain = terrain == null ? HexTerrain.defaultTerrain() : terrain;
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
            HexTerrain terrain,
            String elevation,
            String biome,
            String explorationState,
            String notes,
            List<MarkerSnapshot> markers
    ) {

        public TileDetails {
            terrain = terrain == null ? HexTerrain.defaultTerrain() : terrain;
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
            HexMarkerKind type,
            String note
    ) {

        public MarkerSnapshot {
            markerId = markerId == null ? new HexMarkerId(0L) : markerId;
            name = name == null ? "" : name.trim();
            type = type == null ? HexMarkerKind.LANDMARK : type;
            note = note == null ? "" : note.trim();
        }
    }

}
