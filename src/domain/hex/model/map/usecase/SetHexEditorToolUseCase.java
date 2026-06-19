package src.domain.hex.model.map.usecase;

import java.util.Objects;
import src.domain.hex.model.map.HexEditorMode;
import src.domain.hex.model.map.HexEditorState;
import src.domain.hex.model.map.HexTerrain;

public final class SetHexEditorToolUseCase {

    private final LoadHexEditorStateUseCase loadEditorStateUseCase;

    public SetHexEditorToolUseCase(LoadHexEditorStateUseCase loadEditorStateUseCase) {
        this.loadEditorStateUseCase = Objects.requireNonNull(
                loadEditorStateUseCase,
                "loadEditorStateUseCase");
    }

    public void execute(String modeName, String terrainName) {
        HexEditorState loaded = loadEditorStateUseCase.currentState();
        loadEditorStateUseCase.publish(
                loaded.withActiveTool(mode(modeName), terrain(terrainName)).withStatus("Hex editor tool selected."));
    }

    private static HexEditorMode mode(String modeName) {
        return modeName == null || modeName.isBlank() ? HexEditorMode.defaultMode() : HexEditorMode.valueOf(modeName);
    }

    private static HexTerrain terrain(String terrainName) {
        return terrainName == null || terrainName.isBlank() ? HexTerrain.defaultTerrain() : HexTerrain.valueOf(terrainName);
    }
}
