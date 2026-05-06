package src.view.leftbartabs.dungeoneditor;

import org.jspecify.annotations.Nullable;

public record DungeonEditorControlsViewInputEvent(
        @Nullable MapSelectionInput mapSelection,
        @Nullable MapEditorInput mapEditor,
        @Nullable String viewModeKey,
        @Nullable ToolInput toolInput,
        int projectionLevelShift,
        @Nullable OverlayInput overlay
) {

    public DungeonEditorControlsViewInputEvent {
        viewModeKey = viewModeKey == null ? null : viewModeKey.strip();
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
            String draftName
    ) {
        public MapEditorInput {
            draftName = draftName == null ? "" : draftName.strip();
        }
    }

    public record ToolInput(
            @Nullable ToolFamily requestedFamily,
            @Nullable String selectedToolLabel,
            boolean dismissRequested
    ) {
        public ToolInput {
            selectedToolLabel = selectedToolLabel == null ? null : selectedToolLabel.strip();
        }
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
