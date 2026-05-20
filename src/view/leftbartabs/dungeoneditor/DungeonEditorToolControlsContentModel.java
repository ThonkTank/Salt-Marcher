package src.view.leftbartabs.dungeoneditor;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;

final class DungeonEditorToolControlsContentModel {

    private final ReadOnlyObjectWrapper<ToolProjection> toolProjection =
            new ReadOnlyObjectWrapper<>(ToolProjection.initial());

    ReadOnlyObjectProperty<ToolProjection> toolProjectionProperty() {
        return toolProjection.getReadOnlyProperty();
    }

    void showTool(String tool) {
        ToolPaletteUiState palette = toolProjection.get().toolPaletteUiState();
        toolProjection.set(new ToolProjection(tool, palette));
    }

    void showToolFamily(@Nullable ToolFamily family) {
        showToolPalette(family == null ? ToolPaletteUiState.closed() : ToolPaletteUiState.open(family));
    }

    private void showToolPalette(ToolPaletteUiState toolPaletteUiState) {
        String selectedTool = toolProjection.get().selectedTool();
        toolProjection.set(new ToolProjection(selectedTool, toolPaletteUiState));
    }

    record ToolProjection(
            String selectedTool,
            ToolPaletteUiState toolPaletteUiState
    ) {
        ToolProjection {
            selectedTool = selectedTool == null || selectedTool.isBlank()
                    ? ToolCatalog.DEFAULT_TOOL_LABEL
                    : selectedTool;
            toolPaletteUiState = toolPaletteUiState == null
                    ? ToolPaletteUiState.closed()
                    : toolPaletteUiState;
        }

        static ToolProjection initial() {
            return new ToolProjection(ToolCatalog.DEFAULT_TOOL_LABEL, ToolPaletteUiState.closed());
        }
    }

    enum ToolFamily {
        NONE,
        ROOM,
        WALL,
        DOOR,
        CORRIDOR,
        STAIR,
        TRANSITION
    }

    record ToolPaletteUiState(
            boolean visible,
            ToolFamily family,
            String primaryToolLabel,
            String secondaryToolLabel,
            String primaryToolKey,
            String secondaryToolKey
    ) {
        ToolPaletteUiState {
            family = family == null ? ToolFamily.NONE : family;
            primaryToolLabel = primaryToolLabel == null ? "" : primaryToolLabel;
            secondaryToolLabel = secondaryToolLabel == null ? "" : secondaryToolLabel;
            primaryToolKey = primaryToolKey == null ? "" : primaryToolKey;
            secondaryToolKey = secondaryToolKey == null ? "" : secondaryToolKey;
        }

        static ToolPaletteUiState closed() {
            return new ToolPaletteUiState(false, ToolFamily.NONE, "", "", "", "");
        }

        static ToolPaletteUiState open(ToolFamily family) {
            ToolPalette palette = ToolCatalog.paletteFor(family);
            if (family == null || family == ToolFamily.NONE || !palette.available()) {
                return closed();
            }
            return new ToolPaletteUiState(
                    true,
                    family,
                    palette.primaryToolLabel(),
                    palette.secondaryToolLabel(),
                    palette.primaryToolKey(),
                    palette.secondaryToolKey());
        }
    }
}
