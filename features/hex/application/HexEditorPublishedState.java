package features.hex.application;

import features.hex.api.HexEditorMode;
import features.hex.api.HexEditorModel;
import features.hex.api.HexEditorSnapshot;
import features.hex.api.HexTerrain;
import platform.state.PublishedState;
import platform.ui.UiDispatcher;

public final class HexEditorPublishedState {

    private final PublishedState<HexEditorSnapshot> state;
    private final HexEditorModel model;
    private ToolIntent toolIntent = ToolIntent.initial();

    public HexEditorPublishedState(UiDispatcher dispatcher) {
        state = new PublishedState<>(HexEditorSnapshot.empty("No Hex map loaded."), dispatcher);
        model = new HexEditorModel(state::current, state::subscribe);
    }

    public HexEditorModel model() {
        return model;
    }

    synchronized ToolIntent currentToolIntent() {
        return toolIntent;
    }

    synchronized void publishImmediateToolIntent(HexEditorMode activeTool, HexTerrain activeTerrain) {
        HexEditorSnapshot base = safeSnapshot(state.current());
        toolIntent = new ToolIntent(toolIntent.revision() + 1L, activeTool, activeTerrain);
        state.publish(withToolIntent(
                base,
                toolIntent,
                "Hex editor tool selected.",
                "",
                ""));
    }

    synchronized void publish(HexEditorSnapshot snapshot) {
        state.publish(withToolIntent(safeSnapshot(snapshot), toolIntent));
    }

    synchronized void publishCompletion(HexEditorSnapshot snapshot, long submittedToolRevision) {
        HexEditorSnapshot safeSnapshot = safeSnapshot(snapshot);
        if (toolIntent.revision() == submittedToolRevision) {
            toolIntent = new ToolIntent(
                    toolIntent.revision(),
                    safeSnapshot.activeTool(),
                    safeSnapshot.activeTerrain());
            state.publish(safeSnapshot);
            return;
        }
        state.publish(withToolIntent(safeSnapshot, toolIntent));
    }

    private static HexEditorSnapshot safeSnapshot(HexEditorSnapshot snapshot) {
        return snapshot == null ? HexEditorSnapshot.empty("No Hex map loaded.") : snapshot;
    }

    private static HexEditorSnapshot withToolIntent(HexEditorSnapshot snapshot, ToolIntent intent) {
        return withToolIntent(
                snapshot,
                intent,
                snapshot.statusText(),
                snapshot.failureText(),
                snapshot.warningText());
    }

    private static HexEditorSnapshot withToolIntent(
            HexEditorSnapshot snapshot,
            ToolIntent intent,
            String statusText,
            String failureText,
            String warningText
    ) {
        return new HexEditorSnapshot(
                snapshot.catalog(),
                snapshot.selectedMap(),
                snapshot.tiles(),
                snapshot.selectedTile(),
                intent.activeTool(),
                intent.activeTerrain(),
                statusText,
                failureText,
                warningText);
    }

    record ToolIntent(long revision, HexEditorMode activeTool, HexTerrain activeTerrain) {

        ToolIntent {
            if (revision < 0L) {
                throw new IllegalArgumentException("tool intent revision must not be negative");
            }
            activeTool = activeTool == null ? HexEditorMode.defaultMode() : activeTool;
            activeTerrain = activeTerrain == null ? HexTerrain.defaultTerrain() : activeTerrain;
        }

        static ToolIntent initial() {
            return new ToolIntent(0L, HexEditorMode.defaultMode(), HexTerrain.defaultTerrain());
        }
    }
}
