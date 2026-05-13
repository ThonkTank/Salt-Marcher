package src.view.leftbartabs.dungeoneditor;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

final class DungeonEditorToolControlsContentModel {

    private final ReadOnlyObjectWrapper<ToolProjection> toolProjection =
            new ReadOnlyObjectWrapper<>(ToolProjection.initial());

    ReadOnlyObjectProperty<ToolProjection> toolProjectionProperty() {
        return toolProjection.getReadOnlyProperty();
    }

    void showTool(String tool) {
        DungeonEditorContributionModel.ToolPaletteUiState palette = toolProjection.get().toolPaletteUiState();
        toolProjection.set(new ToolProjection(tool, palette));
    }

    void showToolPalette(DungeonEditorContributionModel.ToolPaletteUiState toolPaletteUiState) {
        String selectedTool = toolProjection.get().selectedTool();
        toolProjection.set(new ToolProjection(selectedTool, toolPaletteUiState));
    }

    record ToolProjection(
            String selectedTool,
            DungeonEditorContributionModel.ToolPaletteUiState toolPaletteUiState
    ) {
        ToolProjection {
            selectedTool = selectedTool == null || selectedTool.isBlank()
                    ? ToolCatalog.DEFAULT_TOOL_LABEL
                    : selectedTool;
            toolPaletteUiState = toolPaletteUiState == null
                    ? DungeonEditorContributionModel.ToolPaletteUiState.closed()
                    : toolPaletteUiState;
        }

        static ToolProjection initial() {
            return new ToolProjection(ToolCatalog.DEFAULT_TOOL_LABEL, DungeonEditorContributionModel.ToolPaletteUiState.closed());
        }
    }
}
