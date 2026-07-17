package features.dungeon.adapter.javafx.editor;

import features.dungeon.api.DungeonEditorTool;
import features.dungeon.api.DungeonEditorViewMode;

record DungeonEditorControlsInput(
        MapInput map,
        ToolInput tool,
        ProjectionInput projection,
        OverlayInput overlay
) {

    DungeonEditorControlsInput {
        map = map == null ? MapInput.none() : map;
        tool = tool == null ? ToolInput.none() : tool;
        projection = projection == null ? ProjectionInput.none() : projection;
        overlay = overlay == null ? OverlayInput.none() : overlay;
    }

    static DungeonEditorControlsInput none() {
        return new DungeonEditorControlsInput(
                MapInput.none(),
                ToolInput.none(),
                ProjectionInput.none(),
                OverlayInput.none());
    }

    record MapInput(
            long selectedMapIdValue,
            String editorDraftName,
            boolean editorInputObserved,
            boolean createControlActivated,
            boolean renameControlActivated,
            boolean deleteControlActivated,
            boolean dismissControlActivated,
            boolean submitControlActivated,
            boolean confirmDeleteControlActivated,
            boolean reloadControlActivated
    ) {
        MapInput {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            editorDraftName = editorDraftName == null ? "" : editorDraftName;
        }

        static MapInput none() {
            return new MapInput(0L, "", false, false, false, false, false, false, false, false);
        }

    }

    record ToolInput(
            String requestedFamilyKey,
            DungeonEditorTool selectedTool,
            String selectedOptionKey,
            boolean dismissControlActivated
    ) {
        ToolInput {
            requestedFamilyKey = requestedFamilyKey == null ? "" : requestedFamilyKey.strip();
            selectedOptionKey = selectedOptionKey == null ? "" : selectedOptionKey.strip();
        }

        static ToolInput none() {
            return new ToolInput("", null, "", false);
        }
    }

    record ProjectionInput(
            DungeonEditorViewMode viewMode,
            int levelShift
    ) {
        static ProjectionInput none() {
            return new ProjectionInput(null, 0);
        }

        String viewModeKey() {
            if (viewMode == DungeonEditorViewMode.GRAPH) {
                return "Graph";
            }
            if (viewMode == DungeonEditorViewMode.GRID) {
                return "Grid";
            }
            return "";
        }
    }

    record OverlayInput(
            OverlayMode mode,
            int levelRange,
            double opacity,
            String selectedLevelsText
    ) {
        OverlayInput {
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevelsText = selectedLevelsText == null ? "" : selectedLevelsText.strip();
        }

        static OverlayInput none() {
            return new OverlayInput(null, 0, 0.0, "");
        }
    }

    enum OverlayMode {
        OFF,
        NEARBY,
        SELECTED
    }
}
