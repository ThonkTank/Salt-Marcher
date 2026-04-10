package features.world.hexmap.editorcontrols.input;

import features.world.hexmap.model.HexMap;
import features.world.hexmap.model.HexTerrainType;
import features.world.hexmap.ui.editor.controls.EditorTool;
import javafx.scene.Node;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;

@SuppressWarnings("unused")
public record ComposeInput(
        Consumer<EditorTool> onToolChanged,
        Consumer<Long> onMapSelected,
        Consumer<Node> onNewMapRequested,
        Consumer<MapActionRequestInput> onEditMapRequested
) {

    public ComposeInput {
        onToolChanged = onToolChanged == null ? ignored -> { } : onToolChanged;
        onMapSelected = onMapSelected == null ? ignored -> { } : onMapSelected;
        onNewMapRequested = onNewMapRequested == null ? ignored -> { } : onNewMapRequested;
        onEditMapRequested = onEditMapRequested == null ? ignored -> { } : onEditMapRequested;
    }

    public record MapActionRequestInput(HexMap map, Node anchor) {
    }

    public record ComposedEditorControlsInput(
            Node controlsContent,
            Node stateContent,
            Supplier<EditorTool> activeToolSupplier,
            Supplier<HexTerrainType> activeTerrainTypeSupplier,
            Consumer<List<HexMap>> setMapsAction,
            Consumer<Long> selectMapAction
    ) {
    }
}
