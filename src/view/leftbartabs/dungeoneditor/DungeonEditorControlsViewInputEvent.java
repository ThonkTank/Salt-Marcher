package src.view.leftbartabs.dungeoneditor;

import org.jspecify.annotations.Nullable;

public record DungeonEditorControlsViewInputEvent(
        @Nullable MapSelectionInput mapSelection,
        @Nullable MapEditorInput mapEditor,
        @Nullable ViewMode viewMode,
        @Nullable ToolInput toolInput,
        int projectionLevelShift,
        @Nullable OverlayInput overlay
) {

    public DungeonEditorControlsViewInputEvent {
    }

    enum ViewMode {
        GRID,
        GRAPH
    }

    enum Tool {
        SELECT,
        ROOM_PAINT,
        ROOM_DELETE,
        WALL_CREATE,
        WALL_DELETE,
        DOOR_CREATE,
        DOOR_DELETE,
        CORRIDOR_CREATE,
        CORRIDOR_DELETE,
        STAIR_CREATE,
        STAIR_DELETE,
        TRANSITION_CREATE,
        TRANSITION_DELETE
    }

    enum ToolFamily {
        ROOM,
        WALL,
        DOOR,
        CORRIDOR,
        STAIR,
        TRANSITION
    }

    public record MapSelectionInput(long selectedMapIdValue) {
        public MapSelectionInput {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
        }
    }

    public record MapEditorInput(
            boolean openCreateRequested,
            boolean openRenameRequested,
            boolean openDeleteRequested,
            boolean dismissRequested,
            boolean submitRequested,
            boolean confirmDeleteRequested,
            long selectedMapIdValue,
            String draftName
    ) {
        public MapEditorInput {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            draftName = draftName == null ? "" : draftName.strip();
        }
    }

    public record ToolInput(
            @Nullable ToolFamily requestedFamily,
            @Nullable Tool selectedTool,
            boolean dismissRequested
    ) {
    }

    public record OverlayInput(
            String modeKey,
            int levelRange,
            double opacity,
            String selectedLevelsText
    ) {
        public OverlayInput {
            modeKey = modeKey == null ? "" : modeKey;
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevelsText = selectedLevelsText == null ? "" : selectedLevelsText.strip();
        }
    }
}
