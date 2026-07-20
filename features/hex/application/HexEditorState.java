package features.hex.application;

import features.hex.api.HexEditorMode;
import features.hex.api.HexTerrain;
import features.hex.domain.map.HexCoordinate;
import features.hex.domain.map.HexMap;
import features.hex.domain.map.HexMapSummary;
import java.util.List;
import java.util.Optional;

public record HexEditorState(
        List<HexMapSummary> catalog,
        Optional<HexMap> selectedMap,
        Optional<HexCoordinate> selectedTile,
        HexEditorMode activeMode,
        HexTerrain activeTerrain,
        String statusText,
        String failureText,
        String warningText
) {

    public HexEditorState {
        catalog = catalog == null ? List.of() : List.copyOf(catalog);
        selectedMap = selectedMap == null ? Optional.empty() : selectedMap;
        selectedTile = selectedTile == null ? Optional.empty() : selectedTile;
        activeMode = activeMode == null ? HexEditorMode.defaultMode() : activeMode;
        activeTerrain = activeTerrain == null ? HexTerrain.defaultTerrain() : activeTerrain;
        statusText = statusText == null ? "" : statusText.trim();
        failureText = failureText == null ? "" : failureText.trim();
        warningText = warningText == null ? "" : warningText.trim();
    }

    public static HexEditorState empty(String statusText) {
        return new HexEditorState(
                List.of(),
                Optional.empty(),
                Optional.empty(),
                HexEditorMode.defaultMode(),
                HexTerrain.defaultTerrain(),
                statusText,
                "",
                "");
    }

    public HexEditorState withStatus(String statusText) {
        return new HexEditorState(
                catalog,
                selectedMap,
                selectedTile,
                activeMode,
                activeTerrain,
                statusText,
                "",
                "");
    }

    public HexEditorState withFailure(String failureText) {
        return new HexEditorState(
                catalog,
                selectedMap,
                selectedTile,
                activeMode,
                activeTerrain,
                "",
                failureText,
                "");
    }

    public HexEditorState withActiveTool(HexEditorMode mode, HexTerrain terrain) {
        return new HexEditorState(
                catalog,
                selectedMap,
                selectedTile,
                mode,
                terrain,
                statusText,
                failureText,
                warningText);
    }

    @Override
    public List<HexMapSummary> catalog() {
        return List.copyOf(catalog);
    }

    @Override
    public Optional<HexMap> selectedMap() {
        return selectedMap;
    }

    @Override
    public Optional<HexCoordinate> selectedTile() {
        return selectedTile;
    }
}
