package src.features.dungeon.runtime;

import java.util.Optional;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;

public interface DungeonEditorControlOperations {
    void setViewMode(DungeonEditorViewMode viewMode);

    void setTool(DungeonEditorTool tool);

    void cancelActivePreviewSession();

    void shiftProjectionLevel(int levelShift);

    void setOverlay(DungeonEditorOverlaySettings overlaySettings);

    void scrollSelection(int levelDelta);

    static Optional<ViewModeSelection> parseViewModeKey(String viewModeKey) {
        if (viewModeKey == null || viewModeKey.isBlank()) {
            return Optional.empty();
        }
        return switch (viewModeKey.strip()) {
            case "Grid", "GRID" -> Optional.of(new ViewModeSelection("Grid", DungeonEditorViewMode.GRID));
            case "Graph", "GRAPH" -> Optional.of(new ViewModeSelection("Graph", DungeonEditorViewMode.GRAPH));
            default -> Optional.empty();
        };
    }

    static Optional<ToolSelection> parseToolKey(String toolKey) {
        if (toolKey == null || toolKey.isBlank()) {
            return Optional.empty();
        }
        try {
            DungeonEditorTool tool = DungeonEditorTool.valueOf(toolKey.strip());
            return Optional.of(new ToolSelection(tool.name(), tool));
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    record ViewModeSelection(String displayKey, DungeonEditorViewMode viewMode) {
        public ViewModeSelection {
            displayKey = displayKey == null || displayKey.isBlank() ? "Grid" : displayKey;
            viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        }

        public void applyTo(DungeonEditorControlOperations controlOperations) {
            controlOperations.setViewMode(viewMode);
        }
    }

    record ToolSelection(String key, DungeonEditorTool tool) {
        public ToolSelection {
            tool = tool == null ? DungeonEditorTool.SELECT : tool;
            key = key == null || key.isBlank() ? tool.name() : key;
        }

        public void applyTo(DungeonEditorControlOperations controlOperations) {
            controlOperations.setTool(tool);
        }
    }
}
